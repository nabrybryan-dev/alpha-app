import { modoNube, supabase } from '../supabase'

/**
 * Lectura de `capacidades_staff` (migración 0083): permisos por acción, ortogonales al
 * rol — no convierte a nadie en coach (RESPUESTA-ASTRA-CONSOLA.md §4). SOLO LECTURA: la
 * tabla no tiene política de insert/update/delete para `authenticated`, así que este
 * archivo no ofrece esas operaciones — se asignan a mano o desde `service_role`.
 *
 * `CAPACIDADES` es la misma lista que el `check` de la migración 0083 (ampliado en la 0086
 * con `aprobar_primer_plan`, en la 0087 con `aprobar_plan_estrategico`, en la 0090 con las de creadores y en la
 * 0094, 0095, 0096, 0098, 0102 y 0106 con una cada una), palabra por palabra; las pruebas de este archivo la comparan contra el SQL para no desincronizarse
 * en silencio (misma lección que `cadenaCorridas.ts` con sus columnas).
 */
export const TABLA_CAPACIDADES_STAFF = 'capacidades_staff'

export const CAPACIDADES = [
  'leer_entrenamiento',
  'responder_por_asesorado',
  'detener_publicacion',
  'reportar_riesgo',
  'autorizar_excepcion',
  'firmar_politica',
  // 0086: aprobar el PRIMER plan de un cliente nuevo (Manuela y Bryan).
  'aprobar_primer_plan',
  // 0087: aprobar el plan estratégico RENOVADO (Manuela y Bryan).
  'aprobar_plan_estrategico',
  // 0090: ver el tablero de creadores y firmar contactos/excepciones (Manuela y Bryan).
  'revisar_creadores',
  'firmar_creadores',
  // 0094: anotar y firmar decisiones compartidas entre Bryan y Manuela.
  'decisiones_compartidas',
  // 0095: triar los comentarios de la app (el coach ya puede por serlo).
  'triar_comentarios',
  // 0096: responder el buzón de mercadeo (Manuela).
  'responder_mercadeo',
  // 0098: usar el organizador («Mi plan»): cada quien edita lo suyo; el coach lee todo.
  'organizar_plan',
  // 0102: ver el área administrativa (Bryan y Manuela); solo lectura.
  'ver_administracion',
  // 0106: la cuenta «Alpha» (alphaathletics301) entra solo al tablero (/tablero); la app esconde el resto.
  'solo_tablero',
] as const

export type Capacidad = (typeof CAPACIDADES)[number]

interface FilaCapacidadStaff {
  capacidad: string
}

const CAPACIDADES_VALIDAS: readonly string[] = CAPACIDADES

/**
 * Las capacidades de UNA persona. La política `capacidades_staff_lee` de la 0083 deja leer
 * la fila propia, o cualquier fila si quien pregunta es coach — esta función siempre pide
 * por `usuarioId` explícito para no depender de cuál de los dos caminos abrió RLS.
 *
 * Nunca lanza: sin conexión (modo demo), sin `usuarioId`, o ante cualquier error de la
 * base (RLS incluida), "ninguna capacidad" es el resultado seguro — nadie ve ni escribe de
 * más por un fallo de red, que es justo el motivo por el que existe este archivo.
 */
export async function capacidadesDe(usuarioId: string): Promise<Capacidad[]> {
  if (!modoNube || !usuarioId) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_CAPACIDADES_STAFF)
      .select('capacidad')
      .eq('usuario_id', usuarioId)
    if (error || !data) return []
    return (data as FilaCapacidadStaff[])
      .map((fila) => fila.capacidad)
      .filter((capacidad): capacidad is Capacidad => CAPACIDADES_VALIDAS.includes(capacidad))
  } catch {
    return []
  }
}
