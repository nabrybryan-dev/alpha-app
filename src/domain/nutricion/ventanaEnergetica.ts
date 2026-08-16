import type { TotalDia } from './dia'

/**
 * Sobre qué días se juzga la disponibilidad energética.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO SE MIRA EL DÍA DE HOY
 * ─────────────────────────────────────────────────────────────────────────────
 * La alerta de disponibilidad energética divide lo que comió entre su masa
 * magra. Aplicada al día en curso, a las ocho de la mañana todo el mundo ha
 * comido un desayuno y nada más: con una masa magra de 45 kg, 350 kcal dan 7,7
 * kcal/kg y el umbral está en 30. Todos los asesorados abrirían la app cada
 * mañana con una alerta de que están comiendo por debajo de lo que su cuerpo
 * necesita, y saldrían de ella a media tarde.
 *
 * Una alerta que se enciende todos los días deja de ser una alerta. Peor: si la
 * lee alguien con antecedente de conducta alimentaria, es un mensaje diario
 * diciéndole que come poco.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ TAMPOCO SIRVE UN DÍA SUELTO CERRADO
 * ─────────────────────────────────────────────────────────────────────────────
 * El registro es estimado. Un día de 1.900 kcal anotadas a ojo está de verdad
 * entre 1.425 y 2.375 (±25 %), y esos dos extremos caen a lados distintos del
 * umbral: 22,5 (problema) y 43,3 (bien). El mismo día, sin cambiar nada, cruza
 * la línea entera. Un solo día no es medible con este dato.
 *
 * Promediar varios encoge ese margen, que es la razón técnica —no estética— de
 * mirar una ventana y no una fecha.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO SE EXIGE QUE EL DÍA ESTÉ "COMPLETO"
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo intuitivo sería contar solo los días con las cuatro comidas anotadas. Sería
 * un sesgo grave: quien come tres veces y anota tres veces quedaría fuera de la
 * media, y esa es justo la persona que la alerta tiene que poder ver. Se
 * excluiría a los que comen poco del cálculo de si alguien come poco.
 *
 * Se cuenta todo día con algo anotado, y el resultado viaja con `dias` para que
 * quien lo lea sepa sobre cuánto se ha calculado.
 */

/** Cuántos días atrás se mira. */
export const DIAS_VENTANA = 7

/**
 * Por debajo de esto no se dice nada.
 *
 * Con uno o dos días, la media es el día suelto que el bloque de arriba descarta
 * por no ser medible.
 */
export const DIAS_MINIMOS = 3

export interface DiaRegistrado {
  fecha: string
  total: TotalDia
}

export interface VentanaEnergetica {
  /** Media de kcal de los días con registro. */
  ingestaKcal: number
  /** Sobre cuántos días se calculó. Nunca por debajo de `DIAS_MINIMOS`. */
  dias: number
  /** El margen más ancho de los días usados: la media no es más fiable que su peor día. */
  margenPct: number
}

/**
 * La media de ingesta de los últimos días con registro, sin contar hoy.
 *
 * `null` cuando no hay suficientes días. No es un cero: significa "todavía no se
 * puede decir", y quien lo reciba tiene que callar, no dar por bueno.
 *
 * `hoy` entra como parámetro en vez de leerse del reloj para que esto siga
 * siendo dominio puro y se pueda probar sin congelar el tiempo.
 */
export function ventanaEnergetica(
  registrados: readonly DiaRegistrado[],
  hoy: string,
): VentanaEnergetica | null {
  const porFecha = new Map<string, DiaRegistrado>()
  for (const d of registrados) {
    if (d.fecha >= hoy) continue
    if ((d.total.porDia.kcal ?? 0) <= 0) continue
    // Una fecha, un día. Si el llamante repitiera una, contarla dos veces
    // desviaría la media sin que nadie lo notara.
    if (!porFecha.has(d.fecha)) porFecha.set(d.fecha, d)
  }

  const usables = [...porFecha.values()]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, DIAS_VENTANA)

  if (usables.length < DIAS_MINIMOS) return null

  const suma = usables.reduce((acc, d) => acc + (d.total.porDia.kcal ?? 0), 0)
  return {
    ingestaKcal: Math.round(suma / usables.length),
    dias: usables.length,
    // El peor, no el promedio de los márgenes: una media que incluye un día
    // anotado a ojo no es más fiable que ese día.
    margenPct: Math.max(...usables.map((d) => d.total.margenPct)),
  }
}
