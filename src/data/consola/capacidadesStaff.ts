import { modoNube, supabase } from '../supabase'

/**
 * Lectura de `capacidades_staff` (migración 0083): permisos por acción, ortogonales al
 * rol — no convierte a nadie en coach (RESPUESTA-ASTRA-CONSOLA.md §4). SOLO LECTURA: la
 * tabla no tiene política de insert/update/delete para `authenticated`, así que este
 * archivo no ofrece esas operaciones — se asignan a mano o desde `service_role`.
 *
 * `CAPACIDADES` es la misma lista que el `check` de la migración 0083, palabra por
 * palabra; las pruebas de este archivo la comparan contra el SQL para no desincronizarse
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
