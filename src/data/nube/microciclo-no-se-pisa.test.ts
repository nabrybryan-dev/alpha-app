/**
 * Lo que el asesorado sube al entrenar NO PUEDE pisar el trabajo del coach.
 *
 * El 2026-08-15 la migración 0036 reescribió la categoría de 849 ejercicios y
 * las cuatro comprobaciones dieron cero. Poco después, el microciclo activo de
 * un asesorado había vuelto entero a la taxonomía vieja: registró una serie, su
 * móvil subió `datos: microciclo` —el blob local completo, con las categorías de
 * antes— y lo escribió encima.
 *
 * `hidratar.ts:71` ya lo tenía dicho: «el blob lo escribe el último dispositivo
 * que suba ese microciclo». Y `cambiarEstadoEnNube` ya hacía lo correcto para el
 * estado —mandar solo la columna, «lo único que no puede pisar el trabajo de
 * nadie»—. Faltaba aplicar ese mismo criterio a las tres escrituras del
 * asesorado.
 *
 * Ver `docs/specs/2026-08-15-subir-solo-lo-que-cambia.md`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Microciclo } from '../../domain/types'
import type { OperacionPendiente } from './sync'

const MICROCICLO: Microciclo = {
  id: 'm-test',
  usuarioId: 'u-valentina',
  numero: 22,
  cadenciaDias: 8,
  estado: 'activo',
  fechaInicio: '2026-07-20',
  sesiones: [
    {
      id: 'ses-1',
      nombre: 'FULL BODY A',
      orden: 1,
      preparacion: [
        { id: 'prep-1', titulo: 'Movilidad de cadera', indicaciones: '2 min', tipo: 'movilidad' },
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

/** Toda operación que mande el blob entero del microciclo. */
function subenElBlob(ops: readonly OperacionPendiente[]): OperacionPendiente[] {
  return ops.filter((o) => o.tabla === 'microciclos' && 'datos' in (o.payload ?? {}))
}

describe('lo que sube el asesorado al entrenar', () => {
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

  it('registrar una serie no sube el blob del microciclo', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.registrarSerie('m-test', 'ej-1', { orden: 1, cargaKg: 60, reps: 8, rir: 2 })
    expect(subenElBlob(cola())).toEqual([])
  })

  it('guardar el test post no sube el blob del microciclo', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.guardarTestPost('m-test', 'ses-1', { duracionMin: 62, rpeSesion: 8, prsEntrada: 7 })
    expect(subenElBlob(cola())).toEqual([])
  })

  it('marcar una parte del calentamiento no sube el blob del microciclo', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.marcarParte('m-test', 'ses-1', 'prep-1')
    expect(subenElBlob(cola())).toEqual([])
  })

  /**
   * El caso exacto que pasó con la 0036: el coach cambia la categoría en el
   * servidor y el asesorado registra una serie desde su móvil, que todavía tiene
   * la categoría vieja en local. Lo que suba no puede llevar categorías dentro.
   */
  it('lo que sube al registrar una serie no lleva ninguna categoría dentro', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.registrarSerie('m-test', 'ej-1', { orden: 1, cargaKg: 60, reps: 8, rir: 2 })
    const enviado = JSON.stringify(cola())
    expect(enviado).not.toContain('categoria')
    expect(enviado).not.toContain('SENTADILLA')
  })

  it('sí sube la serie: no se arregla dejando de sincronizar', async () => {
    const { db } = await dbEnModoNube()
    db.microciclos.registrarSerie('m-test', 'ej-1', { orden: 1, cargaKg: 60, reps: 8, rir: 2 })
    const enviado = JSON.stringify(cola())
    expect(cola().length).toBeGreaterThan(0)
    expect(enviado).toContain('60')
  })

  /**
   * El coach creando el microciclo SÍ manda el blob, y debe seguir haciéndolo:
   * el microciclo es nuevo, no hay nada que pisar.
   */
  it('el coach sigue subiendo el microciclo entero al crearlo', async () => {
    const { db } = await dbEnModoNube()
    localStorage.setItem('alpha-cola-sync', '[]')
    db.microciclos.guardarPropuesta({ ...MICROCICLO, id: 'm-nuevo' })
    expect(subenElBlob(cola()).length).toBeGreaterThan(0)
  })
})
