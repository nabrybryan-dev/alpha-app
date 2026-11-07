import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { REPERTORIO, huellaDe, registrarUso, type HistorialPersona } from '../../../domain/praxis/charla/saludos'
import {
  SALUDOS_POR_SITUACION, fijarAzarDeCharla, fijarSaludosPorSituacion, reiniciarVariantes, responderCharla, aperturaInmediata,
  type ContextoDeCharla,
} from './charla'

const base: ContextoDeCharla = { trato: 'tu', hora: 9, esperaAnimo: false, yaHablo: false, nombre: 'Mateo' }
const conSaludos = (extra: Partial<NonNullable<ContextoDeCharla['saludos']>> = {}): ContextoDeCharla => ({
  ...base, saludos: { voz: 'asesorado', situacion: 'vuelve_tras_dias', historial: [], ...extra },
})
const secuencia = (): (() => number) => { let i = 0; const v = [0.1, 0.9, 0.4, 0.7, 0.3, 0.6, 0.2, 0.8]; return () => v[i++ % v.length] }

beforeEach(() => { reiniciarVariantes(); fijarAzarDeCharla(secuencia()); fijarSaludosPorSituacion(null) })
afterEach(() => { fijarAzarDeCharla(null); fijarSaludosPorSituacion(null) })

describe('SALUDOS_POR_SITUACION', () => {
  it('viene apagada', () => expect(SALUDOS_POR_SITUACION).toBe(false))

  it('apagada, pasar o no pasar `saludos` en el contexto da exactamente lo mismo que hoy', () => {
    for (const frase of ['hola', 'buenas tardes', 'qué más', 'cómo estás']) {
      for (const hora of [3, 9, 15, 21]) {
        reiniciarVariantes(); fijarAzarDeCharla(secuencia())
        const sin = responderCharla(frase, { ...base, hora })
        reiniciarVariantes(); fijarAzarDeCharla(secuencia())
        const con = responderCharla(frase, { ...conSaludos(), hora })
        expect(con).toEqual(sin)
        reiniciarVariantes(); fijarAzarDeCharla(secuencia())
        const aSin = aperturaInmediata(frase, { ...base, hora })
        reiniciarVariantes(); fijarAzarDeCharla(secuencia())
        expect(aperturaInmediata(frase, { ...conSaludos(), hora })).toBe(aSin)
      }
    }
  })

  it('apagada, la respuesta no trae huella', () => {
    expect(responderCharla('hola', conSaludos())?.huella).toBeUndefined()
  })

  it('encendida, un saludo sale del repertorio de la situación y trae su huella', () => {
    fijarSaludosPorSituacion(true)
    const r = responderCharla('hola', conSaludos())!
    expect(r.intencion).toBe('saludo')
    expect(r.huella?.situacion).toBe('vuelve_tras_dias')
    expect(REPERTORIO.asesorado.vuelve_tras_dias.colas).toContain(r.cola)
    expect(REPERTORIO.asesorado.vuelve_tras_dias.aperturas.map(huellaDe)).toContain(r.huella!.apertura)
    expect(r.texto).toBe(`${r.apertura} ${r.cola}`)
  })

  it('encendida sin situación (rutina) sigue el libreto de siempre', () => {
    const apagado = responderCharla('hola', base)
    fijarSaludosPorSituacion(true); reiniciarVariantes(); fijarAzarDeCharla(secuencia())
    expect(responderCharla('hola', conSaludos({ situacion: null }))).toEqual(apagado)
  })

  it('encendida, no repite la apertura a la misma persona en 5 saludos seguidos', () => {
    fijarSaludosPorSituacion(true)
    let h: HistorialPersona = []
    const vistas: string[] = []
    for (let i = 0; i < 12; i++) {
      const r = responderCharla('hola', conSaludos({ historial: h }))!
      vistas.push(r.huella!.apertura!)
      h = registrarUso(h, r.huella!)
    }
    vistas.forEach((a, i) => expect(vistas.slice(Math.max(0, i - 5), i)).not.toContain(a))
  })

  it('encendida, la voz asesorado en «usted» cae al libreto de siempre', () => {
    fijarSaludosPorSituacion(true)
    const r = responderCharla('hola', { ...conSaludos(), trato: 'usted' })!
    expect(r.huella).toBeUndefined()
  })

  it('encendida, la voz del equipo no usa tú', () => {
    fijarSaludosPorSituacion(true)
    const r = responderCharla('hola', conSaludos({ voz: 'equipo', situacion: 'primera_vez' }))!
    expect(r.texto).not.toMatch(/\b(t[uú]|te|tu|contigo|usted)\b/i)
  })
})
