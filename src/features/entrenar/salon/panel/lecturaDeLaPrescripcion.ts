import { esAlFallo } from '../../../../domain/objetivoDeIntensidad'
import type { EjercicioPrescrito } from '../../../../domain/types'

/**
 * LA LECTURA LARGA: las cuatro prescripciones, explicadas.
 *
 * ## De qué se queja esto
 *
 * El panel de abajo llevaba lo que NO cupo arriba: los textos que `contenidoPared()`
 * recortó, con su rótulo y su párrafo. Eso hace honesto el recorte —recortar no es tirar—
 * pero no es una lectura: es un sobrante. Quien baja el panel entre series no busca el
 * final de una frase cortada; busca por qué le han puesto tres series y no cuatro.
 *
 * ## Los tres niveles, y por qué son tres
 *
 * Cada prescripción se cuenta en el mismo orden en que se necesita:
 *
 * - **QUÉ es** — la instrucción, en una frase. Es lo que se hace.
 * - **POR QUÉ importa** — qué decide ese número. Es lo que convierte una orden en una
 *   razón, y lo único que hace que alguien la respete cuando el día viene malo.
 * - **LA SEÑAL** — qué mirar en el gimnasio para saber si se está cumpliendo. Va con
 *   filete a la izquierda porque no es más explicación: es lo que se comprueba.
 *
 * Sin el tercero, esto sería un glosario. La señal es la que se recuerda.
 *
 * ## Lo que NO hace, a propósito
 *
 * No inventa un número que no esté en la prescripción y no redondea ninguno. Todo lo que
 * se lee aquí sale de los campos del ejercicio, y cuando un campo cambia de naturaleza
 * —`AMRAP` en vez de un número de repeticiones, `FALLO` en vez de un RIR— cambia el texto
 * entero, no solo la cifra. Es la diferencia entre explicar una prescripción y rellenar
 * una plantilla con ella.
 *
 * ## `FALLO` no es `RIR 0`, y por eso tiene su propia lectura
 *
 * `RIR 0` es la última repetición completa, con la parcial en reserva. `FALLO` es la
 * instrucción de meterse en esa parcial. Son dos prescripciones distintas y la de abajo
 * las cuenta como tales: escribir «te guardas 0 repeticiones» donde el coach pidió el
 * fallo sería enseñar la orden contraria a la que dio.
 */
export interface LecturaDePrescripcion {
  /** El mismo id que usan las cuatro estaciones, para poder ordenarlas por el foco. */
  id: 'series' | 'reps' | 'descanso' | 'rir'
  rotulo: string
  /**
   * LA CIFRA SOLA, sin unidad y sin rango.
   *
   * Se separó al mirar la pantalla: con el rango dentro, «12 (10-14)» no cabía en la
   * columna y se partía en tres renglones —«12 / (10- / 14)»—, que es exactamente el
   * fallo que ya se corrigió en el muro el 2026-09-03. Una cifra que parte palabras deja
   * de leerse como una cifra.
   *
   * Y no es solo maquetación: el rango y la unidad no SON el número. El número es lo que
   * se compara de una semana a otra; el rango es la horquilla que lo admite y «min» es en
   * qué se mide. Puestos aparte, cada uno se lee por lo que es.
   */
  cifra: string
  /** El rango, la unidad o el matiz que acompaña a la cifra. Ausente cuando no hay. */
  matiz?: string
  que: string
  porque: string
  senal: string
}

export function lecturaDeLaPrescripcion(
  ejercicio: EjercicioPrescrito | undefined,
): LecturaDePrescripcion[] {
  if (!ejercicio) return []
  return [seriesDe(ejercicio), repeticionesDe(ejercicio), descansoDe(ejercicio), intensidadDe(ejercicio)]
}

function seriesDe(ejercicio: EjercicioPrescrito): LecturaDePrescripcion {
  const n = ejercicio.sets
  return {
    id: 'series',
    rotulo: 'Series',
    cifra: String(n),
    que: `${n} ${n === 1 ? 'bloque' : 'bloques'} de repeticiones seguidas, con el descanso completo entre uno y otro.`,
    porque:
      'El volumen de la sesión se decide aquí. Menos series de las pautadas y el estímulo no llega; más, y la siguiente sesión la pagas.',
    senal:
      'Si en la última serie no llegas a las repeticiones, no añadas una serie para compensar: anótalo tal cual.',
  }
}

function repeticionesDe(ejercicio: EjercicioPrescrito): LecturaDePrescripcion {
  const diana = ejercicio.repsDiana
  const rango = ejercicio.rango?.trim()
  const franjaDeFuerza = diana <= 6
  return {
    id: 'reps',
    rotulo: 'Repeticiones',
    cifra: String(diana),
    // El rango acompaña a la diana cuando el coach lo escribió: «(8-10)» es la horquilla
    // que admite, y la diana el punto dentro de ella.
    matiz: rango || undefined,
    que: `${diana} por serie${rango ? `, dentro del rango ${rango}` : ''}, todas con la misma técnica que la primera.`,
    porque: franjaDeFuerza
      ? 'Franja de fuerza: pocas repeticiones con carga alta. La velocidad de la última te dice cuánto te quedaba.'
      : 'Franja de hipertrofia: la carga permite acumular trabajo sin que la técnica se rompa.',
    senal: 'Si una repetición sale con la espalda distinta a la anterior, esa no cuenta.',
  }
}

function descansoDe(ejercicio: EjercicioPrescrito): LecturaDePrescripcion {
  const min = ejercicio.descansoMin
  const texto = String(min).replace('.', ',')
  return {
    id: 'descanso',
    rotulo: 'Descanso',
    cifra: texto,
    matiz: 'min',
    que: `${texto} minutos entre series, con cronómetro. No a ojo.`,
    porque:
      'Por debajo del descanso pautado la siguiente serie sale más lenta y el RIR deja de ser comparable con el de la semana pasada.',
    senal: 'El descanso empieza cuando sueltas la barra, no cuando terminas de anotar.',
  }
}

function intensidadDe(ejercicio: EjercicioPrescrito): LecturaDePrescripcion {
  const objetivo = ejercicio.rirObjetivo
  if (esAlFallo(objetivo)) {
    return {
      id: 'rir',
      rotulo: 'Intensidad',
      cifra: 'FALLO',
      que: 'Sigues hasta que la repetición no sale entera. No es «casi»: es meterte en la que se queda a medias.',
      porque:
        'Es la única prescripción que no deja margen, y por eso se escribe con la palabra y no con un número. Va donde el coach quiere saber tu tope de verdad, no cómo de cerca llegaste.',
      senal: 'Si terminaste la serie y habrías podido hacer una más, no fue al fallo. Anótalo como lo que fue.',
    }
  }
  const rir = objetivo
  return {
    id: 'rir',
    rotulo: 'RIR',
    cifra: String(rir),
    que: `Terminas cada serie guardándote ${rir} ${rir === 1 ? 'repetición' : 'repeticiones'}. Podrías haber hecho ${rir} más, y no las haces.`,
    porque:
      'El RIR es cómo tu coach sabe lo cerca del fallo que estuviste sin verte. Una carga con RIR 2 esta semana y RIR 0 la siguiente cuenta una historia.',
    senal:
      'Si terminaste y no sabrías decir cuántas te quedaban, probablemente te quedaban más de las que crees.',
  }
}
