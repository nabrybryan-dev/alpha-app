import { describe, expect, it } from 'vitest'
import { verificarCifras } from './contrato'
import { GRAVEDAD } from './convenciones'
import { geometriaSagital, momentosDeSentadilla, momentosEstaticos, type PoseSagital } from './dinamica'
import { construirSujeto } from './sujeto'
import { VALORES_REGISTRADOS } from './registro'

/**
 * ARNÉS DE LA FASE 2 (M4). Verdad: (a) casos que se resuelven a mano aquí, con los números de la
 * Tabla 4 de de Leva (varones) copiados a mano y la talla de la muestra (1,741 m, escala 1);
 * (b) y (c), el cálculo de abajo arriba y OpenSim, los corren `scripts/verdad-sentadilla.py` y
 * `scripts/verdad-opensim.py` sobre las poses de `scripts/poses-sentadilla.json`.
 */

const g = GRAVEDAD
const M = 73
const e = { sexo: 'h' as const, talla: 1.741, masa: M }
const pose0: PoseSagital = { tibia: 0, muslo: 0, tronco: 0, cabeza: 0, barraT: 0.1, pieZ: 0.05 }
const mom = (pose: PoseSagital, carga = 100) => {
  const s = construirSujeto(e)!
  return momentosEstaticos(geometriaSagital(s, carga, pose))
}

describe('casos a mano', () => {
  it('de pie, todo en la misma vertical: los tres momentos son 0', () => {
    const m = mom(pose0)
    expect(Math.abs(m.tobillo)).toBeLessThan(1e-9)
    expect(Math.abs(m.rodilla)).toBeLessThan(1e-9)
    expect(Math.abs(m.cadera)).toBeLessThan(1e-9)
  })

  it('tronco horizontal hacia adelante: el momento de cadera es el de la tabla a mano', () => {
    const Lk = 0.6033
    const mTronco = 0.4346 * M
    const mCabeza = 0.0694 * M
    const mBrazos = 2 * (0.0271 + 0.0162 + 0.0061) * M
    const carga = 100
    // z del tronco (CM al 51,38 % desde el cervical), cabeza sobre el cervical, barra al 10 %.
    const esperado =
      g * (mTronco * Lk * (1 - 0.5138) + mCabeza * Lk + (mBrazos + carga) * Lk * (1 - 0.1))
    expect(mom({ ...pose0, tronco: Math.PI / 2 }, carga).cadera).toBeCloseTo(esperado, 8)
  })

  it('muslo horizontal hacia atrás, el resto vertical: la rodilla es extensora y vale lo de la tabla', () => {
    const Lm = 0.4222
    const mMuslo = 2 * 0.1416 * M
    const arriba = (0.4346 + 0.0694 + 2 * (0.0271 + 0.0162 + 0.0061)) * M + 100
    const esperado = g * (mMuslo * Lm * (1 - 0.4095) + arriba * Lm)
    const m = mom({ ...pose0, muslo: -Math.PI / 2 })
    expect(m.rodilla).toBeCloseTo(esperado, 8)
    expect(m.rodilla).toBeGreaterThan(0)
  })

  it('signo del tobillo: la carga delante lo hace flexor plantar (+), detrás (-)', () => {
    expect(mom({ ...pose0, tibia: 0.3, muslo: -0.3 }).tobillo).toBeDefined()
    // tronco inclinado adelante con la tibia vertical: todo cae delante del tobillo
    expect(mom({ ...pose0, tronco: 0.6 }).tobillo).toBeGreaterThan(0)
    expect(mom({ ...pose0, tronco: -0.6 }).tobillo).toBeLessThan(0)
  })

  it('el momento de cadera es lineal en la carga y vale 0 con tronco vertical', () => {
    const base = mom({ ...pose0, tronco: 0.8 }, 0).cadera
    const con = mom({ ...pose0, tronco: 0.8 }, 100).cadera
    const con200 = mom({ ...pose0, tronco: 0.8 }, 200).cadera
    expect(con200 - con).toBeCloseTo(con - base, 8)
    expect(Math.abs(mom(pose0, 150).cadera)).toBeLessThan(1e-9)
  })

  it('una sentadilla en paralelo plausible da cadera y rodilla extensoras', () => {
    const paralelo: PoseSagital = { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, barraT: 0.1, pieZ: 0.05 }
    const m = mom(paralelo, 100)
    expect(m.cadera).toBeGreaterThan(0)
    expect(m.rodilla).toBeGreaterThan(0)
    expect(m.tobillo).toBeGreaterThan(0)
  })
})

describe('el resultado con contrato', () => {
  const pose: PoseSagital = { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, barraT: 0.1, pieZ: 0.05 }
  it('con todo: tres cifras calculadas válidas y el término inercial no_afirmable', () => {
    const r = momentosDeSentadilla({ ...e, cargaKg: 100, pose })
    expect(verificarCifras([r.tobillo, r.rodilla, r.cadera, r.inercial])).toEqual([])
    expect(r.cadera.estado).toBe('calculado')
    expect(r.inercial.valor).toBeNull()
  })
  it('cada fuente que cita existe en el registro de constantes vigiladas', () => {
    const r = momentosDeSentadilla({ ...e, cargaKg: 100, pose })
    for (const f of r.rodilla.fuente) expect(Object.keys(VALORES_REGISTRADOS)).toContain(f)
  })
  it.each([
    ['sin carga', { ...e, cargaKg: undefined, pose }],
    ['carga negativa', { ...e, cargaKg: -5, pose }],
    ['sin pose', { ...e, cargaKg: 100, pose: undefined }],
    ['ángulo NaN', { ...e, cargaKg: 100, pose: { ...pose, tronco: NaN } }],
    ['sin talla', { ...e, talla: null, cargaKg: 100, pose }],
  ])('%s: las tres cifras son null, no cero', (_, entrada) => {
    const r = momentosDeSentadilla(entrada)
    for (const c of [r.tobillo, r.rodilla, r.cadera]) {
      expect(c.valor).toBeNull()
      expect(c.estado).toBe('no_afirmable')
    }
    expect(verificarCifras([r.tobillo, r.rodilla, r.cadera])).toEqual([])
  })
})
