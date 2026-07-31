import type {
  CheckinDiario,
  EstadoAdherencia,
  ItemMarcable,
  Microciclo,
  SerieRegistrada,
  TestPostSesion,
} from '../domain/types'
import { construirRanking } from '../domain/ranking'
import { patronDeSesion, plantillaPreparacion } from './plantillas/preparacionBase'
import type { Db } from './repos'
import { seedDb, type SeedDb } from './seed'
import { diasAtras } from './seed/fechas'

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

/**
 * Cuenta las escrituras LOCALES (las que nacen de tocar la app), no las de la
 * descarga. `hidratarDesdeNube` la mira antes de pedir los datos y otra vez
 * justo antes de aplicarlos: si cambió, es que la persona guardó algo mientras
 * bajaba y la foto del servidor —leída antes de esa pulsación— ya está vieja.
 */
let escriturasLocales = 0

export function versionEscrituras(): number {
  return escriturasLocales
}

function guardar(estado: SeedDb): void {
  escriturasLocales += 1
  localStorage.setItem(CLAVE, JSON.stringify(estado))
  oyentes.forEach((o) => o())
}

let referencia: { actual: SeedDb } | undefined

/**
 * Sube en cada apertura y cierre de sesión. Una descarga que empezó antes de
 * que cambiara ya no vale: o no hay nadie dentro, o dentro hay otra persona.
 */
let epoca = 0

export function epocaSesion(): number {
  return epoca
}

export function abrirSesionLocal(): void {
  epoca += 1
}

/**
 * Borra del dispositivo los datos de quien acaba de salir.
 *
 * Quitar la clave de `localStorage` no bastaba: `referencia.actual` es la copia
 * EN MEMORIA y sobrevivía intacta, así que `db.usuarios`, `db.microciclos` y
 * `db.bienestar` seguían devolviendo los datos de quien había cerrado sesión —y
 * la primera escritura posterior los volvía a dejar en el disco enteros.
 */
export function olvidarDatosLocales(): void {
  epoca += 1
  localStorage.removeItem(CLAVE)
  if (referencia) referencia.actual = structuredClone(seedDb)
  oyentes.forEach((o) => o())
}

export function reiniciarDb(): void {
  olvidarDatosLocales()
}

/**
 * Reemplaza la base local ENTERA con la foto del servidor.
 *
 * `epoca` es la que había cuando ARRANCÓ la descarga. Si ya no coincide, por el
 * medio se cerró sesión o entró otra persona, y esta foto pertenece a una
 * sesión que ya no existe: aplicarla repondría en el teléfono los datos de
 * quien acaba de salir, o dejaría sin perfil a quien acaba de entrar. Sin
 * `epoca` se aplica sin más, que es lo que necesitan los tests para montar un
 * estado de partida.
 */
export function aplicarSnapshot(nuevo: SeedDb, epocaDeOrigen?: number): void {
  if (epocaDeOrigen !== undefined && epocaDeOrigen !== epoca) return
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

  /**
   * Aplica un cambio RELEYENDO el disco, no la copia en memoria.
   *
   * `ref.actual` es la foto de cuando se creó esta instancia y no se vuelve a
   * leer nunca. Como cada escritura serializa esa foto ENTERA sobre
   * `alpha-db-v2`, todo lo que hubiera escrito otra pestaña por el camino
   * desaparecía sin dejar rastro. Es el mismo fallo que tenía la cola de sync,
   * con la segunda pestaña haciendo de `await`.
   */
  const mutar = (transformar: (estado: SeedDb) => SeedDb) => {
    ref.actual = transformar(cargar())
    guardar(ref.actual)
  }

  return {
    usuarios: {
      list: () => ref.actual.usuarios,
      byId: (id) => ref.actual.usuarios.find((u) => u.id === id),
      asesorados: () => ref.actual.usuarios.filter((u) => u.rol === 'asesorado'),
      entrenan: () =>
        ref.actual.usuarios.filter((u) => u.rol === 'asesorado' || u.rol === 'nutricionista'),
    },

    perfiles: {
      byUsuario: (usuarioId) => ref.actual.perfiles.find((p) => p.usuarioId === usuarioId),
      agregarMedida: (usuarioId, medida) => {
        mutar((estado) => ({
          ...estado,
          perfiles: estado.perfiles.some((p) => p.usuarioId === usuarioId)
            ? estado.perfiles.map((p) =>
                p.usuarioId === usuarioId
                  ? {
                      ...p,
                      medidas: [...p.medidas.filter((m) => m.fecha !== medida.fecha), medida].sort(
                        (a, b) => a.fecha.localeCompare(b.fecha),
                      ),
                    }
                  : p,
              )
            : [
                ...estado.perfiles,
                {
                  usuarioId,
                  objetivos: '',
                  edad: 0,
                  diasEntrenamiento: 0,
                  tiempoSesionMin: 0,
                  somatotipo: '',
                  volumenSemanal: {},
                  medidas: [medida],
                },
              ],
        }))
      },
    },

    microciclos: {
      byUsuario: (usuarioId) =>
        ref.actual.microciclos
          .filter((m) => m.usuarioId === usuarioId)
          .sort((a, b) => b.numero - a.numero),
      guardarPropuesta: (micro: Microciclo) => {
        // Se fuerza el estado aquí y no en quien llama: es la salvaguarda de que
        // una propuesta nunca aparezca en las pantallas del asesorado, que solo
        // miran el `activo`. Un descuido de quien llama no puede saltársela.
        const propuesta: Microciclo = { ...micro, estado: 'propuesto' }
        mutar((estado) => ({
          ...estado,
          microciclos: [
            // Reemplaza una propuesta previa del mismo número; nunca toca el
            // microciclo activo ni los cerrados.
            ...estado.microciclos.filter(
              (m) =>
                !(
                  m.usuarioId === propuesta.usuarioId &&
                  m.numero === propuesta.numero &&
                  m.estado === 'propuesto'
                ),
            ),
            propuesta,
          ],
        }))
      },
      registrarSerie: (microcicloId: string, ejercicioId: string, serie: SerieRegistrada) => {
        mutar((estado) =>
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
        mutar((estado) =>
          actualizarMicrociclo(estado, microcicloId, (m) => ({
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
        mutar((estado) =>
          actualizarMicrociclo(estado, microcicloId, (m) => ({
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
        mutar((estado) => ({
          ...estado,
          checkins: [
            ...estado.checkins.filter(
              (c) => !(c.usuarioId === checkin.usuarioId && c.fecha === checkin.fecha),
            ),
            checkin,
          ],
        }))
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
        mutar((estado) => ({
          ...estado,
          adherencias: [
            ...estado.adherencias.filter((a) => !(a.usuarioId === usuarioId && a.fecha === fecha)),
            { id: `ad-${usuarioId}-${fecha}`, usuarioId, fecha, estado: estadoAdh, comentario },
          ],
        }))
      },
      hidratacionDe: (usuarioId, fecha) =>
        (ref.actual.hidratacion ?? []).find((h) => h.usuarioId === usuarioId && h.fecha === fecha)
          ?.ml ?? 0,
      registrarHidratacion: (usuarioId, fecha, deltaMl) => {
        // El acumulado se calcula DENTRO del transformador: es un incremento
        // sobre lo que ya hay, y leerlo fuera sumaría sobre una foto vieja.
        mutar((estado) => {
          const lista = estado.hidratacion ?? []
          const previo = lista.find((h) => h.usuarioId === usuarioId && h.fecha === fecha)
          return {
            ...estado,
            hidratacion: [
              ...lista.filter((h) => !(h.usuarioId === usuarioId && h.fecha === fecha)),
              {
                id: `hid-${usuarioId}-${fecha}`,
                usuarioId,
                fecha,
                ml: Math.max(0, (previo?.ml ?? 0) + deltaMl),
              },
            ],
          }
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
      enviar: ({ deId, paraId, texto, adjuntoUrl, origen }) => {
        mutar((estado) => ({
          ...estado,
          mensajes: [
            ...estado.mensajes,
            {
              id: `msg-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
              deId,
              paraId,
              texto,
              adjuntoUrl,
              origen: origen ?? 'humano',
              fechaIso: new Date().toISOString(),
              leido: false,
            },
          ],
        }))
      },
      recibirDeAlpha: ({ id, deId, paraId, texto }) => {
        // El id lo manda la Edge Function. Si por lo que sea ya estaba en el
        // hilo (una rehidratación que se adelantó), no se duplica.
        if (ref.actual.mensajes.some((m) => m.id === id)) return
        mutar((estado) => ({
          ...estado,
          mensajes: [
            ...estado.mensajes,
            {
              id,
              deId,
              paraId,
              texto,
              origen: 'alpha',
              fechaIso: new Date().toISOString(),
              leido: false,
            },
          ],
        }))
      },
      marcarLeidos: (paraId, deId) => {
        mutar((estado) => ({
          ...estado,
          mensajes: estado.mensajes.map((m) =>
            m.paraId === paraId && m.deId === deId ? { ...m, leido: true } : m,
          ),
        }))
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
        mutar((estado) => ({
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
        }))
      },
    },

    contenidos: {
      list: () => ref.actual.contenidos,
      byId: (id) => ref.actual.contenidos.find((c) => c.id === id),
    },

    premiaciones: {
      byUsuario: (usuarioId) => ref.actual.premiaciones.filter((p) => p.usuarioId === usuarioId),
    },

    ranking: {
      // En nube el snapshot trae el ranking de la RPC (los datos ajenos no
      // llegan al dispositivo); en demo se calcula con los datos locales.
      list: () =>
        ref.actual.ranking ??
        construirRanking(
          {
            usuarios: ref.actual.usuarios,
            microciclos: ref.actual.microciclos,
            adherencias: ref.actual.adherencias,
            checkins: ref.actual.checkins,
            mensajes: ref.actual.mensajes,
          },
          diasAtras(0),
        ),
    },
  }
}
