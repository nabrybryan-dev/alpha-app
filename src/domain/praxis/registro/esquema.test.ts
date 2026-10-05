import { describe, expect, it } from 'vitest'
import { armarContextoParaModelo, armarMensajeUsuario, PROMPT_SISTEMA } from './prompt.ts'
import { ESQUEMA_REGISTRO, esSubcadenaLiteral, validarExtraccion } from './esquema.ts'
import type { ContextoRegistro } from './tipos.ts'

const raiz = (o: Record<string, unknown>) => ({
  intencion: ['entreno'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null,
  clinico: { hay: false, cita: null }, fuera_de_alcance: false, ...o,
})
const bloque = (o: Record<string, unknown>) => ({
  n_series: null, ordinal: null, reps: '12', es_calentamiento: false, extra: [], senales: [],
  reserva: { tipo: 'no_dicha', cita: null },
  carga: { tipo: 'absoluta', valor: '40', unidad_cita: null, discos: null, delta: null, por: 'no_dicho' }, ...o,
})
const ejercicio = (b: unknown) => ({ ejercicio: { cita: 'sentadilla', ref_sugerida: null, implicito: 'no' }, bloques: [b], cuando: null })

describe('esquema JSON', () => {
  it('salida corta: ningún objeto admite extras y solo se exige lo esencial (el resto se omite)', () => {
    const exigidos: string[] = []
    const revisar = (nodo: unknown, ruta: string) => {
      if (Array.isArray(nodo)) return nodo.forEach((x, i) => revisar(x, `${ruta}[${i}]`))
      if (typeof nodo !== 'object' || nodo === null) return
      const o = nodo as Record<string, unknown>
      if (o.type === 'object') {
        expect(o.additionalProperties, ruta).toBe(false)
        const req = o.required as string[]
        for (const k of req) expect(Object.keys(o.properties as object), `${ruta}.${k}`).toContain(k)
        exigidos.push(...req.map((k) => `${ruta}.${k}`))
      }
      for (const [k, v] of Object.entries(o)) revisar(v, `${ruta}.${k}`)
    }
    revisar(ESQUEMA_REGISTRO, 'raiz')
    // La lista completa: cada campo obligatorio nuevo vuelve a alargar la salida de TODOS los mensajes.
    expect(exigidos.sort()).toEqual([
      'raiz.intencion',
      'raiz.properties.aclaracion.motivo',
      'raiz.properties.clinico.hay',
      'raiz.properties.comida.properties.items.items.alimento',
      'raiz.properties.comida.properties.plato.items.alimento',
      'raiz.properties.correccion.objetivo',
      'raiz.properties.entreno.items.ejercicio',
      'raiz.properties.entreno.items.properties.bloques.items.properties.carga.properties.discos.items.cantidad',
      'raiz.properties.entreno.items.properties.bloques.items.properties.carga.properties.discos.items.peso',
      'raiz.properties.entreno.items.properties.bloques.items.properties.carga.tipo',
      'raiz.properties.entreno.items.properties.bloques.items.properties.extra.items.reps',
      'raiz.properties.entreno.items.properties.bloques.items.properties.reserva.tipo',
      'raiz.properties.entreno.items.properties.ejercicio.implicito',
      'raiz.properties.vida.properties.agua.cantidad',
      'raiz.properties.vida.properties.dia_de_entreno.estado',
      'raiz.properties.vida.properties.escalas.items.campo',
      'raiz.properties.vida.properties.escalas.items.cita',
      'raiz.properties.vida.properties.tiempos.items.actividad',
      'raiz.properties.vida.properties.tiempos.items.duracion',
    ].sort())
  })
  it('sin uniones con null: lo no dicho se omite, no se escribe null', () => {
    expect(JSON.stringify(ESQUEMA_REGISTRO)).not.toContain('"type":"null"')
    expect(ESQUEMA_REGISTRO.required).toEqual(['intencion'])
  })
  it('el prompt manda omitir y sus ejemplos no traen null, listas vacías ni neutros', () => {
    expect(PROMPT_SISTEMA).toMatch(/LO NO DICHO SE OMITE/)
    const ejemplos = PROMPT_SISTEMA.split('Frase: ').slice(1).map((x) => x.split('\n')[1] ?? '')
    expect(ejemplos.length).toBeGreaterThan(20)
    for (const e of ejemplos) expect(e, e).not.toMatch(/:null|:\[\]|:false|no_dicho|no_dicha/)
  })
  it('una salida corta (campos omitidos) llega al validador igual que una larga', () => {
    const frase = 'sentadilla 60 por 10'
    const larga = validarExtraccion(frase, raiz({ entreno: [ejercicio(bloque({ reps: '10', carga: { tipo: 'absoluta', valor: '60', unidad_cita: null, discos: null, delta: null, por: 'no_dicho' } }))] }))
    const corta = validarExtraccion(frase, {
      intencion: ['entreno'],
      entreno: [{ ejercicio: { cita: 'sentadilla', implicito: 'no' }, bloques: [{ reps: '10', carga: { tipo: 'absoluta', valor: '60' } }] }],
    })
    expect(corta.extraccion).toEqual(larga.extraccion)
    expect(corta.citasInvalidas).toEqual([])
  })
  it('sin implicito y con nombre, el ejercicio se da por nombrado; sin nombre queda desconocido', () => {
    const a = validarExtraccion('hice sentadilla', { intencion: ['entreno'], entreno: [{ ejercicio: { cita: 'sentadilla' } }] })
    expect(a.extraccion.entreno[0].ejercicio.implicito).toBe('no')
    const b = validarExtraccion('otra igual', { intencion: ['entreno'], entreno: [{ ejercicio: {} }] })
    expect(b.extraccion.entreno[0].ejercicio.implicito).toBe('desconocido')
  })
  it('es serializable y cabe en una línea de comandos', () => {
    expect(JSON.stringify(ESQUEMA_REGISTRO).length).toBeLessThan(12_000)
  })
  it('el prompt lleva la regla de las citas y no menciona confianza como salida', () => {
    expect(PROMPT_SISTEMA).toMatch(/CITAS LITERALES/)
    expect(PROMPT_SISTEMA).not.toMatch(/"confianza"/)
  })
})

describe('validador de citas', () => {
  it('una cita es literal aunque cambien mayúsculas, tildes y puntuación', () => {
    expect(esSubcadenaLiteral('Le metí 40 kilos, 12 en la sentadilla', 'le meti 40 kilos')).toBe(true)
    expect(esSubcadenaLiteral('10, 8 y 6 repeticiones', '10, 8')).toBe(true)
    expect(esSubcadenaLiteral('le metí 40 kilos', '45')).toBe(false)
    expect(esSubcadenaLiteral('le metí 40 kilos', '')).toBe(false)
  })

  it('una carga que el modelo se inventó queda ausente y se anota', () => {
    const frase = 'hice sentadilla con doce'
    const { extraccion, citasInvalidas } = validarExtraccion(frase, raiz({ entreno: [ejercicio(bloque({ reps: 'doce', carga: { tipo: 'absoluta', valor: '40', unidad_cita: null, discos: null, delta: null, por: 'no_dicho' } }))] }))
    const b = extraccion.entreno[0].bloques[0]
    expect(b.carga.valor).toBeNull()
    expect(b.carga.tipo).toBe('no_dicha')
    expect(b.reps).toBe('doce')
    expect(citasInvalidas[0]).toMatch(/carga\.valor: «40»/)
  })

  it('un ejercicio inventado queda sin cita', () => {
    const { extraccion, citasInvalidas } = validarExtraccion('hice 40 por 12', raiz({ entreno: [ejercicio(bloque({}))] }))
    expect(extraccion.entreno[0].ejercicio.cita).toBeNull()
    expect(citasInvalidas.some((c) => c.includes('ejercicio.cita'))).toBe(true)
  })

  it('tolera campos ausentes y basura sin lanzar', () => {
    expect(() => validarExtraccion('hola', null)).not.toThrow()
    expect(() => validarExtraccion('hola', { entreno: 'no soy una lista', vida: 3 })).not.toThrow()
    const { extraccion } = validarExtraccion('hola', {})
    expect(extraccion.entreno).toEqual([])
    expect(extraccion.clinico).toEqual({ hay: false, cita: null })
  })

  it('los enums desconocidos caen al valor neutro, no pasan', () => {
    const { extraccion } = validarExtraccion('40 por 12', raiz({ entreno: [ejercicio(bloque({ carga: { tipo: 'inventado', valor: '40', por: 'raro' } }))] }))
    expect(extraccion.entreno[0].bloques[0].carga.tipo).toBe('no_dicha')
    expect(extraccion.entreno[0].bloques[0].carga.por).toBe('no_dicho')
  })
})

describe('contexto que viaja al modelo', () => {
  const ctx: ContextoRegistro = {
    ahora: '2026-09-28T18:40:00-05:00', microciclo: { id: 'M12' }, sesionHoyId: 'S1',
    sesiones: [{
      id: 'S1', nombre: 'PIERNA',
      ejercicios: [{
        id: 'pa1', nombre: 'SENTADILLA TRASERA', sesionId: 'S1', sets: 4, unidad: 'kg',
        seriesPrescritas: [{ orden: 1, reps: 12, cargaKg: 60 }], cargaKg: 60, repsDiana: 12, series: [],
      }],
    }],
    pantalla: { ejercicioId: null }, ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: 20 },
  }
  it('NO lleva la pauta, las cargas prescritas ni el RIR objetivo', () => {
    const texto = armarMensajeUsuario(ctx, 'hice sentadilla')
    expect(texto).not.toMatch(/60|seriesPrescritas|rirObjetivo|pauta/)
    expect(texto).toContain('SENTADILLA TRASERA')
  })
  it('usa alias efímeros y no el id del ejercicio; solo dice si conoce la barra', () => {
    const c = armarContextoParaModelo(ctx) as { sesion: { ejercicios: { ref: string }[] }; barra_conocida: boolean }
    expect(c.sesion.ejercicios[0].ref).toBe('e1')
    expect(JSON.stringify(c)).not.toContain('pa1')
    expect(c.barra_conocida).toBe(true)
  })
})
