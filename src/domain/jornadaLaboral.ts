import { estaAbierto, esVivo, lunesDe, sumarDias, type Dueno, type ItemPlan } from './planOrganizador'

/**
 * «Jornada laboral» de Administración (decisión de Bryan, 30-sep). Lógica pura sobre el mismo
 * modelo de «Mi plan» (`plan_items`): tareas del día y de la semana, cada una con el hito
 * (corto plazo: la semana) y el objetivo (mediano plazo: los 90 días) al que aporta.
 *
 * Nada se inventa: lo que el plan no trae (fecha del objetivo, hito, entregable) queda en
 * `null` y la pantalla lo dice con «FALTA». El plan no tiene campo de entregables.
 */

export interface FilaJornada {
  tarea: ItemPlan
  hito: ItemPlan | null
  objetivo: ItemPlan | null
  /** Lunes del hito (plazo corto), o null si la tarea no cuelga de un hito. */
  plazoCorto: string | null
  /** Fecha del objetivo (plazo mediano), o null si no está cargada. */
  plazoMediano: string | null
}

export interface Jornada {
  hoy: FilaJornada[]
  /** Del día siguiente al domingo de esta semana. */
  semana: FilaJornada[]
  /** Abiertas sin día: no se les inventa uno. */
  sinDia: FilaJornada[]
}

/** OR-03: solo el dueño tacha su tarea (Bryan no tacha ni aprueba la semana de Manuela). */
export function puedeTachar(tarea: ItemPlan, quienMira: Dueno): boolean {
  return tarea.dueno === quienMira && esVivo(tarea)
}

export function jornadaDe(items: readonly ItemPlan[], dueno: Dueno, hoy: string): Jornada {
  const porId = new Map(items.map((i) => [i.id, i]))
  const fila = (tarea: ItemPlan): FilaJornada => {
    const padre = tarea.padreId ? porId.get(tarea.padreId) ?? null : null
    const hito = padre && padre.nivel === 'hito' ? padre : null
    const objPadre = hito?.padreId ? porId.get(hito.padreId) ?? null : null
    const objetivo = objPadre && objPadre.nivel === 'objetivo' ? objPadre : null
    return { tarea, hito, objetivo, plazoCorto: hito?.fecha ?? null, plazoMediano: objetivo?.fecha ?? null }
  }
  const propias = items.filter((i) => i.nivel === 'tarea' && i.dueno === dueno)
  const domingo = sumarDias(lunesDe(hoy), 6)
  return {
    hoy: propias.filter((t) => t.fecha === hoy && esVivo(t)).map(fila),
    semana: propias.filter((t) => t.fecha !== null && t.fecha > hoy && t.fecha <= domingo && esVivo(t)).map(fila),
    sinDia: propias.filter((t) => t.fecha === null && estaAbierto(t)).map(fila),
  }
}
