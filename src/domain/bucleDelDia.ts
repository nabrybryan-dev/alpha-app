import { bandaPrs } from './ondulacion'
import { aflojar, esAlFallo, type ObjetivoDeIntensidad } from './objetivoDeIntensidad'
import type { EjercicioPrescrito } from './types'

/**
 * El bucle del día — la ondulación flexible intra-semana, EN SOMBRA.
 *
 * ## De dónde sale
 *
 * Del supuesto aprobado por el coach el 2026-08-25
 * (`Cerebro Alpha/docs/superpowers/specs/2026-08-25-ondulacion-flexible-intra-semana.md`).
 * Su idea central, con sus palabras: **la discrepancia entre lo pautado y lo
 * hecho no es un error, es la medida del día** — lo pautado se escribió con la
 * información de hace una semana, y la resta lleva dentro lo que la prescripción
 * no podía saber: sueño, estrés, comida, ánimo.
 *
 * ## Qué decide y qué no
 *
 * Este módulo decide **cuál de dos caminos ya escritos se pisa** — nunca inventa
 * un ajuste. Los escenarios (verde con techo, rojo con suelo) los autoriza el
 * coach por adelantado en la prescripción; aquí solo vive el cruce:
 *
 * | Rendimiento | Contexto | Escenario |
 * |---|---|---|
 * | por encima | bueno | `verde` |
 * | por debajo | malo | `rojo` |
 * | cualquier otra combinación | | `ninguno` — se observa |
 *
 * **La señal es el cruce, nunca el número solo.** Un mal día con check-in limpio
 * no dispara nada: puede ser una máquina distinta, o alguien que sencillamente
 * puede más (el caso de la prensa del 25/08 iba 45 % por encima con PRS 9 — eso
 * no es fatiga, es una frase fosilizada, y lo diagnostica el agente de
 * discrepancia, no este bucle).
 *
 * ## Por qué está en sombra
 *
 * El despliegue pactado (§7 del supuesto) empieza calculando **sin enseñar**: un
 * microciclo entero guardando qué escenario se habría pisado cada día, y el
 * cierre compara si esos ajustes habrían reducido la discrepancia o la habrían
 * perseguido. El número manda. Hasta entonces, nada de esto llega a una
 * pantalla — el módulo está declarado en MODULOS_SIN_ENCHUFAR.
 */

/** El umbral del coach: «más de un veinte por ciento» (2026-08-25). */
export const DISCREPANCIA_GRANDE = 0.2

export type Rendimiento = 'por_encima' | 'en_linea' | 'por_debajo' | 'sin_registro'
export type Contexto = 'bueno' | 'malo' | 'neutro' | 'sin_datos'
export type Escenario = 'verde' | 'rojo' | 'ninguno'

/**
 * El check-in del día, tal como lo guarda la tabla `checkins` (jsonb `datos`).
 * Todo opcional: ausente significa «no reportó», nunca «está mal».
 */
export interface CheckinDelDia {
  horasSueno?: number
  calidadSueno?: string
  estres?: string
  cansancio?: string
  motivacion?: string
}

export interface SenalesDelDia {
  checkin?: CheckinDelDia
  /** PRS de entrada del test post-sesión (1-10), si la sesión ya lo trae. */
  prsEntrada?: number
}

/**
 * Cómo rindió un ejercicio HOY contra lo que tenía pautado.
 *
 * Dos señales, y basta una para cada dirección:
 *
 * - **La carga**: la media de lo registrado contra la pautada, con el umbral
 *   del coach (>20 %).
 * - **El RIR**: quedarse 2+ repeticiones más lejos del fallo que lo pedido es ir
 *   por encima (sobró fuerza); 2+ más cerca es ir por debajo (faltó).
 *
 * Con el objetivo en FALLO el RIR no informa (una parcial no es una repetición
 * en reserva — ver `objetivoDeIntensidad.ts`), así que ahí decide solo la carga.
 */
export function rendimientoDelDia(ejercicio: EjercicioPrescrito): Rendimiento {
  const conCarga = ejercicio.series.filter((s) => s.cargaKg > 0)
  if (conCarga.length === 0) return 'sin_registro'

  const cargaPautada =
    ejercicio.seriesPrescritas && ejercicio.seriesPrescritas.length > 0
      ? ejercicio.seriesPrescritas.reduce((a, s) => a + s.cargaKg, 0) / ejercicio.seriesPrescritas.length
      : ejercicio.cargaKg

  let porCarga: Rendimiento = 'en_linea'
  if (typeof cargaPautada === 'number' && cargaPautada > 0) {
    const media = conCarga.reduce((a, s) => a + s.cargaKg, 0) / conCarga.length
    const desvio = (media - cargaPautada) / cargaPautada
    if (desvio > DISCREPANCIA_GRANDE) porCarga = 'por_encima'
    if (desvio < -DISCREPANCIA_GRANDE) porCarga = 'por_debajo'
  }

  let porRir: Rendimiento = 'en_linea'
  const objetivo = ejercicio.rirObjetivo
  if (!esAlFallo(objetivo)) {
    const conRir = ejercicio.series.filter((s) => typeof s.rir === 'number')
    if (conRir.length > 0) {
      const media = conRir.reduce((a, s) => a + (s.rir as number), 0) / conRir.length
      if (media - objetivo >= 2) porRir = 'por_encima'
      if (objetivo - media >= 2) porRir = 'por_debajo'
    }
  }

  // Si las dos señales apuntan a lados contrarios, no se afirma nada.
  if (porCarga === 'por_encima' && porRir === 'por_debajo') return 'en_linea'
  if (porCarga === 'por_debajo' && porRir === 'por_encima') return 'en_linea'
  if (porCarga !== 'en_linea') return porCarga
  return porRir
}

/**
 * El contexto del día, desde el check-in y el PRS de entrada.
 *
 * `malo` con UNA señal roja basta (la fatiga no necesita unanimidad); `bueno`
 * exige que lo reportado esté bien Y que no falte lo esencial. Sin nada
 * reportado, `sin_datos` — que no es `neutro`: neutro es «reportó y está
 * normal», sin_datos es «no se sabe», y confundirlos es inventar el porqué.
 */
export function contextoDelDia(senales: SenalesDelDia): Contexto {
  const c = senales.checkin
  const prs = senales.prsEntrada
  if (!c && prs === undefined) return 'sin_datos'

  const banda = prs === undefined ? undefined : bandaPrs(prs)
  const malas: boolean[] = [
    banda === 'rojo' || banda === 'critico',
    c?.horasSueno !== undefined && c.horasSueno <= 5,
    (c?.calidadSueno ?? '').toUpperCase() === 'MALA',
    (c?.estres ?? '').toUpperCase() === 'MUCHO',
    (c?.cansancio ?? '').toUpperCase() === 'MUCHO',
  ]
  if (malas.some(Boolean)) return 'malo'

  const buenas: boolean[] = [
    banda === undefined || banda === 'verde',
    c?.horasSueno === undefined || c.horasSueno >= 7,
    (c?.calidadSueno ?? 'BUENA').toUpperCase() === 'BUENA',
    (c?.estres ?? 'POCO').toUpperCase() === 'POCO',
  ]
  return buenas.every(Boolean) ? 'bueno' : 'neutro'
}

export interface EscenarioDelDia {
  escenario: Escenario
  rendimiento: Rendimiento
  contexto: Contexto
  /** I-14: siempre se dice por qué, también cuando no se hace nada. */
  motivo: string
}

/** El cruce. Es TODO el algoritmo, y que quepa en una tabla es la garantía. */
export function escenarioDelDia(
  ejercicio: EjercicioPrescrito,
  senales: SenalesDelDia,
): EscenarioDelDia {
  const rendimiento = rendimientoDelDia(ejercicio)
  const contexto = contextoDelDia(senales)

  if (rendimiento === 'sin_registro') {
    return {
      escenario: 'ninguno', rendimiento, contexto,
      motivo: 'Sin series registradas no hay rendimiento que cruzar: la rama es ondular a ciegas, no este bucle.',
    }
  }
  if (contexto === 'sin_datos') {
    return {
      escenario: 'ninguno', rendimiento, contexto,
      motivo: 'Sin check-in ni PRS del día. La señal es el cruce, y falta la mitad: se observa.',
    }
  }
  if (rendimiento === 'por_encima' && contexto === 'bueno') {
    return {
      escenario: 'verde', rendimiento, contexto,
      motivo: 'Rendimiento por encima con contexto bueno: el siguiente escalón ya autorizado, sin pasar el techo.',
    }
  }
  if (rendimiento === 'por_debajo' && contexto === 'malo') {
    return {
      escenario: 'rojo', rendimiento, contexto,
      motivo: 'Rendimiento por debajo con contexto malo: se suelta RIR sin bajar del suelo escrito.',
    }
  }
  const contradice =
    (rendimiento === 'por_encima' && contexto === 'malo') ||
    (rendimiento === 'por_debajo' && contexto === 'bueno')
  return {
    escenario: 'ninguno', rendimiento, contexto,
    motivo: contradice
      ? `Rendimiento ${rendimiento} con contexto ${contexto}: no concuerdan. Se anota la contradicción para el cierre, no se toca nada.`
      : 'Sin cruce que lo justifique: se ejecuta lo pautado.',
  }
}

export interface SesionRestante {
  nombre: string
  grupos: string[]
  /** Los axiales no entran nunca al escenario verde (bajar el rango ES subir el peso). */
  esAxial?: boolean
}

/**
 * La regla del martes: si HOY salió rojo, ¿qué sesiones restantes de la MISMA
 * semana arrancan ya en rojo?
 *
 * Tres candados, del supuesto §3:
 *
 * 1. **Solo propaga la fatiga.** El verde nunca viaja — que hoy sobrara fuerza
 *    no promete nada de mañana; la frescura se comprueba cada día.
 * 2. **Por solapamiento de grupos.** Pierna de lunes alcanza a pierna o bisagra
 *    del martes; al press banca no le debe nada.
 * 3. La propagación exige que el rojo de hoy viniera de contexto REAL — este
 *    módulo solo la calcula cuando `escenario === 'rojo'`, que por construcción
 *    ya exige contexto malo.
 */
export function reglaDelMartes(
  hoy: EscenarioDelDia,
  gruposDeHoy: string[],
  restantes: SesionRestante[],
): string[] {
  if (hoy.escenario !== 'rojo') return []
  const tocados = new Set(gruposDeHoy.map((g) => g.toUpperCase()))
  return restantes
    .filter((s) => s.grupos.some((g) => tocados.has(g.toUpperCase())))
    .map((s) => s.nombre)
}

// ─────────────────────────────────────────────────────────────────────────────
// Aplicar el escenario — aprobado por el coach el 2026-08-25 («Aprobado»)
// ─────────────────────────────────────────────────────────────────────────────

/** La propuesta concreta del bucle para la PRÓXIMA vez que toque este ejercicio. */
export interface AjusteDelDia {
  escenario: Escenario
  /** Carga propuesta. Sin definir: la carga no se toca. */
  cargaKg?: number
  /** Series propuestas. Sin definir: las series no se tocan. */
  sets?: number
  /** Objetivo de intensidad propuesto. Sin definir: no se toca. */
  rirObjetivo?: ObjetivoDeIntensidad
  motivo: string
}

/**
 * Convierte la decisión del cruce en el ajuste concreto — SOLO por los caminos
 * que el coach dejó escritos.
 *
 * Tres reglas que no se negocian:
 *
 * 1. **Sin `escenarios` en la prescripción no hay ajuste**, valga lo que valga
 *    el cruce. La pre-autorización es el mecanismo, no un adorno: un bucle que
 *    ajusta sin camino escrito es exactamente el bucle que este diseño prohíbe.
 * 2. **El techo del verde es un techo.** La carga propuesta se recorta a
 *    `techoCargaKg`, y si ya está ahí, el verde no propone nada — lo dice.
 * 3. **El rojo afloja con `aflojar`, nunca sumando**, porque el objetivo puede
 *    ser `FALLO` y el escalón de debajo del fallo es RIR 0, no «FALLO+1».
 */
export function aplicarEscenario(
  ejercicio: EjercicioPrescrito,
  decision: EscenarioDelDia,
): AjusteDelDia {
  const sinCambio = (motivo: string): AjusteDelDia => ({ escenario: decision.escenario, motivo })

  if (decision.escenario === 'ninguno') return sinCambio(decision.motivo)
  if (!ejercicio.escenarios) {
    return sinCambio(
      `El cruce dio ${decision.escenario}, pero el ejercicio no trae escenarios escritos: ` +
        'sin camino autorizado no hay ajuste. Se anota para que el coach decida si escribirlos.',
    )
  }

  if (decision.escenario === 'verde') {
    const v = ejercicio.escenarios.verde
    const base = ejercicio.cargaKg
    let cargaKg: number | undefined
    if (typeof base === 'number' && typeof v.deltaCargaKg === 'number') {
      const subida = Math.min(base + v.deltaCargaKg, v.techoCargaKg)
      if (subida > base) cargaKg = subida
    }
    const sets = v.serieExtra ? ejercicio.sets + 1 : undefined
    if (cargaKg === undefined && sets === undefined) {
      return sinCambio(
        typeof base === 'number' && base >= v.techoCargaKg
          ? `Verde autorizado pero la carga ya está en el techo (${v.techoCargaKg} kg): no se propone nada.`
          : 'Verde autorizado pero el escenario no define ni delta de carga ni serie extra.',
      )
    }
    return {
      escenario: 'verde',
      cargaKg,
      sets,
      motivo:
        `Día bueno con rendimiento por encima: se pisa el escalón autorizado` +
        (cargaKg !== undefined ? ` (${cargaKg} kg, techo ${v.techoCargaKg})` : '') +
        (sets !== undefined ? ` con serie extra (${sets})` : '') +
        '.',
    }
  }

  const r = ejercicio.escenarios.rojo
  const rirObjetivo = aflojar(ejercicio.rirObjetivo, r.deltaRir)
  const sets = r.quitarUltimaSerie ? Math.max(1, ejercicio.sets - 1) : undefined
  return {
    escenario: 'rojo',
    rirObjetivo,
    sets,
    motivo:
      `Día malo con rendimiento por debajo: se suelta el esfuerzo (RIR +${r.deltaRir}` +
      (sets !== undefined ? `, una serie menos` : '') +
      `). El suelo escrito del ejercicio es RIR ${r.sueloRir}.`,
  }
}
