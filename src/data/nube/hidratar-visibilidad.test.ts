/**
 * Lo que la nutricionista decide tiene que BAJAR al teléfono del asesorado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL FALLO QUE DOCUMENTA ESTE ARCHIVO
 * ─────────────────────────────────────────────────────────────────────────────
 * `visibilidad_nutricion` tenía ruta de subida (`sync.ts`) y política de lectura
 * en la base (migración 0018, `visibilidad_lee_lo_suyo`, escrita justo para
 * esto), pero la hidratación nunca la pedía. Dos consecuencias, y la segunda no
 * la vio nadie durante días:
 *
 *   1. El asesorado nunca recibía la decisión, así que su app no sabía qué
 *      pintarle y le enseñaba todo.
 *   2. `aplicarSnapshot` REEMPLAZA la base local entera. Como la foto no traía
 *      visibilidades, la decisión que Manuela acababa de tomar desaparecía de su
 *      propio dispositivo en la siguiente hidratación. En Supabase quedaba; en su
 *      pantalla, no — y la ficha le reaparecía como si nunca la hubiera tocado.
 *
 * Es la misma familia que el resto de pérdidas de este repo: escribir una foto
 * incompleta encima de algo que sí estaba.
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

/** Qué devuelve cada tabla en esta prueba. Lo que no esté, sale vacío. */
let tablas: Record<string, unknown[]> = {}
let errores: Record<string, Error> = {}

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => ({
      select: () => respuesta(tablas[tabla] ?? [], errores[tabla] ?? null),
    }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  }),
}))

const FILA = {
  asesorado_id: 'u-ase',
  ver_composicion: false,
  ver_objetivo_calorico: false,
  ver_contador_kcal: true,
  estado: 'decidido',
}

const DECISION_LOCAL = {
  usuarioId: 'u-ase',
  verComposicion: false,
  verObjetivoCalorico: true,
  verContadorKcal: true,
  estado: 'decidido' as const,
}

async function hidratarYLeer() {
  const { hidratarDesdeNube } = await import('./hidratar')
  const { instantaneaLocal } = await import('../mockDb')
  await hidratarDesdeNube()
  return instantaneaLocal().visibilidades
}

describe('la visibilidad baja de la nube', () => {
  beforeEach(() => {
    localStorage.clear()
    tablas = {}
    errores = {}
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('la decisión del servidor llega al dispositivo', async () => {
    tablas.visibilidad_nutricion = [FILA]
    const visibilidades = await hidratarYLeer()

    expect(visibilidades).toEqual([
      {
        usuarioId: 'u-ase',
        verComposicion: false,
        verObjetivoCalorico: false,
        verContadorKcal: true,
        estado: 'decidido',
      },
    ])
  })

  it('sin fila no se inventa ninguna: sin decisión se ve todo, y eso ya lo resuelve el dominio', async () => {
    expect(await hidratarYLeer()).toEqual([])
  })

  /**
   * El caso 2 del encabezado. Si la tabla no responde -migración sin aplicar,
   * corte de red, permisos- se conserva lo que hay en el dispositivo en vez de
   * escribirle una lista vacía encima.
   */
  it('si la tabla no responde, NO se borra lo que ya había en el dispositivo', async () => {
    const { db } = await import('../dbInstance')
    db.visibilidad.decidir(DECISION_LOCAL)
    errores.visibilidad_nutricion = { message: 'relation does not exist', code: '42P01' }

    expect(await hidratarYLeer()).toEqual([DECISION_LOCAL])
  })

  /**
   * LA CARRERA QUE SE ME PASÓ AL CABLEAR ESTO.
   *
   * Manuela decide, la operación entra en la cola y sale hacia el servidor. Si
   * una hidratación arranca DESPUÉS de esa escritura pero ANTES de que la subida
   * aterrice, el servidor devuelve la fila vieja. La guarda de
   * `versionEscrituras()` no la salva: esa solo descarta la foto si se escribió
   * MIENTRAS la descarga estaba en vuelo, no antes.
   *
   * Resultado sin este arreglo: su propia pantalla vuelve al estado anterior y
   * ella cree que no se guardó. Con wifi malo la subida se reintenta durante
   * minutos y la decisión le desaparece una y otra vez — así que vuelve a tocar
   * el interruptor, y ahí sí se pierde de verdad.
   *
   * `conPendientes` existe exactamente para esto. Ver `fusion.ts`.
   */
  it('lo que ella acaba de decidir gana sobre la fila vieja del servidor', async () => {
    tablas.visibilidad_nutricion = [{ ...FILA, ver_contador_kcal: true, estado: 'automatico' }]
    localStorage.setItem(
      'alpha-cola-sync',
      JSON.stringify([
        {
          id: 'op-1',
          tabla: 'visibilidad_nutricion',
          tipo: 'upsert',
          payload: {
            asesorado_id: 'u-ase',
            ver_composicion: false,
            ver_objetivo_calorico: false,
            ver_contador_kcal: false,
            estado: 'decidido',
          },
        },
      ]),
    )

    const [v] = (await hidratarYLeer()) ?? []
    expect(v).toEqual({
      usuarioId: 'u-ase',
      verComposicion: false,
      verObjetivoCalorico: false,
      verContadorKcal: false,
      estado: 'decidido',
    })
  })

  it('un estado que no reconocemos no se cuela como si fuera una decisión', async () => {
    // Una fila corrupta o de una versión futura no puede acabar apagándole las
    // cifras a nadie por accidente: se trata como "nadie ha decidido".
    tablas.visibilidad_nutricion = [{ ...FILA, estado: 'lo-que-sea' }]
    const [v] = (await hidratarYLeer()) ?? []
    expect(v.estado).toBe('automatico')
  })
})
