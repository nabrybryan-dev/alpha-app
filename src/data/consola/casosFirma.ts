import { modoNube, supabase } from '../supabase'

/**
 * Lectura de `casos_firma` y el ciclo de firma por descarga y subida (migración 0084):
 * preparando → listo_para_firmar → firmado → verificado | rechazado | caducado.
 *
 * La fila la escribe el equipo de mesa (`service_role`); este archivo solo lee, más el
 * único avance que puede hacer el navegador: subir el `.sig` a Storage y llamar a la RPC
 * `registrar_firma`. Nunca sube el `.json` (la decisión sin firmar) ni reemplaza nada —
 * la política de Storage de la 0084 ya lo impide, pero `validarArchivoFirma` lo rechaza
 * antes incluso de intentar la subida, para no gastar una petición de red en algo que la
 * base va a rechazar de todos modos.
 */
export const TABLA_CASOS_FIRMA = 'casos_firma'
export const BUCKET_FIRMAS = 'firmas'

export const COLUMNAS_CASOS_FIRMA = [
  'id',
  'usuario_id',
  'semana_inicio',
  'tipo',
  'estado',
  'ruta_decision',
  'ruta_firma',
  'valida_hasta',
  'orden_id',
  'error',
  'creado_en',
  'actualizado_en',
] as const

const SELECCION_CASOS_FIRMA = COLUMNAS_CASOS_FIRMA.join(',')

export type TipoCasoFirma = 'retiro' | 'recorte'
export type EstadoCasoFirma = 'preparando' | 'listo_para_firmar' | 'firmado' | 'verificado' | 'rechazado' | 'caducado'

/** La fila tal como baja de Supabase. `tipo` es NULL solo cuando el caso nace `rechazado`
 *  sin nada que firmar (ajuste del equipo de mesa, 0084: el CHECK de la base exige que un
 *  `tipo` NULL vaya siempre con `estado = 'rechazado'`). */
export interface FilaCasoFirma {
  id: string
  usuario_id: string
  semana_inicio: string
  tipo: string | null
  estado: string
  ruta_decision: string | null
  ruta_firma: string | null
  valida_hasta: string | null
  orden_id: string | null
  error: string | null
  creado_en: string
  actualizado_en: string
}

/** La misma fila, en el vocabulario del dominio. */
export interface CasoFirma {
  id: string
  usuarioId: string
  semanaInicio: string
  /** NULL solo en un caso `rechazado` sin nada que firmar. */
  tipo: TipoCasoFirma | null
  estado: EstadoCasoFirma
  rutaDecision: string | null
  rutaFirma: string | null
  validaHasta: string | null
  ordenId: string | null
  error: string | null
  creadoEn: string
  actualizadoEn: string
}

const TIPOS_VALIDOS: readonly string[] = ['retiro', 'recorte']
const ESTADOS_VALIDOS: readonly string[] = [
  'preparando',
  'listo_para_firmar',
  'firmado',
  'verificado',
  'rechazado',
  'caducado',
]

/**
 * Igual que el resto de `data/consola/*`: nunca lanza sobre una fila con forma inesperada,
 * la descarta. `tipo` NULL se acepta —es válido en un caso `rechazado`—, pero un `tipo`
 * presente que no esté en el vocabulario conocido (ni siquiera correlacionado con
 * `estado`, que ya lo garantiza el CHECK de la base) se trata igual que un `estado`
 * desconocido: se descarta la fila entera en vez de mostrar algo a medias.
 */
export function aCasoFirma(fila: FilaCasoFirma): CasoFirma | null {
  if (fila.tipo !== null && !TIPOS_VALIDOS.includes(fila.tipo)) return null
  if (!ESTADOS_VALIDOS.includes(fila.estado)) return null
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    semanaInicio: fila.semana_inicio,
    tipo: fila.tipo as TipoCasoFirma | null,
    estado: fila.estado as EstadoCasoFirma,
    rutaDecision: fila.ruta_decision,
    rutaFirma: fila.ruta_firma,
    validaHasta: fila.valida_hasta,
    ordenId: fila.orden_id,
    error: fila.error,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  }
}

/**
 * Los casos de firma de una persona y semana, más reciente primero — quien llama se queda
 * con el primero para saber cuál es el vigente. Nunca lanza: sin conexión, sin permiso o
 * ante cualquier error de la base, `[]`.
 */
export async function casosFirmaDePersona(usuarioId: string, semanaInicio: string): Promise<CasoFirma[]> {
  if (!modoNube || !usuarioId) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_CASOS_FIRMA)
      .select(SELECCION_CASOS_FIRMA)
      .eq('usuario_id', usuarioId)
      .eq('semana_inicio', semanaInicio)
      .order('creado_en', { ascending: false })
    if (error || !data) return []
    return (data as unknown as FilaCasoFirma[]).map(aCasoFirma).filter((caso): caso is CasoFirma => caso !== null)
  } catch {
    return []
  }
}

export type ResultadoDescargaCaso = { ok: true; url: string } | { ok: false; error: string }

/** Vida corta a propósito, igual que los adjuntos del chat (`data/nube/adjuntos.ts`): es
 *  una decisión clínica de una persona concreta. */
const SEGUNDOS_FIRMA_CASO = 300

/** URL firmada para descargar el `.json` sin firmar del caso («Descargar el caso»). */
export async function urlDelCaso(rutaDecision: string): Promise<ResultadoDescargaCaso> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { data, error } = await supabase().storage.from(BUCKET_FIRMAS).createSignedUrl(rutaDecision, SEGUNDOS_FIRMA_CASO)
    if (error || !data?.signedUrl) {
      return { ok: false, error: error?.message || 'No se pudo generar el enlace de descarga.' }
    }
    return { ok: true, url: data.signedUrl }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}

export type ResultadoValidacionFirma = { ok: true } | { ok: false; motivo: string }

/** 4 KB: una firma SSH cabe muchas veces en eso — un archivo más pesado no parece una
 *  firma (encargo, punto 2). */
export const TOPE_BYTES_FIRMA = 4 * 1024

/**
 * El archivo que se sube tiene que terminar en `.sig` y pesar 4 KB o menos. Comprobado
 * ANTES de tocar la red: la política de Storage de la 0084 ya rechazaría un `.json` o un
 * archivo de otro nombre, pero avisar aquí es instantáneo y no gasta una subida fallida.
 */
export function validarArchivoFirma(archivo: { name: string; size: number }): ResultadoValidacionFirma {
  if (!archivo.name.toLowerCase().endsWith('.sig')) {
    return { ok: false, motivo: 'El archivo debe terminar en «.sig».' }
  }
  if (archivo.size === 0) return { ok: false, motivo: 'El archivo está vacío.' }
  if (archivo.size > TOPE_BYTES_FIRMA) {
    return { ok: false, motivo: `El archivo pesa más de ${TOPE_BYTES_FIRMA / 1024} KB: no parece una firma.` }
  }
  return { ok: true }
}

export type ResultadoSubidaFirma = { ok: true } | { ok: false; error: string }

/**
 * Sube el `.sig` a `<rutaDecision>.sig`, SIN `upsert`: la política de Storage de la 0084
 * no da privilegio de `update` sobre el bucket `firmas`, así que un segundo intento sobre
 * el mismo caso falla — y eso es lo correcto («sin reemplazar nada», encargo punto 1).
 */
export async function subirFirma(rutaDecision: string, archivo: File): Promise<ResultadoSubidaFirma> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  const validacion = validarArchivoFirma(archivo)
  if (!validacion.ok) return { ok: false, error: validacion.motivo }
  try {
    const { error } = await supabase()
      .storage.from(BUCKET_FIRMAS)
      .upload(`${rutaDecision}.sig`, archivo, { contentType: 'application/octet-stream' })
    if (error) return { ok: false, error: error.message || 'No se pudo subir la firma.' }
    return { ok: true }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}

export type ResultadoRegistrarFirma = { ok: true; caso: CasoFirma } | { ok: false; error: string }

const CODIGO_SIN_PERMISO = '42501'
const CODIGO_NO_ENCONTRADO = 'P0002'

function mensajeDeErrorRegistrarFirma(error: { code?: string; message: string }): string {
  if (error.code === CODIGO_SIN_PERMISO) return 'No tienes permiso para registrar esta firma.'
  if (error.code === CODIGO_NO_ENCONTRADO) {
    return 'No se encontró la firma subida para este caso. Sube el archivo .sig e inténtalo de nuevo.'
  }
  return error.message || 'No se pudo registrar la firma. Vuelve a intentarlo.'
}

/**
 * RPC `registrar_firma(caso_id)` (migración 0084): pasa el caso de `listo_para_firmar` a
 * `firmado`, tras comprobar en el servidor que el `.sig` ya está en Storage. El actor sale
 * de `auth.uid()` dentro de la función — no hay parámetro para mandarlo.
 */
export async function registrarFirma(casoId: string): Promise<ResultadoRegistrarFirma> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { data, error } = await supabase().rpc('registrar_firma', { caso_id: casoId })
    if (error) return { ok: false, error: mensajeDeErrorRegistrarFirma(error) }
    const caso = data ? aCasoFirma(data as unknown as FilaCasoFirma) : null
    if (!caso) return { ok: false, error: 'La base devolvió un caso con forma inesperada.' }
    return { ok: true, caso }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}
