/**
 * Fechas relativas («ayer», «anoche», «el lunes») sobre la HORA LOCAL del
 * teléfono. Trabaja con texto `AAAA-MM-DD` y `Date.UTC` solo para sumar días:
 * nunca pasa por la zona del servidor, que es justo lo que descuadra un
 * «ayer» dicho a las 11 de la noche.
 */
import { normalizarTexto } from './numeros.ts'

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** `2026-09-28T18:40:00-05:00` → `2026-09-28` (la fecha LOCAL, no la UTC). */
export function fechaLocal(iso: string): string {
  return iso.slice(0, 10)
}

export function horaLocal(iso: string): { h: number; m: number } {
  const m = iso.match(/T(\d{2}):(\d{2})/)
  return m ? { h: Number(m[1]), m: Number(m[2]) } : { h: 12, m: 0 }
}

function aUtc(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

export function sumarDias(fecha: string, dias: number): string {
  const t = new Date(aUtc(fecha) + dias * 86_400_000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

export function diaDeLaSemana(fecha: string): number {
  return new Date(aUtc(fecha)).getUTCDay()
}

/** «lunes 28-sep». */
export function etiquetaDeFecha(fecha: string): string {
  const d = new Date(aUtc(fecha))
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}-${MESES[d.getUTCMonth()]}`
}

export interface FechaResuelta {
  fecha: string
  /** Cómo se llama en la tarjeta: «hoy», «ayer, lunes 28-sep». */
  etiqueta: string
  relativa: 'hoy' | 'ayer' | 'anteayer' | 'anoche' | 'dia'
  esHoy: boolean
}

/**
 * Resuelve la cita temporal. `null` o vacía = hoy. Una cita que no se entiende
 * devuelve `null` (no se adivina): quien llama pregunta o usa hoy.
 */
export function resolverFecha(cita: string | null | undefined, ahoraIso: string): FechaResuelta | null {
  const hoy = fechaLocal(ahoraIso)
  const dia = (fecha: string, relativa: FechaResuelta['relativa'], prefijo?: string): FechaResuelta => ({
    fecha,
    relativa,
    esHoy: fecha === hoy,
    etiqueta: fecha === hoy ? 'hoy' : `${prefijo ? prefijo + ', ' : ''}${etiquetaDeFecha(fecha)}`,
  })
  if (!cita || !cita.trim()) return dia(hoy, 'hoy')
  const n = normalizarTexto(cita)
  if (/\banoche\b/.test(n)) return dia(sumarDias(hoy, -1), 'anoche', 'anoche')
  if (/\b(anteayer|antier|antes de ayer)\b/.test(n)) return dia(sumarDias(hoy, -2), 'anteayer', 'anteayer')
  if (/\bayer\b/.test(n)) return dia(sumarDias(hoy, -1), 'ayer', 'ayer')
  if (/\b(hoy|ahorita|ahora|esta manana|esta tarde|esta noche|hace un rato)\b/.test(n)) return dia(hoy, 'hoy')
  for (let i = 0; i < DIAS.length; i++) {
    if (new RegExp(`\\b${DIAS[i]}\\b`).test(n)) {
      // El último `DIAS[i]` que ya pasó; si es hoy mismo, hoy.
      const atras = (diaDeLaSemana(hoy) - i + 7) % 7
      return dia(sumarDias(hoy, -atras), 'dia')
    }
  }
  return null
}
