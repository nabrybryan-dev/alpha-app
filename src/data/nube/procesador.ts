/**
 * El camino de ESCRITURA: vaciar la cola contra Supabase.
 *
 * Aquí vive `enVuelo`, la única variable mutable a nivel de módulo de todo el
 * sync. Por eso este archivo no se duplica ni se instancia dos veces: si hubiera
 * dos procesadores, cada uno con su `enVuelo`, los dos drenarían la misma cola de
 * `localStorage` a la vez y se pisarían las escrituras.
 *
 * Toda la manipulación de la cola pasa por `cola.ts`. Aquí no se toca
 * `localStorage` directamente.
 */
import {
  apartarDescartadas,
  conIntentos,
  escribirCola,
  integrarEnCola,
  leerCola,
  MAX_INTENTOS,
  rescatarDescartes,
  sinLaOperacion,
  type OperacionPendiente,
} from './cola'
import { modoNube, supabase } from '../supabase'

/**
 * El procesado en marcha, o `null` si no hay ninguno. Es la promesa, no un
 * booleano, para que se pueda ESPERAR: `encolar` lo lanza sin await y ese
 * trabajo sigue vivo después de que quien lo disparó haya terminado.
 */
let enVuelo: Promise<void> | null = null

async function ejecutar(op: OperacionPendiente): Promise<void> {
  const sb = supabase()
  if (op.tipo === 'rpc') {
    // La función escribe dentro del JSONB en el servidor. Va con `security
    // invoker`, así que la RLS de la tabla sigue mandando: nadie toca lo que no
    // es suyo por llamar a una función.
    if (!op.funcion) throw new Error('operación rpc sin función')
    const { error } = await sb.rpc(op.funcion, op.payload)
    if (error) throw new Error(error.message)
    return
  }
  if (op.tipo === 'upsert') {
    const { error } = await sb
      .from(op.tabla)
      .upsert(op.payload, op.onConflict ? { onConflict: op.onConflict } : undefined)
    if (error) throw new Error(error.message)
    return
  }
  let consulta = sb.from(op.tabla).update(op.payload)
  for (const [columna, valor] of Object.entries(op.filtro ?? {})) {
    consulta = consulta.eq(columna, valor)
  }
  const { error } = await consulta
  if (error) throw new Error(error.message)
}

/**
 * Vacía la cola de una en una, RELEYENDO `localStorage` en cada paso.
 *
 * Releer no es un detalle: `ejecutar` tarda lo que tarde la red, y durante ese
 * rato la asesorada sigue usando la app y `encolar` escribe en la misma cola.
 * Antes se trabajaba sobre la foto tomada al empezar y se devolvía esa foto
 * recortada, así que **todo lo encolado durante la petición se sobrescribía y
 * desaparecía**: ni se subía ni se reintentaba ni quedaba en descartes.
 */
async function drenar(): Promise<void> {
  for (;;) {
    const cola = leerCola()
    if (cola.length === 0) return
    const op = cola[0]
    try {
      await ejecutar(op)
      escribirCola(sinLaOperacion(leerCola(), op))
    } catch {
      // Sin conexión no se cuenta el intento: estar offline durante todo un
      // entreno no puede terminar descartando las series registradas.
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      const intentos = (op.intentos ?? 0) + 1
      if (intentos >= MAX_INTENTOS) {
        // Operación que falla de forma persistente (fila inexistente, RLS…):
        // se aparta para que no bloquee eternamente las escrituras siguientes.
        apartarDescartadas([{ ...op, intentos }])
        escribirCola(sinLaOperacion(leerCola(), op))
        continue
      }
      escribirCola(conIntentos(leerCola(), op, intentos))
      return
    }
  }
}

/**
 * Vacía la cola contra Supabase. Si ya hay un procesado en marcha devuelve ESE
 * mismo en vez de resolver de inmediato, para que `await procesarCola()` espere
 * de verdad a que la cola quede quieta y no solo a que alguien la esté mirando.
 */
export function procesarCola(): Promise<void> {
  if (!modoNube) return Promise.resolve()
  if (enVuelo) return enVuelo
  enVuelo = drenar().finally(() => {
    enVuelo = null
  })
  return enVuelo
}

/**
 * Promesa del procesado que haya en vuelo, o una ya resuelta si no hay ninguno.
 * A diferencia de `procesarCola`, NO arranca trabajo nuevo: solo deja aterrizar
 * lo que ya estaba corriendo antes de tocar la cola desde fuera.
 *
 * `encolar` lanza el procesado sin esperarlo, así que sus escrituras en
 * `localStorage` ocurren después de que el código que las provocó haya
 * terminado. Quien necesite la cola en un estado conocido —los tests entre
 * casos, o un cierre de sesión que va a borrarla— tiene que esperar aquí.
 */
export function colaEnReposo(): Promise<void> {
  return enVuelo ?? Promise.resolve()
}

export function encolar(op: OperacionPendiente): void {
  if (!modoNube) return
  escribirCola(integrarEnCola(leerCola(), op))
  void procesarCola()
}

/**
 * Devuelve a la cola lo que quedó apartado y pertenece a quien acaba de entrar,
 * y arranca el procesado si hubo algo que rescatar. El filtrado por dueño y los
 * topes de rescate viven en `cola.ts`.
 */
export function recuperarDescartes(usuarioId?: string): void {
  if (!modoNube) return
  if (!rescatarDescartes(usuarioId)) return
  void procesarCola()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void procesarCola())
  window.setInterval(() => void procesarCola(), 30000)
}
