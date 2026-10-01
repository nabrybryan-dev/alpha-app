import { describe, expect, it } from 'vitest'
import { PRAXIS_ABIERTA_A_ASESORADOS, esStaff, puedeVerPraxis } from './acceso'

/**
 * Praxis se publicó el 29-sep-2026 como excepción firmada por Bryan, y desde el 1-oct lee
 * datos reales. Que lea datos reales no la abre a los asesorados: su filtro de riesgo es
 * solo un diccionario, no avisa a nadie y sus textos clínicos no los ha revisado un
 * profesional. Por eso la pantalla solo la ve el staff, y el interruptor sigue apagado.
 */
describe('quién puede ver Praxis', () => {
  it('el staff es el coach y la nutricionista, igual que `es_staff()` en la base', () => {
    expect(esStaff('coach')).toBe(true)
    expect(esStaff('nutricionista')).toBe(true)
    expect(esStaff('asesorado')).toBe(false)
  })

  it('el interruptor para asesorados está apagado', () => {
    expect(PRAXIS_ABIERTA_A_ASESORADOS).toBe(false)
  })

  it('con el interruptor apagado, un asesorado no la ve y el staff sí', () => {
    expect(puedeVerPraxis('asesorado')).toBe(false)
    expect(puedeVerPraxis('coach')).toBe(true)
    expect(puedeVerPraxis('nutricionista')).toBe(true)
  })

  it('el interruptor es lo único que le abre la puerta a un asesorado', () => {
    expect(puedeVerPraxis('asesorado', true)).toBe(true)
    expect(puedeVerPraxis('asesorado', false)).toBe(false)
  })

  it('apagar el interruptor nunca deja fuera al staff', () => {
    expect(puedeVerPraxis('coach', false)).toBe(true)
    expect(puedeVerPraxis('nutricionista', false)).toBe(true)
  })
})

// `acceso.ts` no importa nada (lo usa también la Edge Function, en Deno), así que repite el
// tipo de los roles. Si el del dominio cambia y este no, esto deja de compilar.
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const rolesIguales: Igual<import('./acceso').Rol, import('../types').Rol> = true
describe('el interruptor y el dominio hablan de los mismos roles', () => {
  it('el tipo Rol de acceso.ts es el del dominio', () => expect(rolesIguales).toBe(true))
})
