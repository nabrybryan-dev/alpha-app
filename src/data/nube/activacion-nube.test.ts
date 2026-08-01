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
 *   · Cambiar de estado es un `update` de la COLUMNA `estado`, nunca un upsert del
 *     blob. Así el coach no reescribe nada del asesorado.   ← se prueba aquí
 *   · La hidratación lee la columna y esa manda sobre `datos.estado`.  ← aquí
 *   · Un trigger impide a quien no es staff cambiar la columna (migración 0021).
 *     Eso vive en el servidor y no lo ve ningún test de este repo.
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
  (op.payload.id as string | undefined) ?? op.filtro?.id

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
   * EL FALLO 1, EN UNA LÍNEA: si al cerrar sale un upsert con `datos`, el servidor
   * recibe la copia que el coach tenía en el móvil y pierde lo que el asesorado
   * registró después de la última hidratación.
   */
  it('no re-sube el blob del microciclo que cierra: solo cambia su estado', async () => {
    const { sync, cola, db } = await appEnModoNube([
      micro('m22', 22, 'activo'),
      micro('m23', 23, 'propuesto'),
    ])
    sync.limpiarColasDeSync()

    db.microciclos.activarPropuesta('m23')

    const sobreM22 = opsDeMicrociclos(cola.leerCola()).filter((o) => idDe(o) === 'm22')
    expect(sobreM22).toHaveLength(1)
    expect(sobreM22[0].tipo).toBe('update')
    expect(sobreM22[0].payload).toEqual({ estado: 'cerrado' })
    expect(sobreM22[0].payload.datos).toBeUndefined()
  })

  it('tampoco re-sube el blob de la propuesta: ya está en el servidor', async () => {
    const { sync, cola, db } = await appEnModoNube([
      micro('m22', 22, 'activo'),
      micro('m23', 23, 'propuesto'),
    ])
    sync.limpiarColasDeSync()

    db.microciclos.activarPropuesta('m23')

    const sobreM23 = opsDeMicrociclos(cola.leerCola()).filter((o) => idDe(o) === 'm23')
    expect(sobreM23).toHaveLength(1)
    expect(sobreM23[0].tipo).toBe('update')
    expect(sobreM23[0].payload).toEqual({ estado: 'activo' })
  })

  /**
   * El orden importa cuando la cola se drena a medias —se va la señal justo entre
   * las dos operaciones—. Activar primero deja una ventana con DOS activos: malo,
   * pero el asesorado tiene algo que entrenar y la siguiente pasada lo repara.
   * Cerrar primero la dejaría con CERO: abre la app y no tiene programación.
   */
  it('encola primero la activación y después el cierre', async () => {
    const { sync, cola, db } = await appEnModoNube([
      micro('m22', 22, 'activo'),
      micro('m23', 23, 'propuesto'),
    ])
    sync.limpiarColasDeSync()

    db.microciclos.activarPropuesta('m23')

    expect(opsDeMicrociclos(cola.leerCola()).map(idDe)).toEqual(['m23', 'm22'])
  })

  it('cierra TODOS los activos previos, no solo uno', async () => {
    const { sync, cola, db } = await appEnModoNube([
      micro('m21', 21, 'activo'),
      micro('m22', 22, 'activo'), // el estado roto que ya pasó en producción
      micro('m23', 23, 'propuesto'),
    ])
    sync.limpiarColasDeSync()

    db.microciclos.activarPropuesta('m23')

    const cerrados = opsDeMicrociclos(cola.leerCola())
      .filter((o) => o.payload.estado === 'cerrado')
      .map(idDe)
      .sort()
    expect(cerrados).toEqual(['m21', 'm22'])
  })

  /**
   * Los `update` no se deduplican en la cola (`claveDeFila` solo mira los upsert),
   * así que dos activaciones seguidas dejan las cuatro operaciones en orden. Es lo
   * que se quiere: son transiciones, no fotos.
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

    expect(opsDeMicrociclos(cola.leerCola()).map(idDe)).toEqual(['m23', 'm22', 'm24', 'm23'])
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
