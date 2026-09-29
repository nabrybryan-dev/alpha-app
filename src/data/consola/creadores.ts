import { modoNube, supabase } from '../supabase'

/**
 * Lectura del tablero de CREADORES (migración 0090): `creadores_candidatos`,
 * `creadores_revisiones` y `creadores_eventos`.
 *
 * SOLO LECTURA. Las tres tablas las escribe exclusivamente `service_role` (el importador que
 * corre en los equipos de casa, `bola-de-nieve/tablero/subir_creadores.py`); RLS impide que el
 * navegador escriba. Este archivo no ofrece escrituras por la misma razón que
 * `cadenaCorridas.ts`: sugerirían un camino que la base bloquea.
 *
 * Las columnas salen de aquí y las pruebas las comparan contra el SQL de la 0090.
 */
export const TABLA_CREADORES_CANDIDATOS = 'creadores_candidatos'
export const TABLA_CREADORES_REVISIONES = 'creadores_revisiones'

export const COLUMNAS_CREADORES_CANDIDATOS = [
  'creador_id',
  'usuario_ig',
  'seguidores',
  'segmento',
  'carril',
  'motivos',
  'nota_a',
  'version_rubrica',
  'metricas',
  'senal_colombia',
  'fecha_dato',
  'fecha_recepcion',
  'actualizado_en',
] as const

export const COLUMNAS_CREADORES_REVISIONES = [
  'id',
  'revision_id',
  'creador_id',
  'revisor',
  'rol_reel',
  'media_id',
  'permalink',
  'notas',
  'sin_audio',
  'descripcion',
  'hoja_cuadros',
  'semilla',
  'fecha_revision',
  'fecha_recepcion',
] as const

/** El embudo, en el orden en que se pinta (PLAN-CENTRALIZACION.md §2). */
export const CARRILES = [
  'descubierto',
  'etapa1',
  'etapa2',
  'tambaleando',
  'aprobado_contacto',
  'mensaje_enviado',
  'respondio',
  'no_respondio',
  'encuesta',
  'microprueba',
  'piloto',
  'continua',
  'pausa',
  'descartado',
  'entrenador',
] as const

export type Carril = (typeof CARRILES)[number]

export const NOMBRE_CARRIL: Record<Carril, string> = {
  descubierto: 'Descubiertos',
  etapa1: 'Etapa 1 · números',
  etapa2: 'Etapa 2 · video',
  tambaleando: 'Tambaleando',
  aprobado_contacto: 'Aprobado para contacto',
  mensaje_enviado: 'Mensaje enviado',
  respondio: 'Respondió',
  no_respondio: 'No respondió',
  encuesta: 'Encuesta de ingreso',
  microprueba: 'Microprueba',
  piloto: 'Piloto',
  continua: 'Continúa',
  pausa: 'En pausa',
  descartado: 'Descartado',
  entrenador: 'Entrenadores (alquiler)',
}

export type Segmento = 'aliado' | 'entrenador' | 'fuera'
export type Revisor = 'claude' | 'astra' | 'bryan' | 'manuela'

export interface Candidato {
  creadorId: string
  usuarioIg: string
  seguidores: number | null
  segmento: Segmento
  carril: Carril
  motivos: string[]
  notaA: number | null
  versionRubrica: string | null
  metricas: Record<string, unknown>
  senalColombia: boolean | null
  fechaDato: string
  fechaRecepcion: string
  actualizadoEn: string
}

export interface RevisionReel {
  id: string
  revisionId: string
  creadorId: string
  revisor: Revisor
  rolReel: string
  mediaId: string
  permalink: string | null
  /** Nota por dimensión (H, C, P, T, CTA, S…); `null` = pendiente, nunca inventada. */
  notas: Record<string, number | null>
  sinAudio: boolean
  descripcion: string | null
  hojaCuadros: string | null
  fechaRevision: string
}

interface FilaCandidato {
  creador_id: string
  usuario_ig: string
  seguidores: number | null
  segmento: string
  carril: string
  motivos: unknown
  nota_a: number | string | null
  version_rubrica: string | null
  metricas: unknown
  senal_colombia: boolean | null
  fecha_dato: string
  fecha_recepcion: string
  actualizado_en: string
}

interface FilaRevision {
  id: string
  revision_id: string
  creador_id: string
  revisor: string
  rol_reel: string
  media_id: string
  permalink: string | null
  notas: unknown
  sin_audio: boolean
  descripcion: string | null
  hoja_cuadros: string | null
  semilla: string | null
  fecha_revision: string
  fecha_recepcion: string
}

const SEGMENTOS: readonly string[] = ['aliado', 'entrenador', 'fuera']
const REVISORES: readonly string[] = ['claude', 'astra', 'bryan', 'manuela']

/** Una fila con carril o segmento fuera de vocabulario se descarta (no se disfraza). */
export function aCandidato(fila: FilaCandidato): Candidato | null {
  if (!(CARRILES as readonly string[]).includes(fila.carril)) return null
  if (!SEGMENTOS.includes(fila.segmento)) return null
  const nota = fila.nota_a === null ? null : Number(fila.nota_a)
  return {
    creadorId: fila.creador_id,
    usuarioIg: fila.usuario_ig,
    seguidores: fila.seguidores,
    segmento: fila.segmento as Segmento,
    carril: fila.carril as Carril,
    motivos: Array.isArray(fila.motivos) ? fila.motivos.filter((m): m is string => typeof m === 'string') : [],
    notaA: nota !== null && Number.isFinite(nota) ? nota : null,
    versionRubrica: fila.version_rubrica,
    metricas:
      fila.metricas && typeof fila.metricas === 'object' && !Array.isArray(fila.metricas)
        ? (fila.metricas as Record<string, unknown>)
        : {},
    senalColombia: fila.senal_colombia,
    fechaDato: fila.fecha_dato,
    fechaRecepcion: fila.fecha_recepcion,
    actualizadoEn: fila.actualizado_en,
  }
}

export function aRevision(fila: FilaRevision): RevisionReel | null {
  if (!REVISORES.includes(fila.revisor)) return null
  const notas: Record<string, number | null> = {}
  if (fila.notas && typeof fila.notas === 'object' && !Array.isArray(fila.notas)) {
    for (const [dim, valor] of Object.entries(fila.notas as Record<string, unknown>)) {
      notas[dim] = typeof valor === 'number' && Number.isFinite(valor) ? valor : null
    }
  }
  return {
    id: fila.id,
    revisionId: fila.revision_id,
    creadorId: fila.creador_id,
    revisor: fila.revisor as Revisor,
    rolReel: fila.rol_reel,
    mediaId: fila.media_id,
    permalink: fila.permalink,
    notas,
    sinAudio: fila.sin_audio,
    descripcion: fila.descripcion,
    hojaCuadros: fila.hoja_cuadros,
    fechaRevision: fila.fecha_revision,
  }
}

/**
 * El resultado de una lectura: o los datos (un vacío aquí es un vacío CONFIRMADO), o el
 * fallo con su motivo. Un error de la consulta nunca se disfraza de lista vacía (E-01 de la
 * revisión de Codex del 28-sep): la pantalla dice «no se pudo leer» y ofrece reintentar.
 */
export type Lectura<T> = { ok: true; datos: T } | { ok: false; error: string }

/** Filas por petición. PostgREST puede entregar menos (`max-rows`); la lectura lo tolera. */
export const TAM_PAGINA = 1000
/** Tope de peticiones de una lectura: más allá, algo no cuadra y se dice. */
const MAX_PETICIONES = 500

type RespuestaPagina = { data: unknown; error: { message?: string } | null; count?: number | null }

/** Una página: las filas cuya clave es mayor que `despuesDe` (o desde el principio), por clave. */
export type PedirPagina = (despuesDe: string | null, tam: number) => PromiseLike<RespuestaPagina>
/** El conteo exacto de TODO el universo de la lectura (mismos filtros, sin cursor). */
export type PedirConteo = () => PromiseLike<RespuestaPagina>

/**
 * Lee TODAS las filas con un CURSOR sobre una clave única que no cambia (N-01 de la revisión
 * de Codex del 28-sep), nunca por posición.
 *
 * Por qué no por posición (`range` sobre `actualizado_en`, lo que había): si una fila cambia
 * entre dos peticiones, el orden se corre y la segunda página repite una fila y se salta otra
 * —con [A,B,C,D], tras [A,B] se actualiza D, el orden pasa a [D,A,B,C] y llegaba [B,C]—, y el
 * conteo seguía dando 4: la lectura pasaba por completa con B dos veces y sin D.
 *
 * Con el cursor (`clave > última vista`, ordenado por esa clave), una fila que existe durante
 * toda la lectura sale exactamente una vez, cambie lo que cambie en sus otras columnas. Además:
 *   · se sigue pidiendo hasta una página VACÍA, así que un `max-rows` menor que `tam` no trunca;
 *   · una clave repetida es un error («fila repetida»), no una fila más;
 *   · al terminar se cuenta el universo entero: si no coincide con lo leído, la tabla cambió
 *     por detrás del cursor a mitad de lectura y la lectura se da por INCOMPLETA (se reintenta),
 *     en vez de entregarse como completa.
 * Lo que no cubre (y no se promete): un borrado y una inserción por detrás del cursor dentro
 * de la misma lectura se compensan en el conteo. El importador no borra candidatos.
 */
export async function leerTodasLasPaginas<F>(
  pagina: PedirPagina,
  contar: PedirConteo,
  claveDe: (fila: F) => string,
  tam = TAM_PAGINA,
): Promise<Lectura<F[]>> {
  const filas: F[] = []
  const vistas = new Set<string>()
  let cursor: string | null = null
  for (let peticion = 0; ; peticion++) {
    if (peticion >= MAX_PETICIONES) return { ok: false, error: `lectura incompleta: más de ${MAX_PETICIONES} peticiones` }
    const { data, error } = await pagina(cursor, tam)
    if (error) return { ok: false, error: error.message || 'la consulta falló' }
    if (!Array.isArray(data)) return { ok: false, error: 'la respuesta no trajo filas' }
    if (data.length === 0) break
    for (const fila of data as F[]) {
      const clave = claveDe(fila)
      if (vistas.has(clave)) return { ok: false, error: `lectura inconsistente: fila repetida (${clave})` }
      vistas.add(clave)
      filas.push(fila)
    }
    cursor = claveDe((data as F[])[data.length - 1])
  }
  const conteo = await contar()
  if (conteo.error) return { ok: false, error: conteo.error.message || 'el conteo falló' }
  if (typeof conteo.count !== 'number') return { ok: false, error: 'la respuesta no trajo el conteo' }
  if (conteo.count !== filas.length) {
    return { ok: false, error: `lectura incompleta: ${filas.length} de ${conteo.count} filas (la tabla cambió durante la lectura)` }
  }
  return { ok: true, datos: filas }
}

const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

/** Lo más reciente primero, con desempate estable por la clave. */
const porFechaDesc = <T>(fecha: (x: T) => string, clave: (x: T) => string) => (a: T, b: T) =>
  fecha(b).localeCompare(fecha(a)) || clave(a).localeCompare(clave(b))

/** Todos los candidatos visibles, el más recién actualizado primero. Nunca lanza. En demo, un vacío confirmado. */
export async function candidatosDelTablero(): Promise<Lectura<Candidato[]>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const r = await leerTodasLasPaginas<FilaCandidato>(
      (despuesDe, tam) => {
        let q = supabase().from(TABLA_CREADORES_CANDIDATOS).select(COLUMNAS_CREADORES_CANDIDATOS.join(','))
        if (despuesDe !== null) q = q.gt('creador_id', despuesDe)
        // El cursor es la clave primaria: no cambia al actualizarse la fila.
        return q.order('creador_id', { ascending: true }).limit(tam)
      },
      () => supabase().from(TABLA_CREADORES_CANDIDATOS).select('creador_id', { count: 'exact', head: true }),
      (f) => f.creador_id,
    )
    if (!r.ok) return r
    const datos = r.datos.map(aCandidato).filter((c): c is Candidato => c !== null)
    datos.sort(porFechaDesc((c) => c.actualizadoEn, (c) => c.creadorId))
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

/** Las revisiones de la etapa 2 de un creador, la más reciente primero. Nunca lanza. */
export async function revisionesDe(creadorId: string): Promise<Lectura<RevisionReel[]>> {
  if (!modoNube || !creadorId) return { ok: true, datos: [] }
  try {
    const r = await leerTodasLasPaginas<FilaRevision>(
      (despuesDe, tam) => {
        let q = supabase().from(TABLA_CREADORES_REVISIONES).select(COLUMNAS_CREADORES_REVISIONES.join(',')).eq('creador_id', creadorId)
        if (despuesDe !== null) q = q.gt('id', despuesDe)
        return q.order('id', { ascending: true }).limit(tam)
      },
      () =>
        supabase().from(TABLA_CREADORES_REVISIONES).select('id', { count: 'exact', head: true }).eq('creador_id', creadorId),
      (f) => f.id,
    )
    if (!r.ok) return r
    const datos = r.datos.map(aRevision).filter((x): x is RevisionReel => x !== null)
    datos.sort(porFechaDesc((x) => x.fechaRevision, (x) => x.id))
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

export const TABLA_CREADORES_EVENTOS = 'creadores_eventos'
/** Solo lo que el embudo necesita de la historia (el resto de columnas no sale del servidor). */
export const COLUMNAS_CREADORES_EVENTOS = ['id', 'creador_id', 'carril_nuevo', 'fecha_dato'] as const

/** Un movimiento de carril de `creadores_eventos` (la historia del embudo). */
export interface EventoCarril {
  id: string
  creadorId: string
  /** Texto tal como llegó: puede NO ser un carril conocido (`esCarrilConocido`); `embudoDe` lo cuenta aparte. */
  carrilNuevo: string
  fechaDato: string
}

export function esCarrilConocido(carril: string): carril is Carril {
  return (CARRILES as readonly string[]).includes(carril)
}

interface FilaEvento {
  id: string
  creador_id: string
  carril_nuevo: string
  fecha_dato: string
}

/**
 * Un evento con carril fuera de vocabulario NO se descarta aquí (revisión externa del 28-sep,
 * gravedad media): descartarlo en silencio dejaba la cifra de contactos por debajo de la real
 * sin que nadie lo notara. Se conserva tal cual y `embudoDe` lo cuenta aparte para avisarlo.
 * (La 0097 impide nuevos en la base; esto cubre los que ya estén.)
 */
export function aEvento(fila: FilaEvento): EventoCarril {
  return { id: fila.id, creadorId: fila.creador_id, carrilNuevo: fila.carril_nuevo, fechaDato: fila.fecha_dato }
}

/**
 * La historia entera del embudo (E-05): de aquí sale «contactados», que no puede depender del
 * carril de HOY (un contactado que después se descarta sigue siendo alguien a quien se
 * escribió). El importador deja un evento por carril alcanzado (`<creador>:<carril>`) y no lo
 * borra al moverse. Nunca lanza.
 */
export async function eventosDelTablero(): Promise<Lectura<EventoCarril[]>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const r = await leerTodasLasPaginas<FilaEvento>(
      (despuesDe, tam) => {
        let q = supabase().from(TABLA_CREADORES_EVENTOS).select(COLUMNAS_CREADORES_EVENTOS.join(','))
        if (despuesDe !== null) q = q.gt('id', despuesDe)
        return q.order('id', { ascending: true }).limit(tam)
      },
      () => supabase().from(TABLA_CREADORES_EVENTOS).select('id', { count: 'exact', head: true }),
      (f) => f.id,
    )
    if (!r.ok) return r
    return { ok: true, datos: r.datos.map(aEvento) }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

export const BUCKET_CUADROS = 'creadores-cuadros'

/** URL firmada (1 h) de una hoja de cuadros del bucket privado. `null` si no se puede. */
export async function urlHojaCuadros(ruta: string | null): Promise<string | null> {
  if (!modoNube || !ruta) return null
  try {
    const { data, error } = await supabase().storage.from(BUCKET_CUADROS).createSignedUrl(ruta, 3600)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch {
    return null
  }
}

/**
 * Media de una dimensión sobre los reels con nota (los pendientes no cuentan). NO sirve para
 * S: la seguridad no se promedia, veta (usa `resumenS`).
 */
export function mediaDimension(revisiones: RevisionReel[], dimension: string): number | null {
  const valores = revisiones.map((r) => r.notas[dimension]).filter((v): v is number => typeof v === 'number')
  if (valores.length === 0) return null
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10
}

/** Por debajo de este valor, una S veta (rúbrica de revisor-video, RV-O09). */
export const S_MINIMA = 2

export interface ResumenS {
  /** La S más baja conocida entre TODAS las evaluaciones; `null` si ninguna la trae. */
  minimo: number | null
  /** Alguna S conocida por debajo de `S_MINIMA`. */
  bajo: boolean
  /** EVALUACIONES (una fila = un revisor sobre un reel) con S conocida. */
  conNota: number
  /** Evaluaciones con S pendiente (nula o sin la dimensión). */
  pendientes: number
  /** Evaluaciones en total. Dos revisores del mismo reel son dos evaluaciones, no dos reels. */
  total: number
  /** Reels distintos (por `media_id`). */
  reels: number
  /** Reels con al menos una S conocida. */
  reelsConS: number
}

/**
 * La seguridad S se resume por su MÍNIMO, nunca por su media (E-03): un S=1 junto a un S=3
 * es un veto, no un «2». El mínimo se toma sobre TODAS las evaluaciones (cualquier revisor).
 *
 * La cobertura se cuenta en dos unidades que no se mezclan (N-02 de la revisión de Codex):
 * las filas son EVALUACIONES (un revisor sobre un reel) y los reels son `media_id` distintos.
 * Con un reel y dos revisores hay 1 reel y 2 evaluaciones, no «2 de 2 reels».
 */
export function resumenS(revisiones: readonly RevisionReel[]): ResumenS {
  const tieneS = (r: RevisionReel) => typeof r.notas.S === 'number'
  const valores = revisiones.filter(tieneS).map((r) => r.notas.S as number)
  const minimo = valores.length > 0 ? Math.min(...valores) : null
  return {
    minimo,
    bajo: minimo !== null && minimo < S_MINIMA,
    conNota: valores.length,
    pendientes: revisiones.length - valores.length,
    total: revisiones.length,
    reels: new Set(revisiones.map((r) => r.mediaId)).size,
    reelsConS: new Set(revisiones.filter(tieneS).map((r) => r.mediaId)).size,
  }
}

export interface VueltaDeRevision {
  revisionId: string
  /** La fecha más reciente de sus filas. */
  fecha: string
  filas: RevisionReel[]
}

/**
 * Las revisiones agrupadas por `revision_id` (una vuelta por grupo), la más reciente primero
 * (E-02). Dos vueltas nunca se mezclan: cada una tiene sus notas y sus reels.
 */
export function vueltasDeRevision(revisiones: readonly RevisionReel[]): VueltaDeRevision[] {
  const porId = new Map<string, VueltaDeRevision>()
  for (const r of revisiones) {
    const v = porId.get(r.revisionId)
    if (!v) porId.set(r.revisionId, { revisionId: r.revisionId, fecha: r.fechaRevision, filas: [r] })
    else {
      v.filas.push(r)
      if (r.fechaRevision > v.fecha) v.fecha = r.fechaRevision
    }
  }
  return [...porId.values()].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.revisionId.localeCompare(a.revisionId))
}

/** Candidatos agrupados por carril, en el orden del embudo (carriles vacíos incluidos). */
export function porCarril(candidatos: Candidato[]): Array<{ carril: Carril; candidatos: Candidato[] }> {
  return CARRILES.map((carril) => ({ carril, candidatos: candidatos.filter((c) => c.carril === carril) }))
}
