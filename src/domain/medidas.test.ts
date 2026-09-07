import { describe, expect, it } from 'vitest'
import {
  CLAVES_DE_MEDIDA,
  MEDIDAS,
  MEDIDA_POR_CLAVE,
  esClaveDeMedida,
  revisarMedidas,
  type MedidasDelCuerpo,
} from './medidas'
import { ESTATURA_MAXIMA_CM, ESTATURA_MINIMA_CM } from './patrones/estatura'
import { esqueletoDe, JUEGOS, type Sexo } from './patrones/juegoDeHuesos'
import { puntoDeHueso, resolver } from './patrones/esqueleto'

/** El torso del atlas —de la cadera al hombro— en fracción de su estatura. */
function torsoSobreEstatura(sexo: Sexo): number {
  const esq = resolver({}, [0, 0, 0], [0, 0, 0], esqueletoDe(sexo))
  const hombro = puntoDeHueso(esq, 'brazoD', 0)[1]
  const cadera = puntoDeHueso(esq, 'musloD', 0)[1]
  return (hombro - cadera) / JUEGOS[sexo].coronilla
}

/** Una toma completa y plausible: la persona de 1,75 del atlas, medida con cinta. */
const OCHO: MedidasDelCuerpo = {
  tibiaCm: 38.5,
  femurCm: 47.3,
  torsoCm: 51.4,
  antebrazoCm: 23.1,
  brazoCm: 31.1,
  anchoClavicularCm: 38.8,
  cinturaCm: 82,
  caderasCm: 96,
}

describe('el catálogo de las ocho medidas', () => {
  it('son ocho, ni una más, y en el orden en que las pregunta la ficha', () => {
    expect(CLAVES_DE_MEDIDA).toEqual([
      'tibiaCm',
      'femurCm',
      'torsoCm',
      'antebrazoCm',
      'brazoCm',
      'anchoClavicularCm',
      'cinturaCm',
      'caderasCm',
    ])
    expect(CLAVES_DE_MEDIDA).toHaveLength(8)
    expect(new Set(CLAVES_DE_MEDIDA).size).toBe(8)
    expect(MEDIDAS.map((m) => m.clave)).toEqual([...CLAVES_DE_MEDIDA])
    expect(Object.keys(MEDIDA_POR_CLAVE)).toHaveLength(8)
  })

  it('cada una lleva etiqueta, cómo se mide, unidad y un rango con sentido', () => {
    for (const m of MEDIDAS) {
      expect(m.etiqueta.length, m.clave).toBeGreaterThan(2)
      // Sin el «cómo se mide», cada persona pone la cinta donde quiere y el número no
      // significa nada. Es la mitad del dato.
      expect(m.comoSeMide.length, m.clave).toBeGreaterThan(20)
      expect(m.unidad, m.clave).toBe('cm')
      expect(m.minimo, m.clave).toBeGreaterThan(0)
      expect(m.maximo, m.clave).toBeGreaterThan(m.minimo)
      // El sufijo de la clave dice la unidad, y la unidad es la misma para las ocho.
      expect(m.clave.endsWith('Cm'), m.clave).toBe(true)
    }
  })

  it('los rangos de las seis longitudes cubren a las dos anatomías del atlas en los dos extremos de estatura', () => {
    // De aquí salen los números, y por eso se comprueban contra su origen en vez de
    // copiarlos: el segmento del atlas escalado a 130 y a 220 cm tiene que caber.
    const razon = (largo: number, coronilla: number) => largo / coronilla
    const casos: [string, number, number][] = [
      ['tibiaCm', razon(JUEGOS.mujer.tibia, JUEGOS.mujer.coronilla), razon(JUEGOS.hombre.tibia, JUEGOS.hombre.coronilla)],
      ['femurCm', razon(JUEGOS.mujer.femur, JUEGOS.mujer.coronilla), razon(JUEGOS.hombre.femur, JUEGOS.hombre.coronilla)],
      ['antebrazoCm', razon(JUEGOS.mujer.antebrazo, JUEGOS.mujer.coronilla), razon(JUEGOS.hombre.antebrazo, JUEGOS.hombre.coronilla)],
      ['brazoCm', razon(JUEGOS.mujer.humero, JUEGOS.mujer.coronilla), razon(JUEGOS.hombre.humero, JUEGOS.hombre.coronilla)],
      [
        'anchoClavicularCm',
        razon(2 * JUEGOS.mujer.medioHombro, JUEGOS.mujer.coronilla),
        razon(2 * JUEGOS.hombre.medioHombro, JUEGOS.hombre.coronilla),
      ],
      // El torso es de la cadera al HOMBRO, y la altura del hombro no está en el juego:
      // se mide sobre el esqueleto resuelto, que es como se midió contra los atlas.
      ['torsoCm', torsoSobreEstatura('mujer'), torsoSobreEstatura('hombre')],
    ]
    for (const [clave, menor, mayor] of casos) {
      const def = MEDIDA_POR_CLAVE[clave as keyof typeof MEDIDA_POR_CLAVE]
      // El más bajo posible con la anatomía más corta y un 15 % menos de segmento.
      const suelo = Math.min(menor, mayor) * ESTATURA_MINIMA_CM * 0.85
      // El más alto con la anatomía más larga y un 15 % más.
      const techo = Math.max(menor, mayor) * ESTATURA_MAXIMA_CM * 1.15
      expect(def.minimo, `${clave}: el mínimo deja fuera a alguien real`).toBeLessThanOrEqual(suelo)
      expect(def.maximo, `${clave}: el máximo deja fuera a alguien real`).toBeGreaterThanOrEqual(techo)
    }
  })

  it('reconoce las ocho claves y ninguna otra', () => {
    for (const c of CLAVES_DE_MEDIDA) expect(esClaveDeMedida(c)).toBe(true)
    // Las de `perimetros`, que es de donde vendría la confusión.
    for (const c of ['Cintura', 'Cadera', 'Glúteos', 'cintura', 'tibia', 'femur']) {
      expect(esClaveDeMedida(c), c).toBe(false)
    }
  })
})

describe('revisar unas medidas', () => {
  it('una toma completa y plausible pasa sin un reparo', () => {
    expect(revisarMedidas(OCHO)).toEqual([])
  })

  it('una toma a medias pasa: lo que falta, falta, y no se rellena', () => {
    expect(revisarMedidas({ femurCm: 47.3 })).toEqual([])
    expect(revisarMedidas({})).toEqual([])
    // Un campo del formulario en blanco llega como `undefined`, y un hueco no es un error.
    expect(revisarMedidas({ femurCm: 47.3, cinturaCm: undefined })).toEqual([])
  })

  it('una medida fuera de rango se rechaza, y el mensaje dice cuál, cuánto y entre qué', () => {
    // El fémur en milímetros: el error de unidad que estos rangos existen para cazar.
    const reparos = revisarMedidas({ ...OCHO, femurCm: 473 })
    expect(reparos).toHaveLength(1)
    expect(reparos[0].campo).toBe('femurCm')
    expect(reparos[0].motivo).toContain('Fémur')
    expect(reparos[0].motivo).toContain('473')
    expect(reparos[0].motivo).toContain('27')
    expect(reparos[0].motivo).toContain('69')
    // Y por abajo igual: la coma corrida.
    expect(revisarMedidas({ femurCm: 4.73 })).toHaveLength(1)
    // Justo en los bordes SÍ entra: el rango incluye sus extremos.
    expect(revisarMedidas({ femurCm: 27 })).toEqual([])
    expect(revisarMedidas({ femurCm: 69 })).toEqual([])
  })

  it('una clave que no es de las ocho se rechaza, aunque el número esté bien', () => {
    // Es lo que impide que vuelva a pasar lo de `perimetros`: «Cadera» y «Glúteos»
    // conviviendo como dos columnas del mismo dato porque nadie dijo que no.
    const reparos = revisarMedidas({ femurCm: 47.3, gluteosCm: 96 })
    expect(reparos).toHaveLength(1)
    expect(reparos[0].campo).toBe('gluteosCm')
    expect(reparos[0].motivo).toContain('gluteosCm')
    // Y la variante que de verdad se escribiría a mano: la etiqueta de la pantalla vieja.
    expect(revisarMedidas({ Cintura: 82 })).toHaveLength(1)
  })

  it('lo que no es un número se rechaza, y se dice de qué medida', () => {
    for (const valor of ['82', null, NaN, Infinity, {}]) {
      const reparos = revisarMedidas({ cinturaCm: valor })
      expect(reparos, String(valor)).toHaveLength(1)
      expect(reparos[0].campo).toBe('cinturaCm')
      expect(reparos[0].motivo).toContain('Cintura')
    }
  })

  it('devuelve TODOS los reparos, no el primero', () => {
    // Quien rellena ocho campos merece verlos marcados de una vez.
    const reparos = revisarMedidas({ femurCm: 473, cinturaCm: 5, gluteosCm: 96 })
    expect(reparos.map((r) => r.campo).sort()).toEqual(['cinturaCm', 'femurCm', 'gluteosCm'])
  })

  it('lo que ni siquiera es un objeto se rechaza entero', () => {
    for (const valor of [null, undefined, 42, 'ocho', [1, 2]]) {
      const reparos = revisarMedidas(valor)
      expect(reparos, String(valor)).toHaveLength(1)
      expect(reparos[0].campo).toBe('')
    }
  })
})
