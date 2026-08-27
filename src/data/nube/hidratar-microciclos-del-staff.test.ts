/**
 * El staff deja de bajarse el histórico de toda la cartera.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ
 * ─────────────────────────────────────────────────────────────────────────────
 * Un microciclo es un blob JSON con todas las sesiones, ejercicios y series:
 * ~21 kB. Son solo 4,7 por asesorado, así que el problema no se ve contando
 * filas —se ve pesándolas—.
 *
 * Para una asesorada, RLS acota a lo suyo y da igual. Para el coach,
 * `es_coach()` es cierto y RLS no acota nada: se llevaba la cartera entera cada
 * 45 s. Medido, con 1.000 usuarios serían 94 MB por refresco, 176,7 GB al día,
 * una sola pestaña. Y el 78 % de eso son microciclos CERRADOS, que además
 * crecen sin freno: cada asesorado cierra uno por semana, para siempre.
 *
 * Ver `docs/specs/2026-08-27-donde-truena-a-mil-usuarios.md`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Error = { message: string; code?: string } | null

function respuesta(filas: unknown[], error: Error = null) {
  const r = { data: error ? null : filas, error }
  const p = Promise.resolve(r) as Promise<typeof r> & {
    eq: () => Promise<typeof r>
    or: (f: string) => Promise<typeof r>
  }
  p.eq = () => Promise.resolve(r)
  p.or = () => Promise.resolve(r)
  return p
}

/** El filtro con el que se pidieron los microciclos, o `undefined` si ninguno. */
let filtroDeMicrociclos: string | undefined
vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session } }) },
    from: (tabla: string) => ({
      select: () => {
        const r = respuesta([])
        if (tabla === 'microciclos') {
          r.or = (f: string) => {
            filtroDeMicrociclos = f
            return Promise.resolve({ data: [], error: null })
          }
        }
        return r
      },
    }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  }),
}))

/** Quién está dentro. `null` = nadie. Lo lee el mock de arriba. */
let session: { user: { id: string } } | null = null

async function hidratar() {
  const { hidratarDesdeNube } = await import('./hidratar')
  await hidratarDesdeNube()
}

beforeEach(() => {
  localStorage.clear()
  filtroDeMicrociclos = undefined
  session = null
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('qué microciclos baja la hidratación', () => {
  /**
   * Los dos estados NO son intercambiables ni opcionales:
   *
   *   `activo`     lo miran el semáforo y la revisión de cartera.
   *   `propuesto`  lo busca `propuestaPreparada` en `revisionCartera.ts`. Sin
   *                él, el coach dejaría de ver las propuestas que ya dejó
   *                listas y la app se las recalcularía cada vez.
   *
   * Y `usuario_id.eq.<yo>` trae TODO lo propio, que es lo que necesitan las
   * pantallas de logros y progreso de quien mira: `useGamificacion` lee los
   * `cerrado` para el logro de microciclo completo.
   */
  it('pide los activos y los propuestos de todos, más todo lo propio', async () => {
    session = { user: { id: 'u-bryan' } }

    await hidratar()

    expect(filtroDeMicrociclos).toBe('estado.in.(activo,propuesto),usuario_id.eq.u-bryan')
  })

  /**
   * Sin sesión no se filtra y se baja todo, como siempre. Fallar aquí tiene que
   * costar tráfico, nunca datos que falten: una pantalla lenta se arregla sola
   * al refrescar, una a la que le falta el microciclo activo no.
   */
  it('sin sesión no filtra: se baja todo, como antes', async () => {
    session = null

    await hidratar()

    expect(filtroDeMicrociclos).toBeUndefined()
  })
})
