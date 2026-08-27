/**
 * La hidratación se salta la descarga cuando el servidor no ha cambiado.
 *
 * `hidratarDesdeNube` baja 21 tablas ENTERAS cada 45 s por pestaña abierta, y
 * para el coach RLS no acota nada: se lleva la cartera completa. Casi siempre
 * para encontrarse exactamente lo mismo.
 *
 * La firma (migración 0049) cuesta una consulta pequeña y dice si algo cambió.
 * Es TODO O NADA a propósito: si ninguna tabla cambió, esta función se va antes
 * de construir el snapshot, así que no llega a escribir y no hay forma de que
 * un salto borre nada. Saltarse tablas sueltas exigiría mezclar con lo local y
 * con la cola de pendientes, y ahí es donde este archivo ya perdió datos dos
 * veces. Ver `docs/specs/2026-08-27-sincronizacion-incremental.md`.
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

/** Qué tablas se han pedido desde el último `reiniciarLecturas()`. */
let lecturas: string[] = []
/** Lo que devuelve el RPC de la firma. */
let respuestaFirma: { data: unknown; error: Error } = { data: null, error: null }

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => {
      lecturas.push(tabla)
      return { select: () => respuesta([]) }
    },
    rpc: (fn: string) =>
      fn === 'firma_de_sincronizacion'
        ? Promise.resolve(respuestaFirma)
        : Promise.resolve({ data: [], error: null }),
  }),
}))

const firmaDe = (filasDeMicrociclos: number, ultimo = '2026-08-27T05:00:00Z') => ({
  data: [
    { tabla: 'microciclos', filas: String(filasDeMicrociclos), ultimo_cambio: ultimo },
    { tabla: 'usuarios_app', filas: '26', ultimo_cambio: ultimo },
  ],
  error: null as Error,
})

async function hidratar() {
  const { hidratarDesdeNube } = await import('./hidratar')
  await hidratarDesdeNube()
}

async function firmaGuardada() {
  const { instantaneaLocal } = await import('../mockDb')
  return instantaneaLocal().firmaSync
}

describe('la firma decide si hay que descargar', () => {
  beforeEach(() => {
    localStorage.clear()
    lecturas = []
    respuestaFirma = firmaDe(113)
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('la primera vez descarga y se queda con la firma', async () => {
    await hidratar()

    expect(lecturas.length).toBeGreaterThan(10)
    expect(await firmaGuardada()).toEqual({
      microciclos: { filas: 113, ultimo: '2026-08-27T05:00:00Z' },
      usuarios_app: { filas: 26, ultimo: '2026-08-27T05:00:00Z' },
    })
  })

  it('si nada cambió, la segunda no pide una sola tabla', async () => {
    await hidratar()
    expect(lecturas.length).toBeGreaterThan(10)

    lecturas = []
    await hidratar()

    expect(lecturas).toEqual([])
  })

  /**
   * EL CASO QUE JUSTIFICA EL CONTEO. El coach borra un microciclo: ninguna fila
   * se modificó —una dejó de existir— así que un delta por fila no vería nada y
   * el microciclo borrado se quedaría en el teléfono de la asesorada para
   * siempre. El conteo baja, y eso sí se ve.
   */
  it('un BORRADO en el servidor obliga a descargar de nuevo', async () => {
    await hidratar()

    lecturas = []
    respuestaFirma = firmaDe(112) // una fila menos, misma fecha
    await hidratar()

    expect(lecturas.length).toBeGreaterThan(10)
  })

  it('una modificación mueve la fecha y también obliga a descargar', async () => {
    await hidratar()

    lecturas = []
    respuestaFirma = firmaDe(113, '2026-08-27T06:00:00Z')
    await hidratar()

    expect(lecturas.length).toBeGreaterThan(10)
  })

  /**
   * LA QUE PROTEGE EL DESPLIEGUE. Mientras la 0049 no esté aplicada el RPC no
   * existe. Tiene que descargarse como siempre: si un fallo de la firma se
   * leyera como «no ha cambiado nada», la app dejaría de refrescarse contra un
   * servidor vivo y nadie vería un error.
   */
  it('si el RPC no existe todavía, descarga siempre', async () => {
    respuestaFirma = { data: null, error: { message: 'function does not exist' } }

    await hidratar()
    expect(lecturas.length).toBeGreaterThan(10)
    expect(await firmaGuardada()).toBeUndefined()

    lecturas = []
    await hidratar()
    expect(lecturas.length).toBeGreaterThan(10)
  })
})
