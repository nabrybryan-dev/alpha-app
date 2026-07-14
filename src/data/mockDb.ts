import type {
  CheckinDiario,
  EstadoAdherencia,
  Microciclo,
  SerieRegistrada,
  TestPostSesion,
} from '../domain/types'
import type { Db } from './repos'
import { seedDb, type SeedDb } from './seed'

const CLAVE = 'alpha-db-v1'

type Oyente = () => void
const oyentes = new Set<Oyente>()

export function suscribirse(oyente: Oyente): () => void {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

function cargar(): SeedDb {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) return JSON.parse(crudo) as SeedDb
  } catch {
    // dato corrupto: se reinicia desde el seed
  }
  return structuredClone(seedDb)
}

function guardar(estado: SeedDb): void {
  localStorage.setItem(CLAVE, JSON.stringify(estado))
  oyentes.forEach((o) => o())
}

export function reiniciarDb(): void {
  localStorage.removeItem(CLAVE)
  oyentes.forEach((o) => o())
}

function actualizarMicrociclo(
  estado: SeedDb,
  microcicloId: string,
  transformar: (m: Microciclo) => Microciclo,
): SeedDb {
  return {
    ...estado,
    microciclos: estado.microciclos.map((m) => (m.id === microcicloId ? transformar(m) : m)),
  }
}

export function crearMockDb(): Db {
  let estado = cargar()
  guardar(estado)

  const mutar = (nuevo: SeedDb) => {
    estado = nuevo
    guardar(estado)
  }

  return {
    usuarios: {
      list: () => estado.usuarios,
      byId: (id) => estado.usuarios.find((u) => u.id === id),
      asesorados: () => estado.usuarios.filter((u) => u.rol === 'asesorado'),
    },

    perfiles: {
      byUsuario: (usuarioId) => estado.perfiles.find((p) => p.usuarioId === usuarioId),
    },

    microciclos: {
      byUsuario: (usuarioId) =>
        estado.microciclos
          .filter((m) => m.usuarioId === usuarioId)
          .sort((a, b) => b.numero - a.numero),
      registrarSerie: (microcicloId: string, ejercicioId: string, serie: SerieRegistrada) => {
        mutar(
          actualizarMicrociclo(estado, microcicloId, (m) => ({
            ...m,
            sesiones: m.sesiones.map((s) => ({
              ...s,
              ejercicios: s.ejercicios.map((e) =>
                e.id === ejercicioId
                  ? {
                      ...e,
                      series: [...e.series.filter((x) => x.orden !== serie.orden), serie].sort(
                        (a, b) => a.orden - b.orden,
                      ),
                    }
                  : e,
              ),
            })),
          })),
        )
      },
      guardarTestPost: (microcicloId: string, sesionId: string, test: TestPostSesion) => {
        mutar(
          actualizarMicrociclo(estado, microcicloId, (m) => ({
            ...m,
            sesiones: m.sesiones.map((s) => (s.id === sesionId ? { ...s, testPost: test } : s)),
          })),
        )
      },
    },

    bienestar: {
      byUsuario: (usuarioId) =>
        estado.checkins
          .filter((c) => c.usuarioId === usuarioId)
          .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      guardar: (checkin: CheckinDiario) => {
        mutar({
          ...estado,
          checkins: [
            ...estado.checkins.filter(
              (c) => !(c.usuarioId === checkin.usuarioId && c.fecha === checkin.fecha),
            ),
            checkin,
          ],
        })
      },
    },

    nutricion: {
      planByUsuario: (usuarioId) => estado.planes.find((p) => p.usuarioId === usuarioId),
      adherenciasByUsuario: (usuarioId) =>
        estado.adherencias
          .filter((a) => a.usuarioId === usuarioId)
          .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      marcarAdherencia: (
        usuarioId: string,
        fecha: string,
        estadoAdh: EstadoAdherencia,
        comentario?: string,
      ) => {
        mutar({
          ...estado,
          adherencias: [
            ...estado.adherencias.filter((a) => !(a.usuarioId === usuarioId && a.fecha === fecha)),
            { id: `ad-${usuarioId}-${fecha}`, usuarioId, fecha, estado: estadoAdh, comentario },
          ],
        })
      },
    },

    mensajes: {
      hilo: (usuarioA, usuarioB) =>
        estado.mensajes
          .filter(
            (m) =>
              (m.deId === usuarioA && m.paraId === usuarioB) ||
              (m.deId === usuarioB && m.paraId === usuarioA),
          )
          .sort((a, b) => a.fechaIso.localeCompare(b.fechaIso)),
      enviar: ({ deId, paraId, texto, adjuntoUrl }) => {
        mutar({
          ...estado,
          mensajes: [
            ...estado.mensajes,
            {
              id: `msg-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
              deId,
              paraId,
              texto,
              adjuntoUrl,
              fechaIso: new Date().toISOString(),
              leido: false,
            },
          ],
        })
      },
      marcarLeidos: (paraId, deId) => {
        mutar({
          ...estado,
          mensajes: estado.mensajes.map((m) =>
            m.paraId === paraId && m.deId === deId ? { ...m, leido: true } : m,
          ),
        })
      },
      noLeidosPara: (usuarioId) =>
        estado.mensajes.filter((m) => m.paraId === usuarioId && !m.leido).length,
      noLeidosDe: (paraId, deId) =>
        estado.mensajes.filter((m) => m.paraId === paraId && m.deId === deId && !m.leido).length,
    },

    cuestionarios: {
      asignadosA: (usuarioId) =>
        estado.cuestionarios.filter((q) => q.asignadoA.includes(usuarioId)),
      respuestasDe: (usuarioId) => estado.respuestas.filter((r) => r.usuarioId === usuarioId),
      responder: (cuestionarioId, usuarioId, valores) => {
        mutar({
          ...estado,
          respuestas: [
            ...estado.respuestas,
            {
              id: `r-${cuestionarioId}-${usuarioId}-${Date.now()}`,
              cuestionarioId,
              usuarioId,
              valores,
              fechaIso: new Date().toISOString(),
            },
          ],
        })
      },
    },

    contenidos: {
      list: () => estado.contenidos,
      byId: (id) => estado.contenidos.find((c) => c.id === id),
    },

    premiaciones: {
      byUsuario: (usuarioId) => estado.premiaciones.filter((p) => p.usuarioId === usuarioId),
    },
  }
}
