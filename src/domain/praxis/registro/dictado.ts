// Esqueleto temporal: lo que hace hoy el código (sin arreglos), para ver las pruebas fallar por su razón.
import { numeroDeCita } from './numeros.ts'
export type Lectura = { tipo: 'valor'; valor: number; aproximado: boolean } | { tipo: 'rango'; etiquetas: [string, string] } | { tipo: 'vago' } | null
const hoy = (c: string): Lectura => { const n = numeroDeCita(c); return n ? { tipo: 'valor', ...n } : null }
export const leerSueno = hoy
export const leerPasos = hoy
