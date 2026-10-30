import type { Tema } from '../../../lib/temaDelDocumento'

/**
 * Cuánto se levanta la sala de Blender hacia la luz en cada tema (uniforme `u_aclarado`
 * del shader, solo en lo horneado). 0 = como siempre; 1 = el máximo del shader.
 */
export function aclaradoDelTema(tema: Tema): number {
  return tema === 'light' ? 0.9 : 0
}
