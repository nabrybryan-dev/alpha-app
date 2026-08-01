import type {
  CheckinDiario,
  EstadoAdherencia,
  ItemMarcable,
  Microciclo,
  RegistroComida,
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
 * Lo que hay ahora mismo en el dispositivo.
 *
 * Contraparte de `aplicarSnapshot`. La necesita la hidratacion: cuando una
 * tabla no se puede leer -porque su migracion aun no esta aplicada- hay que
 * conservar lo local en vez de escribir una lista vacia encima, que borraria lo
 * que la persona ya habia registrado.
 */
export function instantaneaLocal(): SeedDb {
  return cargar()
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

const nuevoId = (prefijo: string) =>
  `${prefijo}-${Date.now()}-${Math.round(Math.random() * 1e6)}`

/**
 * Si esa comida es de ese asesorado. Los dos lados de la condición son
 * obligatorios: filtrar solo por `comidaId` dejaría que un asesorado editara o
 * borrara la comida de otro con solo conocer el id. El aislamiento entre
 * asesorados es la propiedad más importante de la app y ya se rompió dos veces.
 */
const esSuya = (comida: RegistroComida, usuarioId: string, comidaId: string) =>
  comida.id === comidaId && comida.usuarioId === usuarioId

/**
 * Mezcla los cambios descartando las claves `undefined`.
 *
 * Un `{ ...comida, ...cambios }` a secas escribiría `undefined` encima de lo que
 * ya había: pedir "cambia solo la hora" borraría el aceite. Y `null` sí pasa, a
 * propósito, porque aquí significa "no se preguntó", que es un dato y no un
 * hueco -la misma regla que separa el `null` del `0` en el catálogo-.
 */
function conCambios<T extends object>(base: T, cambios: Partial<T>): T {
  const definidos = Object.fromEntries(
    Object.entries(cambios).filter(([, valor]) => valor !== undefined),
  ) as Partial<T>
  return { ...base, ...definidos }
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
      activarPropuesta: (propuestaId: string) => {
        mutar((estado) => {
          const propuesta = estado.microciclos.find(
            (m) => m.id === propuestaId && m.estado === 'propuesto',
          )
          // Sin propuesta no se toca nada: cerrar el activo sin abrir el siguiente
          // dejaría a la persona sin programación.
          if (!propuesta) return estado
          return {
            ...estado,
            microciclos: estado.microciclos.map((m) => {
              if (m.id === propuesta.id) return { ...m, estado: 'activo' as const }
              // Todos los activos de esa persona, no solo uno: si ya había dos,
              // esto lo repara en vez de heredar el estado roto.
              if (m.usuarioId === propuesta.usuarioId && m.estado === 'activo') {
                return { ...m, estado: 'cerrado' as const }
              }
              return m
            }),
          }
        })
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

    perfilNutricion: {
      byUsuario: (usuarioId) =>
        (ref.actual.perfilesNutricion ?? []).find((p) => p.usuarioId === usuarioId),
      guardar: (usuarioId, respuestas, completada) => {
        mutar((estado) => {
          const previo = (estado.perfilesNutricion ?? []).find((p) => p.usuarioId === usuarioId)
          return {
            ...estado,
            perfilesNutricion: [
              ...(estado.perfilesNutricion ?? []).filter((p) => p.usuarioId !== usuarioId),
              {
                usuarioId,
                // Se acumula sobre lo que ya había: la encuesta se puede dejar a
                // medias y retomar, y nadie va a volver a escribir su altura.
                respuestas: { ...previo?.respuestas, ...respuestas },
                completadaEn: completada
                  ? (previo?.completadaEn ?? new Date().toISOString())
                  : previo?.completadaEn,
              },
            ],
          }
        })
      },
    },

    visibilidad: {
      byUsuario: (usuarioId) =>
        (ref.actual.visibilidades ?? []).find((v) => v.usuarioId === usuarioId),
      decidir: (decision) => {
        mutar((estado) => ({
          ...estado,
          visibilidades: [
            ...(estado.visibilidades ?? []).filter((v) => v.usuarioId !== decision.usuarioId),
            decision,
          ],
        }))
      },
    },

    registroComidas: {
      delDia: (usuarioId, fecha) =>
        (ref.actual.registrosComida ?? [])
          .filter((c) => c.usuarioId === usuarioId && c.momentoIso.slice(0, 10) === fecha)
          .sort((a, b) => a.momentoIso.localeCompare(b.momentoIso)),

      abrirComida: (comida) => {
        const id = nuevoId('com')
        mutar((estado) => ({
          ...estado,
          registrosComida: [...(estado.registrosComida ?? []), { ...comida, id, items: [] }],
        }))
        return id
      },

      editarComida: (usuarioId, comidaId, cambios) => {
        mutar((estado) => ({
          ...estado,
          registrosComida: (estado.registrosComida ?? []).map((c) =>
            // El genérico se fija a mano: si se deja inferir, TypeScript lo
            // deduce del segundo argumento -que es un Omit- y el resultado
            // dejaría de ser una RegistroComida entera.
            esSuya(c, usuarioId, comidaId) ? conCambios<RegistroComida>(c, cambios) : c,
          ),
        }))
      },

      agregarItem: (usuarioId, comidaId, item) => {
        const id = nuevoId('it')
        mutar((estado) => ({
          ...estado,
          registrosComida: (estado.registrosComida ?? []).map((c) =>
            esSuya(c, usuarioId, comidaId) ? { ...c, items: [...c.items, { ...item, id }] } : c,
          ),
        }))
      },

      quitarItem: (usuarioId, comidaId, itemId) => {
        mutar((estado) => ({
          ...estado,
          registrosComida: (estado.registrosComida ?? []).map((c) =>
            esSuya(c, usuarioId, comidaId)
              ? { ...c, items: c.items.filter((i) => i.id !== itemId) }
              : c,
          ),
        }))
      },

      borrarComida: (usuarioId, comidaId) => {
        mutar((estado) => ({
          ...estado,
          registrosComida: (estado.registrosComida ?? []).filter(
            (c) => !esSuya(c, usuarioId, comidaId),
          ),
        }))
      },

      preferencia: (usuarioId, familia) =>
        (ref.actual.preferenciasEstado ?? []).find(
          (p) => p.usuarioId === usuarioId && p.familia === familia,
        ),

      recordarPreferencia: (preferencia) => {
        mutar((estado) => ({
          ...estado,
          preferenciasEstado: [
            ...(estado.preferenciasEstado ?? []).filter(
              (p) =>
                !(p.usuarioId === preferencia.usuarioId && p.familia === preferencia.familia),
            ),
            preferencia,
          ],
        }))
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
