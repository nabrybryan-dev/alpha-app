import type {
  CheckinDiario,
  EstadoAdherencia,
  ItemMarcable,
  Microciclo,
  SerieRegistrada,
  TestPostSesion,
} from '../domain/types'
import { patronDeSesion, plantillaPreparacion } from './plantillas/preparacionBase'
import type { Db } from './repos'
import { seedDb, type SeedDb } from './seed'

const CLAVE = 'alpha-db-v2'

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

let referencia: { actual: SeedDb } | undefined

export function aplicarSnapshot(nuevo: SeedDb): void {
  localStorage.setItem(CLAVE, JSON.stringify(nuevo))
  if (referencia) referencia.actual = nuevo
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
  const ref = { actual: cargar() }
  referencia = ref
  guardar(ref.actual)

  const mutar = (nuevo: SeedDb) => {
    ref.actual = nuevo
    guardar(ref.actual)
  }

  return {
    usuarios: {
      list: () => ref.actual.usuarios,
      byId: (id) => ref.actual.usuarios.find((u) => u.id === id),
      asesorados: () => ref.actual.usuarios.filter((u) => u.rol === 'asesorado'),
    },

    perfiles: {
      byUsuario: (usuarioId) => ref.actual.perfiles.find((p) => p.usuarioId === usuarioId),
    },

    microciclos: {
      byUsuario: (usuarioId) =>
        ref.actual.microciclos
          .filter((m) => m.usuarioId === usuarioId)
          .sort((a, b) => b.numero - a.numero),
      registrarSerie: (microcicloId: string, ejercicioId: string, serie: SerieRegistrada) => {
        mutar(
          actualizarMicrociclo(ref.actual, microcicloId, (m) => ({
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
          actualizarMicrociclo(ref.actual, microcicloId, (m) => ({
            ...m,
            sesiones: m.sesiones.map((s) => (s.id === sesionId ? { ...s, testPost: test } : s)),
          })),
        )
      },
      marcarParte: (microcicloId: string, sesionId: string, parteId: string) => {
        const alternar = <T extends ItemMarcable>(item: T): T =>
          item.id === parteId
            ? { ...item, hechoEn: item.hechoEn ? undefined : new Date().toISOString() }
            : item
        mutar(
          actualizarMicrociclo(ref.actual, microcicloId, (m) => ({
            ...m,
            sesiones: m.sesiones.map((s) => {
              if (s.id !== sesionId) return s
              const preparacion = s.preparacion ?? plantillaPreparacion(patronDeSesion(s.nombre))
              return { ...s, preparacion: preparacion.map(alternar), bloquesCardio: s.bloquesCardio?.map(alternar) }
            }),
          })),
        )
      },
    },

    bienestar: {
      byUsuario: (usuarioId) =>
        ref.actual.checkins
          .filter((c) => c.usuarioId === usuarioId)
          .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      guardar: (checkin: CheckinDiario) => {
        mutar({
          ...ref.actual,
          checkins: [
            ...ref.actual.checkins.filter(
              (c) => !(c.usuarioId === checkin.usuarioId && c.fecha === checkin.fecha),
            ),
            checkin,
          ],
        })
      },
    },

    nutricion: {
      planByUsuario: (usuarioId) => ref.actual.planes.find((p) => p.usuarioId === usuarioId),
      adherenciasByUsuario: (usuarioId) =>
        ref.actual.adherencias
          .filter((a) => a.usuarioId === usuarioId)
          .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      marcarAdherencia: (
        usuarioId: string,
        fecha: string,
        estadoAdh: EstadoAdherencia,
        comentario?: string,
      ) => {
        mutar({
          ...ref.actual,
          adherencias: [
            ...ref.actual.adherencias.filter((a) => !(a.usuarioId === usuarioId && a.fecha === fecha)),
            { id: `ad-${usuarioId}-${fecha}`, usuarioId, fecha, estado: estadoAdh, comentario },
          ],
        })
      },
    },

    mensajes: {
      hilo: (usuarioA, usuarioB) =>
        ref.actual.mensajes
          .filter(
            (m) =>
              (m.deId === usuarioA && m.paraId === usuarioB) ||
              (m.deId === usuarioB && m.paraId === usuarioA),
          )
          .sort((a, b) => a.fechaIso.localeCompare(b.fechaIso)),
      enviar: ({ deId, paraId, texto, adjuntoUrl }) => {
        mutar({
          ...ref.actual,
          mensajes: [
            ...ref.actual.mensajes,
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
          ...ref.actual,
          mensajes: ref.actual.mensajes.map((m) =>
            m.paraId === paraId && m.deId === deId ? { ...m, leido: true } : m,
          ),
        })
      },
      noLeidosPara: (usuarioId) =>
        ref.actual.mensajes.filter((m) => m.paraId === usuarioId && !m.leido).length,
      noLeidosDe: (paraId, deId) =>
        ref.actual.mensajes.filter((m) => m.paraId === paraId && m.deId === deId && !m.leido).length,
    },

    cuestionarios: {
      asignadosA: (usuarioId) =>
        ref.actual.cuestionarios.filter((q) => q.asignadoA.includes(usuarioId)),
      respuestasDe: (usuarioId) => ref.actual.respuestas.filter((r) => r.usuarioId === usuarioId),
      responder: (cuestionarioId, usuarioId, valores) => {
        mutar({
          ...ref.actual,
          respuestas: [
            ...ref.actual.respuestas,
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
      list: () => ref.actual.contenidos,
      byId: (id) => ref.actual.contenidos.find((c) => c.id === id),
    },

    premiaciones: {
      byUsuario: (usuarioId) => ref.actual.premiaciones.filter((p) => p.usuarioId === usuarioId),
    },
  }
}
