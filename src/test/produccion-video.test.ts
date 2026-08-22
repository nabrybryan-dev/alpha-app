import { describe, expect, it } from 'vitest'
import {
  aSlug,
  construirBloqueDeConsistencia,
  construirPaquete,
  construirPromptImagen,
  construirPromptVariante,
  construirPromptVideo,
  duracionTotal,
  MARCA,
  normalizarBrief,
  repartirTiempos,
} from '../../scripts/produccion-video.mjs'

// Estos tests protegen lo único que no se puede comprobar mirando el resultado: que
// el prompt SALGA COMPLETO. Un prompt al que le falta el bloque de consistencia no
// da error, da una imagen bonita con otra paleta y otra persona — y eso solo se
// descubre después de gastar cuota de la suscripción generando cuatro planos que no
// casan entre sí. Por eso se afirma sobre el contenido del prompt, no sobre que la
// función devuelva algo.

const BRIEF_MINIMO = {
  titulo: 'Prueba de paquete',
  objetivo: 'Comprobar el generador.',
  planos: [{ descripcion: 'Un plano cualquiera.' }],
}

describe('aSlug', () => {
  it('quita tildes, mayúsculas y signos', () => {
    expect(aSlug('Cómo se ajusta tu carga — semana 3')).toBe('como-se-ajusta-tu-carga-semana-3')
  })

  it('no deja guiones colgando en los extremos', () => {
    expect(aSlug('  ¡Ánimo!  ')).toBe('animo')
  })
})

describe('normalizarBrief', () => {
  it('rellena los opcionales y numera los planos sin id', () => {
    const brief = normalizarBrief({
      ...BRIEF_MINIMO,
      planos: [{ descripcion: 'Uno.' }, { descripcion: 'Dos.' }],
    })
    expect(brief.planos.map((p) => p.id)).toEqual(['01', '02'])
    expect(brief.planos[0].segundos).toBe(4)
    expect(brief.formato).toBe('reel-vertical')
    expect(brief.slug).toBe('prueba-de-paquete')
    expect(brief.marca).toEqual(MARCA)
  })

  it('deja sobrescribir la marca sin perder el resto de la identidad', () => {
    const brief = normalizarBrief({ ...BRIEF_MINIMO, marca: { acento: '#00ff00' } })
    expect(brief.marca.acento).toBe('#00ff00')
    expect(brief.marca.fondo).toBe(MARCA.fondo)
  })

  // Cada uno de estos lanza en vez de producir un paquete a medias: un brief
  // incompleto que "funciona" se detecta cuando ya has pegado el prompt.
  it('exige título y objetivo', () => {
    expect(() => normalizarBrief({ objetivo: 'x', planos: [] })).toThrow(/titulo/)
    expect(() => normalizarBrief({ titulo: 'x', planos: [] })).toThrow(/objetivo/)
  })

  it('exige al menos un plano', () => {
    expect(() => normalizarBrief({ titulo: 'x', objetivo: 'y', planos: [] })).toThrow(/al menos un plano/)
  })

  it('exige descripción en cada plano y la nombra por su id', () => {
    expect(() =>
      normalizarBrief({ ...BRIEF_MINIMO, planos: [{ id: '07', segundos: 2 }] }),
    ).toThrow(/"07".*descripcion/)
  })

  it('rechaza dos planos con el mismo id', () => {
    expect(() =>
      normalizarBrief({
        ...BRIEF_MINIMO,
        planos: [
          { id: '01', descripcion: 'Uno.' },
          { id: '01', descripcion: 'Dos.' },
        ],
      }),
    ).toThrow(/mismo id/)
  })

  it('rechaza duraciones que no son números positivos', () => {
    expect(() =>
      normalizarBrief({ ...BRIEF_MINIMO, planos: [{ descripcion: 'Uno.', segundos: 0 }] }),
    ).toThrow(/duración inválida/)
  })

  it('rechaza un formato que no existe, y dice cuáles hay', () => {
    expect(() => normalizarBrief({ ...BRIEF_MINIMO, formato: 'imax' })).toThrow(/reel-vertical/)
  })
})

describe('reparto de tiempos', () => {
  it('encadena los tramos sin huecos ni solapes', () => {
    const { planos } = normalizarBrief({
      ...BRIEF_MINIMO,
      planos: [
        { descripcion: 'Uno.', segundos: 3 },
        { descripcion: 'Dos.', segundos: 5 },
        { descripcion: 'Tres.', segundos: 2 },
      ],
    })
    expect(repartirTiempos(planos)).toEqual([
      { id: '01', desde: 0, hasta: 3 },
      { id: '02', desde: 3, hasta: 8 },
      { id: '03', desde: 8, hasta: 10 },
    ])
    expect(duracionTotal(planos)).toBe(10)
  })
})

describe('bloque de consistencia', () => {
  it('lleva la paleta y el encuadre del formato pedido', () => {
    const bloque = construirBloqueDeConsistencia(MARCA, 'horizontal')
    expect(bloque).toContain(MARCA.acento)
    expect(bloque).toContain(MARCA.fondo)
    expect(bloque).toContain('16:9')
    expect(bloque).toContain('1920x1080')
  })
})

describe('construirPromptImagen', () => {
  const contexto = { marca: MARCA, formato: 'reel-vertical' }

  it('empieza SIEMPRE por el bloque de consistencia', () => {
    const { planos } = normalizarBrief(BRIEF_MINIMO)
    const prompt = construirPromptImagen(planos[0], contexto)
    expect(prompt.startsWith(construirBloqueDeConsistencia(MARCA, 'reel-vertical'))).toBe(true)
  })

  // Nano Banana escribe texto dentro de la imagen si se lo dejas, y sale mal
  // escrito. El texto se sobreimprime en el montaje, nunca se genera.
  it('pide dejar aire y prohíbe escribir el texto dentro de la imagen', () => {
    const { planos } = normalizarBrief({
      ...BRIEF_MINIMO,
      planos: [{ descripcion: 'Uno.', textoEnPantalla: 'Marca la serie' }],
    })
    const prompt = construirPromptImagen(planos[0], contexto)
    expect(prompt).toContain('NO escribas el texto dentro de la imagen')
    expect(prompt).toContain('Marca la serie')
  })

  it('prohíbe todo texto cuando el plano no lleva rótulo', () => {
    const { planos } = normalizarBrief(BRIEF_MINIMO)
    expect(construirPromptImagen(planos[0], contexto)).toContain('Sin ningún texto dentro de la imagen')
  })

  it('añade los negativos propios del plano', () => {
    const { planos } = normalizarBrief({
      ...BRIEF_MINIMO,
      planos: [{ descripcion: 'Uno.', evitar: ['espejos', 'gente de fondo'] }],
    })
    expect(construirPromptImagen(planos[0], contexto)).toContain('espejos; gente de fondo')
  })
})

describe('continuidad entre planos', () => {
  it('no propone variante para el primer plano', () => {
    const { planos } = normalizarBrief(BRIEF_MINIMO)
    expect(construirPromptVariante(planos[0], null)).toBeNull()
  })

  it('referencia el plano anterior y fija lo que no debe cambiar', () => {
    const { planos } = normalizarBrief({
      ...BRIEF_MINIMO,
      planos: [{ descripcion: 'Uno.' }, { descripcion: 'Dos.' }],
    })
    const variante = construirPromptVariante(planos[1], planos[0])
    expect(variante).toContain('PLANO 01')
    expect(variante).toContain('Mantén idénticos')
  })
})

describe('construirPromptVideo', () => {
  it('lleva la duración del plano y su movimiento', () => {
    const { planos } = normalizarBrief({
      ...BRIEF_MINIMO,
      planos: [{ descripcion: 'Uno.', segundos: 6, movimiento: 'travelling lateral' }],
    })
    const prompt = construirPromptVideo(planos[0])
    expect(prompt).toContain('6 s')
    expect(prompt).toContain('travelling lateral')
    expect(prompt).toContain('sin cortes')
  })
})

describe('construirPaquete', () => {
  const paquete = construirPaquete(
    {
      titulo: 'Paquete de ejemplo',
      objetivo: 'Probar el markdown.',
      planos: [
        { descripcion: 'Uno.', segundos: 3, locucion: 'Primera frase.', textoEnPantalla: 'Hola' },
        { descripcion: 'Dos.', segundos: 5, locucion: 'Segunda frase.' },
      ],
    },
    '2026-08-22',
  )

  it('nombra los archivos de cada plano con el slug del vídeo', () => {
    expect(paquete).toContain('paquete-de-ejemplo-plano-01.png')
    expect(paquete).toContain('paquete-de-ejemplo-plano-02.mp4')
  })

  it('marca los tramos de tiempo acumulados', () => {
    expect(paquete).toContain('00:00–00:03')
    expect(paquete).toContain('00:03–00:08')
  })

  it('recoge la locución en un guion aparte', () => {
    expect(paquete).toContain('## Guion de locución')
    expect(paquete).toContain('Segunda frase.')
  })

  // La app maneja datos de salud reales: el recordatorio va en el propio paquete,
  // porque quien lo usa está pegando prompts, no leyendo CLAUDE.md.
  it('recuerda no meter a ninguna asesorada real', () => {
    expect(paquete).toContain('Ninguna cara, medida, nombre ni captura de una asesorada real.')
  })

  it('propaga el error del brief en vez de escribir un paquete a medias', () => {
    expect(() => construirPaquete({ titulo: 'x' }, '2026-08-22')).toThrow(/objetivo/)
  })
})
