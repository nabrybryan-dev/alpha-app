import { diaDeSesion, type DiaSemana } from './calendario'
import { sesionCompleta } from './cumplimiento'
import type { DiaRuta } from './rutaEntrenamiento'
import type { Microciclo, Sesion } from './types'

/**
 * DOBLE SESIÓN EL MISMO DÍA (mañana y repaso de noche) y las funciones que leen la semana ya
 * armada. Antes `armarSemana` solo guardaba la primera sesión por día y la segunda caía en el
 * siguiente hueco libre (la asesorada la veía el martes).
 */

/** Una sesión dentro de su día. `DiaRuta.sesiones` las lleva todas, por `orden`. */
export interface SesionDeDia {
  sesionId: string
  titulo: string
  detalle: string
  completada: boolean
}

/**
 * Reparte las sesiones por nombre de día, en orden. Con el día repetido caen TODAS en él.
 *
 * SOLO si el microciclo cabe en una semana (`cadenciaDias <= 7`, la regla de Bryan desde el
 * 19-sep-2026). Un microciclo heredado de 8 o 15 días repite las mismas etiquetas de día en
 * su segunda semana («LUNES» y otra vez «LUNES»): ahí NO son doble sesión, y apilarlas
 * taparía la semana 2 en la 1. Esos siguen como antes (la repetida va a un hueco o queda
 * fuera, y `sesionesFueraDeLaSemana` lo dice).
 */
export function agruparPorDia(microciclo: Microciclo): { conDia: Map<DiaSemana, Sesion[]>; sinDia: Sesion[] } {
  const admiteDoble = microciclo.cadenciaDias <= 7
  const conDia = new Map<DiaSemana, Sesion[]>()
  const sinDia: Sesion[] = []
  for (const sesion of [...microciclo.sesiones].sort((a, b) => a.orden - b.orden)) {
    const dia = diaDeSesion(sesion)
    if (dia && (admiteDoble || !conDia.has(dia))) conDia.set(dia, [...(conDia.get(dia) ?? []), sesion])
    else sinDia.push(sesion)
  }
  return { conDia, sinDia }
}

/** Las sesiones de un día, con su detalle y si están hechas. */
export function sesionesDeDia(delDia: readonly Sesion[], detalleDeSesion: (s: Sesion) => string): SesionDeDia[] {
  return delDia.map((s) => ({
    sesionId: s.id,
    titulo: s.nombre,
    detalle: detalleDeSesion(s),
    completada: sesionCompleta(s),
  }))
}

/** Lo que dice el título del día: el de la sesión, o los de las dos con doble sesión. */
export function tituloDelDia(dia: DiaRuta): string {
  return dia.sesiones && dia.sesiones.length > 1 ? dia.sesiones.map((s) => s.titulo).join(' + ') : dia.titulo
}

/**
 * Las sesiones del microciclo que `armarSemana` NO consiguió meter en la
 * rejilla de 7 días que devolvió para ese mismo `hoyIso`.
 *
 * `armarSemana` SIEMPRE pinta 7 días —es una rejilla semanal— pero un
 * microciclo puede durar 8 o 15 (`cadenciaDias`, heredados de antes de la
 * regla de Bryan del 19-sep-2026: «todo microciclo nuevo son 7»). Con más
 * sesiones «con día» que huecos libres, o con dos sesiones que casan el mismo nombre de
 * día en un microciclo de más de 7 días (ver `agruparPorDia`), algunas sesiones se quedan
 * sin fecha en ESTA semana. Antes esto no se decía en ningún sitio: la sesión sencillamente no
 * aparecía, y no había manera de distinguir «no tiene nada programado» de
 * «tiene algo que la rejilla no pudo colocar».
 *
 * Nunca reescribe ni descarta nada — es de solo lectura, para que la interfaz
 * pueda avisar en vez de ocultar (regla de aceptación #3 del contrato de
 * Bryan). Con `cadenciaDias: 7` y sesiones sin días repetidos —el caso normal
 * desde la regla nueva— siempre devuelve `[]`.
 */
export function sesionesFueraDeLaSemana(
  microciclo: Microciclo,
  dias: readonly DiaRuta[],
): Sesion[] {
  const enLaRejilla = new Set(
    dias.flatMap((d) => d.sesiones?.map((s) => s.sesionId) ?? (d.sesionId !== undefined ? [d.sesionId] : [])),
  )
  return microciclo.sesiones.filter((s) => !enLaRejilla.has(s.id))
}

export interface SesionDestacada {
  sesionId: string
  titulo: string
  esDeHoy: boolean
}

/**
 * La sesión que propone el botón grande de la Ruta.
 *
 * Sale de la MISMA semana que pinta el calendario, a propósito: cuando el CTA
 * se calculaba aparte, el botón decía "sesión de hoy · UPPER A" mientras la
 * agenda ponía otra sesión en el día de hoy. Dos respuestas distintas a la
 * misma pregunta en la misma pantalla.
 *
 * Orden: la de hoy si está pendiente; si no, la siguiente de la semana; y si
 * tampoco, una pendiente que quedó atrás.
 */
export function sesionDestacada(dias: readonly DiaRuta[]): SesionDestacada | undefined {
  const hoy = dias.find((d) => d.estado === 'hoy')
  if (hoy?.sesionId) {
    // Con doble sesión, la que toca es la primera SIN completar (la de la noche si la de
    // la mañana ya está hecha), no siempre la primera del día.
    const pendiente = hoy.sesiones?.find((s) => !s.completada)
    return pendiente
      ? { sesionId: pendiente.sesionId, titulo: pendiente.titulo, esDeHoy: true }
      : { sesionId: hoy.sesionId, titulo: hoy.titulo, esDeHoy: true }
  }

  const indiceHoy = dias.findIndex((d) => d.esHoy)
  const pendiente =
    dias.slice(indiceHoy + 1).find((d) => d.estado === 'programada') ??
    dias.slice(0, Math.max(0, indiceHoy)).find((d) => d.estado === 'programada')

  if (!pendiente?.sesionId) return undefined
  return { sesionId: pendiente.sesionId, titulo: pendiente.titulo, esDeHoy: false }
}

export interface ResumenSemana {
  completadas: number
  programadas: number
}

/** "2/5 sesiones" de la cabecera del calendario. */
export function resumenSemana(dias: readonly DiaRuta[]): ResumenSemana {
  // Cuenta SESIONES, no días: con doble sesión un día pesa dos. Un día sin `sesiones`
  // (construido a mano) pesa uno, como antes.
  const sesiones = dias.flatMap((d) =>
    d.sesiones ?? (d.sesionId !== undefined ? [{ completada: d.estado === 'completada' }] : []),
  )
  return {
    completadas: sesiones.filter((s) => s.completada).length,
    programadas: sesiones.length,
  }
}
