export interface Hallazgo {
  archivo: string
  linea: number
  patron: string
  texto: string
}
export const PATRONES_DE_MODELO_EXTERNO: { nombre: string; regex: RegExp; optIn?: boolean }[]
export function recorrerLaCadena(p: { raiz: string; entradas: string[] }): Promise<{
  archivos: string[]
  hallazgos: Hallazgo[]
  optIn: Hallazgo[]
}>