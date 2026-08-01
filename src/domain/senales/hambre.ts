/**
 * Si el hambre sostenida ya cumplió su umbral de días para actuar.
 *
 * POR QUÉ EXISTE. La regla del Cerebro decía «hambre sostenida» sin un número:
 * «varios días», «patrón sostenido». La nutricionista puso el número, y depende
 * de cuán intensa sea:
 *
 *     hambre   cómo se vive                                    días para actuar
 *     1-3      molesta, pero se lleva                                21
 *     4-6      cuesta, distrae                                       10
 *     7-8      interfiere con el trabajo o el entreno                 5
 *     9-10     no la puede sostener, fatiga, no se concentra          2
 *
 * ESTO NO DECIDE QUÉ HACER. Aflojar el déficit o cribar riesgo es decisión de
 * la nutricionista. Aquí solo se contesta una pregunta más angosta: ¿el patrón
 * de días ya cruzó el umbral que le corresponde a su intensidad?
 *
 * Espejo de `herramientas/senales/hambre.py`.
 */

export interface Tramo {
  bajo: number
  alto: number
  diasExigidos: number
  etiqueta: string
}

export const TRAMOS: readonly Tramo[] = [
  { bajo: 1, alto: 3, diasExigidos: 21, etiqueta: 'leve' },
  { bajo: 4, alto: 6, diasExigidos: 10, etiqueta: 'moderada' },
  { bajo: 7, alto: 8, diasExigidos: 5, etiqueta: 'intensa' },
  { bajo: 9, alto: 10, diasExigidos: 2, etiqueta: 'insostenible' },
]

/**
 * Un día bueno no rompe la racha; dos seguidos sí.
 *
 * Exigir una racha sin ninguna interrupción dejaría fuera el caso que motiva la
 * pregunta: cuatro días de hambre 8, uno bien, y otros cuatro de 8 no serían
 * «cinco días sostenidos» bajo una racha estricta — y en la práctica sí lo son.
 */
export const TOLERANCIA_DIAS_SIN_CONFIRMAR = 1

export interface RegistroHambre {
  /** `YYYY-MM-DD`. Los días tienen que venir consecutivos. */
  fecha: string
  /**
   * `null` es un día SIN REGISTRAR, no un día sin hambre. Mismo principio que
   * los nutrientes no medidos: el hueco tiene que seguir siendo un hueco.
   */
  hambre: number | null
}

export interface VeredictoHambre {
  cumplido: boolean
  tramo?: string
  diasExigidos?: number
  /** El día en que se cruzó el umbral. */
  fechaCumplimiento?: string
}

function tramoDe(hambre: number): Tramo {
  if (!Number.isInteger(hambre)) {
    throw new Error(`el hambre se registra en enteros del 1 al 10: ${hambre}`)
  }
  const tramo = TRAMOS.find((t) => hambre >= t.bajo && hambre <= t.alto)
  if (!tramo) throw new Error(`el hambre tiene que estar entre 1 y 10: ${hambre}`)
  return tramo
}

/** Cuántos días de ese nivel hacen falta antes de actuar. */
export function diasExigidos(hambre: number): number {
  return tramoDe(hambre).diasExigidos
}

/** El tramo al que pertenece un valor, para poder nombrarlo en pantalla. */
export function tramoDeHambre(hambre: number): Tramo {
  return tramoDe(hambre)
}

const unDiaDespues = (fecha: string): string => {
  const [a, m, d] = fecha.split('-').map(Number)
  const siguiente = new Date(a, m - 1, d + 1)
  const mes = String(siguiente.getMonth() + 1).padStart(2, '0')
  return `${siguiente.getFullYear()}-${mes}-${String(siguiente.getDate()).padStart(2, '0')}`
}

/**
 * Valida los valores y que las fechas sean días consecutivos.
 *
 * Un día sin registrar tiene que aparecer con `hambre: null`, NO faltar de la
 * lista. Si faltara, dos días separados por una semana parecerían seguidos y la
 * racha contaría días que nadie vivió.
 */
function validarSerie(registros: readonly RegistroHambre[]): void {
  registros.forEach((registro, i) => {
    if (registro.hambre !== null) tramoDe(registro.hambre)
    if (i === 0) return
    const anterior = registros[i - 1].fecha
    if (unDiaDespues(anterior) !== registro.fecha) {
      throw new Error(
        `los registros tienen que cubrir días consecutivos, sin huecos ni ` +
          `duplicados: ${anterior} seguido de ${registro.fecha}. Un día sin ` +
          `registrar va con hambre en null, no ausente.`,
      )
    }
  })
}

/**
 * Recorre la serie y dice si algún tramo ya cumplió su umbral.
 *
 * LOS TRAMOS NO SE PRESTAN DÍAS ENTRE SÍ. Tres días de hambre 8 seguidos de
 * tres de hambre 2 no son «seis días de hambre sostenida»: son dos patrones
 * distintos, y cada uno pide una respuesta distinta. Por eso cada tramo lleva
 * su propia cuenta en paralelo.
 *
 * Una lista vacía no revienta: no hay nada que evaluar todavía, que es distinto
 * de un dato inválido.
 */
export function evaluarRacha(registros: readonly RegistroHambre[]): VeredictoHambre {
  validarSerie(registros)

  const racha = new Map<Tramo, number>(TRAMOS.map((t) => [t, 0]))
  const huecoSeguido = new Map<Tramo, number>(TRAMOS.map((t) => [t, 0]))

  for (const registro of registros) {
    const tramoHoy = registro.hambre !== null ? tramoDe(registro.hambre) : null

    for (const tramo of TRAMOS) {
      if (tramo === tramoHoy) {
        const dias = (racha.get(tramo) ?? 0) + 1
        racha.set(tramo, dias)
        huecoSeguido.set(tramo, 0)
        if (dias >= tramo.diasExigidos) {
          return {
            cumplido: true,
            tramo: tramo.etiqueta,
            diasExigidos: tramo.diasExigidos,
            fechaCumplimiento: registro.fecha,
          }
        }
      } else {
        const hueco = (huecoSeguido.get(tramo) ?? 0) + 1
        huecoSeguido.set(tramo, hueco)
        if (hueco > TOLERANCIA_DIAS_SIN_CONFIRMAR) racha.set(tramo, 0)
      }
    }
  }

  return { cumplido: false }
}
