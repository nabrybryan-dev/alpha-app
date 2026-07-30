import type { Db } from '../repos'
import { modoNube, supabase } from '../supabase'

export interface OperacionPendiente {
  tabla: string
  tipo: 'upsert' | 'update'
  payload: Record<string, unknown>
  filtro?: Record<string, string>
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
const CLAVE_TABLA_HIDRATACION = 'alpha-tabla-hidratacion'
const MAX_INTENTOS = 8
const MAX_DESCARTES = 20
const MAX_RESCATES = 2

/**
 * El procesado en marcha, o `null` si no hay ninguno. Es la promesa, no un
 * booleano, para que se pueda ESPERAR: `encolar` lo lanza sin await y ese
 * trabajo sigue vivo después de que quien lo disparó haya terminado.
 */
let enVuelo: Promise<void> | null = null

/**
 * La tabla `hidratacion` llegó después que el esquema inicial (migración 0003).
 * El interruptor existe para no atascar la cola con upserts imposibles si el
 * despliegue todavía no la tiene.
 *
 * Se da por buena mientras no se demuestre lo contrario, y solo la apaga un
 * error que signifique EXACTAMENTE "esta tabla no existe". Antes la apagaba
 * cualquier fallo de esa lectura: un 500 pasajero o un corte de wifi dejaba de
 * sincronizar el agua para siempre en ese dispositivo, y cada vaso se quedaba
 * encerrado en el móvil hasta que la siguiente descarga con éxito lo borrara.
 */
export function marcarTablaHidratacion(disponible: boolean): void {
  localStorage.setItem(CLAVE_TABLA_HIDRATACION, disponible ? '1' : '0')
}

function tablaHidratacionLista(): boolean {
  return localStorage.getItem(CLAVE_TABLA_HIDRATACION) !== '0'
}

function leerCola(): OperacionPendiente[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_COLA) ?? '[]') as OperacionPendiente[]
  } catch {
    return []
  }
}

function escribirCola(cola: OperacionPendiente[]): void {
  localStorage.setItem(CLAVE_COLA, JSON.stringify(cola))
}

export function pendientesDeSync(): number {
  return leerCola().length
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
 * persona (`recuperarDescartes`), nunca la siguiente.
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
  if (op.tipo !== 'upsert') return undefined
  const id = op.payload.id ?? op.payload.usuario_id
  return typeof id === 'string' ? `${op.tabla}:${id}` : undefined
}

/**
 * Identidad de una fila, venga del servidor o de la cola.
 *
 * Las dos formas tienen que resolverse IGUAL o la fusión no encontraría el par.
 * Unas tablas se descargan con `select('datos')` (la fila es `{datos}` y el id
 * vive dentro, en camelCase del dominio) y otras con `select('*')` (columnas
 * reales, en snake_case). Se miran las dos.
 */
function identidadDeFila(fila: Record<string, unknown>): string | undefined {
  const datos = fila.datos
  if (datos && typeof datos === 'object') {
    const d = datos as Record<string, unknown>
    if (typeof d.id === 'string') return d.id
    if (typeof d.usuarioId === 'string') return d.usuarioId
  }
  if (typeof fila.id === 'string') return fila.id
  if (typeof fila.usuario_id === 'string') return fila.usuario_id
  return undefined
}

function cumpleFiltro(
  fila: Record<string, unknown>,
  filtro: Record<string, string> | undefined,
): boolean {
  return Object.entries(filtro ?? {}).every(([columna, valor]) => fila[columna] === valor)
}

/**
 * Las filas descargadas del servidor con las escrituras locales PENDIENTES
 * puestas encima.
 *
 * La cola es, por definición, lo que este dispositivo escribió y el servidor
 * todavía no tiene: cualquier operación que siga en ella es más nueva que la
 * fila que acaba de bajar. Sin esta fusión, la foto del servidor —leída ANTES
 * de que la persona tocara "guardar serie"— vuelve a la base local y borra todo
 * lo que se escribió mientras la descarga estaba en vuelo. Con wifi de gimnasio
 * esa ventana son decenas de segundos, y `SIGNED_IN` la abre cada vez que se
 * desbloquea el móvil entre series.
 *
 * Que la cola gane no es solo para no perder el dato en pantalla: si el estado
 * local se pisa, la escritura SIGUIENTE reconstruye su envío leyendo ese estado
 * ya pisado y reemplaza en la cola la operación buena. Ahí la pérdida deja de
 * ser un susto visual y se vuelve definitiva.
 */
export function conPendientes<T>(tabla: string, filas: readonly T[]): T[] {
  if (!modoNube) return [...filas]
  const ops = leerCola().filter((o) => o.tabla === tabla)
  if (ops.length === 0) return [...filas]

  let salida = [...filas] as Record<string, unknown>[]
  for (const op of ops) {
    if (op.tipo === 'update') {
      // Un update es un parche sobre las filas que cumplen su filtro (marcar
      // leído un hilo), no una fila completa: se aplica encima, no reemplaza.
      salida = salida.map((f) => (cumpleFiltro(f, op.filtro) ? { ...f, ...op.payload } : f))
      continue
    }
    const clave = identidadDeFila(op.payload)
    if (clave === undefined) continue
    const i = salida.findIndex((f) => identidadDeFila(f) === clave)
    // Si no está en la descarga es una fila creada en este dispositivo que el
    // servidor aún no conoce (el check-in de hoy): se añade, no se descarta.
    salida = i === -1 ? [...salida, op.payload] : salida.map((f, j) => (j === i ? op.payload : f))
  }
  return salida as T[]
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
function apartarDescartadas(ops: readonly OperacionPendiente[]): void {
  try {
    localStorage.setItem(
      CLAVE_DESCARTES,
      JSON.stringify([...leerDescartes(), ...ops].slice(-MAX_DESCARTES)),
    )
  } catch {
    // si ni siquiera se puede apartar, se descarta sin más para no atascar la cola
  }
}

async function ejecutar(op: OperacionPendiente): Promise<void> {
  const sb = supabase()
  if (op.tipo === 'upsert') {
    const { error } = await sb.from(op.tabla).upsert(op.payload)
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
function sinLaOperacion(
  cola: OperacionPendiente[],
  op: OperacionPendiente,
): OperacionPendiente[] {
  const i = cola.findIndex((o) => mismaOperacion(o, op))
  if (i === -1) return cola
  return [...cola.slice(0, i), ...cola.slice(i + 1)]
}

/** Deja la operación donde está y le anota el intento fallido. */
function conIntentos(
  cola: OperacionPendiente[],
  op: OperacionPendiente,
  intentos: number,
): OperacionPendiente[] {
  const i = cola.findIndex((o) => mismaOperacion(o, op))
  if (i === -1) return cola
  return cola.map((o, j) => (j === i ? { ...op, intentos } : o))
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

function encolar(op: OperacionPendiente): void {
  if (!modoNube) return
  escribirCola(integrarEnCola(leerCola(), op))
  void procesarCola()
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
 */
export function recuperarDescartes(usuarioId?: string): void {
  if (!modoNube) return
  const descartes = leerDescartes()
  if (descartes.length === 0) return

  const suyas = (op: OperacionPendiente) => op.duenio === undefined || op.duenio === usuarioId
  const rescatables = descartes.filter((op) => suyas(op) && (op.rescates ?? 0) < MAX_RESCATES)
  if (rescatables.length === 0) return

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
  void procesarCola()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void procesarCola())
  window.setInterval(() => void procesarCola(), 30000)
}

export function crearDbSincronizada(local: Db): Db {
  if (!modoNube) return local

  return {
    ...local,

    perfiles: {
      ...local.perfiles,
      agregarMedida: (usuarioId, medida) => {
        local.perfiles.agregarMedida(usuarioId, medida)
        const perfil = local.perfiles.byUsuario(usuarioId)
        if (!perfil) return
        encolar({
          tabla: 'perfiles',
          tipo: 'upsert',
          payload: { usuario_id: usuarioId, datos: perfil },
        })
      },
    },

    microciclos: {
      ...local.microciclos,
      registrarSerie: (microcicloId, ejercicioId, serie) => {
        local.microciclos.registrarSerie(microcicloId, ejercicioId, serie)
        subirMicrociclo(local, microcicloId)
      },
      guardarTestPost: (microcicloId, sesionId, test) => {
        local.microciclos.guardarTestPost(microcicloId, sesionId, test)
        subirMicrociclo(local, microcicloId)
      },
      marcarParte: (microcicloId, sesionId, parteId) => {
        local.microciclos.marcarParte(microcicloId, sesionId, parteId)
        subirMicrociclo(local, microcicloId)
      },
    },

    bienestar: {
      ...local.bienestar,
      guardar: (checkin) => {
        local.bienestar.guardar(checkin)
        encolar({
          tabla: 'checkins',
          tipo: 'upsert',
          payload: {
            id: checkin.id,
            usuario_id: checkin.usuarioId,
            fecha: checkin.fecha,
            datos: checkin,
          },
        })
      },
    },

    nutricion: {
      ...local.nutricion,
      registrarHidratacion: (usuarioId, fecha, deltaMl) => {
        local.nutricion.registrarHidratacion(usuarioId, fecha, deltaMl)
        if (!tablaHidratacionLista()) return
        encolar({
          tabla: 'hidratacion',
          tipo: 'upsert',
          payload: {
            id: `hid-${usuarioId}-${fecha}`,
            usuario_id: usuarioId,
            fecha,
            ml: local.nutricion.hidratacionDe(usuarioId, fecha),
          },
        })
      },
      marcarAdherencia: (usuarioId, fecha, estado, comentario) => {
        local.nutricion.marcarAdherencia(usuarioId, fecha, estado, comentario)
        encolar({
          tabla: 'adherencias',
          tipo: 'upsert',
          payload: {
            id: `ad-${usuarioId}-${fecha}`,
            usuario_id: usuarioId,
            fecha,
            estado,
            comentario: comentario ?? null,
          },
        })
      },
    },

    mensajes: {
      ...local.mensajes,
      enviar: (mensaje) => {
        local.mensajes.enviar(mensaje)
        const hilo = local.mensajes.hilo(mensaje.deId, mensaje.paraId)
        const ultimo = hilo[hilo.length - 1]
        encolar({
          tabla: 'mensajes',
          tipo: 'upsert',
          payload: {
            id: ultimo.id,
            de_id: ultimo.deId,
            para_id: ultimo.paraId,
            fecha_iso: ultimo.fechaIso,
            texto: ultimo.texto,
            adjunto_url: ultimo.adjuntoUrl ?? null,
            origen: ultimo.origen ?? 'humano',
            leido: false,
          },
        })
      },
      /**
       * ÚNICA escritura de mensajes que NO pasa por la cola, y es a propósito.
       *
       * La fila de la respuesta de Alpha va firmada con el id del coach, y la
       * política RLS de `mensajes` es `with check (de_id = auth.uid())`: el
       * dispositivo de la asesorada NO puede insertarla. Por eso la escribe la
       * Edge Function con `service_role`, que se salta RLS, y cuando llega aquí
       * la fila ya existe en la base.
       *
       * Si además se encolara, ese upsert se rechazaría 8 veces, se descartaría
       * y —lo importante— mientras tanto bloquearía la cabeza de la cola,
       * retrasando la subida de las series y los check-ins que van detrás.
       *
       * Se pinta en local con el MISMO id que devolvió la función para que en
       * la siguiente hidratación coincida y no aparezca duplicada.
       */
      recibirDeAlpha: (mensaje) => {
        local.mensajes.recibirDeAlpha(mensaje)
      },
      marcarLeidos: (paraId, deId) => {
        local.mensajes.marcarLeidos(paraId, deId)
        encolar({
          tabla: 'mensajes',
          tipo: 'update',
          payload: { leido: true },
          filtro: { para_id: paraId, de_id: deId },
        })
      },
    },

    cuestionarios: {
      ...local.cuestionarios,
      responder: (cuestionarioId, usuarioId, valores) => {
        local.cuestionarios.responder(cuestionarioId, usuarioId, valores)
        const respuestas = local.cuestionarios.respuestasDe(usuarioId)
        const ultima = respuestas[respuestas.length - 1]
        encolar({
          tabla: 'respuestas',
          tipo: 'upsert',
          payload: {
            id: ultima.id,
            cuestionario_id: ultima.cuestionarioId,
            usuario_id: ultima.usuarioId,
            fecha_iso: ultima.fechaIso,
            valores: ultima.valores,
          },
        })
      },
    },
  }
}

function subirMicrociclo(local: Db, microcicloId: string): void {
  const duenio = local.usuarios
    .list()
    .find((u) => local.microciclos.byUsuario(u.id).some((m) => m.id === microcicloId))
  if (!duenio) return
  const microciclo = local.microciclos.byUsuario(duenio.id).find((m) => m.id === microcicloId)
  if (!microciclo) return
  encolar({
    tabla: 'microciclos',
    tipo: 'upsert',
    payload: {
      id: microciclo.id,
      usuario_id: microciclo.usuarioId,
      numero: microciclo.numero,
      estado: microciclo.estado,
      datos: microciclo,
    },
  })
}
