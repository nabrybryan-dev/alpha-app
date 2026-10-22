export const CODIGO_TANDA_INCOMPLETA: number
export function balanceDeLaPublicacion(cuentas: {
  esperados: number
  publicados: number
  yaAprobados?: number
  rechazados?: number
  sinAudio?: number
  ensayo?: boolean
}): { completa: boolean; faltan: number; codigoDeSalida: number; linea: string }
