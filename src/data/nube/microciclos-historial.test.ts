/**
 * El historial de una persona, pedido a demanda.
 *
 * Existe porque la hidratación del staff ya no se baja los microciclos cerrados
 * de toda la cartera —el 78 % del peso, y creciendo sin freno—. Cuando el coach
 * abre a alguien, su rejilla de volumen necesita esa historia, y se pide
 * entonces. Ver `docs/specs/2026-08-27-donde-truena-a-mil-usuarios.md`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Error = { message: string } | null

/** Con qué se filtró la consulta, para comprobar que pide de UNA persona. */
let filtro: { columna: string; valor: string } | undefined
let filasDelServidor: unknown[] = []
let errorDelServidor: Error = null

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: () => ({
      select: () => ({
        eq: (columna: string, valor: string) => {
          filtro = { columna, valor }
          return Promise.resolve({
            data: errorDelServidor ? null : filasDelServidor,
            error: errorDelServidor,
          })
        },
      }),
    }),
  }),
}))

const micro = (id: string, numero: number, estado: 'activo' | 'cerrado') => ({
  id,
  estado,
  datos: {
    id,
    usuarioId: 'u-val',
    numero,
    cadenciaDias: 8,
    estado,
    fechaInicio: '2026-07-20',
    sesiones: [],
  },
})

async function db() {
  const { crearDbSincronizada } = await import('./sync')
  const { crearMockDb } = await import('../mockDb')
  return crearDbSincronizada(crearMockDb())
}

beforeEach(() => {
  localStorage.clear()
  filtro = undefined
  filasDelServidor = []
  errorDelServidor = null
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('historialDe', () => {
  it('pide los microciclos de esa persona, y solo de esa', async () => {
    filasDelServidor = [micro('m-9', 9, 'cerrado'), micro('m-10', 10, 'activo')]

    const historial = await (await db()).microciclos.historialDe('u-val')

    expect(filtro).toEqual({ columna: 'usuario_id', valor: 'u-val' })
    expect(historial.map((m) => m.id).sort()).toEqual(['m-10', 'm-9'])
  })

  /**
   * Trae los CERRADOS, que es su motivo de existir: son justo los que la
   * hidratación dejó de bajar.
   */
  it('trae los cerrados, que la hidratación ya no baja', async () => {
    filasDelServidor = [micro('m-1', 1, 'cerrado'), micro('m-2', 2, 'cerrado')]

    const historial = await (await db()).microciclos.historialDe('u-val')

    expect(historial).toHaveLength(2)
    expect(historial.every((m) => m.estado === 'cerrado')).toBe(true)
  })

  /**
   * LA QUE PROTEGE LA PANTALLA. Un corte de red no puede dejarle al coach una
   * ficha rota: se devuelve lo que haya en local. Verá menos historia, pero la
   * pantalla abre. Lanzar aquí la tumbaría entera.
   */
  it('si el servidor falla, devuelve lo local en vez de lanzar', async () => {
    errorDelServidor = { message: 'sin red' }

    const historial = await (await db()).microciclos.historialDe('u-val')

    expect(Array.isArray(historial)).toBe(true)
  })
})
