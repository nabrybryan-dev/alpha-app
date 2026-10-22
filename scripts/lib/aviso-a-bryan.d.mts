export interface Aviso {
  id: string
  tipo: string
  mensaje: string
  urgente?: boolean
  slug?: string
  ahora?: Date
}
export function rutaDeNotificaciones(env?: Record<string, string | undefined>): string
export function lineaDeAviso(aviso: Aviso): string
export function avisarABryan(
  aviso: Aviso,
  opciones?: { env?: Record<string, string | undefined>; errores?: (texto: string) => void },
): Promise<boolean>
