/**
 * La app cuenta lo que le falla.
 *
 * POR QUÉ EXISTE. Del 10 al 12-sep el cuestionario de salud falló para todo el mundo:
 * `contestar_cribado()` devolvía 42883, PostgREST lo convertía en 404, la cola lo reintentaba
 * ocho veces y lo apartaba. 37 llamadas fallidas y nadie se enteró hasta que Bryan oyó quejas.
 * La app se traga fallos a propósito —una red de gimnasio no puede tumbar un entreno—, y por eso
 * mismo necesita dejarlos escritos en algún sitio. Ese sitio es `public.errores_navegador`
 * (migración 0078), y lo lee el panel del coach.
 *
 * TRES PROHIBICIONES, cada una con su prueba en `reportarError.test.ts`:
 *   1. NUNCA LANZA. Todo va dentro de try/catch y el envío se dispara sin esperarlo. Si falla,
 *      se descarta en silencio: quien cuenta los fallos no puede ser un fallo más.
 *   2. NUNCA INUNDA. El mismo mensaje una sola vez por sesión, y como mucho `TOPE` envíos. La
 *      memoria vive en `sessionStorage` y no solo en el módulo, porque un fallo que recarga la
 *      página en bucle abriría una «sesión» nueva en cada vuelta.
 *   3. NO AÑADE DATOS. Manda lo que ya trae el error —mensaje, pila—, la ruta sin query ni hash
 *      (ahí viajan los tokens de recuperación), el navegador y la versión. Trunca a los mismos
 *      límites que la tabla hace cumplir, y tapa los correos que asomen en el texto.
 *
 * DIRECTO Y NO POR LA COLA (`nube/procesador.ts`). Se pensó y se descartó, por cuatro razones:
 *   · La cola es de DATOS de la persona: se drena en orden, de una en una, y lo que falla ocho
 *     veces se aparta y se le enseña («operaciones apartadas»). Un informe de error metido ahí
 *     competiría con sus series y sus check-ins, y un informe que no sube acabaría como aviso
 *     en la pantalla de alguien que solo quería entrenar.
 *   · La cola vive en `localStorage`, que ya se llenó una vez (`sinEspacio.ts`). Guardar
 *     diagnósticos en el mismo sitio le quita espacio a lo que no se puede perder.
 *   · Es circular: cuando lo que falla ES la subida —el caso del cribado—, reportarlo por el
 *     mismo camino que está roto es no reportarlo.
 *   · Perder un informe no cuesta nada. Sin conexión no se manda (y no gasta el tope, así que
 *     si el fallo se repite con red, entonces sí sale); con conexión se manda una vez. Un fallo
 *     que importa se repite, y el que se repite acaba llegando.
 */
import { modoNube, supabase } from '../supabase'

export type OrigenError = 'window.error' | 'unhandledrejection' | 'reportado'

export interface ContextoError {
  /** Dónde se tragó el fallo: `hidratar:refresco`, `cola:contestar_cribado`… */
  donde?: string
}

/** Una fila de `public.errores_navegador`. `usuario_id` lo pone la base con `auth.uid()`. */
export interface FilaError {
  pantalla: string | null
  mensaje: string
  pila: string | null
  origen: OrigenError
  donde: string | null
  user_agent: string | null
  version: string | null
}

/** Lo que se usa de `sessionStorage`. Aparte para poder probarlo, y porque puede lanzar. */
export interface MemoriaDeSesion {
  getItem(clave: string): string | null
  setItem(clave: string, valor: string): void
}

export interface OpcionesReportador {
  /** Manda la fila. Puede lanzar o devolver una promesa rechazada: se traga igual. */
  enviar: (fila: FilaError) => unknown
  tope?: number
  memoria?: MemoriaDeSesion | null
  enLinea?: () => boolean
  pantalla?: () => string | null
  userAgent?: () => string | null
  version?: string | null
}

export interface Reportador {
  reportar(err: unknown, contexto?: ContextoError, origen?: OrigenError): void
  /** Escucha `error` y `unhandledrejection` en `destino`. Devuelve cómo dejar de escuchar. */
  instalar(destino: EventTarget): () => void
}

/** Envíos por sesión. Si algo entra en bucle con mensajes distintos, esto es lo más que cuesta. */
export const TOPE = 20

/** Los mismos límites que los CHECK de la 0078. */
export const LIMITES = {
  pantalla: 200,
  mensaje: 500,
  pila: 4000,
  donde: 100,
  user_agent: 300,
  version: 64,
} as const

const CLAVE_MEMORIA = 'alpha:errores-reportados'
const CORREO = /[^\s@()<>[\]"',;:]+@[^\s@()<>[\]"',;:]+\.[a-z]{2,}/gi

/** Recorta y tapa correos. Vacío → null. */
function acotar(texto: string | null | undefined, limite: number): string | null {
  if (typeof texto !== 'string') return null
  const limpio = texto.replace(CORREO, '[correo]').trim()
  return limpio === '' ? null : limpio.slice(0, limite)
}

/**
 * El mensaje de cualquier cosa que llegue como «error».
 *
 * Los de Supabase NO son `Error`: son objetos `{ code, message }`. El código va delante porque es
 * lo que distingue un 42883 (función rota) de un 42501 (permiso) cuando el texto se parece.
 */
function mensajeDe(err: unknown): string | null {
  if (err === null || err === undefined) return null
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const { message, code } = err as { message?: unknown; code?: unknown }
    if (typeof message === 'string' && message !== '') {
      return typeof code === 'string' && code !== '' ? `[${code}] ${message}` : message
    }
    return err instanceof Error ? err.name : null
  }
  return String(err)
}

function pilaDe(err: unknown): string | null {
  if (err && typeof err === 'object' && typeof (err as { stack?: unknown }).stack === 'string') {
    return (err as { stack: string }).stack
  }
  return null
}

interface Estado {
  vistos: string[]
  enviados: number
}

function leerEstado(memoria: MemoriaDeSesion | null | undefined): Estado {
  try {
    const crudo = memoria?.getItem(CLAVE_MEMORIA)
    if (!crudo) return { vistos: [], enviados: 0 }
    const e = JSON.parse(crudo) as Partial<Estado>
    return {
      vistos: Array.isArray(e.vistos) ? e.vistos.filter((v) => typeof v === 'string') : [],
      enviados: typeof e.enviados === 'number' ? e.enviados : 0,
    }
  } catch {
    return { vistos: [], enviados: 0 }
  }
}

export function crearReportador(opciones: OpcionesReportador): Reportador {
  const tope = opciones.tope ?? TOPE
  const pedir = <T>(f: (() => T) | undefined, reserva: T): T => {
    try {
      return f ? f() : reserva
    } catch {
      return reserva
    }
  }

  // En memoria SIEMPRE, y además en sessionStorage cuando se deja: si el almacén está bloqueado
  // (modo privado, cuota llena) se sigue deduplicando dentro de esta carga de la página.
  const inicial = leerEstado(opciones.memoria)
  const vistos = new Set(inicial.vistos)
  let enviados = inicial.enviados

  const recordar = () => {
    try {
      opciones.memoria?.setItem(CLAVE_MEMORIA, JSON.stringify({ vistos: [...vistos], enviados }))
    } catch {
      // Sin almacén: queda la memoria del módulo.
    }
  }

  const reportar = (err: unknown, contexto: ContextoError = {}, origen: OrigenError = 'reportado') => {
    try {
      const mensaje = acotar(mensajeDe(err), LIMITES.mensaje)
      if (!mensaje) return
      if (vistos.has(mensaje) || enviados >= tope) return
      // Sin red no se gasta nada: ni el visto ni el tope. Si se repite con conexión, sale.
      if (!pedir(opciones.enLinea, true)) return

      vistos.add(mensaje)
      enviados += 1
      recordar()

      const fila: FilaError = {
        pantalla: acotar(pedir(opciones.pantalla, null), LIMITES.pantalla),
        mensaje,
        pila: acotar(pilaDe(err), LIMITES.pila),
        origen,
        donde: acotar(contexto.donde, LIMITES.donde),
        user_agent: acotar(pedir(opciones.userAgent, null), LIMITES.user_agent),
        version: acotar(opciones.version ?? null, LIMITES.version),
      }
      const envio = opciones.enviar(fila)
      if (envio && typeof (envio as Promise<unknown>).then === 'function') {
        ;(envio as Promise<unknown>).then(undefined, () => {})
      }
    } catch {
      // Nunca lanza. Ni al leer un error venenoso, ni si el envío revienta de forma síncrona.
    }
  }

  return {
    reportar,
    instalar(destino) {
      const alError = (ev: Event) => {
        const e = ev as Partial<ErrorEvent>
        reportar(e.error ?? e.message, {}, 'window.error')
      }
      const alRechazo = (ev: Event) => {
        reportar((ev as Partial<PromiseRejectionEvent>).reason, {}, 'unhandledrejection')
      }
      destino.addEventListener('error', alError)
      destino.addEventListener('unhandledrejection', alRechazo)
      return () => {
        destino.removeEventListener('error', alError)
        destino.removeEventListener('unhandledrejection', alRechazo)
      }
    },
  }
}

/**
 * El envío de verdad.
 *
 * Sin `.select()` detrás del insert, y es a propósito: un asesorado NO puede leer la tabla (solo
 * el coach), así que pedir la fila de vuelta haría fallar un insert que sí estaba permitido.
 * Sin sesión no se manda: la base no tendría a quién atribuirlo y lo rechazaría.
 */
async function enviarASupabase(fila: FilaError): Promise<void> {
  if (!modoNube) return
  const sb = supabase()
  const { data } = await sb.auth.getSession()
  if (!data.session) return
  await sb.from('errores_navegador').insert(fila)
}

function sesionStorageSeguro(): MemoriaDeSesion | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

let porDefecto: Reportador | undefined

function reportadorPorDefecto(): Reportador {
  porDefecto ??= crearReportador({
    enviar: enviarASupabase,
    memoria: sesionStorageSeguro(),
    enLinea: () => typeof navigator === 'undefined' || navigator.onLine !== false,
    pantalla: () => (typeof location !== 'undefined' ? location.pathname : null),
    userAgent: () => (typeof navigator !== 'undefined' ? navigator.userAgent : null),
    // Lo hornea `vite.config.ts` desde VERCEL_GIT_COMMIT_SHA. Fuera de Vercel no hay.
    version: (import.meta.env.VITE_VERSION_APP as string | undefined) || null,
  })
  return porDefecto
}

/**
 * Para los sitios que hoy se tragan un fallo: `catch (e) { reportarError(e, { donde: '…' }) }`.
 * En modo demo (y en los tests, que siempre corren en demo) no hace nada.
 */
export function reportarError(err: unknown, contexto?: ContextoError): void {
  if (!modoNube) return
  reportadorPorDefecto().reportar(err, contexto, 'reportado')
}

/** Se llama una vez al arrancar (`main.tsx`). En modo demo no escucha nada. */
export function instalarRecogidaDeErrores(): () => void {
  if (!modoNube || typeof window === 'undefined') return () => {}
  return reportadorPorDefecto().instalar(window)
}
