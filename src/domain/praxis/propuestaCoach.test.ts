import { describe, expect, it } from 'vitest'
import { filtroDeRiesgo } from './riesgo'
import {
  PLAZO_HORAS_PROPUESTA,
  RESPUESTA_AUTOMATICA_ENCENDIDA,
  armarPropuestaDeCarga,
  armarVoyAEscribirte,
  debeContestarPraxis,
  estaVencida,
  preguntaPedirSerie,
  recalcularEnConsola,
  type FilaBajarCarga,
} from './propuestaCoach'

const serie = (orden: number, cargaKg: number, reps?: number, rir?: number) => ({ orden, cargaKg, reps, rir })
const base = { ejercicioId: 'press-banca', microcicloId: 'mc-1', cansancio: 'algo' as const, motivo: 'cansancio' as const }
const HORA = 3_600_000
const t0 = Date.parse('2026-10-21T08:00:00.000Z')

function filaDeCarga(extra: Partial<FilaBajarCarga> = {}): FilaBajarCarga {
  const r = armarPropuestaDeCarga({ ...base, series: [serie(1, 100, 8, 1)] })
  if (r.tipo !== 'fila') throw new Error('se esperaba una fila')
  return { ...r.fila, ...extra }
}

describe('armarPropuestaDeCarga', () => {
  it('con una serie completa devuelve la fila con el cálculo y la regla sin firmar', () => {
    const r = armarPropuestaDeCarga({ ...base, series: [serie(1, 100, 8, 1)] })
    expect(r.tipo).toBe('fila')
    if (r.tipo !== 'fila') return
    expect(r.fila).toMatchObject({
      tipo: 'bajar_carga', ejercicioId: 'press-banca', microcicloId: 'mc-1', cansancio: 'algo', motivo: 'cansancio',
      serieCargaKg: 100, serieReps: 8, serieRir: 1, rirObjetivo: 2, cargaPropuestaKg: 95, razonSinCalculo: null, reglaFirmada: false,
    })
    expect(r.fila.unRmKg).toBeGreaterThan(100)
  })

  it('sin series pide una serie: no manda fila al coach', () => {
    expect(armarPropuestaDeCarga({ ...base, series: [] })).toEqual({ tipo: 'pedir_serie' })
  })

  it('sin reps pide una serie', () => {
    expect(armarPropuestaDeCarga({ ...base, series: [serie(1, 100, undefined, 1)] })).toEqual({ tipo: 'pedir_serie' })
  })

  it('sin RIR pide una serie', () => {
    expect(armarPropuestaDeCarga({ ...base, series: [serie(1, 100, 8, undefined)] })).toEqual({ tipo: 'pedir_serie' })
  })

  it('el dolor deriva a salud y nunca llega al coach como carga', () => {
    expect(armarPropuestaDeCarga({ ...base, motivo: 'dolor', series: [serie(1, 100, 8, 1)] })).toEqual({ tipo: 'derivar_a_salud' })
    // aun sin serie, el dolor manda: no se pide una serie para bajar una carga por dolor
    expect(armarPropuestaDeCarga({ ...base, motivo: 'dolor', series: [] })).toEqual({ tipo: 'derivar_a_salud' })
  })

  it('con serie completa pero fuera de la tabla, la fila va sin número y con la razón', () => {
    const r = armarPropuestaDeCarga({ ...base, series: [serie(1, 100, 40, 1)] })
    expect(r.tipo).toBe('fila')
    if (r.tipo !== 'fila') return
    expect(r.fila.cargaPropuestaKg).toBeNull()
    expect(r.fila.razonSinCalculo).toBe('fuera_de_tabla')
    expect(r.fila.serieCargaKg).toBe(100)
  })

  it('una serie que redondea a la misma carga rotula «no_baja», no «fuera_de_tabla»', () => {
    const r = armarPropuestaDeCarga({ ...base, series: [serie(1, 20, 8, 1)] })
    expect(r.tipo).toBe('fila')
    if (r.tipo !== 'fila') return
    expect(r.fila.cargaPropuestaKg).toBeNull()
    expect(r.fila.razonSinCalculo).toBe('no_baja')
  })

  it('un ejercicioId o microcicloId con forma de frase se rechaza antes de armar la fila', () => {
    expect(armarPropuestaDeCarga({ ...base, ejercicioId: 'me duele mucho el hombro', series: [serie(1, 100, 8, 1)] })).toEqual({ tipo: 'id_invalido' })
    expect(armarPropuestaDeCarga({ ...base, microcicloId: '', series: [serie(1, 100, 8, 1)] })).toEqual({ tipo: 'id_invalido' })
    expect(armarPropuestaDeCarga({ ...base, ejercicioId: 'x'.repeat(81), series: [serie(1, 100, 8, 1)] })).toEqual({ tipo: 'id_invalido' })
  })

  it('el dolor sigue derivando a salud aunque los ids sean inválidos', () => {
    expect(armarPropuestaDeCarga({ ...base, motivo: 'dolor', ejercicioId: 'una frase', series: [] })).toEqual({ tipo: 'derivar_a_salud' })
  })

  it('la fila solo lleva números, listas cerradas e identificadores: ninguna cadena libre', () => {
    const r = armarPropuestaDeCarga({ ...base, series: [serie(1, 100, 8, 1)] })
    if (r.tipo !== 'fila') throw new Error('fila')
    const permitidas = new Set(['bajar_carga', 'algo', 'mucho', 'cansancio', 'tecnica', 'otro', 'press-banca', 'mc-1'])
    for (const [llave, valor] of Object.entries(r.fila)) {
      if (typeof valor === 'string') expect(permitidas.has(valor), `${llave}=${valor}`).toBe(true)
    }
  })
})

describe('armarVoyAEscribirte', () => {
  it('guarda el tema como lista cerrada y la ficha como identificador', () => {
    const r = armarVoyAEscribirte({ origenContacto: 'ficha', fichaId: 'vida-sin-ganas', tema: 'animo' })
    expect(r).toEqual({ ok: true, fila: { tipo: 'voy_a_escribirte', origenContacto: 'ficha', fichaId: 'vida-sin-ganas', tema: 'animo' } })
  })

  it('un tema fuera de la lista cerrada se rechaza (no cae a texto)', () => {
    const r = armarVoyAEscribirte({ origenContacto: 'ficha', fichaId: 'vida-sin-ganas', tema: 'me siento mal' as never })
    expect(r.ok).toBe(false)
  })

  it('una ficha con forma de frase se rechaza', () => {
    expect(armarVoyAEscribirte({ origenContacto: 'ficha', fichaId: 'Estoy muy triste hoy', tema: 'otro' }).ok).toBe(false)
  })

  it('la fila no admite ningún campo de texto libre', () => {
    const r = armarVoyAEscribirte({ origenContacto: 'filtro_clinico', fichaId: 'vida-sin-ganas', tema: 'alimentacion' })
    if (!r.ok) throw new Error('ok')
    expect(Object.keys(r.fila).sort()).toEqual(['fichaId', 'origenContacto', 'tema', 'tipo'])
  })
})

describe('estaVencida (12 h exactas, >=)', () => {
  it('el plazo es de 12 horas', () => expect(PLAZO_HORAS_PROPUESTA).toBe(12))

  it('un minuto antes de las 12 h no está vencida', () => {
    expect(estaVencida({ creadoEn: new Date(t0).toISOString(), estado: 'pendiente' }, new Date(t0 + 12 * HORA - 60_000))).toBe(false)
  })

  it('a las 12 h exactas SÍ está vencida (>=, no >)', () => {
    expect(estaVencida({ creadoEn: new Date(t0).toISOString(), estado: 'pendiente' }, new Date(t0 + 12 * HORA))).toBe(true)
  })

  it('pasadas las 12 h está vencida', () => {
    expect(estaVencida({ creadoEn: new Date(t0).toISOString(), estado: 'pendiente' }, new Date(t0 + 30 * HORA))).toBe(true)
  })

  it('una fila ya decidida nunca está vencida', () => {
    expect(estaVencida({ creadoEn: new Date(t0).toISOString(), estado: 'atendida' }, new Date(t0 + 30 * HORA))).toBe(false)
  })

  it('una fecha ilegible no cuenta como vencida', () => {
    expect(estaVencida({ creadoEn: 'ayer', estado: 'pendiente' }, new Date(t0))).toBe(false)
  })
})

describe('debeContestarPraxis', () => {
  const vencidaContacto = { tipo: 'voy_a_escribirte' as const, tema: 'otro' as const, vencida: true, frase: 'quiero preguntar por mi rutina' }

  it('la respuesta automática está APAGADA en el código', () => {
    expect(RESPUESTA_AUTOMATICA_ENCENDIDA).toBe(false)
  })

  it('con la constante apagada es siempre false, aunque todo lo demás esté en orden', () => {
    expect(debeContestarPraxis(vencidaContacto)).toBe(false)
    expect(debeContestarPraxis({ ...vencidaContacto, tema: 'animo' })).toBe(false)
    expect(debeContestarPraxis({ tipo: 'bajar_carga', vencida: true, frase: '' })).toBe(false)
  })

  it('aun encendida, nunca si el filtro de riesgo marcó la frase', () => {
    const frase = 'quiero morirme'
    expect(filtroDeRiesgo(frase)).not.toBeNull() // el instrumento ve el positivo
    expect(debeContestarPraxis({ ...vencidaContacto, frase }, true)).toBe(false)
  })

  it('aun encendida, nunca en voy_a_escribirte con tema de salud o riesgo', () => {
    expect(debeContestarPraxis({ ...vencidaContacto, tema: 'salud' }, true)).toBe(false)
    expect(debeContestarPraxis({ ...vencidaContacto, tema: 'riesgo' }, true)).toBe(false)
  })

  it('aun encendida, nunca en ánimo ni alimentación (esperan al psicólogo) ni en cargas', () => {
    expect(debeContestarPraxis({ ...vencidaContacto, tema: 'animo' }, true)).toBe(false)
    expect(debeContestarPraxis({ ...vencidaContacto, tema: 'alimentacion' }, true)).toBe(false)
    expect(debeContestarPraxis({ tipo: 'bajar_carga', vencida: true, frase: '' }, true)).toBe(false)
  })

  it('aun encendida, un bajar_carga nunca, ni con tema otro (Praxis no toca cargas)', () => {
    expect(debeContestarPraxis({ tipo: 'bajar_carga', tema: 'otro', vencida: true, frase: 'quiero preguntar por mi rutina' }, true)).toBe(false)
  })

  it('aun encendida, solo si está vencida', () => {
    expect(debeContestarPraxis({ ...vencidaContacto, vencida: false }, true)).toBe(false)
  })

  it('encendida y sin ninguna razón en contra, el único caso que da true (control del instrumento)', () => {
    expect(debeContestarPraxis(vencidaContacto, true)).toBe(true)
  })
})

describe('recalcularEnConsola', () => {
  it('coincide cuando la fila trae lo que sale del cálculo', () => {
    expect(recalcularEnConsola(filaDeCarga(), [])).toEqual({ resultado: 'coincide', recalculadaKg: 95 })
  })

  it('no coincide cuando el número guardado es distinto del recalculado', () => {
    expect(recalcularEnConsola(filaDeCarga({ cargaPropuestaKg: 80 }), [])).toEqual({ resultado: 'no_coincide', recalculadaKg: 95 })
  })

  it('no coincide si la propuesta guardada es null y el cálculo sí da número', () => {
    expect(recalcularEnConsola(filaDeCarga({ cargaPropuestaKg: null, razonSinCalculo: 'no_baja' }), []).resultado).toBe('no_coincide')
  })

  it('usa las series de la consola si las trae, en vez de las de la fila', () => {
    const r = recalcularEnConsola(filaDeCarga(), [serie(1, 60, 8, 1)])
    expect(r.resultado).toBe('no_coincide')
  })

  it('coincide cuando ambos lados dicen «no se calcula»', () => {
    const fila = filaDeCarga({ serieReps: 40, cargaPropuestaKg: null, razonSinCalculo: 'fuera_de_tabla' })
    expect(recalcularEnConsola(fila, [])).toEqual({ resultado: 'coincide', recalculadaKg: null })
  })
})

describe('preguntaPedirSerie', () => {
  const tu = preguntaPedirSerie('tu')
  const usted = preguntaPedirSerie('usted')

  it('es una sola pregunta de 280 caracteres o menos', () => {
    for (const p of [tu, usted]) {
      expect(p.length).toBeLessThanOrEqual(280)
      expect(p.match(/\?/g)).toHaveLength(1)
      expect(p.trim().startsWith('¿')).toBe(true)
    }
  })

  it('pide kilos, repeticiones y repeticiones en reserva', () => {
    for (const p of [tu, usted]) {
      expect(p).toMatch(/\bkilos\b/)
      expect(p).toMatch(/\brepeticiones\b/)
      expect(p).toMatch(/\breserva\b/)
    }
  })

  it('no promete nada: ni aviso, ni cambio, ni plazo, ni resultado', () => {
    const PROMESA = /\b(promet\w*|garantiz\w*|seguro|te aviso|le aviso|te lo bajo|se lo bajo|lo bajar\w*|quedara|listo|pronto|hoy)\b/
    for (const p of [tu, usted]) expect(p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()).not.toMatch(PROMESA)
  })

  it('en tú habla de tú y nunca de usted', () => {
    expect(tu).toMatch(/\btu\b|\btus\b|\bme dices\b/i)
    expect(tu).not.toMatch(/\b(usted|su|sus|dígame|digame)\b/i)
  })

  it('en usted habla de usted y nunca de tú', () => {
    expect(usted).toMatch(/\bsu\b|\bsus\b|\bpodría\b/i)
    expect(usted).not.toMatch(/\b(tu|tus|dime|dices|puedes)\b/i)
  })

  it('no menciona ningún número (no hay cifra que enseñar a la persona)', () => {
    for (const p of [tu, usted]) expect(p).not.toMatch(/\d/)
  })
})
