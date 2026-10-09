import type { PlanNutricional, TipoDia } from '../types'

/**
 * Qué tipo de día (ALTO, BAJO, CHEAT) le toca a una fecha, según lo que el plan dice de sus
 * propios menús.
 *
 * POR QUÉ EXISTE. El diario tenía el tipo fijo en ALTO: a quien su plan le marca jueves y
 * sábado como día bajo y el domingo como refeed, el diario le titulaba «día alto» y le medía
 * contra la meta del día alto tres días de cada siete (revisión del 9-oct-2026).
 *
 * DE DÓNDE SALE. El plan no guarda un mapa día→tipo: solo el nombre de cada menú («Día BAJO ·
 * jueves y sábado») y, a veces, una etiqueta corta («DÍA BAJO · J · Sá»). Se lee de ahí: el
 * nombre completo del día en el nombre del menú y, si no aparece en ninguno, su sigla en la
 * etiqueta. Solo se acepta la respuesta cuando UN tipo, y solo uno, nombra ese día; con cero o
 * con varios se devuelve ALTO, que es lo que el diario hacía antes. Adivinar a medias sería
 * peor que el fallo que se arregla.
 */
const DIAS: readonly { nombre: string; siglas: readonly string[] }[] = [
  { nombre: 'domingo', siglas: ['d', 'do', 'dom'] },
  { nombre: 'lunes', siglas: ['l', 'lu', 'lun'] },
  { nombre: 'martes', siglas: ['ma', 'mar'] },
  { nombre: 'miercoles', siglas: ['mi', 'mie', 'x'] },
  { nombre: 'jueves', siglas: ['j', 'ju', 'jue'] },
  { nombre: 'viernes', siglas: ['v', 'vi', 'vie'] },
  { nombre: 'sabado', siglas: ['s', 'sa', 'sab'] },
]

const POR_OMISION: TipoDia = 'ALTO'

/** Minúsculas, sin tildes y partido en palabras: «Sá · J» → ['sa', 'j']. */
function palabras(texto: string | undefined): string[] {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean)
}

export function tipoDiaDeLaFecha(plan: PlanNutricional | undefined, fechaIso: string): TipoDia {
  if (!plan) return POR_OMISION
  const [anio, mes, dia] = fechaIso.split('-').map(Number)
  if (!anio || !mes || !dia) return POR_OMISION
  // A mano y en hora local: `new Date('2026-10-08')` es UTC y en Colombia cae el día anterior.
  const hoy = DIAS[new Date(anio, mes - 1, dia).getDay()]
  if (!hoy) return POR_OMISION

  const porNombre = new Set<TipoDia>()
  const porSigla = new Set<TipoDia>()
  for (const menu of plan.menus) {
    if (palabras(menu.nombre).includes(hoy.nombre)) porNombre.add(menu.tipoDia)
    const etiqueta = palabras(plan.etiquetasDia?.[menu.tipoDia])
    if (etiqueta.includes(hoy.nombre) || etiqueta.some((p) => hoy.siglas.includes(p))) {
      porSigla.add(menu.tipoDia)
    }
  }
  const candidatos = porNombre.size > 0 ? porNombre : porSigla
  if (candidatos.size !== 1) return POR_OMISION
  return [...candidatos][0]
}

/**
 * La etiqueta del tipo de día, sin repetir «día»: el diario escribía «Día DÍA ALTO · L · Ma»
 * porque anteponía la palabra a una etiqueta que ya la traía.
 */
export function etiquetaDelTipoDeDia(plan: PlanNutricional | undefined, tipo: TipoDia): string {
  const etiqueta = plan?.etiquetasDia?.[tipo]?.trim()
  if (!etiqueta) return `Día ${tipo}`
  return /^d[ií]a(\s|$)/i.test(etiqueta) ? etiqueta : `Día ${etiqueta}`
}
