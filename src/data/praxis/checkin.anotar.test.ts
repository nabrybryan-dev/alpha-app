/** El cuaderno de anotaciones, lado datos (RPC praxis_anotar_patron, 0175). ESCRITAS POR IA: SOLO PRUEBA. */
import { describe, expect, it, vi } from 'vitest'
import { anotarPatron, RPC_ANOTAR_PATRON } from './checkin'
import type { Anotacion } from '../../domain/praxis/registro/anotaciones'

const zona: Anotacion = { tipo: 'recuperacion_zona', zona: 'piernas', cita: 'estoy molida de las piernas' }
const comida: Anotacion = { tipo: 'reaccion_comida', momento: 'almuerzo', cita: 'me sentí pesada después del almuerzo' }

function deps(over: Record<string, unknown> = {}) {
  return {
    usuarioDeLaSesion: async () => 'u1',
    rpc: vi.fn(async () => ({ data: { id: 'x', repetida: false }, error: null })),
    anotarFallo: vi.fn(),
    ...over,
  }
}

describe('anotarPatron', () => {
  it('llama a la RPC una vez por anotación, con clave por mensaje y posición, sin alimento', async () => {
    const d = deps()
    const r = await anotarPatron({ usuarioId: 'u1', mensajeId: 'm1', anotaciones: [zona, comida] }, d)
    expect(r).toEqual({ ok: true, anotadas: 2 })
    expect(d.rpc).toHaveBeenNthCalledWith(1, RPC_ANOTAR_PATRON, {
      p_tipo: 'recuperacion_zona', p_zona: 'piernas', p_momento: null, p_alimento: null, p_cita: zona.cita, p_clave: 'm1:0',
    })
    expect(d.rpc).toHaveBeenNthCalledWith(2, RPC_ANOTAR_PATRON, expect.objectContaining({ p_tipo: 'reaccion_comida', p_momento: 'almuerzo', p_clave: 'm1:1' }))
  })
  it('sin anotaciones no llama a nada', async () => {
    const d = deps()
    expect(await anotarPatron({ usuarioId: 'u1', mensajeId: 'm1', anotaciones: [] }, d)).toEqual({ ok: false, motivo: 'nada' })
    expect(d.rpc).not.toHaveBeenCalled()
  })
  it('nunca anota en nombre de otra persona ni sin sesión', async () => {
    const d = deps({ usuarioDeLaSesion: async () => 'otra' })
    expect(await anotarPatron({ usuarioId: 'u1', mensajeId: 'm1', anotaciones: [zona] }, d)).toEqual({ ok: false, motivo: 'otra_persona' })
    const e = deps({ usuarioDeLaSesion: async () => null })
    expect(await anotarPatron({ usuarioId: 'u1', mensajeId: 'm1', anotaciones: [zona] }, e)).toEqual({ ok: false, motivo: 'otra_persona' })
    expect(d.rpc).not.toHaveBeenCalled()
    expect(e.rpc).not.toHaveBeenCalled()
  })
  it('0175 sin aplicar (PGRST202) = sin_migracion, sin avisar de error', async () => {
    const d = deps({ rpc: vi.fn(async () => ({ data: null, error: { code: 'PGRST202' } })) })
    expect(await anotarPatron({ usuarioId: 'u1', mensajeId: 'm1', anotaciones: [zona] }, d)).toEqual({ ok: false, motivo: 'sin_migracion' })
    expect(d.anotarFallo).not.toHaveBeenCalled()
  })
  it('si la base falla, avisa con texto fijo (sin cita ni persona) y devuelve no_se_pudo', async () => {
    const d = deps({ rpc: vi.fn(async () => ({ data: null, error: { code: '22023' } })) })
    expect(await anotarPatron({ usuarioId: 'u1', mensajeId: 'm1', anotaciones: [zona] }, d)).toEqual({ ok: false, motivo: 'no_se_pudo' })
    const aviso = String(d.anotarFallo.mock.calls[0]?.[0])
    expect(aviso).not.toContain('piernas')
    expect(aviso).not.toContain('u1')
  })
  it('si la RPC lanza, no lanza', async () => {
    const d = deps({ rpc: vi.fn(async () => { throw new Error('red') }) })
    expect(await anotarPatron({ usuarioId: 'u1', mensajeId: 'm1', anotaciones: [zona] }, d)).toEqual({ ok: false, motivo: 'no_se_pudo' })
  })
  it('no pasa de 5 por tarjeta', async () => {
    const d = deps()
    await anotarPatron({ usuarioId: 'u1', mensajeId: 'm1', anotaciones: Array(9).fill(zona) }, d)
    expect(d.rpc).toHaveBeenCalledTimes(5)
  })
})
