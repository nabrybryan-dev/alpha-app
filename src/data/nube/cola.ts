/**
 * La cola de escrituras pendientes, como estructura de datos.
 *
 * **Este es el ÚNICO archivo que toca las claves de `localStorage` de la cola.**
 * No es una preferencia de estilo: la cola es estado global compartido, y si dos
 * módulos la leyeran y escribieran por su cuenta, un descuido dejaría dos colas
 * creyéndose la misma —se encola en una y se drena de la otra— y eso no falla con
 * un error, se traga series de entrenamiento en silencio. Quien necesite la cola
 * pasa por aquí.
 *
 * Aquí no hay red ni asincronía: son funciones puras sobre arrays más los cuatro
 * accesos al almacén. Quien las ejecuta contra Supabase es `procesador.ts`.
 */

export interface OperacionPendiente {
  tabla: string
  tipo: 'upsert' | 'update' | 'rpc'
  payload: Record<string, unknown>
  filtro?: Record<string, string>
  /**
   * Función del servidor a llamar, solo en `tipo: 'rpc'`.
   *
   * Existe porque PostgREST no sabe escribir dentro de un JSONB: para tocar una
   * rama de `microciclos.datos` sin mandar el blob entero hace falta que el
   * servidor haga el `jsonb_set`. Ver `0037` y
   * `docs/specs/2026-08-15-subir-solo-lo-que-cambia.md`.
   */
  funcion?: string
  /**
   * Qué identifica a esta llamada para colapsarla con la anterior igual. Sin
   * esto, cuatro series en el mismo ejercicio dejan cuatro operaciones en cola
   * donde basta la última: cada una manda el array completo de ese ejercicio.
   */
  claveRpc?: string
  /**
   * Columna sobre la que resolver el conflicto del upsert. Sin esto, Supabase
   * usa la clave primaria, y las tablas del registro de comidas la generan en
   * el servidor: el movil no la conoce, asi que cada reintento insertaria una
   * fila nueva en vez de actualizar la suya.
   */
  onConflict?: string
  intentos?: number
  /**
   * Quién la escribió. Se sella al apartarla en el cierre de sesión, para que
   * su trabajo no se reintente nunca con la sesión de la persona siguiente en
   * un móvil compartido: solo se rescata cuando vuelve a entrar quien la hizo.
   */
  duenio?: string
  /** Veces que se ha reencolado desde descartes. Corta el ida y vuelta eterno. */
  rescates?: number
}

const CLAVE_COLA = 'alpha-cola-sync'
const CLAVE_DESCARTES = 'alpha-cola-descartes'
const MAX_DESCARTES = 20
const MAX_RESCATES = 2

/** Reintentos antes de apartar una operación. Lo aplica `procesador.ts`. */
export const MAX_INTENTOS = 8

export function leerCola(): OperacionPendiente[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_COLA) ?? '[]') as OperacionPendiente[]
  } catch {
    return []
  }
}

export function escribirCola(cola: OperacionPendiente[]): void {
  localStorage.setItem(CLAVE_COLA, JSON.stringify(cola))
}

export function pendientesDeSync(): number {
  return leerCola().length
}

/**
 * Cuántas operaciones de esta persona quedaron apartadas tras fallar.
 *
 * POR QUÉ HACE FALTA. El descarte es silencioso a propósito —protege el registro
 * local de una cola que se atasca—, pero «no pierdas el dato» y «no se lo
 * cuentes a nadie» son dos decisiones distintas, y aquí se tomaron juntas sin
 * querer. El registro de comidas estuvo semanas sin subir y el asesorado siguió
 * anotando su día con normalidad, sin ver jamás un aviso.
 *
 * OJO AL LEER ESTE NÚMERO: el montón guarda `MAX_DESCARTES` operaciones y tira
 * las más viejas al desbordar, así que es un **mínimo**, no el total de lo que
 * no llegó. Ningún texto de la interfaz debe prometer que están todas.
 */
export function descartesPendientes(usuarioId?: string): number {
  return leerDescartes().filter((op) => op.duenio === undefined || op.duenio === usuarioId).length
}

/**
 * Al cerrar sesión, la cola activa tiene que vaciarse: en un dispositivo
 * compartido, sus operaciones se reintentarían con el JWT de la persona
 * siguiente.
 *
 * Pero vaciarla NO puede significar tirarla. `cerrarSesion` intenta subir lo
 * pendiente antes de salir y `procesarCola` resuelve igual cuando no subió nada
 * —sin señal se rinde a propósito, para no gastar reintentos—, así que borrar
 * aquí sin más se llevaba por delante entrenos enteros: quien entrena en un
 * sótano, registra sus series y luego cierra sesión porque "la app se puso
 * rara", perdía las 24 series sin un solo aviso.
 *
 * Se aparta sellada con su dueño. Solo vuelve a la cola cuando entra esa misma
 * persona (`rescatarDescartes`), nunca la siguiente.
 */
export function limpiarColasDeSync(usuarioId?: string): void {
  const pendientes = leerCola()
  if (pendientes.length > 0) {
    apartarDescartadas(pendientes.map((op) => ({ ...op, duenio: op.duenio ?? usuarioId })))
  }
  localStorage.removeItem(CLAVE_COLA)
}

/**
 * Un upsert nuevo sobre la misma fila reemplaza al que ya estaba en cola: en
 * una sesión de 24 series el microciclo se sube una vez con el estado final,
 * no 24 veces con estados intermedios.
 */
export function integrarEnCola(
  cola: OperacionPendiente[],
  op: OperacionPendiente,
): OperacionPendiente[] {
  const clave = claveDeFila(op)
  if (!clave) return [...cola, op]
  const previa = cola.findIndex((o) => claveDeFila(o) === clave)
  if (previa === -1) return [...cola, op]
  return cola.map((o, i) => (i === previa ? op : o))
}

function claveDeFila(op: OperacionPendiente): string | undefined {
  // Las llamadas al servidor traen su propia clave: mandan el estado final de
  // la rama que tocan, así que la última gana y las anteriores sobran.
  if (op.tipo === 'rpc') return op.claveRpc ? `rpc:${op.funcion}:${op.claveRpc}` : undefined
  if (op.tipo !== 'upsert') return undefined
  // `cliente_id` entra por el registro de comidas, donde la clave primaria la
  // pone el servidor: sin mirarla, editar la misma comida cinco veces dejaria
  // cinco upserts en cola en vez de uno con el estado final.
  const id = op.payload.id ?? op.payload.cliente_id ?? op.payload.usuario_id
  return typeof id === 'string' ? `${op.tabla}:${id}` : undefined
}

function leerDescartes(): OperacionPendiente[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DESCARTES) ?? '[]') as OperacionPendiente[]
  } catch {
    return []
  }
}

/**
 * Aparta operaciones para rescatarlas más tarde. Las nuevas van al final, así
 * que si el almacén se llena lo que se pierde es lo más viejo.
 */
export function apartarDescartadas(ops: readonly OperacionPendiente[]): void {
  try {
    localStorage.setItem(
      CLAVE_DESCARTES,
      JSON.stringify([...leerDescartes(), ...ops].slice(-MAX_DESCARTES)),
    )
  } catch {
    // si ni siquiera se puede apartar, se descarta sin más para no atascar la cola
  }
}

/**
 * Devuelve a la cola lo apartado que pertenezca a quien acaba de entrar: lo que
 * quedó sin subir al cerrar sesión, y lo que se descartó por fallar de forma
 * persistente (p. ej. las series que rechazaba el permiso RLS corregido en la
 * migración 0009, que ahora ya se pueden escribir).
 *
 * Se filtra por dueño a propósito. En un móvil compartido, reencolar lo de otra
 * persona significaría intentar subir sus datos con la sesión de esta: RLS lo
 * rechazaría, pero además su trabajo se gastaría los reintentos y acabaría
 * descartado de verdad. Lo que no tiene dueño sellado es de antes de este
 * cambio y se rescata igual, que es como se comportaba hasta ahora.
 *
 * `rescates` corta el ida y vuelta: una operación que el servidor no acepta
 * nunca deja de reencolarse tras un par de intentos y se queda apartada.
 *
 * @returns si se reencoló algo, para que quien llame decida si arrancar el
 *          procesado. Aquí no se dispara trabajo: esto es solo la cola.
 */
export function rescatarDescartes(usuarioId?: string): boolean {
  const descartes = leerDescartes()
  if (descartes.length === 0) return false

  const suyas = (op: OperacionPendiente) => op.duenio === undefined || op.duenio === usuarioId
  const rescatables = descartes.filter((op) => suyas(op) && (op.rescates ?? 0) < MAX_RESCATES)
  if (rescatables.length === 0) return false

  // se reencolan sin el contador de intentos, con dedup por fila
  let cola = leerCola()
  for (const op of rescatables) {
    cola = integrarEnCola(cola, { ...op, intentos: 0, rescates: (op.rescates ?? 0) + 1 })
  }
  escribirCola(cola)
  localStorage.setItem(
    CLAVE_DESCARTES,
    JSON.stringify(descartes.filter((op) => !rescatables.includes(op))),
  )
  return true
}

/**
 * Dos entradas son la misma operación si su contenido coincide. No hay id de
 * operación, y comparar por posición es justo lo que no se puede hacer aquí.
 */
function mismaOperacion(a: OperacionPendiente, b: OperacionPendiente): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Quita la operación que se acaba de procesar, buscándola por CONTENIDO.
 *
 * Si no aparece es porque `integrarEnCola` la reemplazó durante el vuelo por
 * una versión más nueva de la misma fila (la serie siguiente del mismo
 * microciclo). Entonces no se quita nada: esa versión nueva todavía no ha
 * subido y le toca en la vuelta siguiente.
 *
 * Se quita UNA sola coincidencia: dos `update` idénticos (marcar leídos dos
 * veces) son dos operaciones distintas y las dos tienen que ejecutarse.
 */
export function sinLaOperacion(
  cola: OperacionPendiente[],
  op: OperacionPendiente,
): OperacionPendiente[] {
  const i = cola.findIndex((o) => mismaOperacion(o, op))
  if (i === -1) return cola
  return [...cola.slice(0, i), ...cola.slice(i + 1)]
}

/** Deja la operación donde está y le anota el intento fallido. */
export function conIntentos(
  cola: OperacionPendiente[],
  op: OperacionPendiente,
  intentos: number,
): OperacionPendiente[] {
  const i = cola.findIndex((o) => mismaOperacion(o, op))
  if (i === -1) return cola
  return cola.map((o, j) => (j === i ? { ...op, intentos } : o))
}
