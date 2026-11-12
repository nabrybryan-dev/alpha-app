/** El alimento que la persona dijo viaja al cuaderno solo en una reacción a comida. ESCRITAS POR IA: SOLO PRUEBA. */
import { describe, expect, it, vi } from 'vitest'
import { anotarPatron } from './checkin'

function deps() {
  return { usuarioDeLaSesion: async () => 'u1', rpc: vi.fn(async () => ({ data: { id: 'x' }, error: null })), anotarFallo: vi.fn() }
}

describe('anotarPatron y el alimento', () => {
  it('«comí frijoles y me sentí pesada»: el alimento viaja', async () => {
    const d = deps()
    await anotarPatron({ usuarioId: 'u1', mensajeId: 'm', anotaciones: [{ tipo: 'reaccion_comida', momento: 'otro', alimento: 'frijoles', cita: 'me sentí pesada' }] }, d)
    expect(d.rpc).toHaveBeenCalledWith('praxis_anotar_patron', expect.objectContaining({ p_alimento: 'frijoles', p_momento: 'otro' }))
  })
  it('una recuperación de zona nunca manda alimento (la base lo rechazaría)', async () => {
    const d = deps()
    await anotarPatron({ usuarioId: 'u1', mensajeId: 'm', anotaciones: [{ tipo: 'recuperacion_zona', zona: 'piernas', alimento: 'frijoles', cita: 'x' }] }, d)
    expect(d.rpc).toHaveBeenCalledWith('praxis_anotar_patron', expect.objectContaining({ p_alimento: null }))
  })
})
