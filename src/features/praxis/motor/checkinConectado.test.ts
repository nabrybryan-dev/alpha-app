import { beforeEach, describe, expect, it, vi } from 'vitest'
import { intentarCheckin, reiniciarCheckinConectado } from './checkinConectado'
import type { ConexionPraxis } from './conexion'

/**
 * La pieza del check-in por conectores, sola (segunda defensa: la pantalla ya frena el riesgo antes de llegar aquí).
 * Frases inventadas por IA: no sirven para entrenar.
 */
function conCheckin() {
  const checkin = { yaHoy: vi.fn(() => []), lexico: vi.fn(async () => []), guardar: vi.fn() }
  return { c: { checkin } as unknown as ConexionPraxis, checkin }
}

beforeEach(() => reiniciarCheckinConectado())

describe('intentarCheckin, sin pantalla', () => {
  it('con riesgo no toma la frase ni lee nada de la persona', async () => {
    const { c, checkin } = conCheckin()
    expect(await intentarCheckin(c, 'dormí fatal y la verdad no quiero vivir', 0, () => 'm')).toBe(false)
    expect(checkin.yaHoy).not.toHaveBeenCalled()
    expect(checkin.lexico).not.toHaveBeenCalled()
  })

  it('sin `checkin` en la conexión (bandera apagada) no hace nada', async () => {
    expect(await intentarCheckin({} as ConexionPraxis, 'dormí fatal', 0, () => 'm')).toBe(false)
  })

  it('una frase sin nada del check-in vuelve al camino de siempre', async () => {
    const { c, checkin } = conCheckin()
    expect(await intentarCheckin(c, '¿qué es el RIR?', 0, () => 'm')).toBe(false)
    expect(checkin.guardar).not.toHaveBeenCalled()
  })
})
