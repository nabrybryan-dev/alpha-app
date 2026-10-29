import { beforeEach, describe, expect, it, vi } from 'vitest'

const consulta = vi.hoisted(() => {
  const llamadas: Array<[string, unknown[]]> = []
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'order', 'limit']) {
    q[m] = (...a: unknown[]) => { llamadas.push([m, a]); return q }
  }
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
  return { llamadas, q }
})
vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'bryan' } } }) },
    from: () => consulta.q,
  }),
}))

import { historialDeFirma } from './revisiones'

beforeEach(() => { consulta.llamadas.length = 0 })

describe('historialDeFirma: la consulta no pierde lo más reciente', () => {
  it('pide de la semana más nueva a la más vieja, desde una ventana y con tope explícito', async () => {
    await historialDeFirma(new Date(2026, 9, 28))
    const por = Object.fromEntries(consulta.llamadas.map(([m, a]) => [m, a]))
    expect(por.order).toEqual(['semana', { ascending: false }])
    expect(por.limit?.[0]).toBeGreaterThanOrEqual(1000)
    // 26 semanas atrás desde el lunes 26-oct
    expect(por.gte).toEqual(['semana', '2026-04-27'])
  })
})
