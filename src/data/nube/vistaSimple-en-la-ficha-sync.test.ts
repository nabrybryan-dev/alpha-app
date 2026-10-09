/**
 * `vistaSimple` sube al servidor DENTRO de `datos` — a diferencia del sexo, no
 * tiene columna propia, así que basta con que viaje en el mismo blob que el
 * resto de la ficha (`subirPerfil`). Mismo arnés que
 * `sexo-en-la-ficha-sync.test.ts`.
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

describe('la vista simple de la ficha sube al servidor', () => {
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

  it('el coach la prende y viaja dentro del blob', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.guardarVistaSimple(ASESORADA, true)

    expect(fichasEnCola()).toHaveLength(1)
    const { payload } = fichasEnCola()[0]
    expect(payload.usuario_id).toBe(ASESORADA)
    expect((payload.datos as { vistaSimple?: unknown }).vistaSimple).toBe(true)
  })

  it('apagarla la saca del blob, no la deja en false', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.guardarVistaSimple(ASESORADA, true)
    db.perfiles.guardarVistaSimple(ASESORADA, undefined)

    const { payload } = fichasEnCola()[0]
    expect('vistaSimple' in (payload.datos as object)).toBe(false)
  })

  it('una valoración del coach detrás no la pisa: la fila fundida sigue llevándola', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.guardarVistaSimple(ASESORADA, true)
    db.perfiles.guardarValoracion(ASESORADA, { id: 'tecnica', pct: 70, nota: 'Bien', fecha: '2026-09-06' })

    expect(fichasEnCola()).toHaveLength(1)
    const { payload } = fichasEnCola()[0]
    expect((payload.datos as { vistaSimple?: unknown }).vistaSimple).toBe(true)
    expect((payload.datos as { valoraciones?: unknown[] }).valoraciones).toHaveLength(1)
  })

  it('la medida del asesorado no sube ficha ninguna: viaja sola, sin nombrarla', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.agregarMedida(ASESORADA, { fecha: '2026-09-06', alturaCm: 165, perimetros: {} })

    expect(fichasEnCola()).toHaveLength(0)
  })
})
