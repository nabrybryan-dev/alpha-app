import type { Microciclo, PlanNutricional, Sesion } from '../../domain/types'

/**
 * La forma mínima con la que la app puede pintar un microciclo o un plan.
 *
 * `hidratar` bajaba el blob de `datos` y lo casteaba —`f.datos as Microciclo`—
 * sin comprobar nada. El cast es una promesa al compilador, no una garantía en
 * tiempo de ejecución: si la fila llega sin un array, la app lee `.length` de
 * `undefined`, revienta el render y el ErrorBoundary pinta «Esta sección no se
 * pudo mostrar». **La pantalla entera se cae por un campo que faltaba.**
 *
 * Y falta más de lo que parece. Las filas que entran por SQL —las cargas de
 * microciclo y los planes que escribe la nutricionista— no pasan por ningún
 * validador, y `jsonb_agg` de cero filas **devuelve NULL, no `[]`**: es la misma
 * trampa que documenta CLAUDE.md y que ya se llevó por delante sesiones de
 * cardio. Una sesión sin ejercicios —Zona 2, movilidad, hábito— es justo la que
 * más probabilidades tiene de llegar con `ejercicios: null`.
 *
 * Así que la app deja de fiarse del cast. Lo que falta se rellena vacío, que es
 * lo que la UI ya sabe pintar, y **el asesorado ve el resto de su pantalla** en
 * vez de un cartel de error. No inventa datos: solo distingue «no hay» de
 * «esto no existe y me caigo».
 */

/** Un array, o uno vacío si lo que vino no lo era (null, undefined, un objeto). */
function lista<T>(valor: unknown): T[] {
  return Array.isArray(valor) ? (valor as T[]) : []
}

export function sanearSesion(sesion: Sesion): Sesion {
  const limpia: Sesion = { ...sesion, ejercicios: lista(sesion.ejercicios) }
  // `preparacion` y `bloquesCardio` son opcionales en el tipo: si no vinieron, se
  // quedan sin definir. Solo se normaliza lo que vino mal.
  if (sesion.preparacion !== undefined) limpia.preparacion = lista(sesion.preparacion)
  if (sesion.bloquesCardio !== undefined) limpia.bloquesCardio = lista(sesion.bloquesCardio)
  return limpia
}

export function sanearMicrociclo(micro: Microciclo): Microciclo {
  return { ...micro, sesiones: lista<Sesion>(micro.sesiones).map(sanearSesion) }
}

export function sanearPlan(plan: PlanNutricional): PlanNutricional {
  return {
    ...plan,
    menus: lista(plan.menus),
    equivalencias: lista(plan.equivalencias),
    listaCompras: lista(plan.listaCompras),
    suplementacion: lista(plan.suplementacion),
    seccionesEspeciales: lista(plan.seccionesEspeciales),
  }
}
