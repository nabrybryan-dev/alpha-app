import { modoNube, supabase } from '../supabase'

export type ClaveAlertaNutricion = 'objetivo_insuficiente' | 'hambre_sostenida'

export const ETIQUETA_ALERTA: Record<ClaveAlertaNutricion, string> = {
  objetivo_insuficiente: 'Objetivo calórico insuficiente',
  hambre_sostenida: 'Hambre sostenida',
}

export interface AlertaNutricion {
  id: string
  asesoradoId: string
  clave: ClaveAlertaNutricion
  detalle: string
  creadaEn: string
}

/**
 * Las alertas nutricionales abiertas, para el staff (0148).
 *
 * Con el interruptor apagado (el estado por defecto, hasta que la nutricionista firme) la Edge
 * Function no crea ninguna y esto devuelve una lista vacía: la pantalla no pinta nada. Solo el
 * staff las lee (la política de la 0148); a cualquier otro rol le devuelve vacío.
 * Lanza si la lectura falla: quien llama decide no mostrar nada.
 */
export async function traerAlertasNutricion(): Promise<AlertaNutricion[]> {
  if (!modoNube) return []
  const { data, error } = await supabase()
    .from('alertas_nutricion')
    .select('id, asesorado_id, clave, detalle, creada_en')
    .is('resuelta_en', null)
    .order('creada_en', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((f) => ({
    id: String(f.id),
    asesoradoId: String(f.asesorado_id),
    clave: f.clave as ClaveAlertaNutricion,
    detalle: String(f.detalle),
    creadaEn: String(f.creada_en),
  }))
}
