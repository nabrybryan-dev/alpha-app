/**
 * EL MAPA DE VIDA TIENE QUE LLEGAR AL SERVIDOR — completo, y con lo
 * acumulado, no solo con lo último que se tocó.
 *
 * Mismo patrón de prueba que `sexo-en-la-ficha-sync.test.ts`: se activa el
 * modo nube contra un `fetch` que falla a propósito (sin red en test) y se
 * mira la cola de sync, que es donde vive la prueba de que algo "salió" hacia
 * la base sin necesitar un servidor real.
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
  return { db }
}

function cola(): OperacionPendiente[] {
  return JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[]
}

function mapaEnCola(): OperacionPendiente[] {
  return cola().filter((o) => o.tabla === 'mapa_de_vida_respuestas')
}

describe('el mapa de vida sube al servidor', () => {
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

  it('guardar la encuesta encola exactamente una operación, con el usuario y los valores', async () => {
    const { db } = await dbEnModoNube()
    db.mapaDeVida.guardar(ASESORADA, { sol_de_la_manana: 'Sí', cafeina: '2' })

    expect(mapaEnCola()).toHaveLength(1)
    const { payload, tipo } = mapaEnCola()[0]
    expect(tipo).toBe('upsert')
    expect(payload.usuario_id).toBe(ASESORADA)
    expect(payload.valores).toEqual({ sol_de_la_manana: 'Sí', cafeina: '2' })
  })

  it('la respuesta también queda leíble en local, para que la pantalla la retome', async () => {
    const { db } = await dbEnModoNube()
    db.mapaDeVida.guardar(ASESORADA, { estres_general: '4' })

    expect(db.mapaDeVida.respuestaDe(ASESORADA)?.valores).toEqual({ estres_general: '4' })
  })

  it('una segunda vuelta se ACUMULA sobre la primera, y lo que sube es el total, no solo lo nuevo', async () => {
    const { db } = await dbEnModoNube()
    db.mapaDeVida.guardar(ASESORADA, { sol_de_la_manana: 'Sí' })
    db.mapaDeVida.guardar(ASESORADA, { cafeina: '1' })

    // La cola funde upserts de la misma tabla+usuario en operaciones separadas
    // aquí porque `mapaDeVida` no usa `claveRpc`/`onConflict` de fusión: cada
    // guardado manda el acumulado completo, así que la ÚLTIMA operación en
    // cola ya trae las dos respuestas.
    const ultima = mapaEnCola()[mapaEnCola().length - 1]
    expect(ultima.payload.valores).toEqual({ sol_de_la_manana: 'Sí', cafeina: '1' })
  })

  it('sin las dos variables de nube, no se encola nada (modo demo)', async () => {
    vi.resetModules()
    const sync = await import('./sync')
    const { crearMockDb } = await import('../mockDb')
    const db = sync.crearDbSincronizada(crearMockDb())
    localStorage.setItem('alpha-cola-sync', '[]')

    db.mapaDeVida.guardar(ASESORADA, { sol_de_la_manana: 'No' })

    expect(mapaEnCola()).toHaveLength(0)
    // Pero sigue guardando en local: el modo demo no puede perder la respuesta.
    expect(db.mapaDeVida.respuestaDe(ASESORADA)?.valores).toEqual({ sol_de_la_manana: 'No' })
  })
})
