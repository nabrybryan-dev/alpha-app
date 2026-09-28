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

/** Todos los candidatos visibles. Nunca lanza: en demo, sin sesión o con error, `[]`. */
export async function candidatosDelTablero(): Promise<Candidato[]> {
  if (!modoNube) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_CREADORES_CANDIDATOS)
      .select(COLUMNAS_CREADORES_CANDIDATOS.join(','))
      .order('actualizado_en', { ascending: false })
    if (error || !Array.isArray(data)) return []
    return (data as unknown as FilaCandidato[]).map(aCandidato).filter((c): c is Candidato => c !== null)
  } catch {
    return []
  }
}

/** Las revisiones de la etapa 2 de un creador, la más reciente primero. Nunca lanza. */
export async function revisionesDe(creadorId: string): Promise<RevisionReel[]> {
  if (!modoNube || !creadorId) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_CREADORES_REVISIONES)
      .select(COLUMNAS_CREADORES_REVISIONES.join(','))
      .eq('creador_id', creadorId)
      .order('fecha_revision', { ascending: false })
    if (error || !Array.isArray(data)) return []
    return (data as unknown as FilaRevision[]).map(aRevision).filter((r): r is RevisionReel => r !== null)
  } catch {
    return []
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

/** Media de una dimensión sobre los reels con nota (los pendientes no cuentan). */
export function mediaDimension(revisiones: RevisionReel[], dimension: string): number | null {
  const valores = revisiones.map((r) => r.notas[dimension]).filter((v): v is number => typeof v === 'number')
  if (valores.length === 0) return null
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10
}

/** Candidatos agrupados por carril, en el orden del embudo (carriles vacíos incluidos). */
export function porCarril(candidatos: Candidato[]): Array<{ carril: Carril; candidatos: Candidato[] }> {
  return CARRILES.map((carril) => ({ carril, candidatos: candidatos.filter((c) => c.carril === carril) }))
}
