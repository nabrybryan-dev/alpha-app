/**
 * EL GESTO QUE ATRAVIESA: dedo en vertical sobre el sujeto → eje W.
 *
 * Orbitar es el dedo en horizontal y no toca este archivo. Aquí solo está la regla que
 * convierte centímetros de dedo en un escalón del eje W, y es una función pura a
 * propósito: el eje que decide qué ve el asesorado del cuerpo se tiene que poder probar
 * sin navegador, sin WebGL y sin puntero.
 *
 * ## El sentido: hacia arriba se entra
 *
 * Arrastrar hacia ARRIBA profundiza —piel → músculo → tendón → hueso— y hacia ABAJO se
 * sale hasta volver a la piel. Se elige así porque el dedo aparta hacia arriba lo que
 * tiene encima, como quien levanta una tapa; y porque deja el gesto de salir en el
 * mismo sentido que el de cerrar el panel de abajo, que también baja.
 *
 * El signo sigue la convención de la pantalla, no la del cuerpo: en coordenadas de
 * puntero **+Y es hacia abajo**, así que un `desplazamientoY` NEGATIVO es un dedo que
 * sube. Es la convención de `PointerEvent.clientY`, y traducirla aquí evitaría que la
 * capa de interfaz tuviera que acordarse de invertirla —que es donde se pierde un signo.
 *
 * ## El contrato con quien llama
 *
 * `desplazamientoY` es lo recorrido DESDE EL ORIGEN DEL ARRASTRE, en píxeles CSS. Un
 * arrastre completo avanza **exactamente una capa**, por largo que sea: quien arrastra
 * media pantalla de una tirada no acaba en el hueso saltándose el músculo. Para
 * encadenar varios saltos en un mismo contacto, el llamante vuelve a poner el origen en
 * el punto donde cambió la capa. Es una línea en el manejador y a cambio hace imposible
 * el atropello de tres capas por un resbalón.
 */

import type { NivelW } from '../salon/huecos'

/**
 * Cuánto dedo es un arrastre completo, en píxeles CSS.
 *
 * Por debajo de unos 40 px está el ruido: el temblor de un dedo que solo quería tocar,
 * y el arranque de un gesto horizontal que todavía no se ha decidido —orbitar y
 * atravesar salen del mismo contacto—. Por encima de unos 100 px el eje se vuelve
 * trabajoso: son cuatro arrastres para llegar al hueso, así que un umbral de 120 px
 * costaría casi media pantalla de teléfono en total.
 *
 * 72 px es aproximadamente un dedo de recorrido y cae en medio: bastante para que no se
 * dispare solo, poco para repetirlo cuatro veces sin cansancio.
 *
 * De dónde sale el número: de la geometría del gesto —los 40 px de ruido por abajo y los
 * ~100 px de fatiga por arriba, con cuatro arrastres hasta el hueso—, no de una tanda de
 * pruebas con dedos. Es un umbral de tacto, y un tacto solo lo firma una mano sobre un
 * teléfono. Está aquí solo, sin repetirse en el manejador, para que ajustarlo sea un
 * cambio de un dígito.
 */
export const UMBRAL_DE_CAPA = 72

/** El primer escalón del eje: la piel. */
export const CAPA_MINIMA = 0

/** El último: el hueso. No hay nada debajo. */
export const CAPA_MAXIMA = 4

/**
 * En qué capa deja el arrastre.
 *
 * Reglas duras, en este orden:
 *
 * 1. Un arrastre por debajo del umbral **no cambia de capa**. Ni un poquito: no hay
 *    capa 1,4, porque una capa a medio enseñar es una pantalla rota y no una animación.
 * 2. Un arrastre completo avanza **exactamente una capa**, en el sentido del dedo.
 * 3. El resultado nunca sale de `[0, 4]`. En los topes el gesto no hace nada, que es lo
 *    que hay que sentir al llegar al hueso: se acabó el cuerpo.
 *
 * Es total: una entrada rara —`NaN`, infinito, una capa fuera de rango que venga de un
 * estado viejo— devuelve una capa válida en lugar de propagar la basura al motor.
 * Devolver `NaN` aquí apagaría el sujeto entero sin lanzar ningún error.
 */
export function capaTrasArrastre(desplazamientoY: number, capaActual: number): NivelW {
  const desde = normalizarCapa(capaActual)
  // Un desplazamiento que no es un número no es un gesto: se queda donde estaba.
  if (!Number.isFinite(desplazamientoY)) return desde
  if (Math.abs(desplazamientoY) < UMBRAL_DE_CAPA) return desde
  // Dedo hacia arriba (Y negativa en pantalla) → hacia dentro del cuerpo.
  const paso = desplazamientoY < 0 ? 1 : -1
  return limitarCapa(desde + paso)
}

/**
 * Limpia una capa que viene de fuera: la redondea al escalón más cercano y la mete en
 * rango. Un estado guardado de una versión anterior, o un 2,5 salido de una
 * interpolación, entran por aquí y salen siendo una capa de verdad.
 */
function normalizarCapa(capa: number): NivelW {
  if (!Number.isFinite(capa)) return CAPA_MINIMA
  return limitarCapa(Math.round(capa))
}

/** Recorta al rango del eje. Es la única puerta por la que sale un valor de este módulo. */
function limitarCapa(capa: number): NivelW {
  if (capa <= CAPA_MINIMA) return CAPA_MINIMA
  if (capa >= CAPA_MAXIMA) return CAPA_MAXIMA
  return capa as NivelW
}
