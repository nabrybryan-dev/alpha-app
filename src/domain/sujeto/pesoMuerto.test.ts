import { describe, expect, it } from 'vitest'
import { verificarCifras } from './contrato'
import { GRAVEDAD } from './convenciones'
import { DE_LEVA_CERV } from './deleva'
import { geometriaSagital, momentosEstaticos, type PoseSagital } from './dinamica'
import {
  POSE_DE_PARTIDA_ILUSTRATIVA,
  brazoParaBarraSobre,
  geometriaDePesoMuerto,
  momentosDePesoMuerto,
  momentosDePesoMuertoEnElTiempo,
  puntosDelBrazo,
  type PoseDePesoMuerto,
} from './pesoMuerto'
import { construirSujeto } from './sujeto'

/**
 * Peso muerto: la barra cuelga de las manos. Verdad: casos a mano con los números de la Tabla 4 de de Leva (varones, 73 kg, 1,741 m: escala 1) y
 * una identidad que sí se puede comprobar contra la sentadilla: con los brazos verticales, la barra y los brazos quedan en la vertical del punto
 * cervical, y el momento estático solo depende de las posiciones horizontales, así que coincide con el de la sentadilla con la barra en el cervical.
 */

const g = GRAVEDAD
const M = 73
const e = { sexo: 'h' as const, talla: 1.741, masa: M }
const s = construirSujeto(e)!
const cero: PoseDePesoMuerto = { tibia: 0, muslo: 0, tronco: 0, cabeza: 0, brazo: 0, pieZ: 0.05 }
const mom = (pose: PoseDePesoMuerto, carga = 100) => momentosEstaticos(geometriaDePesoMuerto(s, carga, pose))

const mTronco = 0.4346 * M
const mCabeza = 0.0694 * M
const mBrazos = 2 * (0.0271 + 0.0162 + 0.0061) * M
const Lk = 0.6033
const cmTronco = 0.5138

describe('casos a mano', () => {
  it('de pie, todo en la misma vertical y los brazos colgando: los tres momentos son 0', () => {
    const m = mom(cero)
    for (const x of [m.tobillo, m.rodilla, m.cadera]) expect(Math.abs(x)).toBeLessThan(1e-9)
  })

  it('los brazos cuelgan verticales del hombro: el agarre está bajo el hombro a (brazo + antebrazo + cm de la mano) de largo', () => {
    const base = geometriaSagital(s, 0, { ...cero, barraT: 0 })
    const p = puntosDelBrazo(s, base, cero)
    expect(p.agarre.z).toBeCloseTo(p.hombro.z, 12)
    expect(p.hombro.y - p.agarre.y).toBeCloseTo(0.2817 + 0.2689 + 0.79 * 0.0862, 12) // Tabla 4, varones, escala 1
    // el centro de masas de los dos brazos queda entre el hombro y el agarre
    expect(p.brazos.y).toBeLessThan(p.hombro.y)
    expect(p.brazos.y).toBeGreaterThan(p.agarre.y)
    expect(p.brazos.kg).toBeCloseTo(mBrazos, 12)
  })

  it('tronco a 60°, piernas verticales: el momento de cadera es el de la tabla; rodilla = −cadera y tobillo = cadera', () => {
    const th = Math.PI / 3
    const esperado = g * (mTronco * (1 - cmTronco) * Lk * Math.sin(th) + (mCabeza + mBrazos + 100) * Lk * Math.sin(th))
    const m = mom({ ...cero, tronco: th })
    expect(m.cadera).toBeCloseTo(esperado, 8)
    expect(m.rodilla).toBeCloseTo(-esperado, 8)
    expect(m.tobillo).toBeCloseTo(esperado, 8)
    expect(esperado).toBeGreaterThan(200) // no es un caso trivial: unos 280 N·m
  })

  it('con la mano adelantada del hombro, la barra suma su brazo de palanca: Δ cadera = carga · g · Δz de la barra', () => {
    const th = 0.8
    const a = mom({ ...cero, tronco: th, brazo: 0 }).cadera
    const b = mom({ ...cero, tronco: th, brazo: 0.2 }).cadera
    const alcance = 0.2817 + 0.2689 + 0.79 * 0.0862
    // la barra se adelanta alcance · sen(0,2); los brazos, el suyo; a mano solo la barra: la diferencia total es la de la barra más la de los brazos
    const base = geometriaSagital(s, 0, { ...cero, tronco: th, barraT: 0 })
    const p0 = puntosDelBrazo(s, base, { ...cero, tronco: th, brazo: 0 })
    const p1 = puntosDelBrazo(s, base, { ...cero, tronco: th, brazo: 0.2 })
    const dBarra = p1.agarre.z - p0.agarre.z
    expect(dBarra).toBeCloseTo(alcance * Math.sin(0.2), 12)
    const dBrazos = p1.brazos.z - p0.brazos.z
    expect(b - a).toBeCloseTo(g * (100 * dBarra + mBrazos * dBrazos), 8)
  })

  it('identidad con la sentadilla: con los brazos verticales el peso muerto da los momentos de la sentadilla con la barra en el cervical (barraT = 0)', () => {
    const poses: PoseDePesoMuerto[] = [
      { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, brazo: 0, pieZ: 0.05 },
      { tibia: 0.3, muslo: -0.6, tronco: 1.1, cabeza: 0.6, brazo: 0, pieZ: 0.02 },
      POSE_DE_PARTIDA_ILUSTRATIVA,
    ]
    for (const p of poses) {
      const sq: PoseSagital = { tibia: p.tibia, muslo: p.muslo, tronco: p.tronco, cabeza: p.cabeza, barraT: 0, pieZ: p.pieZ }
      const a = momentosEstaticos(geometriaSagital(s, 100, sq))
      const b = mom(p)
      expect(b.tobillo).toBeCloseTo(a.tobillo, 8)
      expect(b.rodilla).toBeCloseTo(a.rodilla, 8)
      expect(b.cadera).toBeCloseTo(a.cadera, 8)
    }
  })
})

describe('la barra sobre el medio del pie', () => {
  const { brazo: _b, ...sinBrazo } = POSE_DE_PARTIDA_ILUSTRATIVA
  void _b
  it('el ángulo que pone la barra sobre la vertical pedida la deja ahí, a 1e-9 m', () => {
    const objetivo = 0.05
    const ang = brazoParaBarraSobre(s, sinBrazo, objetivo)!
    expect(ang).not.toBeNull()
    const gm = geometriaDePesoMuerto(s, 100, { ...sinBrazo, brazo: ang })
    const barra = gm.porEncimaDeLaCadera.find((m) => m.nombre === 'barra')!
    expect(Math.abs(barra.z - objetivo)).toBeLessThan(1e-9)
  })
  it('una vertical que el brazo no alcanza da null, no un ángulo inventado', () => {
    expect(brazoParaBarraSobre(s, sinBrazo, 3)).toBeNull()
    expect(brazoParaBarraSobre(s, sinBrazo, -3)).toBeNull()
  })
  it('con la barra sobre el pie la carga pesa menos en la cadera que con los brazos verticales cuando el hombro va delante del pie', () => {
    const delante = mom({ ...sinBrazo, brazo: 0 }).cadera
    const ang = brazoParaBarraSobre(s, sinBrazo, 0.05)!
    const sobre = mom({ ...sinBrazo, brazo: ang }).cadera
    expect(Math.abs(ang)).toBeGreaterThan(0)
    expect(sobre).not.toBeCloseTo(delante, 3)
  })
})

describe('el resultado con contrato', () => {
  it('tres cifras estimadas válidas y el término inercial no_afirmable (el estático no lo calcula)', () => {
    const r = momentosDePesoMuerto({ ...e, cargaKg: 100, pose: POSE_DE_PARTIDA_ILUSTRATIVA })
    expect(verificarCifras([r.tobillo, r.rodilla, r.cadera, r.inercial])).toEqual([])
    for (const c of [r.tobillo, r.rodilla, r.cadera]) {
      expect(c.estado).toBe('estimado')
      expect(c.id.startsWith('pesoMuerto.momento.')).toBe(true)
    }
    expect(r.inercial.valor).toBeNull()
    expect(r.cadera.valor).toBeCloseTo(mom(POSE_DE_PARTIDA_ILUSTRATIVA).cadera, 9)
  })
  it.each([
    ['sin carga', { ...e, cargaKg: undefined, pose: POSE_DE_PARTIDA_ILUSTRATIVA }],
    ['carga negativa', { ...e, cargaKg: -1, pose: POSE_DE_PARTIDA_ILUSTRATIVA }],
    ['sin pose', { ...e, cargaKg: 100, pose: undefined }],
    ['brazo NaN', { ...e, cargaKg: 100, pose: { ...POSE_DE_PARTIDA_ILUSTRATIVA, brazo: Number.NaN } }],
    ['sin talla', { ...e, talla: null, cargaKg: 100, pose: POSE_DE_PARTIDA_ILUSTRATIVA }],
  ])('%s: las tres cifras son null, no cero', (_, entrada) => {
    const r = momentosDePesoMuerto(entrada)
    for (const c of [r.tobillo, r.rodilla, r.cadera]) {
      expect(c.valor).toBeNull()
      expect(c.estado).toBe('no_afirmable')
    }
  })
})

describe('el término inercial del peso muerto: el tronco gira con la cadera fija y los brazos cuelgan del hombro', () => {
  const A = 0.3
  const w = 2 * Math.PI
  const dt = 0.002
  const N = 501
  const base: PoseDePesoMuerto = { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, brazo: 0, pieZ: 0.05 }
  const th = (t: number) => base.tronco + A * Math.sin(w * t)
  const poses = Array.from({ length: N }, (_, k) => ({ t: k * dt, pose: { ...base, tronco: th(k * dt) } }))
  const r = momentosDePesoMuertoEnElTiempo({ ...e, cargaKg: 100, instantes: poses, fuenteDeAngulos: 'sintetico:prueba' })
  const gm0 = geometriaDePesoMuerto(s, 100, base)
  const Lc = DE_LEVA_CERV.h.cabeza.largo
  const cmC = DE_LEVA_CERV.h.cabeza.cm
  // distancia del hombro a cada punto del brazo, por la recta vertical colgante (Tabla 4, varones, escala 1)
  const dB = 0.5772 * 0.2817
  const dA = 0.2817 + 0.4574 * 0.2689
  const dM = 0.2817 + 0.2689 + 0.79 * 0.0862
  const masasBrazo = [0.0271, 0.0162, 0.0061]
  const dBrazos = (masasBrazo[0]! * dB + masasBrazo[1]! * dA + masasBrazo[2]! * dM) / (masasBrazo[0]! + masasBrazo[1]! + masasBrazo[2]!)

  const aMano = (k: number) => {
    const t = k * dt
    const q = th(t)
    const qpp = -A * w * w * Math.sin(w * t)
    const qp = A * w * Math.cos(w * t)
    const uc = { z: Math.sin(base.cabeza), y: Math.cos(base.cabeza) }
    // masa, radio que gira alrededor de la cadera, desplazamiento fijo respecto del punto que gira
    const lista = [
      { kg: mTronco, d: (1 - cmTronco) * Lk, c: { z: 0, y: 0 } },
      { kg: mCabeza, d: Lk, c: { z: (1 - cmC) * Lc * uc.z, y: (1 - cmC) * Lc * uc.y } },
      { kg: mBrazos, d: Lk, c: { z: 0, y: -dBrazos } },
      { kg: 100, d: Lk, c: { z: 0, y: -dM } },
    ]
    let suma = 0
    for (const m of lista) {
      const rz = gm0.cadera.z + m.d * Math.sin(q) + m.c.z - gm0.cadera.z
      const ry = gm0.cadera.y + m.d * Math.cos(q) + m.c.y - gm0.cadera.y
      const az = m.d * (qpp * Math.cos(q) - qp * qp * Math.sin(q))
      const ay = m.d * (-qpp * Math.sin(q) - qp * qp * Math.cos(q))
      suma += m.kg * (rz * ay - ry * az)
    }
    return suma
  }

  it.each([60, 125, 190, 380])('en el cuadro %i el término traslacional de cadera es el de la fórmula del péndulo con los brazos y la barra colgando', (k) => {
    expect(r.marcos[k]!.cadera.traslacional.valor!).toBeCloseTo(aMano(k), 1)
    expect(Math.abs(aMano(k))).toBeGreaterThan(5)
  })
  it('las cifras llevan el prefijo del ejercicio y cumplen el contrato', () => {
    const m = r.marcos[125]!
    expect(m.cadera.total.id).toBe('pesoMuerto.momento.dinamico.cadera')
    expect(m.cadera.traslacional.id).toBe('pesoMuerto.momento.inercial.traslacional.cadera')
    expect(verificarCifras([m.tobillo.total, m.rodilla.total, m.cadera.total, m.cadera.rotacional, m.cadera.traslacional])).toEqual([])
  })
  it('aceleración cero: el total es el estático (con la misma pose)', () => {
    const quieto = momentosDePesoMuertoEnElTiempo({
      ...e,
      cargaKg: 100,
      instantes: Array.from({ length: 5 }, (_, k) => ({ t: k * 0.1, pose: POSE_DE_PARTIDA_ILUSTRATIVA })),
      fuenteDeAngulos: 'sintetico:prueba',
    })
    const est = mom(POSE_DE_PARTIDA_ILUSTRATIVA)
    const m = quieto.marcos[2]!
    expect(m.cadera.total.valor!).toBeCloseTo(est.cadera, 8)
    expect(m.rodilla.total.valor!).toBeCloseTo(est.rodilla, 8)
    expect(m.tobillo.total.valor!).toBeCloseTo(est.tobillo, 8)
    expect(Math.abs(m.cadera.inercial.valor!)).toBeLessThan(1e-9)
  })
  it('sin la fuente de los ángulos declarada, todo no_afirmable', () => {
    const sin = momentosDePesoMuertoEnElTiempo({ ...e, cargaKg: 100, instantes: poses.slice(0, 5), fuenteDeAngulos: '' })
    expect(sin.motivo).not.toBeNull()
    expect(sin.marcos[2]!.cadera.total.valor).toBeNull()
  })
})
