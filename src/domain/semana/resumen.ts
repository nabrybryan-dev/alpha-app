/**
 * La semana natural del asesorado: de lunes a domingo, y la cuenta de lo hecho.
 *
 * Vive en el dominio porque dos pantallas la miran (Semana y, más adelante, cualquier
 * resumen) y porque la cuenta tiene un límite que no se puede decidir en el JSX: **solo
 * se cuenta lo que la app guarda como hecho**. Una nota leída o una revisión escuchada no
 * tienen estado en `main`; contarlas sería inventar un «hecho» que nadie marcó.
 */
import { sumarDias } from '../activacion'
import type { Cuestionario, Respuesta } from '../types'

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export interface RangoDeLaSemana {
  /** Lunes, ISO local (`2026-10-19`). */
  inicio: string
  /** Domingo, ISO local (`2026-10-25`). */
  fin: string
  /** «Del 19 al 25 de octubre», con el mes o el año cuando hacen falta. */
  etiqueta: string
}

/** El lunes de la semana natural que contiene la fecha. */
export function lunesDe(fechaIso: string): string {
  const fecha = new Date(`${fechaIso}T12:00:00`)
  const desdeLunes = (fecha.getDay() + 6) % 7
  return sumarDias(fechaIso, -desdeLunes)
}

function partes(iso: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return { anio, mes, dia }
}

/** «Del 19 al 25 de octubre», «Del 28 de septiembre al 4 de octubre», con año si cruza. */
export function rangoDeLaSemana(fechaIso: string): RangoDeLaSemana {
  const inicio = lunesDe(fechaIso)
  const fin = sumarDias(inicio, 6)
  const a = partes(inicio)
  const b = partes(fin)
  const mismoAnio = a.anio === b.anio
  const mismoMes = mismoAnio && a.mes === b.mes
  const izquierda = mismoMes ? `${a.dia}` : `${a.dia} de ${MESES[a.mes - 1]}${mismoAnio ? '' : ` de ${a.anio}`}`
  const derecha = `${b.dia} de ${MESES[b.mes - 1]}${mismoAnio ? '' : ` de ${b.anio}`}`
  return { inicio, fin, etiqueta: `Del ${izquierda} al ${derecha}` }
}

export interface CuentaDeLaSemana {
  sesionesPautadas: number
  sesionesHechas: number
  cuestionariosTotal: number
  cuestionariosRespondidos: number
}

/**
 * Los cuestionarios que la semana mostrada puede contar.
 *
 * Una respuesta solo suma si su fecha cae DENTRO del rango: la respuesta del mes pasado no
 * puede hacer que esta semana parezca más hecha de lo que está. Un cuestionario asignado y
 * sin responder no tiene fecha con la que situarlo en otra semana, así que cuenta como de
 * esta —es lo que la app tiene delante—, pero nunca como hecho.
 */
export function cuestionariosDeLaSemana(
  asignados: readonly Cuestionario[],
  respuestas: readonly Respuesta[],
  rango: Pick<RangoDeLaSemana, 'inicio' | 'fin'>,
): { total: number; respondidos: number } {
  const ids = new Set(asignados.map((q) => q.id))
  const respondidos = new Set(
    respuestas
      .filter((r) => ids.has(r.cuestionarioId))
      .filter((r) => {
        const dia = r.fechaIso.slice(0, 10)
        return dia >= rango.inicio && dia <= rango.fin
      })
      .map((r) => r.cuestionarioId),
  ).size
  const pendientes = asignados.filter(
    (q) => !respuestas.some((r) => r.cuestionarioId === q.id),
  ).length
  return { total: pendientes + respondidos, respondidos }
}

export interface ResumenDeLaSemana extends CuentaDeLaSemana {
  hechas: number
  total: number
  pct: number
  /** Un segmento por cosa pautada: los primeros `hechas` van encendidos. */
  segmentos: boolean[]
  texto: string
}

const entero = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

/**
 * Suma sesiones y cuestionarios. Los dos topes son a propósito: un registro de más no
 * puede hacer que la barra pase de 100 % ni que «hechas» supere a «pautadas».
 */
export function resumirLaSemana(cuenta: CuentaDeLaSemana): ResumenDeLaSemana {
  const sesionesPautadas = entero(cuenta.sesionesPautadas)
  const sesionesHechas = Math.min(entero(cuenta.sesionesHechas), sesionesPautadas)
  const cuestionariosTotal = entero(cuenta.cuestionariosTotal)
  const cuestionariosRespondidos = Math.min(entero(cuenta.cuestionariosRespondidos), cuestionariosTotal)
  const total = sesionesPautadas + cuestionariosTotal
  const hechas = sesionesHechas + cuestionariosRespondidos
  const pct = total === 0 ? 0 : Math.round((hechas * 100) / total)
  return {
    sesionesPautadas,
    sesionesHechas,
    cuestionariosTotal,
    cuestionariosRespondidos,
    hechas,
    total,
    pct,
    segmentos: Array.from({ length: total }, (_, i) => i < hechas),
    texto:
      total === 0
        ? 'Sin nada pautado esta semana'
        : hechas >= total
          ? 'Todo hecho esta semana'
          : `${hechas} de ${total} hechas esta semana`,
  }
}

/** El enlace de Hoy hacia la Semana: con la cuenta de lo que queda por hacer, si queda algo. */
export function etiquetaVerSemana(pendientes: number): string {
  const n = entero(pendientes)
  return n > 0 ? `Ver toda tu semana (${n} por hacer)` : 'Ver toda tu semana'
}
