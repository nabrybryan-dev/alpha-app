import { comparablesPorHora, type AvisoDeHora } from './tanda'
import type { NivelCalidad } from './nucleo/analisis'

/**
 * Qué entra en la tendencia del historial, y qué tramos no se pueden comparar.
 *
 * ## Por qué el eje es el %PV y no la velocidad de la primera repetición
 *
 * La primera versión graficaba v₁ en m/s. **Ese dato no se guarda, y no por
 * descuido:** `VelocidadDeSerie` deja fuera a propósito la v₁ y el índice de
 * esfuerzo porque los dos dependen de la escala, y hoy la escala puede ir un
 * 14-24 % desviada — guardar eso sería guardar una conclusión falsa.
 *
 * Lo que sí se guarda es el **%PV**, y para una tendencia es mejor dato: es un
 * cociente entre dos velocidades de la MISMA serie, así que la escala se cancela
 * y **vale igual medido en píxeles por segundo**. No espera a que la prueba de
 * gravedad apruebe. Lo que se pierde es poder decir «va más rápido que hace un
 * mes»; lo que se gana es poder decir «llega igual de fatigado con más peso»,
 * que es lo que decide la programación.
 *
 * ## La condición que el %PV sí tiene
 *
 * El cociente se cancela **solo si la escala fue constante durante la serie**. Si
 * la referencia se movió entre la primera repetición y la última, queda
 * contaminado. Eso lo cubre el veredicto de calidad —a partir de 20° la toma sale
 * `referencia_torcida`— y por eso aquí no se inventa un segundo umbral: se filtra
 * por calidad y se enseña la inclinación como contexto.
 */

export interface TomaDelHistorial {
  fecha: string
  /** Pérdida de velocidad de la serie, en puntos porcentuales. */
  pvPct: number
  calidad: NivelCalidad
  /** La carga de esa serie. Un %PV a 100 kg y otro a 110 no dicen lo mismo. */
  cargaKg: number
  /** `false` = medido en píxeles por segundo. **No invalida el %PV**: es un
   *  cociente y la escala se cancela. Se guarda para poder decirlo, no para
   *  descartar la toma. */
  hayEscala?: boolean
  /** Inclinación máxima de la referencia durante la serie. Se enseña como
   *  contexto: es lo que puede contaminar el cociente. */
  inclinacionMax?: number
}

export interface TramoDelHistorial {
  desde: TomaDelHistorial
  hasta: TomaDelHistorial
  aviso: AvisoDeHora
  /** Alguna de las dos tomas no trae hora, así que la franja del día es
   *  desconocida y **el aviso de hora no se puede dar**. Ver `tieneHora`. */
  horaDesconocida: boolean
  /** La carga cambió entre las dos. Con %PV no invalida la comparación —al
   *  contrario, es el dato interesante— pero hay que decirlo: llegar al mismo
   *  %PV con más peso es progreso, y sin la carga a la vista parece estancamiento. */
  cargaCambio: boolean
}

/**
 * Los puntos que se pintan.
 *
 * Las descartadas **no aparecen**: su número es falso, y un punto falso en una
 * serie temporal no se distingue de uno real por la forma. Las dudosas sí se
 * pintan, en hueco, porque su número existe — pero no cuentan para la línea.
 */
export function puntosDelHistorial(tomas: TomaDelHistorial[]): TomaDelHistorial[] {
  return tomas
    .filter((t) => t.calidad !== 'descartada' && Number.isFinite(t.pvPct))
    .slice()
    .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
}

/** Las que sostienen la línea de tendencia. Solo buenas. */
export function tomasDeLaTendencia(tomas: TomaDelHistorial[]): TomaDelHistorial[] {
  return puntosDelHistorial(tomas).filter((t) => t.calidad === 'buena')
}

/**
 * Los tramos entre puntos consecutivos de la tendencia.
 *
 * Se compara cada toma con **la anterior**, no dos sueltas: con seis puntos hay
 * cinco comparaciones, y el aviso tiene que poder señalar cuál de los tramos es
 * el que no se sostiene. Un solo aviso para toda la gráfica diría que ninguna
 * pareja se compara, que casi nunca es verdad.
 */
/**
 * Si una fecha trae hora de verdad.
 *
 * **Hoy casi ninguna la trae, y por eso esto existe.** `SerieRegistrada` no
 * guarda cuándo se hizo: la fecha de un punto se deriva del `fechaInicio` del
 * microciclo más el día de la semana, y eso da un día a medianoche. Pasarle esa
 * medianoche a `comparablesPorHora` haría que TODAS las tomas cayeran en la misma
 * franja inventada y el aviso de hora saliera —o dejara de salir— por una hora
 * que nadie midió.
 *
 * Una medianoche exacta se trata como «sin hora» a propósito. Se pierde el caso
 * rarísimo de quien entrena a las 00:00 clavadas; se gana no inventar la franja
 * de todas las demás.
 */
export function tieneHora(fechaIso: string): boolean {
  if (!fechaIso.includes('T')) return false
  const d = new Date(fechaIso)
  if (Number.isNaN(d.getTime())) return false
  return d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0
}

export function tramosDelHistorial(tomas: TomaDelHistorial[]): TramoDelHistorial[] {
  const puntos = tomasDeLaTendencia(tomas)
  const tramos: TramoDelHistorial[] = []
  for (let i = 1; i < puntos.length; i++) {
    const desde = puntos[i - 1]
    const hasta = puntos[i]
    const horaDesconocida = !tieneHora(desde.fecha) || !tieneHora(hasta.fecha)
    tramos.push({
      desde,
      hasta,
      aviso: comparablesPorHora(desde.fecha, hasta.fecha),
      horaDesconocida,
      cargaCambio: desde.cargaKg !== hasta.cargaKg,
    })
  }
  return tramos
}

/**
 * El tramo que la pantalla señala, si hay alguno.
 *
 * Manda el **más reciente** que no se sostiene, y no el peor: el historial se
 * mira para decidir qué hacer ahora, y la comparación que importa es contra la
 * última toma. Entre los no comparables gana el que rompe del todo sobre el que
 * solo avisa.
 */
export function tramoQueSeñalar(tomas: TomaDelHistorial[]): TramoDelHistorial | undefined {
  // Sin hora no se señala nada: decir «una toma es de mañana y la otra de tarde»
  // sobre dos medianoches derivadas sería inventarse el motivo.
  const tramos = tramosDelHistorial(tomas).filter((t) => !t.horaDesconocida)
  for (let i = tramos.length - 1; i >= 0; i--) {
    if (!tramos[i].aviso.comparables) return tramos[i]
  }
  for (let i = tramos.length - 1; i >= 0; i--) {
    if (tramos[i].aviso.aviso) return tramos[i]
  }
  return undefined
}

/** Con menos de dos tomas buenas no hay tendencia que enseñar. */
export function hayTendencia(tomas: TomaDelHistorial[]): boolean {
  return tomasDeLaTendencia(tomas).length >= 2
}

/**
 * Si en la tendencia hay tomas a cargas distintas.
 *
 * No es un problema y por eso no es una negativa: **es el dato**. Llegar al mismo
 * %PV con más peso es exactamente el progreso que se busca. Pero la gráfica sola
 * no lo cuenta —dos puntos a la misma altura parecen estancamiento— así que la
 * pantalla tiene que poner las cargas al lado.
 */
export function cargasDeLaTendencia(tomas: TomaDelHistorial[]): number[] {
  return [...new Set(tomasDeLaTendencia(tomas).map((t) => t.cargaKg))].sort((a, b) => a - b)
}

/**
 * Las tomas medidas sin escala, que siguen valiendo.
 *
 * Se cuenta para poder decirlo, no para descartarlas: el %PV es un cociente y la
 * escala se cancela. Callarlo sería tan malo como descartarlas — quien mire la
 * gráfica tiene derecho a saber que parte de esos puntos salieron en píxeles por
 * segundo y que aun así son comparables.
 */
export function sinEscalaEnLaTendencia(tomas: TomaDelHistorial[]): number {
  return tomasDeLaTendencia(tomas).filter((t) => t.hayEscala === false).length
}

/**
 * De las series registradas del microciclo a los puntos de la gráfica.
 *
 * El tipo se declara aquí **estructuralmente** y no se importa de
 * `domain/types.ts` a propósito: así esta pantalla no se acopla al modelo del
 * asesorado, y el día que `VelocidadDeSerie` gane un campo no hay que tocar nada.
 * Lo que necesita la gráfica es lo que está escrito abajo, ni más ni menos.
 *
 * Una serie **sin `velocidad` no es un cero: es que no se grabó**, que hoy es lo
 * normal. Se salta, no se cuenta como pérdida nula — eso dibujaría una tendencia
 * plana inventada sobre las sesiones que nadie midió.
 */
export interface SerieConVelocidad {
  cargaKg: number
  velocidad?: {
    pvPct: number
    hayEscala: boolean
    calidad: string
    inclinacionMax?: number
  }
}

function nivel(calidad: string): NivelCalidad {
  return calidad === 'buena' || calidad === 'dudosa' || calidad === 'descartada'
    ? calidad
    : // Un veredicto que no reconocemos NO se asume bueno: se trata como dudoso,
      // que lo pinta pero lo deja fuera de la línea de tendencia.
      'dudosa'
}

export function tomasDeLasSeries(
  sesiones: Array<{ fecha: string; series: SerieConVelocidad[] }>,
): TomaDelHistorial[] {
  const tomas: TomaDelHistorial[] = []
  for (const s of sesiones) {
    for (const serie of s.series) {
      const v = serie.velocidad
      if (!v || !Number.isFinite(v.pvPct)) continue
      tomas.push({
        fecha: s.fecha,
        pvPct: v.pvPct,
        calidad: nivel(v.calidad),
        cargaKg: serie.cargaKg,
        hayEscala: v.hayEscala,
        inclinacionMax: v.inclinacionMax,
      })
    }
  }
  return tomas
}
