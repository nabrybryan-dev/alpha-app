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

/** Qué tablas se han pedido desde el último reinicio. */
let lecturas: string[] = []
/** Qué devuelve cada tabla. Lo que no esté, sale vacío. */
let tablas: Record<string, unknown[]> = {}
/** Lo que devuelve el RPC de la firma. */
let respuestaFirma: { data: unknown; error: Error } = { data: null, error: null }

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => {
      lecturas.push(tabla)
      return { select: () => respuesta(tablas[tabla] ?? []) }
    },
    rpc: (fn: string) =>
      fn === 'firma_de_sincronizacion'
        ? Promise.resolve(respuestaFirma)
        : Promise.resolve({ data: [], error: null }),
  }),
}))

const FIJA = '2026-08-27T05:00:00Z'

/**
 * Una firma con todas las tablas iguales salvo las que se le pasen. Así un test
 * cambia UNA y el resto se queda quieto, que es el escenario real.
 */
const firmaCon = (cambios: Record<string, string> = {}) => ({
  data: [
    'usuarios_app', 'perfiles', 'microciclos', 'checkins', 'checkins_nutricion',
    'adherencias', 'planes_nutricionales', 'mensajes', 'cuestionarios',
    'respuestas', 'contenidos', 'premiaciones', 'hidratacion',
    'perfil_alimentario', 'registro_comida', 'registro_item',
    'preferencia_estado', 'prueba_calibracion', 'visibilidad_nutricion',
    'perfil_alimentario_veto', 'despensa',
  ].map((tabla) => ({
    tabla,
    filas: cambios[tabla] ?? '10',
    ultimo_cambio: FIJA,
  })),
  error: null as Error,
})

const firmaDe = (filasDeMicrociclos: number, ultimo = FIJA) => ({
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
    tablas = {}
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

describe('el salto por tabla', () => {
  const USUARIO = { id: 'u-val', nombre: 'Valentina', rol: 'asesorado', avatar_iniciales: 'VC' }

  beforeEach(() => {
    localStorage.clear()
    lecturas = []
    tablas = {}
    respuestaFirma = firmaCon()
    vi.resetModules()
  })

  it('solo pide las tablas que cambiaron', async () => {
    tablas.usuarios_app = [USUARIO]
    await hidratar()

    lecturas = []
    respuestaFirma = firmaCon({ microciclos: '11' }) // solo esta se movió
    await hidratar()

    expect(lecturas).toContain('microciclos')
    expect(lecturas).not.toContain('usuarios_app')
    expect(lecturas).not.toContain('mensajes')
  })

  /**
   * LA PRUEBA QUE DECIDE SI ESTO ES SEGURO.
   *
   * `aplicarSnapshot` reemplaza la instantánea ENTERA. Si una tabla que no se
   * pidió llegara vacía al snapshot, no se quedaría igual: BORRARÍA lo que la
   * persona ya tenía en el dispositivo. Y sin error, que es lo peor.
   *
   * Aquí el servidor devuelve vacío para TODO en la segunda vuelta. Lo que se
   * conservó tiene que seguir estando.
   */
  it('lo que no se pidió NO se pierde, aunque el servidor devuelva vacío', async () => {
    tablas.usuarios_app = [USUARIO]
    await hidratar()

    const { instantaneaLocal } = await import('../mockDb')
    expect(instantaneaLocal().usuarios.some((u) => u.id === 'u-val')).toBe(true)

    // El servidor no devuelve nada de nada, y solo `microciclos` cambió.
    tablas = {}
    respuestaFirma = firmaCon({ microciclos: '11' })
    await hidratar()

    const despues = (await import('../mockDb')).instantaneaLocal()
    expect(despues.usuarios.some((u) => u.id === 'u-val')).toBe(true)
    // Y lo que sí se pidió refleja lo que dijo el servidor: vacío.
    expect(despues.microciclos).toEqual([])
  })

  /**
   * `checkins` se arma con la tabla y con la vista de la nutricionista. Si solo
   * una se movió, hay que rebajar las dos: media hidratación sería peor que
   * ninguna.
   */
  it('un campo con dos fuentes se rebaja entero si una se movió', async () => {
    await hidratar()

    lecturas = []
    respuestaFirma = firmaCon({ checkins_nutricion: '11' })
    await hidratar()

    expect(lecturas).toContain('checkins')
    expect(lecturas).toContain('checkins_nutricion')
  })
})
