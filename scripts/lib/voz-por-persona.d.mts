export const SILENCIO_PREVIO_MS: number
export const REINTENTOS_DE_LA_VOZ: number
export const ESPERA_ANTES_DE_REINTENTAR_MS: number

export interface PersonaDeLaVoz {
  usuarioId: string
  nombre?: string
}
export interface ResumenDeLasVoces {
  generadas: (PersonaDeLaVoz & { intentos: number })[]
  yaEstaban: PersonaDeLaVoz[]
  fallidas: (PersonaDeLaVoz & { intentos: number; motivo: string })[]
  omitidas: PersonaDeLaVoz[]
}
export interface IoDeLaVoz {
  correrVoz(rutaEncargo: string, cwd: string): Promise<{ codigo: number | null; error?: string }>
  anteponerSilencio(entrada: string, salida: string, ms: number): Promise<void>
  esperar(ms: number): Promise<void>
}
export function generarVocesDeLaTanda(p: {
  carpeta: string
  manifiesto: { semana: string; encargos: { usuarioId: string; nombre?: string; guion?: string; omitido?: boolean; mensaje?: { motivo?: string | null } }[] }
  molde: string
  moldeSha256: string
  estudio: string
  io: IoDeLaVoz
  silencioMs?: number
  reintentos?: number
  esperaMs?: number
  soloUno?: string
  log?: (texto: string) => void
}): Promise<ResumenDeLasVoces>
export function codigoDeSalidaDeLasVoces(resumen: ResumenDeLasVoces): number
