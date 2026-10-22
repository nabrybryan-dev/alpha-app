import { describe, expect, it } from 'vitest'
import { verificarCifras } from './contrato'
import { GRAVEDAD } from './convenciones'
import { geometriaSagital, momentosEstaticos } from './dinamica'
import {
  INCERTIDUMBRE_DEL_CP_M,
  momentosConCp,
  momentosDeZancada,
  repartoPorPalanca,
  resolverEscenario,
  rodillaDeLaPiernaTrasera,
  type EntradaDeZancada,
  type PoseDeZancada,
} from './zancada'
import { construirSujeto } from './sujeto'

/**
 * Zancada con mancuernas: dos apoyos, estática. Verdad: (a) con el paso en cero y los dos pies en el mismo punto, cada pierna lleva la mitad de la
 * sentadilla; (b) la identidad que cierra el cuerpo: los dos momentos de cadera suman el momento del tronco, la cabeza, los brazos y la carga
 * respecto de la cadera (la cadera es una sola); (c) el cierre geométrico de la rodilla trasera; (d) casos que no se pueden afirmar.
 */

const e = { sexo: 'h' as const, talla: 1.741, masa: 73 }
const s = construirSujeto(e)!
const g = GRAVEDAD
const Lt = 0.4403
const Lm = 0.4222

const pose: PoseDeZancada = {
  tibiaDelantera: 0.3,
  musloDelantero: -0.9,
  tronco: 0.15,
  cabeza: 0.1,
  brazo: 0,
  pasoM: 0.35,
  alturaTobilloTraseroM: 0.08,
  pieZ: 0.06,
  copTraseroM: 0.14,
}
const entrada = (p: Partial<PoseDeZancada> = {}, extra: Partial<EntradaDeZancada> = {}): EntradaDeZancada => ({
  ...e,
  cargaKg: 32, // dos mancuernas de 16 kg
  pose: { ...pose, ...p },
  ...extra,
})

describe('(a) con los dos pies en el mismo punto cada pierna lleva la mitad de la sentadilla', () => {
  const sq = { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, barraT: 0, pieZ: 0.05 }
  const geo = geometriaSagital(s, 32, sq)
  // el CP y el pie van bajo el centro de masas; como el pie también pesa, el punto fijo es el centro de masas de todo lo que NO es pie
  const sinPies = geo.porEncimaDelTobillo
  const zCom = sinPies.reduce((t, m) => t + m.kg * m.z, 0) / sinPies.reduce((t, m) => t + m.kg, 0)
  const sentadilla = momentosEstaticos(geo)

  it('con el CP justo bajo el centro de masas: tobillo, rodilla y cadera de cada pierna = mitad de la sentadilla', () => {
    const r = momentosDeZancada(
      entrada({ tibiaDelantera: sq.tibia, musloDelantero: sq.muslo, tronco: sq.tronco, cabeza: sq.cabeza, pasoM: 0, alturaTobilloTraseroM: 0, pieZ: zCom, copTraseroM: zCom }),
    )
    expect(r.repartoDelantera.valor).toBe(0.5)
    for (const pata of [r.delantera, r.trasera]) {
      expect(pata.tobillo.valor!).toBeCloseTo(sentadilla.tobillo / 2, 6)
      expect(pata.rodilla.valor!).toBeCloseTo(sentadilla.rodilla / 2, 6)
      expect(pata.cadera.valor!).toBeCloseTo(sentadilla.cadera / 2, 6)
    }
    expect(r.delantera.cadera.valor!).toBeGreaterThan(50) // no es un caso trivial
  })
})

describe('(b) el cuerpo se cierra: los dos momentos de cadera suman el de lo que va sobre la cadera', () => {
  it.each([
    ['la pose de la prueba', {}],
    ['más paso', { pasoM: 0.45, alturaTobilloTraseroM: 0.1 }],
    ['tronco más inclinado', { tronco: 0.5 }],
    ['sin carga', {}],
  ])('%s', (nombre, cambio) => {
    const p = { ...pose, ...cambio }
    const carga = nombre === 'sin carga' ? 0 : 32
    const r = momentosDeZancada({ ...e, cargaKg: carga, pose: p })
    expect(r.delantera.cadera.valor).not.toBeNull()
    const esc = resolverEscenario(s, carga, p)
    if (typeof esc === 'string') throw new Error(esc)
    const hipZ = esc.delantera.cadera.z
    const arriba = esc.superior.reduce((t, m) => t + g * m.kg * (m.z - hipZ), 0)
    expect(r.delantera.cadera.valor! + r.trasera.cadera.valor!).toBeCloseTo(arriba, 6)
    expect(Math.abs(arriba)).toBeGreaterThan(5)
  })
  it('los dos tobillos y rodillas tienen sentido: el peso que lleva cada pierna suma el del cuerpo', () => {
    const esc = resolverEscenario(s, 32, pose) as Exclude<ReturnType<typeof resolverEscenario>, string>
    const zf = pose.pieZ
    const zr = -pose.pasoM + pose.copTraseroM
    const m = momentosConCp(esc, zf, zr)!
    expect(m.reparto).toBeGreaterThan(0)
    expect(m.reparto).toBeLessThan(1)
    // la regla de la palanca coloca el centro de masas sobre la recta de las dos reacciones
    const todas = [...esc.superior, ...Object.values(esc.delantera.masas), ...Object.values(esc.trasera.masas)]
    const zCom = todas.reduce((t, x) => t + x.kg * x.z, 0) / todas.reduce((t, x) => t + x.kg, 0)
    expect(m.reparto * zf + (1 - m.reparto) * zr).toBeCloseTo(zCom, 12)
  })
})

describe('(c) la rodilla trasera cierra el triángulo y va por delante', () => {
  it('distancias a la tibia y al muslo exactas, y la rodilla por delante de la recta cadera-tobillo', () => {
    const esc = resolverEscenario(s, 32, pose) as Exclude<ReturnType<typeof resolverEscenario>, string>
    const t = esc.trasera
    expect(Math.hypot(t.rodilla.z - t.tobillo.z, t.rodilla.y - t.tobillo.y)).toBeCloseTo(Lt, 12)
    expect(Math.hypot(t.cadera.z - t.rodilla.z, t.cadera.y - t.rodilla.y)).toBeCloseTo(Lm, 12)
    const cruz = (t.cadera.z - t.tobillo.z) * (t.rodilla.y - t.tobillo.y) - (t.cadera.y - t.tobillo.y) * (t.rodilla.z - t.tobillo.z)
    expect(cruz).toBeLessThan(0) // rodilla a la derecha de tobillo->cadera mirando hacia +z: por delante
    // los ángulos de segmento reconstruyen la cadena
    const k = { z: t.tobillo.z + Lt * Math.sin(t.tibia), y: t.tobillo.y + Lt * Math.cos(t.tibia) }
    expect(k.z).toBeCloseTo(t.rodilla.z, 12)
    expect(k.y).toBeCloseTo(t.rodilla.y, 12)
    const h = { z: t.rodilla.z + Lm * Math.sin(t.muslo), y: t.rodilla.y + Lm * Math.cos(t.muslo) }
    expect(h.z).toBeCloseTo(t.cadera.z, 12)
    expect(h.y).toBeCloseTo(t.cadera.y, 12)
  })
  it('a mano: tibia y muslo del mismo largo, tobillo a 0,6 m bajo la cadera: la rodilla queda a la altura media y por delante', () => {
    // L = 0,5 cada uno; D = 0,6: a = 0,3; h = 0,4. Cadera (0; 0,6), tobillo (0; 0).
    const k = rodillaDeLaPiernaTrasera({ z: 0, y: 0.6 }, { z: 0, y: 0 }, 0.5, 0.5)!
    expect(k.y).toBeCloseTo(0.3, 12)
    expect(k.z).toBeCloseTo(0.4, 12)
  })
  it('fuera de alcance (demasiado lejos o demasiado cerca) no hay rodilla', () => {
    expect(rodillaDeLaPiernaTrasera({ z: 0, y: 1.2 }, { z: 0, y: 0 }, 0.5, 0.5)).toBeNull()
    expect(rodillaDeLaPiernaTrasera({ z: 0, y: 0.05 }, { z: 0, y: 0 }, 0.6, 0.3)).toBeNull()
  })
})

describe('la regla de la palanca a mano', () => {
  it('CM a un tercio del camino del apoyo trasero al delantero: la delantera lleva 1/3', () => {
    expect(repartoPorPalanca(0.1, 0.4, -0.2)).toBeCloseTo(0.5, 12) // (0,1 + 0,2) / 0,6
    expect(repartoPorPalanca(0, 0.3, -0.3)).toBeCloseTo(0.5, 12)
    expect(repartoPorPalanca(-0.1, 0.4, -0.2)).toBeCloseTo(1 / 6, 12)
  })
  it('justo sobre un apoyo lo lleva todo; fuera de los dos apoyos, null', () => {
    expect(repartoPorPalanca(0.4, 0.4, -0.2)).toBe(1)
    expect(repartoPorPalanca(-0.2, 0.4, -0.2)).toBe(0)
    expect(repartoPorPalanca(0.41, 0.4, -0.2)).toBeNull()
    expect(repartoPorPalanca(-0.21, 0.4, -0.2)).toBeNull()
  })
  it('los dos apoyos en el mismo punto: 50 % solo si el CM está sobre ellos', () => {
    expect(repartoPorPalanca(0.1, 0.1, 0.1)).toBe(0.5)
    expect(repartoPorPalanca(0.2, 0.1, 0.1)).toBeNull()
  })
})

describe('el resultado con contrato y las abstenciones', () => {
  it('las cifras cumplen el contrato, son estimadas y la banda contiene el valor y tiene ancho', () => {
    const r = momentosDeZancada(entrada())
    const todas = [...Object.values(r.delantera), ...Object.values(r.trasera), r.repartoDelantera, r.inercial]
    expect(verificarCifras(todas)).toEqual([])
    for (const c of [...Object.values(r.delantera), ...Object.values(r.trasera), r.repartoDelantera]) {
      expect(c.estado).toBe('estimado')
      expect(c.banda!.inf).toBeLessThanOrEqual(c.valor!)
      expect(c.banda!.sup).toBeGreaterThanOrEqual(c.valor!)
    }
    expect(r.delantera.cadera.banda!.sup - r.delantera.cadera.banda!.inf).toBeGreaterThan(1) // mover el CP 3 cm cambia el momento
    expect(r.inercial.valor).toBeNull()
    expect(r.inercial.estado).toBe('no_afirmable')
    expect(INCERTIDUMBRE_DEL_CP_M).toBe(0.03)
  })
  it('el CM cae fuera de los apoyos (el trasero demasiado adelante): no_afirmable, sin ceros', () => {
    const r = momentosDeZancada(entrada({ copTraseroM: 0.9, pieZ: 0.95 }))
    for (const c of [...Object.values(r.delantera), ...Object.values(r.trasera), r.repartoDelantera]) {
      expect(c.valor).toBeNull()
      expect(c.estado).toBe('no_afirmable')
    }
    expect(r.delantera.cadera.motivo).toMatch(/fuera de los dos apoyos/)
  })
  it('el tobillo trasero no alcanza: no_afirmable con el motivo', () => {
    const r = momentosDeZancada(entrada({ pasoM: 2 }))
    expect(r.delantera.tobillo.valor).toBeNull()
    expect(r.delantera.tobillo.motivo).toMatch(/no alcanza/)
    expect(r.piernaTrasera).toBeNull()
  })
  it.each([
    ['sin talla', { talla: null }, {}],
    ['carga negativa', { cargaKg: -1 }, {}],
    ['paso negativo', {}, { pasoM: -0.1 }],
    ['talón negativo', {}, { alturaTobilloTraseroM: -0.01 }],
    ['ángulo NaN', {}, { tronco: Number.NaN }],
  ])('%s: todo no_afirmable', (_, extra, cambio) => {
    const r = momentosDeZancada(entrada(cambio as Partial<PoseDeZancada>, extra as Partial<EntradaDeZancada>))
    expect(r.delantera.cadera.valor).toBeNull()
    expect(r.trasera.rodilla.valor).toBeNull()
    expect(verificarCifras([r.delantera.cadera, r.repartoDelantera])).toEqual([])
  })
  it('sin pose: no_afirmable', () => {
    expect(momentosDeZancada({ ...e, cargaKg: 32, pose: undefined }).delantera.cadera.estado).toBe('no_afirmable')
  })
})
