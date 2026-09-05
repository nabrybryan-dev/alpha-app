/**
 * TESTS QUE DOCUMENTAN FALLOS DE PÉRDIDA SILENCIOSA DE DATOS.
 *
 * ⚠️ ESTOS TESTS FALLAN A PROPÓSITO. No están arreglados: describen el
 * comportamiento CORRECTO que la app todavía no tiene. Sirven de red para
 * cuando se decida arreglarlos.
 *
 * Todos son variantes del mismo fallo que se encontró el 2026-07-26 en la cola
 * de sync: **leer un estado compartido, cruzar un `await`, y escribir la foto
 * vieja encima de lo que pasó en medio**.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Microciclo, SerieRegistrada, Usuario } from '../../domain/types'
import type { OperacionPendiente } from './sync'

const VALENTINA: Usuario = {
  id: 'u-val',
  nombre: 'Valentina Cruz',
  rol: 'asesorado',
  avatarIniciales: 'VC',
}

const serie = (orden: number, cargaKg: number): SerieRegistrada => ({
  orden,
  cargaKg,
  reps: 8,
  rir: 2,
})

function microciclo(series: SerieRegistrada[]): Microciclo {
  return {
    id: 'm-test',
    usuarioId: 'u-val',
    numero: 22,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-07-20',
    sesiones: [
      {
        id: 'ses-1',
        nombre: 'FULL BODY A',
        orden: 1,
        ejercicios: [
          {
            id: 'ej-1',
            categoria: 'CUÁDRICEPS',
            nombre: 'SENTADILLA BÚLGARA',
            cues: 'rango completo',
            prescripcion: '42.5KG A 8 REPS',
            descansoMin: 2,
            sets: 3,
            rango: '8-10',
            repsDiana: 8,
            rirObjetivo: 2,
            series,
          },
        ],
      },
    ],
  }
}

/** Lo que el servidor tiene: el microciclo pautado, sin ninguna serie hecha. */
const FILAS_SERVIDOR: Record<string, unknown[]> = {
  usuarios_app: [
    { id: 'u-val', nombre: 'Valentina Cruz', rol: 'asesorado', avatar_iniciales: 'VC' },
  ],
  perfiles: [],
  microciclos: [{ datos: microciclo([]) }],
  checkins: [],
  adherencias: [],
  planes_nutricionales: [],
  mensajes: [],
  cuestionarios: [],
  respuestas: [],
  contenidos: [],
  premiaciones: [],
  hidratacion: [],
}

interface Peticion {
  url: string
  metodo: string
  cuerpo: string
  resolver: (r: Response) => void
  rechazar: (e: Error) => void
}

/**
 * `fetch` con freno de mano: NADA se resuelve solo. El test decide qué petición
 * aterriza y cuándo, que es la única forma de escribir *mientras* la hidratación
 * está a mitad de sus `await`.
 */
function fetchConFreno() {
  const peticiones: Peticion[] = []
  const fn = vi.fn((entrada: unknown, init?: { method?: string; body?: unknown }) => {
    const url = String(entrada)
    return new Promise<Response>((resolver, rechazar) => {
      peticiones.push({
        url,
        metodo: init?.method ?? 'GET',
        cuerpo: String(init?.body ?? ''),
        resolver,
        rechazar,
      })
    })
  })
  vi.stubGlobal('fetch', fn)
  peticionesVivas = peticiones
  return peticiones
}

const json = (datos: unknown) =>
  new Response(JSON.stringify(datos), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

/** Nombre de la tabla de una URL del REST de Supabase. */
function tablaDe(url: string): string {
  return url.split('/rest/v1/')[1]?.split('?')[0] ?? ''
}

type Freno = (p: Peticion) => boolean

/** La lectura de la tabla `hidratacion`: el punto donde se frena la hidratación. */
const LECTURA_HIDRATACION: Freno = (p) => p.metodo === 'GET' && tablaDe(p.url) === 'hidratacion'
/** La subida del microciclo a la cola: se queda en vuelo, como en el gimnasio. */
/**
 * La subida de lo que el asesorado hace en el microciclo. Desde el 2026-08-15
 * viaja como llamada a `fijar_series_ejercicio` en vez de como upsert de la
 * tabla: el móvil ya no manda el blob entero. Ver el spec del 15 de agosto.
 */
const SUBIDA_MICROCICLO: Freno = (p) =>
  p.metodo === 'POST' &&
  (tablaDe(p.url) === 'microciclos' || tablaDe(p.url).startsWith('rpc/fijar_'))

/** Suelta con datos del servidor todo lo pendiente salvo lo que retenga el freno. */
function soltarLecturas(peticiones: Peticion[], retener: Freno = () => false): number {
  let sueltas = 0
  for (const p of peticiones.splice(0)) {
    if (retener(p)) {
      peticiones.push(p) // se queda esperando: es el freno del test
      continue
    }
    p.resolver(json(p.metodo === 'GET' ? (FILAS_SERVIDOR[tablaDe(p.url)] ?? []) : []))
    sueltas += 1
  }
  return sueltas
}

const tic = () => new Promise((r) => setTimeout(r, 0))

/**
 * Deja correr la app soltando todo lo que vaya pidiendo. Hace falta un `tick`
 * real (no un microtask) porque supabase-js lee el cuerpo de cada `Response`.
 */
async function bombear(peticiones: Peticion[], retener: Freno = () => false): Promise<void> {
  for (let i = 0; i < 40; i++) {
    soltarLecturas(peticiones, retener)
    await tic()
  }
}

function colaEnDisco(): OperacionPendiente[] {
  return JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[]
}

/** Solo las llamadas que suben series de un ejercicio. */
function seriesEnCola(): OperacionPendiente[] {
  return colaEnDisco().filter((o) => o.funcion === 'fijar_series_ejercicio')
}

function seriesDe(m: Microciclo | undefined): number[] {
  return (m?.sesiones[0].ejercicios[0].series ?? []).map((s) => s.orden)
}

let modulos:
  | {
      sync: typeof import('./sync')
      hidratar: typeof import('./hidratar')
      db: import('../repos').Db
    }
  | undefined
let peticionesVivas: Peticion[] | undefined

async function appEnModoNube() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  const hidratar = await import('./hidratar')
  const { crearMockDb, aplicarSnapshot } = await import('../mockDb')
  const db = sync.crearDbSincronizada(crearMockDb())

  // Estado de partida: el microciclo pautado ya bajado, sin series hechas.
  aplicarSnapshot({
    usuarios: [VALENTINA],
    perfiles: [],
    microciclos: [microciclo([])],
    checkins: [],
    planes: [],
    adherencias: [],
    hidratacion: [],
    mensajes: [],
    cuestionarios: [],
    respuestas: [],
    contenidos: [],
    premiaciones: [],
  })
  modulos = { sync, hidratar, db }
  return modulos
}

describe('hidratación desde la nube vs. escrituras locales en curso', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(async () => {
    // El procesado de la cola sobrevive al test: se le sueltan las peticiones
    // que hayan quedado colgadas para que `colaEnReposo` pueda resolver.
    if (peticionesVivas) await bombear(peticionesVivas)
    await modulos?.sync.colaEnReposo()
    peticionesVivas = undefined
    modulos = undefined
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
    localStorage.clear() // no dejar `alpha-db-v2` puesto para otros ficheros
  })

  /**
   * ESCENARIO REAL
   * Valentina desbloquea el móvil entre serie y serie. supabase-js emite
   * SIGNED_IN en cada refoco, y `SessionProvider` arranca `hidratarDesdeNube()`.
   * Esa descarga tarda lo que tarde el wifi del gimnasio. Mientras baja, ella
   * le da a "Guardar serie".
   *
   * `hidratarDesdeNube` leyó los microciclos ANTES de esa pulsación y llama a
   * `aplicarSnapshot` DESPUÉS: la serie recién registrada se sobrescribe con la
   * foto vieja del servidor. Sin error, sin aviso: desaparece de la pantalla.
   */
  it('la serie registrada durante la descarga NO debe borrarse al aplicar el snapshot', async () => {
    const { hidratar, db } = await appEnModoNube()
    const peticiones = fetchConFreno()

    const enCurso = hidratar.hidratarDesdeNube()

    // Las 11 lecturas del Promise.all ya salieron: el servidor devuelve el
    // microciclo SIN series. Se retiene `hidratacion`, que se pide después.
    await vi.waitFor(() => expect(peticiones.length).toBeGreaterThanOrEqual(11))
    soltarLecturas(peticiones, LECTURA_HIDRATACION)

    // …y aquí, con la hidratación a medias, Valentina guarda la serie.
    await vi.waitFor(() => expect(peticiones.some((p) => tablaDe(p.url) === 'hidratacion')).toBe(true))
    db.microciclos.registrarSerie('m-test', 'ej-1', serie(1, 42.5))
    expect(seriesDe(db.microciclos.byUsuario('u-val')[0])).toEqual([1]) // está guardada

    // La descarga termina y aplica la foto que traía.
    await bombear(peticiones)
    await enCurso

    expect(seriesDe(db.microciclos.byUsuario('u-val')[0])).toEqual([1])
  })

  /**
   * ESCENARIO REAL (la parte que hace que la pérdida sea PERMANENTE)
   *
   * Tras el borrado del test anterior, la serie 1 sigue viva en la cola de
   * sync, así que "solo" era un susto visual. Pero Valentina registra la serie
   * 2: la subida reconstruye el payload leyendo el estado local, y
   * `integrarEnCola` REEMPLAZA la operación pendiente que sí tenía la serie 1.
   *
   * Si el estado local estuviera pisado, la serie 1 no estaría en el móvil, ni
   * en la cola, y nunca llegaría al servidor. Ni reintento, ni descarte, ni
   * error.
   *
   * El colapso de operaciones sigue existiendo tras pasar a escrituras
   * quirúrgicas (`claveRpc` junta las del mismo ejercicio), así que esta red
   * hace falta igual: lo que la sostiene es que el local NO se pise.
   */
  it('la serie borrada por el snapshot NO debe desaparecer también de la cola de sync', async () => {
    const { hidratar, db } = await appEnModoNube()
    const peticiones = fetchConFreno()

    const enCurso = hidratar.hidratarDesdeNube()
    await vi.waitFor(() => expect(peticiones.length).toBeGreaterThanOrEqual(11))
    soltarLecturas(peticiones, LECTURA_HIDRATACION)
    await vi.waitFor(() => expect(peticiones.some((p) => tablaDe(p.url) === 'hidratacion')).toBe(true))

    db.microciclos.registrarSerie('m-test', 'ej-1', serie(1, 42.5))
    // Se cuenta LA OPERACION DE LAS SERIES, no el total de la cola: desde el
    // 2026-09-04 anotar una serie encola tambien la fecha de la sesion, y un
    // total clavado a 1 convertiria este guardian en un detector de operaciones
    // nuevas en vez de un detector de series perdidas, que es lo suyo.
    expect(seriesEnCola()).toHaveLength(1)

    // La hidratación termina, pero la SUBIDA del microciclo sigue en vuelo:
    // wifi de gimnasio. La serie 1 solo vive ya dentro de esa operación.
    await bombear(peticiones, SUBIDA_MICROCICLO)
    await enCurso

    // Valentina sigue entrenando y registra la serie 2.
    db.microciclos.registrarSerie('m-test', 'ej-1', serie(2, 42.5))

    // Por `funcion` y no por `tabla`: sobre `microciclos` hay ya tres llamadas
    // distintas y `find` cogeria la primera que pasara por ahi.
    const opSeries = seriesEnCola()[0]
    const series = (opSeries?.payload.p_series ?? []) as { orden: number }[]
    expect(series.map((s) => s.orden)).toEqual([1, 2])
  })
})

describe('el interruptor de la tabla hidratacion', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(async () => {
    if (peticionesVivas) await bombear(peticionesVivas)
    await modulos?.sync.colaEnReposo()
    peticionesVivas = undefined
    modulos = undefined
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
    localStorage.clear()
  })

  /**
   * ESCENARIO REAL
   * `hidratarDesdeNube` decide si la tabla `hidratacion` existe mirando SOLO si
   * la petición dio error (hidratar.ts:76-77):
   *
   *     const hidratacion = await sb.from('hidratacion').select('*')
   *     marcarTablaHidratacion(!hidratacion.error)
   *
   * Pero un error ahí no significa "la tabla no existe": significa cualquier
   * cosa, incluido un 500 pasajero o un corte de wifi. Como esa lectura va
   * SUELTA (fuera del `Promise.all`), un fallo suyo no rompe la hidratación:
   * la apaga en silencio.
   *
   * A partir de ese momento `registrarHidratacion` deja de encolar
   * (sync.ts:313) y cada vaso de agua se queda solo en el móvil… hasta que la
   * siguiente hidratación con éxito lo borre con la foto del servidor.
   */
  it('un fallo pasajero al leer hidratacion no debe dejar de sincronizar el agua', async () => {
    const { hidratar, sync, db } = await appEnModoNube()
    const peticiones = fetchConFreno()

    const enCurso = hidratar.hidratarDesdeNube()
    await vi.waitFor(() => expect(peticiones.length).toBeGreaterThanOrEqual(11))
    soltarLecturas(peticiones, LECTURA_HIDRATACION)

    // La lectura de `hidratacion` se cae con un 500 pasajero.
    await vi.waitFor(() => expect(peticiones.some(LECTURA_HIDRATACION)).toBe(true))
    for (const p of peticiones.splice(0)) {
      if (LECTURA_HIDRATACION(p)) {
        p.resolver(
          new Response(JSON.stringify({ message: 'canceling statement due to statement timeout' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }),
        )
      } else peticiones.push(p)
    }
    await bombear(peticiones)
    await enCurso

    // Valentina se bebe un vaso de agua.
    db.nutricion.registrarHidratacion('u-val', '2026-07-27', 250)
    expect(db.nutricion.hidratacionDe('u-val', '2026-07-27')).toBe(250) // se ve en pantalla

    expect(sync.pendientesDeSync()).toBe(1) // …pero ¿va camino del servidor?
  })
})

describe('cerrar sesión con escrituras sin subir', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(async () => {
    await modulos?.sync.colaEnReposo()
    modulos = undefined
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
    localStorage.clear()
  })

  /**
   * ESCENARIO REAL
   * Valentina termina de entrenar en el sótano del gimnasio, sin señal. Sus
   * series están en local y en la cola, pero no han subido. Le da a
   * "Cerrar sesión".
   *
   * `cerrarSesion` (SessionProvider.tsx:210-215) hace `await procesarCola()` con
   * el comentario "subir lo pendiente antes de salir" — pero `procesarCola`
   * RESUELVE IGUAL cuando `drenar` se rinde por falta de red (sync.ts:202) o
   * anota un reintento y vuelve (sync.ts:211). No devuelve nada que distinga
   * "lo subí todo" de "no subí nada".
   *
   * Acto seguido `signOut()` dispara SIGNED_OUT, que borra la base local Y las
   * dos colas (SessionProvider.tsx:115-119 + sync.ts:60-63, que quita también
   * `alpha-cola-descartes`). El entreno entero se evapora: no está en el móvil,
   * no está en la cola, no está en descartes y nunca llegó al servidor.
   *
   * El mismo borrado ocurre SIN pasar por `cerrarSesion` cuando Supabase
   * invalida la sesión por su cuenta (token revocado, cambio de contraseña):
   * ahí SIGNED_OUT llega directo y `procesarCola` ni siquiera se intenta.
   */
  it('las series sin subir no deben desaparecer al cerrar sesión', async () => {
    const { sync, db } = await appEnModoNube()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin señal en el sótano')))

    db.microciclos.registrarSerie('m-test', 'ej-1', serie(1, 42.5))
    db.microciclos.registrarSerie('m-test', 'ej-1', serie(2, 45))
    await sync.colaEnReposo()

    // El intento de subida falló: sigue pendiente. Se mira que HAYA pendientes,
    // no cuántos: lo que este test defiende es que el entreno sea rescatable, y
    // el número exacto de operaciones no es suyo.
    expect(sync.pendientesDeSync()).toBeGreaterThan(0)

    // --- Secuencia exacta de SessionProvider al cerrar sesión ---
    await sync.procesarCola() // "subir lo pendiente antes de salir"
    localStorage.removeItem('alpha-db-v2') // SIGNED_OUT
    sync.limpiarColasDeSync() // SIGNED_OUT
    // ------------------------------------------------------------

    const descartes = JSON.parse(
      localStorage.getItem('alpha-cola-descartes') ?? '[]',
    ) as OperacionPendiente[]
    const rescatable = sync.pendientesDeSync() + descartes.length
    expect(rescatable).toBeGreaterThan(0)
  })
})

describe('dos pestañas abiertas sobre el mismo localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  /**
   * ESCENARIO REAL
   * Bryan (o Manuela) tiene la app abierta en dos pestañas del escritorio.
   *
   * `crearMockDb` lee `alpha-db-v2` UNA vez al arrancar y guarda ese objeto en
   * `ref.actual` (mockDb.ts:65). Cada escritura posterior serializa esa copia en
   * memoria ENTERA sobre la clave (mockDb.ts:69-72 + 35-38): nunca se relee el
   * disco. La pestaña que escribe de segunda pisa lo que hizo la primera.
   *
   * Es el mismo fallo de la cola, con la pestaña haciendo de `await`.
   */
  it('lo que escribe una pestaña no debe borrarlo la otra', async () => {
    vi.resetModules()
    const { crearMockDb } = await import('../mockDb')

    const pestanaA = crearMockDb()
    const pestanaB = crearMockDb() // se abre con la foto de este momento

    pestanaA.bienestar.guardar({
      id: 'ck-val-2026-07-27',
      usuarioId: 'u-valentina',
      fecha: '2026-07-27',
      pasos: 8400,
      comentarios: 'dormí mal pero entrené bien',
    })
    // La pestaña B toca cualquier otra cosa, sin saber nada del check-in.
    pestanaB.nutricion.registrarHidratacion('u-valentina', '2026-07-27', 250)

    const enDisco = JSON.parse(localStorage.getItem('alpha-db-v2') ?? '{}') as {
      checkins?: { id: string }[]
    }
    expect(enDisco.checkins?.map((c) => c.id)).toContain('ck-val-2026-07-27')
  })
})
