import { modoNube, supabase } from '../supabase'
import type { DecisionDeAviso } from '../../domain/avisos/embudo'
import type { SuscripcionParaGuardar } from '../../features/avisos/suscripcion'

export interface DecisionParaGuardar {
  usuarioId: string
  dijoSi: boolean
  suscripcion?: SuscripcionParaGuardar | null
}

/**
 * Guarda lo que la persona decidió sobre los avisos.
 *
 * **La decisión y la suscripción son dos cosas distintas** y por eso viajan en
 * la misma fila pero por separado: alguien puede decir que sí y que la
 * suscripción no salga —no hay clave de servidor todavía, o el navegador la
 * rechazó—, y confundirlas perdería la mitad del embudo. El número que decide
 * si se construye el empuje es cuánta gente DIJO que sí.
 *
 * Nunca lanza y no devuelve nada útil: si esto falla, la persona ya vio la
 * pantalla y ya contestó, y no se le puede molestar con un error por algo que
 * es nuestro.
 */
export async function guardarDecisionDeAviso(decision: DecisionParaGuardar): Promise<void> {
  if (!modoNube) return
  try {
    await supabase()
      .from('permisos_de_aviso')
      .upsert(
        {
          usuario_id: decision.usuarioId,
          dijo_si: decision.dijoSi,
          visto_en: new Date().toISOString(),
          endpoint: decision.suscripcion?.endpoint ?? null,
          p256dh: decision.suscripcion?.p256dh ?? null,
          auth: decision.suscripcion?.auth ?? null,
        },
        { onConflict: 'usuario_id' },
      )
  } catch {
    // Ver el comentario de arriba.
  }
}

/**
 * Las decisiones de toda la cartera, para el informe del coach.
 *
 * Solo el staff puede leerlas: la politica de la 0063 deja a cada quien ver la
 * suya, asi que a un asesorado esto le devuelve su propia fila y nada mas — no
 * hace falta un filtro por rol aqui, y ponerlo seria el error de siempre.
 */
export async function traerDecisionesDeAviso(): Promise<DecisionDeAviso[]> {
  if (!modoNube) return []
  try {
    const { data } = await supabase()
      .from('permisos_de_aviso')
      .select('usuario_id, dijo_si, visto_en, vivo_en')
    return (data ?? []).map((f) => ({
      usuarioId: String(f.usuario_id),
      dijoSi: Boolean(f.dijo_si),
      vioEn: String(f.visto_en),
      vivoEn: f.vivo_en ? String(f.vivo_en) : undefined,
    }))
  } catch {
    return []
  }
}
