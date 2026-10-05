import { modoNube, supabase } from '../supabase'

/**
 * Lectura de `mensajes_vida` (migración 0088) — la bandeja de mensajes de estilo de vida.
 * SOLO LECTURA, igual que `consola/planesEstrategicos.ts`: la escribe exclusivamente
 * `service_role` (la cola `cola_mensajes_vida.py` de `cerebro-alpha`). Contrato completo
 * en `docs/specs/2026-09-27-mensajes-de-estilo-de-vida.md`.
 *
 * La RLS ya filtra a "los míos, que ya tocan y no están detenidos"
 * (`mensajes_vida_leer`): este módulo no repite esa condición, la asume — pedir de más
 * aquí no traería nada de más, porque la base no lo entrega.
 */
export const TABLA_MENSAJES_VIDA = 'mensajes_vida'

interface FilaMensajeVida {
  id: string
  usuario_id: string
  texto: string
  tipo: 'prescripcion_vida' | 'ayuda_animo'
  enviar_despues_de: string
  enviado_en: string | null
  detenido_en: string | null
  creado_en: string
}

export interface MensajeVida {
  id: string
  usuarioId: string
  texto: string
  tipo: 'prescripcion_vida' | 'ayuda_animo'
  enviarDespuesDe: string
  enviadoEn: string | null
  detenidoEn: string | null
  creadoEn: string
}

function aMensajeVida(fila: FilaMensajeVida): MensajeVida {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    texto: fila.texto,
    tipo: fila.tipo,
    enviarDespuesDe: fila.enviar_despues_de,
    enviadoEn: fila.enviado_en,
    detenidoEn: fila.detenido_en,
    creadoEn: fila.creado_en,
  }
}

/**
 * Los mensajes que esta persona puede ver ahora mismo, del más reciente al más viejo.
 * `[]` sin sesión de nube o si algo falla: nunca lanza — mismo contrato que
 * `planVigente`.
 */
export async function mensajesVidaDe(usuarioId: string): Promise<MensajeVida[]> {
  if (!modoNube || !usuarioId) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_MENSAJES_VIDA)
      .select('id,usuario_id,texto,tipo,enviar_despues_de,enviado_en,detenido_en,creado_en')
      .eq('usuario_id', usuarioId)
      .order('enviar_despues_de', { ascending: false })
    if (error || !data) return []
    return (data as unknown as FilaMensajeVida[]).map(aMensajeVida)
  } catch {
    return []
  }
}
