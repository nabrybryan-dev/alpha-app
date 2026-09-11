/**
 * Qué manda el dispositivo del coach cuando activa el microciclo siguiente.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LOS DOS FALLOS QUE DOCUMENTAN ESTOS TESTS
 * ────────────────────────────────────────────────────────────────────────────
 * Los encontró una revisión adversaria del mecanismo de activación y los verifiqué
 * en el código antes de escribirlos. Los dos son de la misma familia que el resto
 * de pérdidas de este repo: **el estado real vive dentro del blob `datos` y gana
 * el último que escriba**.
 *
 * 1. **Cerrar re-subía el microciclo entero desde la copia del coach.** Su copia
 *    de lo del asesorado es la de la última hidratación (cada 45 s, y solo con la
 *    pestaña visible). Si el asesorado registró series después, el upsert del coach
 *    pisaba la fila del servidor y **esas series desaparecían**, sin error.
 *
 * 2. **El estado viajaba dentro del blob.** El asesorado que entrenó sin señal
 *    tiene en su cola un upsert con `estado: 'activo'`; al recuperar cobertura eso
 *    sube y **reabre el microciclo que el coach acaba de cerrar** → dos activos,
 *    que es el estado que ya rompió producción con dos asesoradas.
 *
 * El arreglo tiene tres piezas y solo dos se pueden probar aquí:
 *
 *   · Cambiar de estado nunca es un upsert del blob. Así el coach no reescribe
 *     nada del asesorado.   ← se prueba aquí
 *   · La hidratación lee la columna y esa manda sobre `datos.estado`.  ← aquí
 *   · Un trigger impide a quien no es staff cambiar la columna (migración 0021).
 *     Eso vive en el servidor y no lo ve ningún test de este repo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ CAMBIÓ EL 2026-09-10, Y POR QUÉ ESTOS TESTS DICEN AHORA OTRA COSA
 * ────────────────────────────────────────────────────────────────────────────
 * Activar eran DOS operaciones sueltas —abrir la propuesta y después cerrar los
 * activos— y el orden estaba elegido a conciencia: si la cola se drenaba a medias,
 * ese orden dejaba DOS activos (malo, pero con algo que entrenar) y el contrario
 * dejaba CERO (abrir la app sin programación). Elegir entre dos males era lo
 * único que se podía hacer desde el cliente.
 *
 * Ahora es UNA: la RPC `activar_microciclo` (migración `0060`) cierra y abre dentro
 * de la misma transacción, así que no existe el instante intermedio y no hay nada
 * que elegir. Lo que aquí se probaba —el orden de encolado, el cierre de todos los
 * activos previos— o desaparece o se prueba donde ahora vive: el cierre de TODOS
 * sigue comprobándose, pero sobre el estado local, porque el servidor hace lo mismo
 * y su prueba es `supabase/comprobar-0060.sql`.
 *
 * Sin este cambio, el índice único parcial de `R-01` no se puede aplicar: un índice
 * único no se difiere, así que el instante con dos activos dejaría de ser una
 * ventana rara para ser un error en cada activación.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Microciclo, Usuario } from '../../domain/types'
import type { OperacionPendiente } from './sync'

const COACH: Usuario = { id: 'u-coach', nombre: 'Coach', rol: 'coach', avatarIniciales: 'CO' }
const ASESORADO: Usuario = { id: 'u-ase', nombre: 'Asesorado', rol: 'asesorado', avatarIniciales: 'AS' }

function micro(id: string, numero: number, estado: Microciclo['estado']): Microciclo {
  return {
    id,
    usuarioId: ASESORADO.id,
    numero,
    cadenciaDias: 8,
    estado,
    fechaInicio: '2026-07-20',
    sesiones: [
      {
        id: `${id}-s1`,
        nombre: 'FULL A',
        orden: 1,
        ejercicios: [
          {
            id: `${id}-e1`,
            categoria: 'CUÁDRICEPS',
            nombre: 'SENTADILLA',
            cues: '',
            prescripcion: '',
            descansoMin: 2,
            sets: 3,
            rango: '8-10',
            repsDiana: 8,
            rirObjetivo: 2,
            series: [],
          },
        ],
      },
    ],
  }
}

let modulos:
  | {
      sync: typeof import('./sync')
      cola: typeof import('./cola')
      db: import('../repos').Db
    }
  | undefined

async function appEnModoNube(microciclos: Microciclo[]) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  // La misma instancia del módulo que usa `sync`: importarla después de
  // `resetModules` y antes del siguiente reset es lo que lo garantiza. Con dos
  // instancias se encolaría en una y se leería de la otra, que es justo el fallo
  // contra el que avisa el encabezado de `cola.ts`.
  const cola = await import('./cola')
  const { crearMockDb, aplicarSnapshot } = await import('../mockDb')
  const db = sync.crearDbSincronizada(crearMockDb())
  aplicarSnapshot({
    usuarios: [COACH, ASESORADO],
    perfiles: [],
    microciclos,
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
  modulos = { sync, cola, db }
  return modulos
}

const opsDeMicrociclos = (cola: OperacionPendiente[]) =>
  cola.filter((o) => o.tabla === 'microciclos')

const idDe = (op: OperacionPendiente) =>
  (op.payload.id as string | undefined) ??
  (op.payload.p_propuesta_id as string | undefined) ??
  op.filtro?.id

describe('activar el microciclo siguiente desde el dispositivo del coach', () => {
  beforeEach(() => localStorage.clear())

  afterEach(async () => {
    await modulos?.sync.colaEnReposo()
    modulos = undefined
    vi.unstubAllEnvs()
    vi.resetModules()
    localStorage.clear()
  })

  /**
   * EL FALLO 1, EN UNA LÍNEA: si al activar sale un upsert con `datos`, el servidor
   * recibe la copia que el coach tenía en el móvil y pierde lo que el asesorado
   * registró después de la última hidratación. Sigue siendo el fallo a evitar; lo
   * que cambió es que ahora se evita con una sola operación en vez de dos.
   */
  it('no sube el blob de nadie: solo pide la activación por su id', async () => {
    const { sync, cola, db } = await appEnModoNube([
      micro('m22', 22, 'activo'),
      micro('m23', 23, 'propuesto'),
    ])
    sync.limpiarColasDeSync()

    db.microciclos.activarPropuesta('m23')

    const ops = opsDeMicrociclos(cola.leerCola())
    expect(ops).toHaveLength(1)
    expect(ops[0].tipo).toBe('rpc')
    expect(ops[0].funcion).toBe('activar_microciclo')
    expect(ops[0].payload).toEqual({ p_propuesta_id: 'm23' })
    expect(ops[0].payload.datos).toBeUndefined()
  })

  /**
   * ESTE TEST SUSTITUYE A «encola primero la activación y después el cierre».
   *
   * Aquel fijaba una elección entre dos males —dejar dos activos o dejar cero— que
   * solo existía porque eran dos operaciones. Con una, el cierre del viejo no viaja
   * por la cola: lo hace el servidor en la misma transacción, así que no hay ninguna
   * operación sobre `m22` que ordenar.
   */
  it('no encola nada sobre el microciclo que se cierra: de eso se encarga el servidor', async () => {
    const { sync, cola, db } = await appEnModoNube([
      micro('m22', 22, 'activo'),
      micro('m23', 23, 'propuesto'),
    ])
    sync.limpiarColasDeSync()

    db.microciclos.activarPropuesta('m23')

    expect(opsDeMicrociclos(cola.leerCola()).map(idDe)).toEqual(['m23'])
  })

  /**
   * Cerrar TODOS los activos —no solo uno— sigue siendo la regla: si ya había dos,
   * activar repara el estado roto en vez de heredarlo. Lo que cambió es dónde se
   * comprueba. En el servidor lo hace `activar_microciclo` y lo prueba
   * `supabase/comprobar-0060.sql`; aquí se comprueba en la copia local, que es la
   * que el coach ve en pantalla mientras la cola drena.
   */
  it('cierra en local TODOS los activos previos, no solo uno', async () => {
    const { sync, db } = await appEnModoNube([
      micro('m21', 21, 'activo'),
      micro('m22', 22, 'activo'), // el estado roto que ya pasó en producción
      micro('m23', 23, 'propuesto'),
    ])
    sync.limpiarColasDeSync()

    db.microciclos.activarPropuesta('m23')

    const porId = Object.fromEntries(
      db.microciclos.byUsuario(ASESORADO.id).map((m) => [m.id, m.estado]),
    )
    expect(porId).toEqual({ m21: 'cerrado', m22: 'cerrado', m23: 'activo' })
  })

  /**
   * Dos activaciones seguidas dejan sus dos llamadas, en orden: son transiciones
   * distintas, no dos fotos de lo mismo. La `claveRpc` colapsa una activación
   * repetida de la MISMA propuesta, que sí es la misma transición.
   */
  it('la cola conserva el orden de dos activaciones seguidas', async () => {
    const { sync, cola, db } = await appEnModoNube([
      micro('m22', 22, 'activo'),
      micro('m23', 23, 'propuesto'),
      micro('m24', 24, 'propuesto'),
    ])
    sync.limpiarColasDeSync()

    db.microciclos.activarPropuesta('m23')
    db.microciclos.activarPropuesta('m24')

    expect(opsDeMicrociclos(cola.leerCola()).map(idDe)).toEqual(['m23', 'm24'])
  })

  /** Guardar una propuesta SÍ crea la fila: ahí el upsert entero es lo correcto. */
  it('guardar una propuesta sigue subiendo la fila completa', async () => {
    const { sync, cola, db } = await appEnModoNube([micro('m22', 22, 'activo')])
    sync.limpiarColasDeSync()

    db.microciclos.guardarPropuesta(micro('m23', 23, 'propuesto'))

    const ops = opsDeMicrociclos(cola.leerCola())
    expect(ops).toHaveLength(1)
    expect(ops[0].tipo).toBe('upsert')
    expect(ops[0].payload.datos).toBeDefined()
    expect(ops[0].payload.estado).toBe('propuesto')
  })
})
