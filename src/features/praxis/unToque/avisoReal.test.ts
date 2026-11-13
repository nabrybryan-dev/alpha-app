import { afterEach, describe, expect, it, vi } from 'vitest'
import { avisoRealActivo, manejadorDeAvisoDeSalud } from './avisoReal'

afterEach(() => vi.unstubAllEnvs())

describe('bandera VITE_PRAXIS_AVISO_REAL', () => {
  it('nace apagada: sin la variable, o con cualquier otro valor, está apagada', () => {
    expect(avisoRealActivo()).toBe(false)
    vi.stubEnv('VITE_PRAXIS_AVISO_REAL', 'si')
    expect(avisoRealActivo()).toBe(false)
  })
  it('solo "true" la enciende', () => {
    vi.stubEnv('VITE_PRAXIS_AVISO_REAL', 'true')
    expect(avisoRealActivo()).toBe(true)
  })
})

describe('manejadorDeAvisoDeSalud', () => {
  it('apagado: navega a /chat y el escritor se llama CERO veces', () => {
    const navegar = vi.fn()
    const escribir = vi.fn()
    const r = manejadorDeAvisoDeSalud({ activo: false, usuarioId: 'u-aviso-1', navegar, escribir })('salud')
    expect(r).toBeUndefined()
    expect(navegar).toHaveBeenCalledWith('/chat')
    expect(escribir).not.toHaveBeenCalled()
  })
  it('encendido: llama al escritor UNA vez con usuario y tipo, y no navega', async () => {
    const navegar = vi.fn()
    const escribir = vi.fn().mockResolvedValue({ ok: true })
    const r = await manejadorDeAvisoDeSalud({ activo: true, usuarioId: 'u-aviso-1', navegar, escribir })('vida')
    expect(r).toEqual({ ok: true })
    expect(escribir).toHaveBeenCalledTimes(1)
    expect(escribir).toHaveBeenCalledWith({ usuarioId: 'u-aviso-1', nivel: 'vida' })
    expect(navegar).not.toHaveBeenCalled()
  })
})
