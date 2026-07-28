/**
 * ⚠️ ESTOS TESTS FALLAN A PROPÓSITO. Documentan fallos REALES que NO están
 * arreglados (auditoría de carreras y estado compartido, 2026-07-27).
 *
 * Los tres cubren la misma pregunta: cuando una persona cierra sesión en un
 * teléfono y entra otra, ¿queda algo de la primera?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 1) `SessionProvider.tsx:115-119` — SIGNED_OUT borra `alpha-db-v2` y las colas
 *    de sync, pero NO los borradores del entreno: `alpha-crono-<sesionId>`,
 *    `alpha-descanso-<sesionId>` y `alpha-serie-<microciclo>-<ejercicio>-<n>`.
 *    Esas claves guardan la carga en kg, las reps y el RIR que la persona tenía
 *    a medio escribir. Se quedan en el teléfono después de salir.
 *
 * 2) `SessionProvider.tsx:116` borra el `alpha-db-v2` de disco pero la copia EN
 *    MEMORIA de la base (`mockDb.ts:45-72`, `ref.actual`) se queda intacta:
 *    `db.usuarios`, `db.microciclos`, `db.bienestar`… siguen devolviendo los
 *    datos de quien acaba de salir.
 *
 * 3) `SessionProvider.tsx:70` — `hidratandoRef` es un candado sin dueño. Si una
 *    hidratación de la persona A sigue en vuelo (no hay timeout en ninguna de
 *    las consultas de `hidratar.ts`), el SIGNED_IN de la persona B se DESCARTA
 *    en seco, y cuando la hidratación de A aterriza ejecuta sus últimas líneas
 *    (`SessionProvider.tsx:91-93`) y deja la app "lista"… con la sesión de A.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ LE PASA A LAS PERSONAS
 * ────────────────────────────────────────────────────────────────────────────
 * Ana entrena con la app instalada en el teléfono. Desbloquea la pantalla entre
 * series: supabase-js emite SIGNED_IN y arranca una hidratación en segundo
 * plano; el wifi del gimnasio va lento y esa petición tarda. Ana le presta el
 * teléfono a Carlos, que también es asesorado: Ana toca "Cerrar sesión" y
 * Carlos escribe su correo y su contraseña. Supabase acepta a Carlos.
 *
 *   - La app se queda en la pantalla de login (el SIGNED_IN de Carlos se tiró),
 *     y cuando la hidratación vieja de Ana aterriza, la app entra… COMO ANA.
 *     Carlos, con su propia sesión iniciada, ve la programación, los check-ins
 *     y las medidas de Ana.
 *   - Aunque nada de eso pasara, los kilos y las reps que Ana tenía a medio
 *     escribir siguen en el teléfono, y la base en memoria sigue siendo la de
 *     Ana.
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider, useSesion } from './SessionProvider'
import { db } from '../data/dbInstance'
import { aplicarSnapshot, epocaSesion } from '../data/mockDb'
import type { SeedDb } from '../data/seed'
import type { Usuario } from '../domain/types'

type Oyente = (evento: string, sesion: { user: { id: string } } | null) => void

const arnes = vi.hoisted(() => ({
  oyente: null as Oyente | null,
  sesion: null as { user: { id: string } } | null,
  /** Lo que hace `hidratarDesdeNube`; el test lo reemplaza en cada caso. */
  hidratar: async () => {},
  /** Error que devuelve Supabase al subir la cola (null = sube bien). */
  errorDeSubida: null as { message: string } | null,
}))

vi.mock('../data/supabase', () => ({
  modoNube: true,
  sesionDeFunciones: async () => null,
  supabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: arnes.sesion } }),
      onAuthStateChange: (cb: Oyente) => {
        arnes.oyente = cb
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                arnes.oyente = null
              },
            },
          },
        }
      },
      signOut: async () => {
        arnes.sesion = null
        arnes.oyente?.('SIGNED_OUT', null)
        return { error: null }
      },
    },
    from: () => ({
      upsert: async () => ({ error: arnes.errorDeSubida }),
      update: () => ({ eq: () => ({ eq: async () => ({ error: arnes.errorDeSubida }) }) }),
    }),
    rpc: async () => ({ data: [], error: null }),
  }),
}))

vi.mock('../data/nube/hidratar', () => ({
  hidratarDesdeNube: () => arnes.hidratar(),
}))

const ana: Usuario = { id: 'u-ana', nombre: 'Ana Ruiz', rol: 'asesorado', avatarIniciales: 'AR' }
const carlos: Usuario = { id: 'u-carlos', nombre: 'Carlos Páez', rol: 'asesorado', avatarIniciales: 'CP' }

function snapshotDe(usuarios: Usuario[]): SeedDb {
  return {
    usuarios,
    perfiles: [],
    microciclos: [],
    checkins: [],
    planes: [],
    adherencias: [],
    hidratacion: [],
    mensajes: [],
    cuestionarios: [],
    respuestas: [],
    contenidos: [],
    premiaciones: [],
  }
}

function QuienSoy() {
  const { usuario, cerrarSesion } = useSesion()
  return (
    <>
      <p data-testid="quien">{usuario.id}</p>
      <button type="button" onClick={cerrarSesion}>
        Cerrar sesión
      </button>
    </>
  )
}

function montar() {
  return render(
    <SessionProvider>
      <QuienSoy />
    </SessionProvider>,
  )
}

/** Emite el evento de supabase-js tal cual lo recibe el proveedor. */
async function emitir(evento: string, usuarioId?: string) {
  await act(async () => {
    arnes.oyente?.(evento, usuarioId ? { user: { id: usuarioId } } : null)
    await Promise.resolve()
  })
}

/**
 * Rastro personal que deja Ana en `localStorage` mientras usa la app:
 * el cronómetro (`CronometroSesion.tsx:22`), el descanso en curso
 * (`SesionPage.tsx:65`), la serie a medio escribir (`RegistroSerie.tsx:39`) y
 * si ya hizo el check-in de hoy (`recordatorio.ts:1`).
 */
const BORRADORES_DE_ANA = {
  'alpha-crono-s-lega-m40': JSON.stringify({ acumuladoSeg: 1420, desdeEpoch: Date.now() }),
  'alpha-descanso-s-lega-m40': JSON.stringify({ hasta: Date.now() + 90_000, totalSeg: 180 }),
  'alpha-serie-m40-ana-e-hip-3': JSON.stringify({ cargaKg: 92.5, reps: 8, rir: 1 }),
  'alpha-notif-bienestar': '2026-07-27',
}

describe('cambio de asesorado en el mismo teléfono', () => {
  beforeEach(async () => {
    localStorage.clear()
    arnes.oyente = null
    arnes.sesion = { user: { id: 'u-ana' } }
    arnes.hidratar = async () => aplicarSnapshot(snapshotDe([ana]))
    arnes.errorDeSubida = null
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('cerrar sesión NO debe dejar en el teléfono los kilos y reps a medio escribir', async () => {
    montar()
    await waitFor(() => expect(screen.getByTestId('quien')).toHaveTextContent('u-ana'))

    for (const [clave, valor] of Object.entries(BORRADORES_DE_ANA)) {
      localStorage.setItem(clave, valor)
    }

    await emitir('SIGNED_OUT')

    const residuo = Object.keys(localStorage).filter((k) => k in BORRADORES_DE_ANA)
    expect(residuo).toEqual([])
  })

  it('cerrar sesión NO debe dejar la base en memoria con los datos de quien salió', async () => {
    montar()
    await waitFor(() => expect(screen.getByTestId('quien')).toHaveTextContent('u-ana'))

    await emitir('SIGNED_OUT')

    expect(db.usuarios.byId('u-ana')).toBeUndefined()
  })

  it('una hidratación vieja que aterriza tarde NO debe reponer los datos ya borrados', async () => {
    montar()
    await waitFor(() => expect(screen.getByTestId('quien')).toHaveTextContent('u-ana'))

    // Ana desbloquea el teléfono: supabase-js emite SIGNED_IN y arranca una
    // hidratación en segundo plano que el wifi del gimnasio deja colgada.
    let soltarHidratacion = () => {}
    arnes.hidratar = () => {
      // Como la de verdad: la época se captura al ARRANCAR la descarga y se
      // usa al aplicarla, que es lo que la delata como vieja.
      const epoca = epocaSesion()
      return new Promise<void>((resolver) => {
        soltarHidratacion = () => {
          aplicarSnapshot(snapshotDe([ana]), epoca)
          resolver()
        }
      })
    }
    await emitir('SIGNED_IN', 'u-ana')

    // Ana cierra sesión mientras esa petición sigue en vuelo.
    await emitir('SIGNED_OUT')
    expect(localStorage.getItem('alpha-db-v2')).toBeNull()

    // Ahora sí responde el servidor, con los datos de Ana.
    await act(async () => {
      soltarHidratacion()
      await Promise.resolve()
    })

    expect(localStorage.getItem('alpha-db-v2')).toBeNull()
  })

  it('el login de la persona siguiente NO debe descartarse por una hidratación en vuelo', async () => {
    montar()
    await waitFor(() => expect(screen.getByTestId('quien')).toHaveTextContent('u-ana'))

    let soltarHidratacionDeAna = () => {}
    arnes.hidratar = () => {
      const epoca = epocaSesion()
      return new Promise<void>((resolver) => {
        soltarHidratacionDeAna = () => {
          aplicarSnapshot(snapshotDe([ana]), epoca)
          resolver()
        }
      })
    }
    await emitir('SIGNED_IN', 'u-ana') // refoco: hidratación en segundo plano

    await emitir('SIGNED_OUT') // Ana sale

    // Carlos escribe su correo y su contraseña; Supabase lo acepta.
    arnes.sesion = { user: { id: 'u-carlos' } }
    arnes.hidratar = async () => aplicarSnapshot(snapshotDe([carlos]))
    await emitir('SIGNED_IN', 'u-carlos')

    // …y en algún momento aterriza la petición vieja de Ana.
    await act(async () => {
      soltarHidratacionDeAna()
      await Promise.resolve()
    })

    await waitFor(() => expect(screen.getByTestId('quien')).toHaveTextContent('u-carlos'))
  })
})

/**
 * ⚠️ TAMBIÉN FALLA A PROPÓSITO. Otro fallo REAL sin arreglar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EL FALLO
 * ────────────────────────────────────────────────────────────────────────────
 * `SessionProvider.tsx:211-215` cierra sesión así:
 *
 *     await procesarCola()          // "subir lo pendiente antes de salir"
 *     await supabase().auth.signOut()   // SIGNED_OUT limpia db, colas y marca
 *
 * Pero `procesarCola` NO promete dejar la cola vacía: `sync.ts:199-213` corta el
 * drenado y RESUELVE en cuanto una operación falla —sin conexión ni siquiera
 * cuenta el intento (`sync.ts:202`), justo para no perder nada—. Así que
 * `await procesarCola()` puede resolver con la cola llena, y la línea siguiente
 * dispara SIGNED_OUT, que llama a `limpiarColasDeSync()` y BORRA esas
 * operaciones. No van a descartes: desaparecen.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ LE PASA A LA PERSONA QUE ENTRENA
 * ────────────────────────────────────────────────────────────────────────────
 * Entrena en un gimnasio de sótano sin señal. Registra sus 24 series: todas
 * quedan en la cola esperando cobertura. Al terminar, la app se le queda rara y
 * el coach le dice lo de siempre: "cierra sesión y vuelve a entrar". Lo hace, y
 * el entreno entero se borra del teléfono sin que nada avise. Al volver a
 * entrar, la hidratación baja el microciclo del servidor —sin sus series— y las
 * pisa también en local.
 */
describe('cerrar sesión con series que no llegaron a subir', () => {
  beforeEach(() => {
    localStorage.clear()
    arnes.oyente = null
    arnes.sesion = { user: { id: 'u-ana' } }
    arnes.hidratar = async () => aplicarSnapshot(snapshotDe([ana]))
    arnes.errorDeSubida = null
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('no debe tirar a la basura el entreno que quedó pendiente de subir', async () => {
    montar()
    await waitFor(() => expect(screen.getByTestId('quien')).toHaveTextContent('u-ana'))

    // Sótano sin señal: las series del día están en la cola, sin subir.
    arnes.errorDeSubida = { message: 'TypeError: Failed to fetch' }
    const seriesDelDia = [
      {
        tabla: 'microciclos',
        tipo: 'upsert',
        payload: { id: 'm40-ana', usuario_id: 'u-ana', numero: 40, datos: { series: 24 } },
      },
    ]
    localStorage.setItem('alpha-cola-sync', JSON.stringify(seriesDelDia))

    // "Cierra sesión y vuelve a entrar."
    await act(async () => {
      screen.getByRole('button', { name: 'Cerrar sesión' }).click()
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.queryByTestId('quien')).toBeNull())

    const cola = localStorage.getItem('alpha-cola-sync') ?? '[]'
    const descartes = localStorage.getItem('alpha-cola-descartes') ?? '[]'
    // El entreno tiene que seguir en alguna parte del teléfono.
    expect(cola + descartes).toContain('m40-ana')
  })
})
