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

/**
 * Lee TODAS las filas pidiendo `range` hasta completar el conteo exacto (E-06). Avanza por
 * lo que de verdad llegó, así que un `max-rows` menor que la página no trunca: sigue
 * pidiendo. Si una página llega vacía antes de completar el conteo, es un error (lectura
 * incompleta), no un final.
 */
export async function leerTodasLasPaginas<F>(
  pagina: (desde: number, hasta: number) => PromiseLike<RespuestaPagina>,
  tam = TAM_PAGINA,
): Promise<Lectura<F[]>> {
  const filas: F[] = []
  for (let peticion = 0; peticion < MAX_PETICIONES; peticion++) {
    const { data, error, count } = await pagina(filas.length, filas.length + tam - 1)
    if (error) return { ok: false, error: error.message || 'la consulta falló' }
    if (!Array.isArray(data)) return { ok: false, error: 'la respuesta no trajo filas' }
    filas.push(...(data as F[]))
    const total = typeof count === 'number' ? count : null
    if (total !== null && filas.length >= total) return { ok: true, datos: filas }
    if (data.length === 0) {
      return total === null || filas.length >= total
        ? { ok: true, datos: filas }
        : { ok: false, error: `lectura incompleta: ${filas.length} de ${total} filas` }
    }
    if (total === null && data.length < tam) return { ok: true, datos: filas }
  }
  return { ok: false, error: `lectura incompleta: más de ${MAX_PETICIONES} peticiones` }
}

const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

/** Todos los candidatos visibles. Nunca lanza. En demo, un vacío confirmado. */
export async function candidatosDelTablero(): Promise<Lectura<Candidato[]>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const r = await leerTodasLasPaginas<FilaCandidato>((desde, hasta) =>
      supabase()
        .from(TABLA_CREADORES_CANDIDATOS)
        .select(COLUMNAS_CREADORES_CANDIDATOS.join(','), { count: 'exact' })
        .order('actualizado_en', { ascending: false })
        // Desempate estable: sin él, dos páginas podrían repetir o saltarse una fila.
        .order('creador_id', { ascending: true })
        .range(desde, hasta),
    )
    if (!r.ok) return r
    return { ok: true, datos: r.datos.map(aCandidato).filter((c): c is Candidato => c !== null) }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

/** Las revisiones de la etapa 2 de un creador, la más reciente primero. Nunca lanza. */
export async function revisionesDe(creadorId: string): Promise<Lectura<RevisionReel[]>> {
  if (!modoNube || !creadorId) return { ok: true, datos: [] }
  try {
    const r = await leerTodasLasPaginas<FilaRevision>((desde, hasta) =>
      supabase()
        .from(TABLA_CREADORES_REVISIONES)
        .select(COLUMNAS_CREADORES_REVISIONES.join(','), { count: 'exact' })
        .eq('creador_id', creadorId)
        .order('fecha_revision', { ascending: false })
        .order('id', { ascending: true })
        .range(desde, hasta),
    )
    if (!r.ok) return r
    return { ok: true, datos: r.datos.map(aRevision).filter((x): x is RevisionReel => x !== null) }
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
  /** La S más baja conocida; `null` si ningún reel la trae. */
  minimo: number | null
  /** Alguna S conocida por debajo de `S_MINIMA`. */
  bajo: boolean
  /** Reels con S conocida. */
  conNota: number
  /** Reels con S pendiente (nula o sin la dimensión). */
  pendientes: number
  total: number
}

/**
 * La seguridad S se resume por su MÍNIMO, nunca por su media (E-03): un S=1 junto a un S=3
 * es un veto, no un «2». Con la cobertura y los pendientes a la vista, porque un mínimo con
 * reels sin nota no es la última palabra.
 */
export function resumenS(revisiones: readonly RevisionReel[]): ResumenS {
  const valores = revisiones.map((r) => r.notas.S).filter((v): v is number => typeof v === 'number')
  const minimo = valores.length > 0 ? Math.min(...valores) : null
  return {
    minimo,
    bajo: minimo !== null && minimo < S_MINIMA,
    conNota: valores.length,
    pendientes: revisiones.length - valores.length,
    total: revisiones.length,
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
