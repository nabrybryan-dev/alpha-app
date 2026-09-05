import { aplicarEscenario, escenarioDelDia, type SenalesDelDia } from './bucleDelDia'
import { esAlFallo } from './objetivoDeIntensidad'
import type { CheckinDiario, EjercicioPrescrito, Microciclo, Sesion } from './types'
import { fechaDeLaSesion } from './corridaEnSombra'

/**
 * El segundo hemisferio del §7.1: **¿el ajuste habría acercado el plan a lo que
 * la persona hizo, o lo habría perseguido?**
 *
 * ## La pregunta contrafactual que NO se hace, y por qué
 *
 * La tentación es preguntar «¿qué habría pasado si el plan hubiera sido otro?».
 * Eso no se puede saber: la persona no ejecutó ese plan. Cualquier número que
 * salga de ahí es una simulación de una conducta que nadie observó.
 *
 * Lo que sí se puede medir, y es lo que mide esto:
 *
 * > El bucle propone un ajuste el día D **para la próxima vez que toque ese
 * > ejercicio**. Esa próxima vez ocurrió de verdad, y ocurrió **bajo la
 * > prescripción original**. Así que se compara, con datos reales de los dos
 * > lados: ¿la carga ajustada se parecía más a lo que la persona movió, o menos?
 *
 *     |ajustado(D) − ejecutado(D+1)|   contra   |original(D+1) − ejecutado(D+1)|
 *
 * Si la primera es menor, el ajuste **acercaba**. Si es mayor, **alejaba**.
 *
 * ## El límite, dicho antes de que nadie lo use como si no existiera
 *
 * Si la persona hubiera VISTO el plan ajustado, quizá habría hecho otra cosa. La
 * comparación no lo captura y no puede. Lo que dice este número es más modesto y
 * sigue siendo útil: **la prescripción ajustada describe mejor a esta persona que
 * la original**. Es una condición necesaria para que el bucle sirva, no una
 * prueba de que sirva.
 *
 * ## Las dos variantes, y esto es una deuda que se paga aquí
 *
 * Bryan eligió el 2026-09-04 que el día malo **además recorte la última serie**,
 * sabiendo el precio: con dos palancas moviéndose a la vez no se puede separar
 * cuál ayudó. En sombra separar es gratis, así que se mide con recorte y sin él.
 *
 * **Y aquí apareció algo que no estaba en el plan: el rojo NUNCA mueve kilos.**
 * `aplicarEscenario` le toca el RIR y las series, no la carga — así que una
 * comparación en kg no puede medir el camino rojo por mucho que se corra dos
 * veces. Lo destapó el mutador: quitarle la palanca del recorte no cambiaba ni
 * un número, o sea que el check no protegía nada.
 *
 * Por eso el rojo tiene **su propia vara: las SERIES**. Misma pregunta y mismo
 * método —¿el número ajustado se parecía más a lo que la persona hizo la vez
 * siguiente?— contando series en vez de kilos. Sin esto, la decisión de Bryan
 * sería inmedible y el informe daría un silencio con pinta de resultado.
 */

export interface BalanceDeUnPar {
  ejercicio: string
  categoria: string
  /** El escenario que el bucle habría pisado el día D. */
  escenario: 'verde' | 'rojo'
  cargaOriginal: number
  cargaAjustada: number
  cargaEjecutadaDespues: number
  errorOriginal: number
  errorAjustado: number
  /** `true` si el ajuste dejaba la prescripción MÁS cerca de lo que hizo. */
  acerca: boolean
}

/** El mismo par, pero contando SERIES. Es la vara del camino rojo. */
export interface BalanceDeUnParDeSeries {
  ejercicio: string
  seriesOriginales: number
  seriesAjustadas: number
  seriesHechasDespues: number
  acerca: boolean
}

export interface BalanceDeLaSombra {
  /** Pares (día D, siguiente vez que tocó ese ejercicio) que se pudieron medir. */
  paresMedidos: number
  acercan: number
  alejan: number
  empatan: number
  /** Media de |original − ejecutado| y de |ajustado − ejecutado|, en kg. */
  errorMedioOriginal: number
  errorMedioAjustado: number
  /** Lo mismo, en % de la carga original. Es lo que el coach pidió medir. */
  discrepanciaMediaOriginalPct: number
  discrepanciaMediaAjustadaPct: number
  pares: BalanceDeUnPar[]
  /** El camino ROJO, medido en series: es la única vara que lo alcanza. */
  series: {
    paresMedidos: number
    acercan: number
    alejan: number
    empatan: number
    pares: BalanceDeUnParDeSeries[]
  }
  /** Por qué no se pudo medir, cuando no se pudo. */
  descartados: { sinSiguiente: number; sinEscaleras: number; sinAjusteDeCarga: number }
}

const VACIO: BalanceDeLaSombra = {
  paresMedidos: 0, acercan: 0, alejan: 0, empatan: 0,
  errorMedioOriginal: 0, errorMedioAjustado: 0,
  discrepanciaMediaOriginalPct: 0, discrepanciaMediaAjustadaPct: 0,
  pares: [], series: { paresMedidos: 0, acercan: 0, alejan: 0, empatan: 0, pares: [] },
  descartados: { sinSiguiente: 0, sinEscaleras: 0, sinAjusteDeCarga: 0 },
}

/** La carga media que la persona movió de verdad en ese ejercicio. */
function cargaEjecutada(e: EjercicioPrescrito): number | undefined {
  const conCarga = e.series.filter((s) => s.cargaKg > 0)
  if (conCarga.length === 0) return undefined
  return conCarga.reduce((a, s) => a + s.cargaKg, 0) / conCarga.length
}

function senalesDe(sesion: Sesion, checkins: readonly CheckinDiario[]): SenalesDelDia {
  const { fecha } = fechaDeLaSesion(sesion)
  const c = fecha ? checkins.find((x) => x.fecha === fecha) : undefined
  return {
    checkin: c && {
      horasSueno: c.horasSueno, calidadSueno: c.calidadSueno,
      estres: c.estres, cansancio: c.cansancio, motivacion: c.motivacion,
    },
    prsEntrada: sesion.testPost?.prsEntrada,
  }
}

/**
 * Todas las apariciones de cada ejercicio, en orden temporal.
 *
 * Se empareja **por nombre dentro de la misma persona**, que es lo mismo que hace
 * el clonador de microciclos: el `id` cambia entre microciclos y el nombre no.
 * Hereda su límite conocido —dos ejercicios con el mismo nombre en la misma
 * semana— y por eso esos se descartan en vez de emparejarse a ciegas.
 */
function aparicionesPorEjercicio(
  microciclos: readonly Microciclo[],
): Map<string, { micro: number; sesion: Sesion; ejercicio: EjercicioPrescrito }[]> {
  const mapa = new Map<string, { micro: number; sesion: Sesion; ejercicio: EjercicioPrescrito }[]>()
  const ambiguos = new Set<string>()

  for (const m of [...microciclos].sort((a, b) => a.numero - b.numero)) {
    const vistosEnEsteMicro = new Set<string>()
    for (const sesion of [...(m.sesiones ?? [])].sort((a, b) => a.orden - b.orden)) {
      for (const ejercicio of sesion.ejercicios) {
        const clave = (ejercicio.nombre ?? '').trim().toUpperCase()
        if (!clave) continue
        if (vistosEnEsteMicro.has(clave)) ambiguos.add(clave)
        vistosEnEsteMicro.add(clave)
        if (!mapa.has(clave)) mapa.set(clave, [])
        mapa.get(clave)!.push({ micro: m.numero, sesion, ejercicio })
      }
    }
  }
  for (const clave of ambiguos) mapa.delete(clave)
  return mapa
}

export function balanceDeLaSombra(
  microciclos: readonly Microciclo[],
  checkins: readonly CheckinDiario[],
  opciones: { conRecorteDeSerie?: boolean } = {},
): BalanceDeLaSombra {
  const pares: BalanceDeUnPar[] = []
  const paresSeries: BalanceDeUnParDeSeries[] = []
  const descartados = { sinSiguiente: 0, sinEscaleras: 0, sinAjusteDeCarga: 0 }

  for (const apariciones of aparicionesPorEjercicio(microciclos).values()) {
    for (let i = 0; i < apariciones.length; i += 1) {
      const hoy = apariciones[i]
      const decision = escenarioDelDia(hoy.ejercicio, senalesDe(hoy.sesion, checkins))
      if (decision.escenario === 'ninguno') continue

      if (!hoy.ejercicio.escenarios) {
        descartados.sinEscaleras += 1
        continue
      }
      const siguiente = apariciones[i + 1]
      if (!siguiente) {
        descartados.sinSiguiente += 1
        continue
      }

      const ejercicioParaAjuste = opciones.conRecorteDeSerie
        ? hoy.ejercicio
        : // Sin recorte: se le quita al escenario rojo esa palanca, para poder
          // ver el efecto de aflojar el RIR por separado. Es la deuda que dejó
          // la decisión de Bryan del 4-sep, pagada aquí.
          {
            ...hoy.ejercicio,
            escenarios: {
              ...hoy.ejercicio.escenarios,
              rojo: { ...hoy.ejercicio.escenarios.rojo, quitarUltimaSerie: false },
            },
          }
      const ajuste = aplicarEscenario(ejercicioParaAjuste, decision)

      // LA VARA DEL ROJO: series. Se recoge aquí, antes del corte de la carga,
      // porque el rojo nunca llega a proponer kilos y si no se mide aquí no se
      // mide en ningún sitio.
      const seriesHechas = siguiente.ejercicio.series.filter((s) => s.cargaKg > 0).length
      if (typeof ajuste.sets === 'number' && siguiente.ejercicio.sets > 0 && seriesHechas > 0) {
        const errOrig = Math.abs(siguiente.ejercicio.sets - seriesHechas)
        const errAjus = Math.abs(ajuste.sets - seriesHechas)
        paresSeries.push({
          ejercicio: hoy.ejercicio.nombre,
          seriesOriginales: siguiente.ejercicio.sets,
          seriesAjustadas: ajuste.sets,
          seriesHechasDespues: seriesHechas,
          acerca: errAjus < errOrig,
        })
      }

      // Solo se puede comparar en kg lo que propone kg. Un rojo que solo suelta
      // RIR no mueve la carga, y meterlo aquí como «error cero» diría que acertó
      // cuando lo que pasa es que no opinó.
      if (typeof ajuste.cargaKg !== 'number') {
        descartados.sinAjusteDeCarga += 1
        continue
      }

      const original = siguiente.ejercicio.cargaKg
      const hecho = cargaEjecutada(siguiente.ejercicio)
      if (typeof original !== 'number' || original <= 0 || hecho === undefined) {
        descartados.sinSiguiente += 1
        continue
      }
      if (esAlFallo(siguiente.ejercicio.rirObjetivo)) continue

      const errorOriginal = Math.abs(original - hecho)
      const errorAjustado = Math.abs(ajuste.cargaKg - hecho)
      pares.push({
        ejercicio: hoy.ejercicio.nombre,
        categoria: hoy.ejercicio.categoria,
        escenario: decision.escenario,
        cargaOriginal: original,
        cargaAjustada: ajuste.cargaKg,
        cargaEjecutadaDespues: Math.round(hecho * 100) / 100,
        errorOriginal: Math.round(errorOriginal * 100) / 100,
        errorAjustado: Math.round(errorAjustado * 100) / 100,
        acerca: errorAjustado < errorOriginal,
      })
    }
  }

  const series = {
    paresMedidos: paresSeries.length,
    acercan: paresSeries.filter((p) => p.acerca).length,
    alejan: paresSeries.filter((p) => !p.acerca && p.seriesAjustadas !== p.seriesOriginales).length,
    empatan: paresSeries.filter((p) => p.seriesAjustadas === p.seriesOriginales).length,
    pares: paresSeries,
  }

  if (pares.length === 0) return { ...VACIO, series, descartados }

  const media = (f: (p: BalanceDeUnPar) => number) =>
    Math.round((pares.reduce((a, p) => a + f(p), 0) / pares.length) * 100) / 100

  return {
    paresMedidos: pares.length,
    // Se cuenta LEYENDO `p.acerca`, no recalculando la resta. Tenerla en dos
    // sitios hacia que el campo del par no lo comprobara nadie: la mutacion que
    // lo invertia sobrevivia entera porque el resumen no lo miraba.
    acercan: pares.filter((p) => p.acerca).length,
    alejan: pares.filter((p) => !p.acerca && p.errorAjustado !== p.errorOriginal).length,
    empatan: pares.filter((p) => p.errorAjustado === p.errorOriginal).length,
    errorMedioOriginal: media((p) => p.errorOriginal),
    errorMedioAjustado: media((p) => p.errorAjustado),
    discrepanciaMediaOriginalPct: media((p) => (100 * p.errorOriginal) / p.cargaOriginal),
    discrepanciaMediaAjustadaPct: media((p) => (100 * p.errorAjustado) / p.cargaOriginal),
    pares,
    series,
    descartados,
  }
}
