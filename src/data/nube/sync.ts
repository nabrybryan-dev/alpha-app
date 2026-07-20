import type { Db } from '../repos'
import { modoNube, supabase } from '../supabase'

export interface OperacionPendiente {
  tabla: string
  tipo: 'upsert' | 'update'
  payload: Record<string, unknown>
  filtro?: Record<string, string>
  intentos?: number
}

const CLAVE_COLA = 'alpha-cola-sync'
const CLAVE_DESCARTES = 'alpha-cola-descartes'
const CLAVE_TABLA_HIDRATACION = 'alpha-tabla-hidratacion'
const MAX_INTENTOS = 8
const MAX_DESCARTES = 20
let procesando = false

/**
 * La tabla `hidratacion` llegó después que el esquema inicial (migración 0003).
 * Solo se sincroniza si la hidratación desde nube confirmó que existe; si no,
 * el registro queda local y así la cola no se atasca con upserts imposibles.
 */
export function marcarTablaHidratacion(disponible: boolean): void {
  if (disponible) localStorage.setItem(CLAVE_TABLA_HIDRATACION, '1')
  else localStorage.removeItem(CLAVE_TABLA_HIDRATACION)
}

function tablaHidratacionLista(): boolean {
  return localStorage.getItem(CLAVE_TABLA_HIDRATACION) === '1'
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
 * Al cerrar sesión en un dispositivo (posiblemente compartido) no deben quedar
 * escrituras con datos personales en localStorage, ni operaciones de un usuario
 * que la cola intentaría subir con el JWT del siguiente.
 */
export function limpiarColasDeSync(): void {
  localStorage.removeItem(CLAVE_COLA)
  localStorage.removeItem(CLAVE_DESCARTES)
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

function apartarDescartada(op: OperacionPendiente): void {
  try {
    const crudo = localStorage.getItem(CLAVE_DESCARTES)
    const descartes = crudo ? (JSON.parse(crudo) as OperacionPendiente[]) : []
    localStorage.setItem(
      CLAVE_DESCARTES,
      JSON.stringify([...descartes, op].slice(-MAX_DESCARTES)),
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

export async function procesarCola(): Promise<void> {
  if (!modoNube || procesando) return
  procesando = true
  try {
    let cola = leerCola()
    while (cola.length > 0) {
      const op = cola[0]
      try {
        await ejecutar(op)
        cola = cola.slice(1)
        escribirCola(cola)
      } catch {
        // Sin conexión no se cuenta el intento: estar offline durante todo un
        // entreno no puede terminar descartando las series registradas.
        if (typeof navigator !== 'undefined' && !navigator.onLine) return
        const intentos = (op.intentos ?? 0) + 1
        if (intentos >= MAX_INTENTOS) {
          // Operación que falla de forma persistente (fila inexistente, RLS…):
          // se aparta para que no bloquee eternamente las escrituras siguientes.
          apartarDescartada({ ...op, intentos })
          cola = cola.slice(1)
          escribirCola(cola)
          continue
        }
        escribirCola([{ ...op, intentos }, ...cola.slice(1)])
        return
      }
    }
  } finally {
    procesando = false
  }
}

function encolar(op: OperacionPendiente): void {
  if (!modoNube) return
  escribirCola(integrarEnCola(leerCola(), op))
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
            leido: false,
          },
        })
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
