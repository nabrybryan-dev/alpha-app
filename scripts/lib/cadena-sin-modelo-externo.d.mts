export const PATRONES_DE_MODELO_EXTERNO: { nombre: string; regex: RegExp }[]
export function recorrerLaCadena(p: { raiz: string; entradas: string[] }): Promise<{
  archivos: string[]
  hallazgos: { archivo: string; linea: number; patron: string; texto: string }[]
}>
