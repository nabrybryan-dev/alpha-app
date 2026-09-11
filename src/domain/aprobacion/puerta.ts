/**
 * LA PUERTA: cuándo deja de hacer falta que un humano mire antes de enviar.
 *
 * El encargo original decía «la salida automática se abre tras cuatro domingos seguidos sin
 * que corrija ni una». Eso se escribió cuando lo que salía era una TARJETA de texto. Desde
 * la noche del 2026-09-10 lo que sale son **veintitrés vídeos, uno por persona, con la cara
 * y la voz clonadas de Bryan diciendo sus números en voz alta**.
 *
 * Así que esta función ya no decide si se manda un párrafo sin revisar: decide si la cara y
 * la voz de Bryan salen a hablarle a alguien **sin que Bryan lo haya oído**. La regla es la
 * misma; lo que cambia es cuánto hay que exigirle antes de darla por cumplida, y por eso
 * aquí se sube el listón en tres sitios en vez de bajarlo.
 *
 * ## Los tres sitios donde se sube, y por qué cada uno
 *
 * 1. **Un domingo sin borradores NO es un domingo limpio.** «No corrigió nada» es cierto
 *    también cuando no hubo nada que corregir, y cuatro domingos vacíos abrirían la puerta
 *    con cero evidencia. Un domingo cuenta si hubo trabajo delante.
 * 2. **Lo que nadie miró no está aprobado.** Un borrador que se quedó en la bandeja sin
 *    abrir no dice que estuviera bien: dice que no se supo. Silencio no es firma, y contarlo
 *    como aprobación es exactamente la forma de abrir la puerta por cansancio.
 * 3. **Cada firmante tiene su propia puerta.** Manuela y Bryan firman bandejas distintas
 *    (decisión 6 del diseño), así que los cuatro domingos limpios de uno no abren la salida
 *    del otro. Quien llama pasa el historial de UNA firma; mezclarlos sería dejar salir la
 *    voz de Bryan por la constancia de otra persona.
 *
 * ## Y por qué devuelve un motivo y no solo un sí o un no
 *
 * Porque la bandeja tiene que poder decir POR QUÉ sigue cerrada —«llevas dos de cuatro»,
 * «ese domingo se quedaron seis sin mirar»— y con un booleano habría que recalcularlo fuera,
 * que es como dos sitios acaban contando cosas distintas. `puedeSalirSola()` sigue existiendo
 * con su contrato de siempre y se apoya en esto.
 *
 * Vive en `src/domain/` y no en `src/features/aprobacion/` como decía el encargo: es una
 * regla de negocio pura, sin React y sin red, y la casa las quiere aquí. La pantalla la
 * importa.
 */

/** Qué pasó un domingo con los borradores de UN firmante. */
export interface DomingoDeFirma {
  /** El domingo, en fecha local (`AAAA-MM-DD`). */
  fecha: string
  /** Cuántos borradores se le pusieron delante. */
  borradores: number
  /** Cuántos dejó salir TAL CUAL, sin tocar una palabra. */
  aprobadosSinTocar: number
  /** Cuántos corrigió antes de que salieran. */
  corregidos: number
}

/**
 * Cuántos domingos seguidos y limpios hacen falta. Cuatro, y viene del diseño: con 23
 * borradores por domingo, dos domingos son cuarenta y pico decisiones y no exigen
 * constancia — exigen una buena semana. Cuatro son un mes de conducta.
 */
export const DOMINGOS_LIMPIOS = 4

/**
 * Por debajo de esto, un domingo no cuenta como evidencia aunque salga impecable.
 *
 * Tres es poco para decir nada de un sistema que redacta veintitrés, y es justo el número
 * que un domingo flojo —media cartera de vacaciones, una semana de descarga— podría dar
 * cuatro veces seguidas.
 *
 * // DECISIÓN PENDIENTE: el número honesto sale de la cartera real de cada firmante, no de
 * // aquí. Cinco es el suelo por debajo del cual un domingo no informa; si Bryan quiere que
 * // la puerta exija «media cartera», este valor pasa a calcularse contra ella.
 */
export const MINIMO_POR_DOMINGO = 5

export type MotivoCerrada =
  /** No hay ni un domingo con trabajo delante. */
  | 'sin-historial'
  /** Van bien, pero todavía no son cuatro. */
  | 'faltan-domingos'
  /** Corrigió algo: la cuenta vuelve a empezar. */
  | 'hubo-correccion'
  /** Un domingo con tan pocos borradores que no dice nada. */
  | 'domingo-flojo'
  /** Quedaron borradores sin mirar: eso no es aprobar. */
  | 'quedaron-sin-mirar'

export type VeredictoDeLaPuerta =
  | { abierta: true; desde: string }
  | { abierta: false; motivo: MotivoCerrada; domingosLimpios: number }

/** Un domingo cuenta solo si hubo trabajo, se miró entero y no se tocó nada. */
function comoSalio(d: DomingoDeFirma): 'limpio' | MotivoCerrada {
  if (d.corregidos > 0) return 'hubo-correccion'
  if (d.borradores < MINIMO_POR_DOMINGO) return 'domingo-flojo'
  if (d.aprobadosSinTocar < d.borradores) return 'quedaron-sin-mirar'
  return 'limpio'
}

/**
 * EL VEREDICTO DE LA PUERTA para un firmante.
 *
 * @param historial Los domingos de ESE firmante, del más antiguo al más reciente. Se miran
 *   los últimos, porque lo que importa es la conducta de ahora: quien corrigió hace dos
 *   meses y lleva cuatro domingos limpios ha ganado la puerta, y quien corrigió el domingo
 *   pasado la ha vuelto a cerrar por mucho historial bueno que tenga detrás.
 */
export function veredictoDeLaPuerta(
  historial: readonly DomingoDeFirma[],
): VeredictoDeLaPuerta {
  if (historial.length === 0) return { abierta: false, motivo: 'sin-historial', domingosLimpios: 0 }

  // Se recorre HACIA ATRÁS desde el último domingo: la racha que cuenta es la que llega
  // hasta hoy. Una racha de cuatro perfecta en mayo no abre nada si en junio corrigió.
  let limpios = 0
  let corte: MotivoCerrada = 'faltan-domingos'
  for (let i = historial.length - 1; i >= 0; i--) {
    const salida = comoSalio(historial[i])
    if (salida !== 'limpio') {
      corte = salida
      break
    }
    limpios++
  }
  if (limpios < DOMINGOS_LIMPIOS) return { abierta: false, motivo: corte, domingosLimpios: limpios }

  // `desde` ES EL DOMINGO EN QUE SE ABRIÓ, no el primero de la racha ni el último.
  //
  // Con seis domingos limpios seguidos, la puerta se abrió en el CUARTO —contando desde que
  // empezó la racha— y lleva abierta desde entonces; decir que se abrió el sexto sería
  // rejuvenecerla cada semana, y decir que se abrió el primero sería abrirla tres semanas
  // antes de que se ganara. Las dos versiones estuvieron escritas aquí antes que esta, y
  // ninguna de las dos se distingue con cuatro domingos justos: hay que probar con seis.
  const empiezaLaRacha = historial.length - limpios
  return { abierta: true, desde: historial[empiezaLaRacha + DOMINGOS_LIMPIOS - 1].fecha }
}

/**
 * Si las tarjetas y los vídeos de este firmante pueden salir sin que nadie los mire.
 *
 * Es el contrato del encargo, dicho en un booleano. Por dentro es el veredicto de arriba:
 * un solo sitio decide, y la bandeja puede además explicar por qué.
 */
export function puedeSalirSola(historial: readonly DomingoDeFirma[]): boolean {
  return veredictoDeLaPuerta(historial).abierta
}
