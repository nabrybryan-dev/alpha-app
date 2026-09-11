/**
 * La fecha de la sesión tiene que LLEGAR al servidor, y llegar sola.
 *
 * El campo se escribe en local (`mockDb`), pero las tres escrituras del
 * asesorado suben SOLO su rama —nunca el blob del microciclo, que es la lección
 * del 2026-08-15—, así que un campo nuevo en la sesión no viaja por arte de
 * magia: si nadie lo encola, la fecha vive en el móvil y muere ahí.
 *
 * Aquí se defiende que sube, que sube en su propia llamada (sin tocar la firma
 * de las tres funciones que ya llevan meses en producción), que no arrastra el
 * blob detrás, y que varias marcas seguidas en la misma sesión colapsan en un
 * solo envío en vez de dejar cinco.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Microciclo } from '../../domain/types'
import { hoyIso } from '../../lib/fecha'
import type { OperacionPendiente } from './sync'

const MICROCICLO: Microciclo = {
  id: 'm-test',
  usuarioId: 'u-valentina',
  numero: 22,
  cadenciaDias: 8,
  estado: 'activo',
  fechaInicio: '2026-07-20',
  sesiones: [
    // Va PRIMERA y no tiene ejercicios, a proposito: si `sesionDelEjercicio`
    // devolviera «la primera» en vez de «la que tiene ese ejercicio», con la
    // sesion buena en la posicion 0 el fallo seria invisible. Lo fue: la
    // mutacion que rompe esa busqueda sobrevivio hasta que esta sesion existio.
    { id: 'ses-0', nombre: 'CARDIO ZONA 2', orden: 1, ejercicios: [] },
    {
      id: 'ses-1',
      nombre: 'FULL BODY A',
      orden: 2,
      preparacion: [
        { id: 'prep-1', titulo: 'Movilidad de cadera', indicaciones: '2 min', tipo: 'movilidad' },
        { id: 'prep-2', titulo: 'Sentadilla sin peso', indicaciones: '×10', tipo: 'movilidad' },
      ],
      ejercicios: [
        {
          id: 'ej-1',
          categoria: 'SENTADILLA',
          nombre: 'Sentadilla con barra',
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
    { id: 'ses-2', nombre: 'FULL BODY B', orden: 3, ejercicios: [] },
  ],
}

let ultimoSync: typeof import('./sync') | undefined

async function dbEnModoNube() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  ultimoSync = sync
  const { crearMockDb } = await import('../mockDb')
  const db = sync.crearDbSincronizada(crearMockDb())
  db.microciclos.guardarPropuesta(MICROCICLO)
  localStorage.setItem('alpha-cola-sync', '[]')
  return { sync, db }
}

function cola(): OperacionPendiente[] {
  return JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[]
}

function fechasEnCola(): OperacionPendiente[] {
  return cola().filter((o) => o.tipo === 'rpc' && o.funcion === 'fijar_fecha_sesion')
}

describe('la fecha de la sesión sube al servidor', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red en test')))
  })

  afterEach(async () => {
    await ultimoSync?.pendientesDeSync?.()
    ultimoSync = undefined
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('marcar el calentamiento la encola, con la sesión y el día de hoy', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.marcarParte('m-test', 'ses-1', 'prep-1')

    expect(fechasEnCola()).toHaveLength(1)
    expect(fechasEnCola()[0].payload).toEqual({
      p_microciclo_id: 'm-test',
      p_sesion_id: 'ses-1',
      p_fecha: hoyIso(),
    })
  })

  it('anotar una serie la encola en la sesión DEL EJERCICIO, no en otra', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.registrarSerie('m-test', 'ej-1', { orden: 1, cargaKg: 60, reps: 8, rir: 2 })

    expect(fechasEnCola()).toHaveLength(1)
    expect(fechasEnCola()[0].payload.p_sesion_id).toBe('ses-1')
  })

  it('guardar el test posterior la encola', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.guardarTestPost('m-test', 'ses-1', { duracionMin: 62, rpeSesion: 8, prsEntrada: 7 })

    expect(fechasEnCola()).toHaveLength(1)
  })

  it('no arrastra el blob del microciclo detrás', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.marcarParte('m-test', 'ses-1', 'prep-1')

    const blobs = cola().filter((o) => o.tabla === 'microciclos' && 'datos' in (o.payload ?? {}))
    expect(blobs).toEqual([])
    // Y tampoco lleva dentro nada del plan: es el fallo del 15 de agosto.
    expect(JSON.stringify(fechasEnCola())).not.toContain('SENTADILLA')
  })

  it('cinco marcas en la misma sesión dejan UNA operación, no cinco', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.marcarParte('m-test', 'ses-1', 'prep-1')
    db.microciclos.marcarParte('m-test', 'ses-1', 'prep-2')
    db.microciclos.marcarParte('m-test', 'ses-1', 'prep-1')
    db.microciclos.registrarSerie('m-test', 'ej-1', { orden: 1, cargaKg: 60, reps: 8, rir: 2 })
    db.microciclos.guardarTestPost('m-test', 'ses-1', { duracionMin: 62, rpeSesion: 8, prsEntrada: 7 })

    expect(fechasEnCola()).toHaveLength(1)
  })

  it('dos sesiones distintas sí dejan dos operaciones', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.marcarParte('m-test', 'ses-1', 'prep-1')
    db.microciclos.guardarTestPost('m-test', 'ses-2', { duracionMin: 40, rpeSesion: 6, prsEntrada: 8 })

    expect(fechasEnCola().map((o) => o.payload.p_sesion_id).sort()).toEqual(['ses-1', 'ses-2'])
  })
})
