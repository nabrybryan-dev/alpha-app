/**
 * Lo que la pantalla de palancas necesita calcular, sin React y sin pintar nada.
 *
 * **No se llama `palancas.ts`**: convivía con `Palancas.tsx` y en Windows —donde
 * se desarrolla— el sistema de archivos no distingue mayúsculas, así que
 * `import … from './Palancas'` resolvía a ESTE archivo y el componente entraba
 * como `undefined`. El síntoma no señalaba al nombre: los 15 tests morían con
 * «Element type is invalid», que se lee como un export mal puesto.
 *
 * Vive aparte porque son las decisiones que NO pueden salir mal: el rango del eje,
 * dónde se corta una curva y cuál es la causa que manda. Un error aquí no se ve
 * como un error — se ve como una gráfica bonita con la escala mal.
 */

/** Un eje articular en un fotograma. Lo devuelve `brazo-por-fotograma.mjs`. */
export interface BrazoDeEje {
  mm: number
  /** Solo se ve un lado del cuerpo: el punto está fuera del plano sagital y su
   *  error es mayor. Se dice, no se disimula. */
  unLado: boolean
  /** El eje no se ve y se estima —el lumbar—. Arrastra su propia incertidumbre,
   *  que domina el modelo y no el píxel. */
  derivado: boolean
  sigmaExtraMm: number
  /** El fotograma se cayó por movimiento imposible. Es un hueco, no un dato. */
  salto?: boolean
}

export interface FotogramaBrazo {
  t: number
  ok: boolean
  motivo?: string
  brazos?: Record<string, BrazoDeEje>
  torsoGrados?: number
}

export interface CausasDescarte {
  sin_persona: number
  sin_carga: number
  sin_consenso: number
  sin_eje: number
  salto: number
}

export interface MedidaDePalancas {
  ok: boolean
  /** `ejercicio_no_aplica` cuando la línea de fuerza no la fija la gravedad
   *  —polea, muelle—. Viene del análisis: NO se deduce de las causas, porque un
   *  jalón en polea y un curl femoral tapado se parecen mucho en los contadores y
   *  no se parecen en nada en lo que hay que decirle a la persona. */
  motivo?: string
  explicacion?: string
  negativas: string[]
  escala: { mmPorPx: number; dispersion: number; fiable: boolean }
  sigmaArticulacionPx: number
  sigmaBrazoMm: number
  ejeObjetivo: string
  grupoObjetivo: string
  grupoObjetivoTexto?: string
  porFotograma: FotogramaBrazo[]
  medidos: number
  total: number
  descartadosPorSalto: number
  causas?: CausasDescarte
  maximoEje?: { mm: number; t: number; fraccion: number | null }
}

/** La sigma total de un eje: la del píxel más la del modelo, si la trae. */
export function sigmaDe(b: BrazoDeEje, sigmaBase: number): number {
  return sigmaBase + (b.sigmaExtraMm || 0)
}

/**
 * El rango del eje Y, calculado **incluyendo las bandas de error**.
 *
 * Es la diferencia entre una gráfica honesta y una que engaña: si el rango se
 * ajusta solo a los valores, una banda de ±44 se sale del lienzo y se recorta, y
 * justo la incertidumbre —el dato que decide si el número sirve— es lo que
 * desaparece de la vista.
 */
export function rangoConBandas(
  fotogramas: FotogramaBrazo[],
  ejes: string[],
  sigmaBase: number,
): { min: number; max: number } {
  let min = 0 // el cero SIEMPRE entra: un brazo negativo significa algo real
  let max = 0
  for (const f of fotogramas) {
    if (!f.ok || !f.brazos) continue
    for (const eje of ejes) {
      const b = f.brazos[eje]
      if (!b || b.salto || !Number.isFinite(b.mm)) continue
      const s = sigmaDe(b, sigmaBase)
      min = Math.min(min, b.mm - s)
      max = Math.max(max, b.mm + s)
    }
  }
  if (min === max) return { min: -10, max: 10 }
  const margen = (max - min) * 0.06
  return { min: min - margen, max: max + margen }
}

/**
 * Trocea la serie de un eje en tramos continuos.
 *
 * Un fotograma con `salto` o sin dato **corta** el trazado. No se interpola nunca:
 * unir los dos extremos dibujaría un brazo de momento que nadie midió, y sería
 * indistinguible de uno real.
 */
export function tramosDeEje(
  fotogramas: FotogramaBrazo[],
  eje: string,
): Array<Array<{ t: number; mm: number; sigmaExtraMm: number }>> {
  const tramos: Array<Array<{ t: number; mm: number; sigmaExtraMm: number }>> = []
  let actual: Array<{ t: number; mm: number; sigmaExtraMm: number }> = []
  for (const f of fotogramas) {
    const b = f.ok ? f.brazos?.[eje] : undefined
    if (!b || b.salto || !Number.isFinite(b.mm)) {
      if (actual.length) tramos.push(actual)
      actual = []
      continue
    }
    actual.push({ t: f.t, mm: b.mm, sigmaExtraMm: b.sigmaExtraMm || 0 })
  }
  if (actual.length) tramos.push(actual)
  return tramos
}

/** Los instantes donde se cayó un fotograma por salto: se rotulan como hueco. */
export function huecosPorSalto(fotogramas: FotogramaBrazo[], eje: string): number[] {
  return fotogramas.filter((f) => f.ok && f.brazos?.[eje]?.salto).map((f) => f.t)
}

/**
 * Cuál de las causas manda, que es lo que decide **qué frase se puede decir**.
 *
 * No es estadística por gusto: con el grueso en `sin_consenso` la pantalla puede
 * decir «no lo va a haber por mucho que repitas con esta máquina», porque los dos
 * detectores discrepan y eso significa que algo tapa la articulación. Si el grueso
 * fuera `sin_persona` o `sin_carga`, la misma pantalla tiene que decir lo
 * contrario: **vuelve a encuadrar y repite**, porque eso sí se arregla.
 *
 * Decir la frase equivocada aquí es peor que no decir ninguna: manda a la persona
 * a repetir una toma que nunca va a salir, o la deja sin repetir una que sí.
 */
export type Remedio = 'no_se_arregla' | 'encuadre' | 'desconocido'

export function causaDominante(
  causas?: CausasDescarte,
): { causa: keyof CausasDescarte; n: number; remedio: Remedio } | undefined {
  if (!causas) return undefined
  const entradas = Object.entries(causas) as Array<[keyof CausasDescarte, number]>
  const conteo = entradas.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  if (!conteo.length) return undefined
  const [causa, n] = conteo[0]
  const remedio: Remedio =
    causa === 'sin_consenso'
      ? 'no_se_arregla'
      : causa === 'sin_persona' || causa === 'sin_carga'
        ? 'encuadre'
        : 'desconocido'
  return { causa, n, remedio }
}
