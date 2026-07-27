import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { integrarEnCola, limpiarColasDeSync, pendientesDeSync, type OperacionPendiente } from './sync'

const upsertMicrociclo = (id: string, numero: number): OperacionPendiente => ({
  tabla: 'microciclos',
  tipo: 'upsert',
  payload: { id, numero },
})

describe('integrarEnCola', () => {
  it('agrega al final cuando la fila no estaba en cola', () => {
    const cola = integrarEnCola([], upsertMicrociclo('m1', 1))
    expect(cola).toHaveLength(1)
    expect(cola[0].payload.id).toBe('m1')
  })

  it('reemplaza el upsert pendiente de la misma fila en vez de acumular', () => {
    let cola: OperacionPendiente[] = []
    for (let serie = 1; serie <= 24; serie++) {
      cola = integrarEnCola(cola, upsertMicrociclo('m1', serie))
    }
    expect(cola).toHaveLength(1)
    expect(cola[0].payload.numero).toBe(24)
  })

  it('mantiene la posición original al reemplazar (no reordena escrituras)', () => {
    let cola = integrarEnCola([], upsertMicrociclo('m1', 1))
    cola = integrarEnCola(cola, upsertMicrociclo('m2', 1))
    cola = integrarEnCola(cola, upsertMicrociclo('m1', 2))
    expect(cola.map((o) => o.payload.id)).toEqual(['m1', 'm2'])
    expect(cola[0].payload.numero).toBe(2)
  })

  it('no mezcla filas distintas ni tablas distintas', () => {
    let cola = integrarEnCola([], upsertMicrociclo('m1', 1))
    cola = integrarEnCola(cola, {
      tabla: 'checkins',
      tipo: 'upsert',
      payload: { id: 'm1', datos: {} },
    })
    expect(cola).toHaveLength(2)
  })

  it('coalesce por usuario_id cuando el payload no trae id (perfiles)', () => {
    let cola = integrarEnCola([], {
      tabla: 'perfiles',
      tipo: 'upsert',
      payload: { usuario_id: 'u1', datos: { v: 1 } },
    })
    cola = integrarEnCola(cola, {
      tabla: 'perfiles',
      tipo: 'upsert',
      payload: { usuario_id: 'u1', datos: { v: 2 } },
    })
    expect(cola).toHaveLength(1)
    expect((cola[0].payload.datos as { v: number }).v).toBe(2)
  })

  it('nunca coalesce updates con filtro (marcar leídos)', () => {
    const update: OperacionPendiente = {
      tabla: 'mensajes',
      tipo: 'update',
      payload: { leido: true },
      filtro: { para_id: 'u1', de_id: 'u2' },
    }
    const cola = integrarEnCola(integrarEnCola([], update), update)
    expect(cola).toHaveLength(2)
  })
})

/**
 * Los tests corren en modo demo (ver `vitest.config.ts`), donde
 * `crearDbSincronizada` devuelve la db local sin envolver. Para probar el
 * envoltorio hay que levantar el módulo con las variables puestas.
 */
let ultimoSync: typeof import('./sync') | undefined

async function dbEnModoNube() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  ultimoSync = sync
  const { crearMockDb } = await import('../mockDb')
  return { sync, db: sync.crearDbSincronizada(crearMockDb()) }
}

describe('mensajes: qué se sincroniza y qué no', () => {
  beforeEach(() => {
    localStorage.clear()
    // procesarCola sale a la red en cuanto se encola algo; sin esto el test
    // dependería del DNS.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red en test')))
  })

  /**
   * `encolar` dispara `procesarCola` sin esperarlo, y ese procesado sobrevive
   * al test: `vi.resetModules()` da un módulo nuevo pero no cancela el del
   * anterior, y los dos escriben en el MISMO `localStorage`.
   *
   * Sin esta espera, el reintento del test que acaba (la misma operación con
   * `intentos: 1`) aterrizaba a mitad del siguiente —después de su
   * `localStorage.clear()` y antes de su primer encolado— y le metía una
   * operación ajena en la cola. Eso hacía fallar "la respuesta de Alpha NO se
   * encola" con 2 pendientes en vez de 1, aproximadamente la mitad de las
   * corridas, según ganara la carrera el import o la promesa huérfana.
   *
   * Va ANTES de `unstubAllGlobals` a propósito: el procesado en vuelo todavía
   * necesita el `fetch` simulado para terminar.
   */
  afterEach(async () => {
    await ultimoSync?.colaEnReposo()
    ultimoSync = undefined
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('el mensaje del asesorado SÍ se encola', async () => {
    const { sync, db } = await dbEnModoNube()
    expect(sync.pendientesDeSync()).toBe(0)
    db.mensajes.enviar({ deId: 'u-valentina', paraId: 'u-bryan', texto: 'hasta donde bajo' })
    expect(sync.pendientesDeSync()).toBe(1)
  })

  /**
   * La fila de Alpha la escribe la Edge Function con service_role, porque la
   * política RLS de `mensajes` (`with check (de_id = auth.uid())`) impide que
   * el dispositivo de la asesorada inserte una fila firmada por el coach.
   *
   * Si la app la encolara, ese upsert se rechazaría 8 veces y mientras tanto
   * bloquearía la cabeza de la cola: las series y los check-ins van detrás.
   */
  it('la respuesta de Alpha NO se encola: la fila ya existe en el servidor', async () => {
    const { sync, db } = await dbEnModoNube()
    db.mensajes.enviar({ deId: 'u-valentina', paraId: 'u-bryan', texto: 'hasta donde bajo' })
    expect(sync.pendientesDeSync()).toBe(1)

    db.mensajes.recibirDeAlpha({
      id: 'msg-de-la-funcion',
      deId: 'u-bryan',
      paraId: 'u-valentina',
      texto: 'Baja hasta pasar la paralela.',
    })

    // La cola sigue igual: la respuesta de Alpha no añadió nada.
    expect(sync.pendientesDeSync()).toBe(1)

    const hilo = db.mensajes.hilo('u-valentina', 'u-bryan')
    const ultimo = hilo[hilo.length - 1]
    expect(ultimo.id).toBe('msg-de-la-funcion')
    expect(ultimo.origen).toBe('alpha')
  })

  it('no duplica si la fila ya estaba en el hilo', async () => {
    const { db } = await dbEnModoNube()
    const alpha = {
      id: 'msg-de-la-funcion',
      deId: 'u-bryan',
      paraId: 'u-valentina',
      texto: 'Baja hasta pasar la paralela.',
    }
    db.mensajes.recibirDeAlpha(alpha)
    db.mensajes.recibirDeAlpha(alpha)
    const repetidas = db.mensajes
      .hilo('u-valentina', 'u-bryan')
      .filter((m) => m.id === 'msg-de-la-funcion')
    expect(repetidas).toHaveLength(1)
  })
})

describe('limpiarColasDeSync', () => {
  it('borra la cola y los descartes de localStorage', () => {
    localStorage.setItem('alpha-cola-sync', JSON.stringify([upsertMicrociclo('m1', 1)]))
    localStorage.setItem('alpha-cola-descartes', JSON.stringify([upsertMicrociclo('m2', 1)]))
    expect(pendientesDeSync()).toBe(1)
    limpiarColasDeSync()
    expect(pendientesDeSync()).toBe(0)
    expect(localStorage.getItem('alpha-cola-descartes')).toBeNull()
  })
})
