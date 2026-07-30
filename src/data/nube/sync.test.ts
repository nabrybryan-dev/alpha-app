import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { integrarEnCola, limpiarColasDeSync, pendientesDeSync, type OperacionPendiente } from './sync'
import type { CheckinDiario } from '../../domain/types'

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

/**
 * `fetch` simulado con freno de mano: cada llamada queda EN VUELO hasta que el
 * test la suelta a mano. Es la única forma de encolar algo *mientras* hay una
 * petición en curso, que es exactamente la situación que se prueba aquí.
 */
function fetchConFreno() {
  const llamadas: { cuerpo: string }[] = []
  const sueltas: { ok: () => void; falla: () => void }[] = []
  const fn = vi.fn((_url: unknown, init?: { body?: unknown }) => {
    llamadas.push({ cuerpo: String(init?.body ?? '') })
    return new Promise<Response>((resolver, rechazar) => {
      sueltas.push({
        ok: () =>
          resolver(
            new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
          ),
        falla: () => rechazar(new Error('sin red en test')),
      })
    })
  })
  vi.stubGlobal('fetch', fn)
  ultimoArnes = { llamadas, sueltas }
  return ultimoArnes
}

let ultimoArnes: { llamadas: { cuerpo: string }[]; sueltas: { ok: () => void; falla: () => void }[] } | undefined

async function nubeConFreno() {
  const arnes = fetchConFreno()
  const { sync, db } = await dbEnModoNube()
  return { sync, db, ...arnes }
}

const checkin = (id: string, pasos: number): CheckinDiario => ({
  id,
  usuarioId: 'u-valentina',
  fecha: '2026-07-27',
  pasos,
})

const CASI_DESCARTADA = 7 // MAX_INTENTOS es 8: el siguiente fallo la aparta

/**
 * `ejecutar` tarda lo que tarde la red, y durante ese rato la asesorada sigue
 * usando la app: registra otra serie, guarda un check-in, bebe agua. Todo eso
 * entra en la MISMA cola que se está procesando.
 *
 * `drenar` trabajaba sobre la foto tomada al empezar y la devolvía recortada,
 * así que esas escrituras se sobrescribían: no subían, no se reintentaban y no
 * quedaban en descartes. Desaparecían del teléfono en la siguiente hidratación.
 */
describe('procesarCola: lo que se encola mientras la cola se procesa', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(async () => {
    // Si el test dejó peticiones colgadas (porque falló antes de soltarlas),
    // se sueltan para que el procesado termine; si no, `colaEnReposo` no
    // resolvería nunca y este afterEach se quedaría esperando.
    for (let vuelta = 0; vuelta < 20 && ultimoArnes; vuelta++) {
      const colgadas = ultimoArnes.sueltas.splice(0)
      if (colgadas.length === 0) break
      for (const s of colgadas) s.falla()
      await ultimoSync?.colaEnReposo()
    }
    await ultimoSync?.colaEnReposo()
    ultimoArnes = undefined
    ultimoSync = undefined
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('ÉXITO: lo encolado durante el vuelo no se pierde y acaba subiendo', async () => {
    const { sync, db, llamadas, sueltas } = await nubeConFreno()

    db.bienestar.guardar(checkin('chk-A', 100))
    await vi.waitFor(() => expect(llamadas).toHaveLength(1))

    // B entra MIENTRAS A está en vuelo.
    db.bienestar.guardar(checkin('chk-B', 200))
    expect(sync.pendientesDeSync()).toBe(2)

    sueltas[0].ok() // A sube bien
    await vi.waitFor(() => expect(llamadas).toHaveLength(2))

    // B sigue en la cola y es lo que se está subiendo ahora.
    expect(sync.pendientesDeSync()).toBe(1)
    expect(llamadas[1].cuerpo).toContain('chk-B')

    sueltas[1].ok()
    await sync.colaEnReposo()
    expect(sync.pendientesDeSync()).toBe(0)
  })

  it('REINTENTO: A vuelve a la cola con su cuenta de intentos y B sigue detrás', async () => {
    const { sync, db, llamadas, sueltas } = await nubeConFreno()

    db.bienestar.guardar(checkin('chk-A', 100))
    await vi.waitFor(() => expect(llamadas).toHaveLength(1))

    db.bienestar.guardar(checkin('chk-B', 200))

    sueltas[0].falla() // A no sube
    await sync.colaEnReposo()

    const cola = JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[]
    expect(cola).toHaveLength(2)
    expect(cola[0].payload.id).toBe('chk-A')
    expect(cola[0].intentos).toBe(1)
    expect(cola[1].payload.id).toBe('chk-B')
    expect(cola[1].intentos).toBeUndefined()
  })

  it('DESCARTE: A agota los intentos y se aparta, B sobrevive en la cola', async () => {
    const { sync, db, llamadas, sueltas } = await nubeConFreno()

    // A llega con 7 intentos: el fallo de ahora es el octavo y la aparta.
    localStorage.setItem(
      'alpha-cola-sync',
      JSON.stringify([
        { tabla: 'microciclos', tipo: 'upsert', payload: { id: 'm-vieja' }, intentos: CASI_DESCARTADA },
      ]),
    )
    void sync.procesarCola()
    await vi.waitFor(() => expect(llamadas).toHaveLength(1))

    db.bienestar.guardar(checkin('chk-B', 200))

    sueltas[0].falla() // A agota los intentos
    await vi.waitFor(() => expect(llamadas).toHaveLength(2)) // sigue con B
    sueltas[1].falla()
    await sync.colaEnReposo()

    const cola = JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[]
    expect(cola).toHaveLength(1)
    expect(cola[0].payload.id).toBe('chk-B')

    const descartes = JSON.parse(
      localStorage.getItem('alpha-cola-descartes') ?? '[]',
    ) as OperacionPendiente[]
    expect(descartes).toHaveLength(1)
    expect(descartes[0].payload.id).toBe('m-vieja')
    expect(descartes[0].intentos).toBe(CASI_DESCARTADA + 1)
  })

  /**
   * El caso real del entreno: se registra una serie (arranca la subida) y antes
   * de que termine se registra la siguiente del MISMO microciclo.
   * `integrarEnCola` reemplaza la operación en su sitio por la versión nueva,
   * así que quitar "la de la posición 0" al acabar borraría la nueva —el mismo
   * bug con otra cara— y el microciclo se quedaría en el estado viejo.
   */
  it('COALESCENCIA: la versión más nueva de la misma fila no se borra al acabar la vieja', async () => {
    const { sync, db, llamadas, sueltas } = await nubeConFreno()

    db.bienestar.guardar(checkin('chk-1', 100))
    await vi.waitFor(() => expect(llamadas).toHaveLength(1))
    expect(llamadas[0].cuerpo).toContain('"pasos":100')

    // Misma fila, dato nuevo: reemplaza a la que está en vuelo, no se añade.
    db.bienestar.guardar(checkin('chk-1', 900))
    expect(sync.pendientesDeSync()).toBe(1)

    sueltas[0].ok() // termina la subida de la versión vieja
    await vi.waitFor(() => expect(llamadas).toHaveLength(2))
    expect(llamadas[1].cuerpo).toContain('"pasos":900')

    sueltas[1].ok()
    await sync.colaEnReposo()
    expect(sync.pendientesDeSync()).toBe(0)
  })

  it('no reenvía una operación ya subida, aunque entren otras en medio', async () => {
    const { sync, db, llamadas, sueltas } = await nubeConFreno()

    db.bienestar.guardar(checkin('chk-A', 100))
    await vi.waitFor(() => expect(llamadas).toHaveLength(1))
    db.bienestar.guardar(checkin('chk-B', 200))

    sueltas[0].ok()
    await vi.waitFor(() => expect(llamadas).toHaveLength(2))
    sueltas[1].ok()
    await sync.colaEnReposo()

    expect(llamadas).toHaveLength(2)
    expect(llamadas.filter((l) => l.cuerpo.includes('chk-A'))).toHaveLength(1)
    expect(llamadas.filter((l) => l.cuerpo.includes('chk-B'))).toHaveLength(1)
    expect(sync.pendientesDeSync()).toBe(0)
  })
})

/**
 * Este bloque comprobaba antes que cerrar sesión borrara la cola Y los
 * descartes. Esa conducta era el fallo: `cerrarSesion` intenta subir lo
 * pendiente, pero sin señal `procesarCola` se rinde y resuelve igual, así que
 * el borrado se llevaba por delante el entreno entero de quien había entrenado
 * en un sótano. Ahora la exigencia es la contraria — vaciar la cola activa sin
 * perder el trabajo — y el aislamiento se consigue sellando el dueño.
 */
describe('cerrar sesión con trabajo sin subir', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red en test')))
  })

  afterEach(async () => {
    await ultimoSync?.colaEnReposo()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('vacía la cola activa pero NO tira lo que quedó sin subir', () => {
    localStorage.setItem('alpha-cola-sync', JSON.stringify([upsertMicrociclo('m1', 1)]))
    expect(pendientesDeSync()).toBe(1)

    limpiarColasDeSync('u-ana')

    // Vacía: si no, sus operaciones se reintentarían con el JWT de quien entre
    // después en este mismo móvil.
    expect(pendientesDeSync()).toBe(0)
    // Pero rescatable, y sellada con su dueña.
    const apartadas = JSON.parse(
      localStorage.getItem('alpha-cola-descartes') ?? '[]',
    ) as OperacionPendiente[]
    expect(apartadas).toHaveLength(1)
    expect(apartadas[0].duenio).toBe('u-ana')
  })

  it('lo de una persona no vuelve a la cola con la sesión de otra', async () => {
    const { sync } = await dbEnModoNube()
    localStorage.setItem('alpha-cola-sync', JSON.stringify([upsertMicrociclo('m1', 1)]))
    sync.limpiarColasDeSync('u-ana')

    sync.recuperarDescartes('u-carlos')
    expect(sync.pendientesDeSync()).toBe(0)

    sync.recuperarDescartes('u-ana')
    expect(sync.pendientesDeSync()).toBe(1)
  })

  it('deja de reencolar lo que el servidor nunca acepta', async () => {
    const { sync } = await dbEnModoNube()
    const rechazada = { ...upsertMicrociclo('m1', 1), duenio: 'u-ana', rescates: 2 }
    localStorage.setItem('alpha-cola-descartes', JSON.stringify([rechazada]))

    sync.recuperarDescartes('u-ana')

    expect(sync.pendientesDeSync()).toBe(0)
  })
})
