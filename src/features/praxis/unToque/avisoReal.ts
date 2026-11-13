import { dejarAvisoAlCoach, type ResultadoAviso } from '../../../data/praxis/avisoAlCoach'
import type { NivelAviso } from '../../../domain/praxis/aviso'

/**
 * El aviso REAL al coach (D09, 12-nov-2026). APAGADO por defecto, con el mismo mecanismo que `VITE_MOTOR_APP_ACTIVO`: se
 * decide al construir (`import.meta.env`), no en runtime. Sin `VITE_PRAXIS_AVISO_REAL=true` la app queda como hoy:
 * «Avisar a mi coach» solo lleva al chat. Se enciende solo DESPUÉS de aplicar la migración 0108 (orden escrita de Bryan).
 * La variable NO está definida en ningún archivo del repo.
 */
export const avisoRealActivo = (): boolean => import.meta.env.VITE_PRAXIS_AVISO_REAL === 'true'

/**
 * Lo que hace el botón «Avisar a mi coach» de la tarjeta de salud.
 * - Apagado: navega a `/chat` (lo de siempre) y no devuelve nada.
 * - Encendido: escribe UNA fila de aviso (usuario, origen, tipo) y devuelve el resultado; la capa solo dice «listo» si fue `ok`.
 */
export function manejadorDeAvisoDeSalud(entrada: {
  activo: boolean
  usuarioId: string
  navegar: (ruta: string) => void
  escribir?: (e: { usuarioId: string; nivel: NivelAviso }) => Promise<ResultadoAviso>
}): (nivel: NivelAviso) => void | Promise<ResultadoAviso> {
  const escribir = entrada.escribir ?? dejarAvisoAlCoach
  if (!entrada.activo) return () => entrada.navegar('/chat')
  return (nivel) => escribir({ usuarioId: entrada.usuarioId, nivel })
}
