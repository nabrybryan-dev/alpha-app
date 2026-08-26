import { diaDeSesion, diaSemanaDe } from '../../../domain/calendario'
import type { Microciclo } from '../../../domain/types'
import type { TomaDelHistorial } from './historial'

/**
 * De los microciclos guardados a los puntos del historial de %PV.
 *
 * ## La fecha se deriva, y por eso no lleva hora
 *
 * `SerieRegistrada` **no guarda cuándo se hizo la serie**: `hechoEn` existe en la
 * preparación y en los bloques de cardio, no en el trabajo de fuerza. Lo más
 * cercano es `fechaInicio` del microciclo más el día de la semana que lleva la
 * sesión en el nombre.
 *
 * Eso da un día, no un instante, y aquí se respeta: la fecha sale **sin hora**, y
 * `tramoQueSeñalar` sabe que sin hora no puede dar el aviso de franja horaria.
 * Ponerle una hora cualquiera para que el aviso «funcionara» sería fabricar el
 * dato que hace falta para el aviso — exactamente el fallo que el aviso existe
 * para evitar.
 *
 * ## Una serie por punto, no una sesión
 *
 * Cada serie medida es un punto. Promediar las series de una sesión escondería
 * justo lo que el %PV mide: la primera serie y la quinta del mismo ejercicio
 * llegan a fatigas distintas, y esa diferencia es el dato.
 */

/** Qué ejercicio se está siguiendo. Se compara sin tildes ni mayúsculas. */
function mismoEjercicio(a: string, b: string): boolean {
  const pelar = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toLowerCase()
  return pelar(a) === pelar(b)
}

/**
 * La fecha de una sesión dentro de su microciclo.
 *
 * Devuelve `undefined` cuando la sesión no dice qué día es: sin día no hay dónde
 * ponerla en el eje del tiempo, y colocarla en `fechaInicio` la amontonaría con
 * las demás del microciclo como si se hubieran hecho todas a la vez.
 */
export function fechaDeLaSesion(
  fechaInicio: string,
  sesion: { nombre: string; dia?: string },
): string | undefined {
  const dia = diaDeSesion(sesion)
  if (!dia) return undefined
  const inicio = new Date(`${fechaInicio.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(inicio.getTime())) return undefined
  // El microciclo puede arrancar a mitad de semana, así que se avanza desde su
  // inicio hasta el primer día que coincida — nunca hacia atrás, que pondría la
  // sesión antes de que el microciclo empezara.
  const d = new Date(inicio)
  for (let i = 0; i < 7; i++) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (diaSemanaDe(iso) === dia) return iso
    d.setDate(d.getDate() + 1)
  }
  return undefined
}

export function tomasDeMicrociclos(
  microciclos: Microciclo[],
  ejercicio: string,
): TomaDelHistorial[] {
  const tomas: TomaDelHistorial[] = []
  for (const m of microciclos) {
    for (const sesion of m.sesiones ?? []) {
      const fecha = fechaDeLaSesion(m.fechaInicio, sesion)
      if (!fecha) continue
      for (const ej of sesion.ejercicios ?? []) {
        if (!mismoEjercicio(ej.nombre, ejercicio)) continue
        for (const serie of ej.series ?? []) {
          const v = serie.velocidad
          if (!v || !Number.isFinite(v.pvPct)) continue
          tomas.push({
            fecha,
            pvPct: v.pvPct,
            // Un veredicto que no reconocemos no se asume bueno.
            calidad:
              v.calidad === 'buena' || v.calidad === 'dudosa' || v.calidad === 'descartada'
                ? v.calidad
                : 'dudosa',
            cargaKg: serie.cargaKg,
            hayEscala: v.hayEscala,
            inclinacionMax: v.inclinacionMax,
          })
        }
      }
    }
  }
  return tomas
}

/** Los ejercicios que tienen al menos una serie medida, para poder elegir. */
export function ejerciciosConMedicion(microciclos: Microciclo[]): string[] {
  const nombres = new Set<string>()
  for (const m of microciclos) {
    for (const sesion of m.sesiones ?? []) {
      for (const ej of sesion.ejercicios ?? []) {
        if ((ej.series ?? []).some((s) => s.velocidad && Number.isFinite(s.velocidad.pvPct))) {
          nombres.add(ej.nombre)
        }
      }
    }
  }
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'))
}
