/**
 * Dos secciones se vaciaban en silencio, y el vacío se leía como un dato.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL FALLO QUE DOCUMENTA ESTE ARCHIVO
 * ─────────────────────────────────────────────────────────────────────────────
 * `hidratar.ts` declara su regla en su propia línea 364: **«un error a gritos es
 * mejor que una pantalla vacía que parece decir *esta gente no ha registrado
 * nada*»**. Doce tablas la cumplían: si cualquiera fallaba, se lanzaba con un
 * mensaje visible. Dos no.
 *
 *   · `hidratacion` (`hidratar.ts:464`) devolvía `[]` ante CUALQUIER error, así
 *     que un 500 pasajero o un permiso denegado se veían igual que un día sin
 *     beber: **0 ml**.
 *   · `ranking` (`hidratar.ts:473`) hacía lo mismo: tabla vacía, idéntica a la de
 *     una semana en la que nadie entrenó.
 *
 * El asesorado no podía distinguir «la consulta falló» de «no hay nada que
 * enseñar». Y el coach tampoco, porque no se registraba en ningún sitio. Lo
 * midió la auditoría del 2026-09-07 (`caso-01`, `REC-03`) sobre el archivo leído
 * de `origin/main`: la regla se cumplía en 12 de 14 sitios.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE **NO** CAMBIA, Y ES DELIBERADO
 * ─────────────────────────────────────────────────────────────────────────────
 * Que una pieza **todavía no exista en el despliegue** no es un fallo: es una
 * migración que aún no se ha aplicado. Esa rama se queda, y con ella el
 * interruptor `marcarTablaHidratacion(false)`, que existe para no atascar la cola
 * con escrituras imposibles. La diferencia que este archivo fija es entre **«esto
 * no está todavía»** y **«esto está roto»**: lo primero se tolera en silencio, lo
 * segundo se grita.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Error = { message: string; code?: string } | null

/** Una respuesta de PostgREST: promesa, y además encadenable con `.eq()`. */
function respuesta(filas: unknown[], error: Error = null) {
  const r = { data: error ? null : filas, error }
  const p = Promise.resolve(r) as Promise<typeof r> & { eq: () => Promise<typeof r> }
  p.eq = () => Promise.resolve(r)
  return p
}

let tablas: Record<string, unknown[]> = {}
let errores: Record<string, Error> = {}
let errorDelRanking: Error = null

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => ({
      select: () => respuesta(tablas[tabla] ?? [], errores[tabla] ?? null),
    }),
    rpc: () =>
      Promise.resolve(
        errorDelRanking ? { data: null, error: errorDelRanking } : { data: [], error: null },
      ),
  }),
}))

async function hidratar() {
  const { hidratarDesdeNube } = await import('./hidratar')
  return hidratarDesdeNube()
}

describe('una sección que falla no se puede confundir con una sección vacía', () => {
  beforeEach(() => {
    localStorage.clear()
    tablas = {}
    errores = {}
    errorDelRanking = null
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * El caso del asesorado: bebió agua toda la semana, la consulta se cayó, y la
   * app le enseñaba 0 ml. Antes esto pasaba sin una queja.
   */
  it('si la consulta de hidratación se rompe, se grita en vez de enseñar 0 ml', async () => {
    errores.hidratacion = { message: 'permission denied for table hidratacion', code: '42501' }

    await expect(hidratar()).rejects.toThrow(/No se pudo descargar tus datos/)
  })

  it('si el ranking se rompe, se grita en vez de enseñar una tabla vacía', async () => {
    errorDelRanking = { message: 'canceling statement due to statement timeout', code: '57014' }

    await expect(hidratar()).rejects.toThrow(/No se pudo descargar tus datos/)
  })

  /**
   * LA EXCEPCIÓN QUE SE CONSERVA. La tabla llegó en la migración 0003 y la RPC en
   * la 0004: en un despliegue que todavía no las tenga, la app tiene que seguir
   * andando. Eso NO es un fallo, y por eso no grita.
   */
  it('una tabla que todavía no existe no es un fallo: la app sigue', async () => {
    errores.hidratacion = { message: 'relation "hidratacion" does not exist', code: '42P01' }

    await expect(hidratar()).resolves.not.toThrow()
  })

  it('una RPC que todavía no existe tampoco: el ranking se queda vacío y ya', async () => {
    errorDelRanking = { message: 'function ranking_disciplina does not exist', code: '42883' }

    await expect(hidratar()).resolves.not.toThrow()
  })

  /** Y con todo respondiendo, la hidratación normal no se ve afectada. */
  it('sin errores, hidrata como siempre', async () => {
    tablas.hidratacion = [{ id: 'h1', usuario_id: 'u-ase', fecha: '2026-09-10', ml: 500 }]

    await expect(hidratar()).resolves.not.toThrow()
    const { instantaneaLocal } = await import('../mockDb')
    expect(instantaneaLocal().hidratacion).toEqual([
      { id: 'h1', usuarioId: 'u-ase', fecha: '2026-09-10', ml: 500 },
    ])
  })
})
