import type { CuadroEnPantalla } from '../camara/dedoEnElCuerpo'

/**
 * EL CARTEL DE UNA ESTACIÓN NO SE DIBUJA ENCIMA DEL SUJETO.
 *
 * ## Lo que se midió, y por qué esto existe
 *
 * El 2026-09-10, con el instrumento `testigo/carteles-y-sujeto.mjs` —que resta capturas y
 * cuenta TINTA, no rectángulos—, las cuatro estaciones se comían entre el **9 % y el 37 %
 * de los píxeles que pinta el cuerpo**, en las trece posiciones de cámara medidas y con la
 * mediana en el 25 %. No es un ángulo malo: es todos. El kit lo prohíbe en su criterio 3
 * («ningún rótulo, cifra ni panel … se dibuja encima del sujeto o de otro texto») y Bryan
 * lo dijo antes con otras palabras: desaparecer las letras que tapen el salón.
 *
 * ## Se aparta por donde menos tenga que moverse, y los dos lados hacen falta
 *
 * Un cuerpo **de pie** es estrecho y altísimo: ocupa de la cabeza a los pies casi toda la
 * pantalla útil, así que por arriba y por abajo no cabe un cartel de 92 px —medido: se
 * queda con 36 px de aire sobre la cabeza y 42 bajo los pies—, pero a los lados sobra
 * sitio. Un cuerpo **tumbado** en un banco es lo contrario: una banda estrecha en mitad de
 * la pantalla que va de x=40 a x=350 de 390, sin un solo hueco horizontal y con toda la
 * holgura arriba y abajo.
 *
 * Por eso se calculan los dos desvíos y gana **el más corto que despeje de verdad y quepa
 * en la pantalla**. Un cartel que se sale del marco no tapa al sujeto y tampoco se lee: es
 * el mismo criterio 3 incumplido por el otro lado.
 *
 * ## Por qué se esquiva contra el cuerpo MEDIDO y no contra una altura fija
 *
 * El cartel se planta a una altura fija sobre el suelo (`POSTE + 4`), y el cuerpo no está
 * siempre en el mismo sitio: de pie ocupa de la cabeza a los pies, tumbado en un banco es
 * una banda estrecha en mitad de la pantalla, y sentado está a media altura. Una altura
 * fija acierta en un patrón y falla en los otros treinta. El salón YA mide el cuerpo en
 * píxeles en cada fotograma (`alMirar.cuerpo`, el mismo dato con el que el dedo sabe si
 * está sobre el sujeto): esto lo reutiliza en vez de inventar una segunda medida que se
 * separaría de la primera al primer ajuste. Es la misma regla que el encuadre:
 * **el cuadro se calcula contra el cuerpo**.
 */

export interface Recuadro {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * El aire que se le deja al cuerpo por encima y por debajo del cartel, en píxeles.
 *
 * Diez y no cero: pegar el cartel al píxel exacto del contorno deja el número tocando la
 * silueta, y basta que el sujeto se mueva medio dedo dentro de la repetición para volver a
 * pisarlo. Tampoco más: cada píxel de holgura empuja el cartel hacia el borde de la
 * pantalla, y salirse del marco es el mismo criterio 3 incumplido por el otro lado.
 */
export const HOLGURA_DEL_CARTEL = 10

/**
 * DÓNDE EMPIEZA EL SITIO LIBRE POR ARRIBA, en píxeles desde el borde de la pantalla.
 *
 * Ochenta y cuatro: por debajo de la banda de la sesión —«SESIÓN UPPER B · JUEVES»—, que
 * en el salón emulado a 390×844 termina en el 64 y es TEXTO. El criterio 3 del kit prohíbe
 * pisar al sujeto y a otro texto con las mismas palabras, así que el cartel que sube tiene
 * el mismo tope que si bajara.
 */
export const BANDA_DE_SESION = 84

/**
 * CUÁNTO SE COME EL MOBILIARIO DE ABAJO, contado desde el borde inferior.
 *
 * Ciento cuarenta y cuatro, medidos en el mismo salón: la barra de navegación ocupa de 766
 * a 830 (`--tope-nav` = 78), y por encima viven el tirador del panel y la tira de puntos
 * de los ejercicios. Un cartel metido ahí no taparía al sujeto y tampoco se leería.
 */
export const SUELO_DE_LOS_CARTELES = 144

/** Cuánto se aparta un cartel de su sitio natural, en píxeles de pantalla. */
export interface DesvioDelCartel {
  dx: number
  dy: number
}

const QUIETO: DesvioDelCartel = { dx: 0, dy: 0 }

/**
 * Cuánto hay que mover el cartel para que deje de pisar al cuerpo.
 *
 * `{0, 0}` es que no se toca, y es el caso normal: una estación de lado no pisa nada. Si
 * pisa, se prueban los cuatro escapes —izquierda, derecha, arriba, abajo—, se descartan los
 * que se salgan del marco y gana el más corto. Si ninguno cabe —un cuerpo que llena la
 * pantalla— se baja o se sube lo que se pueda, hasta el borde: es peor que despejar y mejor
 * que quedarse en mitad del pecho.
 *
 * @param cartel Dónde caería el cartel SIN desvío, en píxeles de la pantalla.
 * @param cuerpo El cuerpo tal y como lo avisa el visor. Sin él no se mueve nada: no se
 *               esquiva lo que no se ha medido.
 * @param marco  Dónde puede vivir el cartel: `arriba` y `abajo` en vertical (ya descontados
 *               la banda de la sesión y el mobiliario de abajo) y `ancho` de la pantalla.
 */
export function desvioDelCartel(
  cartel: Recuadro,
  cuerpo: CuadroEnPantalla | undefined,
  marco: { arriba: number; abajo: number; ancho: number },
): DesvioDelCartel {
  if (!cuerpo) return QUIETO

  const pisa =
    cartel.x1 > cuerpo.x0 && cartel.x0 < cuerpo.x1 && cartel.y1 > cuerpo.y0 && cartel.y0 < cuerpo.y1
  if (!pisa) return QUIETO

  // Los cuatro escapes, como desvíos y no como posiciones.
  const izquierda = cuerpo.x0 - HOLGURA_DEL_CARTEL - cartel.x1
  const derecha = cuerpo.x1 + HOLGURA_DEL_CARTEL - cartel.x0
  const subir = cuerpo.y0 - HOLGURA_DEL_CARTEL - cartel.y1
  const bajar = cuerpo.y1 + HOLGURA_DEL_CARTEL - cartel.y0

  const salidas: DesvioDelCartel[] = []
  if (cartel.x0 + izquierda >= 0) salidas.push({ dx: izquierda, dy: 0 })
  if (cartel.x1 + derecha <= marco.ancho) salidas.push({ dx: derecha, dy: 0 })
  if (cartel.y0 + subir >= marco.arriba) salidas.push({ dx: 0, dy: subir })
  if (cartel.y1 + bajar <= marco.abajo) salidas.push({ dx: 0, dy: bajar })

  if (salidas.length > 0) {
    return salidas.reduce((mejor, s) =>
      Math.abs(s.dx) + Math.abs(s.dy) < Math.abs(mejor.dx) + Math.abs(mejor.dy) ? s : mejor,
    )
  }

  // Ninguna salida cabe. Se va hacia donde quede menos cartel sobre el cuerpo, acotado al
  // marco: no despeja, pero saca el número del centro del cuerpo.
  const haciaArriba = Math.max(marco.arriba - cartel.y0, subir)
  const haciaAbajo = Math.min(marco.abajo - cartel.y1, bajar)
  const solapeCon = (dy: number) =>
    Math.max(0, Math.min(cartel.y1 + dy, cuerpo.y1) - Math.max(cartel.y0 + dy, cuerpo.y0))
  return { dx: 0, dy: solapeCon(haciaArriba) <= solapeCon(haciaAbajo) ? haciaArriba : haciaAbajo }
}
