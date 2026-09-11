/**
 * EL SEXO DE LA FICHA TIENE QUE LLEGAR AL SERVIDOR — y llegar solo de quien
 * puede ponerlo.
 *
 * La cola funde los upserts de la misma fila (`integrarEnCola`): el segundo
 * reemplaza al primero. Así que no basta con que `guardarSexo` lo encole; si el
 * coach después guarda una valoración sin red, ESE envío tiene que llevarlo
 * también, o el sexo muere en la cola sin que nadie lo vea.
 *
 * Y al revés para el asesorado: su única escritura sobre la ficha (una medida)
 * NO puede nombrar la columna. Su copia puede ser vieja —hidrató antes de que
 * el coach la rellenara— y mandarla escribiría `null` encima de lo que el coach
 * acaba de poner.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperacionPendiente } from './sync'

const ASESORADA = 'u-valentina'

let ultimoSync: typeof import('./sync') | undefined

async function dbEnModoNube() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  ultimoSync = sync
  const { crearMockDb } = await import('../mockDb')
  const db = sync.crearDbSincronizada(crearMockDb())
  localStorage.setItem('alpha-cola-sync', '[]')
  return { sync, db }
}

function cola(): OperacionPendiente[] {
  return JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[]
}

function fichasEnCola(): OperacionPendiente[] {
  return cola().filter((o) => o.tabla === 'perfiles' && o.tipo === 'upsert')
}

describe('el sexo de la ficha sube al servidor', () => {
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

  it('el coach lo indica y viaja en su columna, no dentro del blob', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.guardarSexo(ASESORADA, 'hombre')

    expect(fichasEnCola()).toHaveLength(1)
    const { payload } = fichasEnCola()[0]
    expect(payload.usuario_id).toBe(ASESORADA)
    expect(payload.sexo).toBe('hombre')
    expect('sexo' in (payload.datos as object)).toBe(false)
  })

  it('quitarlo manda null explícito: es una orden, no una ausencia', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.guardarSexo(ASESORADA, undefined)

    expect(fichasEnCola()[0].payload.sexo).toBeNull()
  })

  it('una valoración del coach detrás no lo pisa: la fila fundida sigue llevándolo', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.guardarSexo(ASESORADA, 'mujer')
    db.perfiles.guardarValoracion(ASESORADA, { id: 'tecnica', pct: 70, nota: 'Bien', fecha: '2026-09-06' })

    // Una sola operación para la fila (la cola funde), y con las dos cosas.
    expect(fichasEnCola()).toHaveLength(1)
    const { payload } = fichasEnCola()[0]
    expect(payload.sexo).toBe('mujer')
    expect((payload.datos as { valoraciones?: unknown[] }).valoraciones).toHaveLength(1)
  })

  it('el peldaño del coach también lo lleva', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.guardarSexo(ASESORADA, 'mujer')
    db.perfiles.guardarPeldano(ASESORADA, 4, '2026-09-06')

    expect(fichasEnCola()[0].payload.sexo).toBe('mujer')
  })

  it('la medida del asesorado no sube ficha ninguna: viaja sola, y el sexo ni se nombra (0057)', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.agregarMedida(ASESORADA, { fecha: '2026-09-06', alturaCm: 165, perimetros: {} })

    expect(fichasEnCola()).toHaveLength(0)
    const llamadas = cola().filter((o) => o.tabla === 'perfiles' && o.tipo === 'rpc')
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].funcion).toBe('registrar_medida')
    expect('sexo' in llamadas[0].payload).toBe(false)
  })
})
