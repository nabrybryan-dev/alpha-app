/**
 * El estado del microciclo viaja en la COLUMNA y en ningún otro sitio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA QUE DOCUMENTA ESTE ARCHIVO
 * ─────────────────────────────────────────────────────────────────────────────
 * El estado vive hoy en dos sitios: la columna `estado` de `microciclos` y la
 * clave `estado` de dentro del blob `datos`. Es el `R-03` de la auditoría, y no
 * es teórico: el 2026-08-16 aparecieron **18 microciclos con la columna en
 * `cerrado` y el JSON en `activo`**, de 17 asesorados, porque una carga vieja
 * cerró solo la columna.
 *
 * La lectura ya está resuelta —`microciclosDe()` hace que la columna mande— pero
 * **la escritura no**, y la parte que se escapa no se ve leyendo: no hay ningún
 * `datos.estado = …` que buscar. `subirMicrociclo` manda `datos: microciclo`, el
 * objeto local ENTERO, y el estado se cuela dentro al serializarlo. Cada guardado
 * de la app reponía la clave.
 *
 * Lo fijado aquí: lo que sube al servidor lleva el estado **en la columna** y el
 * blob va sin él. Nada más cambia — las series, las sesiones y el resto del
 * microciclo viajan igual, porque el blob sigue siendo la copia de trabajo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE ESTE ARCHIVO **NO** ARREGLA, Y CONVIENE NO CREERSE
 * ─────────────────────────────────────────────────────────────────────────────
 * Los blobs ya guardados siguen llevando la clave (155 de 155 el 2026-09-10), y
 * hay dos piezas del servidor que la reponen: `plantilla-carga-microciclo.sql` y
 * la RPC `activar_microciclo` de la `0060`. Limpiar los datos sin cambiar esas dos
 * sería barrer con la puerta abierta. Esto para la hemorragia por el lado de la
 * app; la limpieza va aparte y con su comprobante.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Microciclo, Usuario } from '../../domain/types'
import type { OperacionPendiente } from './sync'

const COACH: Usuario = { id: 'u-coach', nombre: 'Coach', rol: 'coach', avatarIniciales: 'CO' }
const ASESORADO: Usuario = {
  id: 'u-ase',
  nombre: 'Asesorado',
  rol: 'asesorado',
  avatarIniciales: 'AS',
}

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

const upsertsDeMicrociclos = (cola: OperacionPendiente[]) =>
  cola.filter((o) => o.tabla === 'microciclos' && o.tipo === 'upsert')

describe('el estado del microciclo sube por la columna, no dentro del blob', () => {
  beforeEach(() => localStorage.clear())

  afterEach(async () => {
    await modulos?.sync.colaEnReposo()
    modulos = undefined
    vi.unstubAllEnvs()
    vi.resetModules()
    localStorage.clear()
  })

  it('guardar una propuesta manda el estado en la columna y NO dentro de datos', async () => {
    const { sync, cola, db } = await appEnModoNube([micro('m22', 22, 'activo')])
    sync.limpiarColasDeSync()

    db.microciclos.guardarPropuesta(micro('m23', 23, 'propuesto'))

    const [op] = upsertsDeMicrociclos(cola.leerCola())
    expect(op.payload.estado).toBe('propuesto')
    const datos = op.payload.datos as Record<string, unknown>
    expect(datos).toBeDefined()
    expect('estado' in datos).toBe(false)
  })

  /**
   * Quitar una clave del objeto no puede llevarse nada más por delante: el blob
   * sigue siendo la copia de trabajo del microciclo y ahí viajan las sesiones.
   */
  it('el resto del microciclo viaja intacto', async () => {
    const { sync, cola, db } = await appEnModoNube([micro('m22', 22, 'activo')])
    sync.limpiarColasDeSync()

    const propuesta = micro('m23', 23, 'propuesto')
    db.microciclos.guardarPropuesta(propuesta)

    const [op] = upsertsDeMicrociclos(cola.leerCola())
    const datos = op.payload.datos as Record<string, unknown>
    expect(datos.id).toBe('m23')
    expect(datos.numero).toBe(23)
    expect(datos.fechaInicio).toBe('2026-07-20')
    expect((datos.sesiones as unknown[]).length).toBe(1)
  })

  /** Y la copia local conserva su estado: lo que cambia es lo que VIAJA. */
  it('en el dispositivo el microciclo sigue teniendo su estado', async () => {
    const { sync, db } = await appEnModoNube([micro('m22', 22, 'activo')])
    sync.limpiarColasDeSync()

    db.microciclos.guardarPropuesta(micro('m23', 23, 'propuesto'))

    const enLocal = db.microciclos.byUsuario(ASESORADO.id).find((m) => m.id === 'm23')
    expect(enLocal?.estado).toBe('propuesto')
  })
})
