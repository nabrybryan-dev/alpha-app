import type { Db } from '../repos'
import { modoNube, supabase } from '../supabase'

interface OperacionPendiente {
  tabla: string
  tipo: 'upsert' | 'update'
  payload: Record<string, unknown>
  filtro?: Record<string, string>
}

const CLAVE_COLA = 'alpha-cola-sync'
let procesando = false

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
      await ejecutar(cola[0])
      cola = cola.slice(1)
      escribirCola(cola)
    }
  } catch {
    // sin conexión o error transitorio: la cola queda para el próximo intento
  } finally {
    procesando = false
  }
}

function encolar(op: OperacionPendiente): void {
  if (!modoNube) return
  escribirCola([...leerCola(), op])
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
