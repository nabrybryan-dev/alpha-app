/**
 * EL COACH PUEDE FICHAR A UN CLIENTE NUEVO (0107, auditoría del 2-oct-2026, A-2).
 *
 * Un cliente recién dado de alta solo existe en `usuarios_app`: no tiene ficha. Antes,
 * `guardarSexo`, `guardarPeldano` y `guardarValoracion` hacían `perfiles.map(...)` sobre una
 * lista sin su fila y `subirPerfil` hacía `if (!perfil) return`: tres botones del coach que no
 * cambiaban nada y no avisaban. Ahora la capa local estrena la ficha y la subida lleva delante
 * la llamada `crear_ficha_si_falta`, de modo que la fila existe en el servidor cuando llega el
 * blob; y si la llamada no prospera, queda a la vista como descarte, no se pierde en silencio.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperacionPendiente } from './sync'

const NUEVO = 'u-cliente-sin-ficha'

let ultimoSync: typeof import('./sync') | undefined

async function dbEnModoNube() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  ultimoSync = sync
  const { crearMockDb } = await import('../mockDb')
  const local = crearMockDb()
  const db = sync.crearDbSincronizada(local)
  localStorage.setItem('alpha-cola-sync', '[]')
  return { sync, db, local }
}

function cola(): OperacionPendiente[] {
  return JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[]
}

const valoracion = { id: 'tecnica', pct: 70, nota: 'Bien', fecha: '2026-10-02' }

describe('el coach guarda sobre un cliente sin ficha', () => {
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

  const caminos: Array<[string, (db: import('../repos').Db) => void, (p: import('../../domain/types').Perfil) => unknown]> = [
    ['guardarSexo', (db) => db.perfiles.guardarSexo(NUEVO, 'mujer'), (p) => p.sexo],
    ['guardarPeldano', (db) => db.perfiles.guardarPeldano(NUEVO, 3, '2026-10-02'), (p) => p.peldanoAlfa],
    ['guardarValoracion', (db) => db.perfiles.guardarValoracion(NUEVO, valoracion), (p) => p.valoraciones?.[0]?.id],
  ]

  for (const [nombre, guardar, leido] of caminos) {
    it(`${nombre}: la ficha nace en local y el cambio se ve`, async () => {
      const { local } = await dbEnModoNube()
      expect(local.perfiles.byUsuario(NUEVO)).toBeUndefined()
      guardar(local)
      const ficha = local.perfiles.byUsuario(NUEVO)
      expect(ficha, 'el guardado sobre un cliente sin ficha no hizo nada').toBeDefined()
      expect(leido(ficha!)).toBeDefined()
      // Nace con lo mínimo: no se fabrican objetivos ni edad.
      expect(ficha!.objetivos).toBe('')
      expect(ficha!.edad).toBe(0)
    })

    it(`${nombre}: sube primero crear_ficha_si_falta y detrás la fila`, async () => {
      const { db } = await dbEnModoNube()
      guardar(db)

      const ops = cola().filter((o) => o.tabla === 'perfiles')
      expect(ops.map((o) => (o.tipo === 'rpc' ? o.funcion : o.tipo))).toEqual(['crear_ficha_si_falta', 'upsert'])
      expect(ops[0].payload).toEqual({ p_usuario: NUEVO })
      expect(ops[1].payload.usuario_id).toBe(NUEVO)
    })
  }

  it('tres guardados seguidos no apilan tres llamadas: la clave las funde en una', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.guardarSexo(NUEVO, 'hombre')
    db.perfiles.guardarPeldano(NUEVO, 2, '2026-10-02')
    db.perfiles.guardarValoracion(NUEVO, valoracion)

    const llamadas = cola().filter((o) => o.tipo === 'rpc' && o.funcion === 'crear_ficha_si_falta')
    expect(llamadas).toHaveLength(1)
    const filas = cola().filter((o) => o.tabla === 'perfiles' && o.tipo === 'upsert')
    expect(filas).toHaveLength(1)
    expect(filas[0].payload.sexo).toBe('hombre')
  })

  it('si el servidor la rechaza, no se pierde en silencio: queda como descarte visible', async () => {
    const { sync, db } = await dbEnModoNube()
    db.perfiles.guardarSexo(NUEVO, 'mujer')

    const { procesarCola } = await import('./procesador')
    const { descartesPendientes } = await import('./cola')
    for (let i = 0; i < 30; i++) await procesarCola()

    expect(cola()).toHaveLength(0)
    expect(descartesPendientes()).toBeGreaterThan(0)
    expect(sync.pendientesDeSync()).toBe(0)
  })
})
