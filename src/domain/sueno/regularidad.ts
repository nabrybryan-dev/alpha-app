/**
 * Índice de regularidad del sueño, a partir de las dos horas que registra el
 * check-in.
 *
 * Qué mide: si a cada minuto del día estabas en el mismo estado —dormido o
 * despierto— que a esa misma hora el día anterior. Sale un número del 0 al 100
 * donde 100 es «todos los días igual» y 0 es «cada día distinto». Es el índice
 * publicado en 2024 con unas 60.000 personas, donde predijo mortalidad mejor
 * que las horas dormidas.
 *
 * **Lo que NO es**, y conviene decirlo antes de que alguien lo confunda: aquello
 * se midió con acelerómetro en la muñeca, minuto a minuto. Esto sale de dos
 * horas que la persona escribe de memoria, así que no ve las siestas, ni los
 * despertares de la noche, ni la diferencia entre estar en la cama y estar
 * dormido. Es la misma cuenta sobre un dato más pobre, y por eso lo que se
 * enseña es la tendencia, no el decimal.
 *
 * Y lo que este archivo NO hace a propósito: **no recomienda una hora de
 * despertar**. Las calculadoras de ciclos de 90 minutos no tienen base — los
 * ciclos reales van de 80 a 150 minutos y cambian dentro de la misma noche.
 */

const MINUTOS_DIA = 1440

export interface NocheRegistrada {
  /** Día del check-in, `YYYY-MM-DD`. */
  fecha: string
  /** `HH:MM` locales. Si falta cualquiera de las dos, la noche no cuenta. */
  horaAcostarse?: string
  horaLevantarse?: string
}

export type Regularidad =
  | { estado: 'sin-datos'; nochesConDato: number; motivo: string }
  | { estado: 'medido'; indice: number; nochesConDato: number; diasComparados: number }

/** Noches con las dos horas que hacen falta antes de dar un número. */
export const NOCHES_MINIMAS = 7

function aMinutos(hhmm: string | undefined): number | undefined {
  if (!hhmm) return undefined
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return undefined
  return h * 60 + min
}

function indiceDeDia(fecha: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim())
  if (!m) return undefined
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(t) ? undefined : Math.round(t / 86_400_000)
}

interface Tramo {
  /** Minutos absolutos desde el día 0, dormido en [inicio, fin). */
  inicio: number
  fin: number
  dia: number
}

/**
 * La convención, que hay que escribirla porque no es obvia: el check-in del día
 * D describe **la noche que terminó esa mañana**. O sea que la hora de
 * levantarse cae en D y la de acostarse en la víspera. Si se leyera al revés,
 * toda la serie quedaría corrida un día y el índice compararía noches que no
 * son vecinas.
 */
function tramoDe(noche: NocheRegistrada): Tramo | undefined {
  const dia = indiceDeDia(noche.fecha)
  const acostarse = aMinutos(noche.horaAcostarse)
  const levantarse = aMinutos(noche.horaLevantarse)
  if (dia === undefined || acostarse === undefined || levantarse === undefined) return undefined
  const duracion = (levantarse - acostarse + MINUTOS_DIA) % MINUTOS_DIA
  // Dormir 0 minutos no es una noche: es un formulario mal rellenado.
  if (duracion === 0) return undefined
  const fin = dia * MINUTOS_DIA + levantarse
  return { inicio: fin - duracion, fin, dia }
}

function dormidoEn(minuto: number, tramos: Tramo[]): boolean {
  return tramos.some((t) => minuto >= t.inicio && minuto < t.fin)
}

/**
 * Calcula el índice. Devuelve **`sin-datos`, nunca un cero**, cuando no hay
 * material: un cero significa «te acuestas a una hora distinta cada día», que
 * es una acusación, y no es lo mismo que «no lo sabemos».
 */
export function regularidadDelSueno(noches: NocheRegistrada[]): Regularidad {
  const tramos = noches.map(tramoDe).filter((t): t is Tramo => t !== undefined)
  const nochesConDato = tramos.length

  if (nochesConDato < NOCHES_MINIMAS) {
    return {
      estado: 'sin-datos',
      nochesConDato,
      motivo: `llevas ${nochesConDato} de ${NOCHES_MINIMAS} noches registradas`,
    }
  }

  const dias = [...new Set(tramos.map((t) => t.dia))].sort((a, b) => a - b)

  // Un día natural solo está COMPLETO si conocemos su mañana (la noche que
  // terminó ese día) y su noche (la que termina al día siguiente). Con un hueco
  // en medio no se puede suponer que estaba despierto: suponerlo inflaría el
  // parecido entre días y el índice saldría mejor de lo que es.
  const completos = dias.filter((d) => dias.includes(d + 1))

  let iguales = 0
  let comparados = 0
  let paresDeDias = 0
  for (const d of completos) {
    if (!completos.includes(d + 1)) continue
    paresDeDias += 1
    for (let m = 0; m < MINUTOS_DIA; m += 1) {
      const hoy = dormidoEn(d * MINUTOS_DIA + m, tramos)
      const manana = dormidoEn((d + 1) * MINUTOS_DIA + m, tramos)
      if (hoy === manana) iguales += 1
      comparados += 1
    }
  }

  if (comparados === 0) {
    return {
      estado: 'sin-datos',
      nochesConDato,
      motivo: 'las noches registradas no son seguidas, y el índice compara días vecinos',
    }
  }

  const acuerdo = iguales / comparados
  // La fórmula publicada: 100 = idéntico, 0 = al azar. Puede dar negativo con
  // series muy cortas y contrarias; se recorta en 0 porque «peor que el azar»
  // no significa nada para quien lo lee.
  const indice = Math.max(0, Math.min(100, Math.round(200 * acuerdo - 100)))

  return { estado: 'medido', indice, nochesConDato, diasComparados: paresDeDias }
}
