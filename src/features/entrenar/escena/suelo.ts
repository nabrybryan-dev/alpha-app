import { Malla, type Color } from '../../../domain/patrones/malla'

/**
 * EL SUELO DE LA SALA: la primera superficie del salón que lleva una imagen encima.
 *
 * Hasta el 2026-09-05 la sala no tenía suelo. `construirSala` levanta la pared, los
 * marcadores, la estación y el mobiliario, y bajo los pies quedaba el `clearColor` del
 * motor y el degradado del SVG. Se notaba: en el tour del Fitness Park que Bryan pasó
 * como referencia, lo que más dice «gimnasio» no son las máquinas sino la goma del
 * suelo con sus juntas.
 *
 * ## Un disco, no un cuadrado
 *
 * La pared es un cilindro de radio `radio`, así que el suelo es el disco que la cierra
 * por abajo: cualquier otra forma dejaría un borde a la vista o se metería dentro de la
 * pared. Un abanico desde el centro, `sectores` triángulos.
 *
 * ## Las coordenadas van en metros
 *
 * La imagen `suelo-goma` cubre 3 × 3 m del suelo real y se repite. Las coordenadas de
 * textura son la posición dividida por eso, y no un 0–1 sobre el disco, porque lo que se
 * quiere ver es una baldosa de medio metro que mida medio metro se mire desde donde se
 * mire — y no una baldosa que cambia de tamaño si cambia el radio de la sala.
 *
 * ## Mira hacia arriba, y se comprueba
 *
 * Con `CULL_FACE` la tarjeta tira en silencio cualquier cara enrollada al revés, y un
 * suelo del revés se construye bien, se sube bien y no aparece: cero píxeles, ningún
 * error. `suelo.test.ts` recalcula la normal de cada triángulo y exige que apunte hacia
 * arriba.
 */

/** El nombre con el que el motor conoce la imagen. La ruta la pone `visor/texturas.ts`. */
export const TEXTURA_DEL_SUELO = 'suelo-goma'

/** Cuántos metros de suelo cubre la imagen antes de repetirse: seis baldosas de 0,5 m. */
export const METROS_POR_REPETICION = 3

/** Blanco: el vértice no tiñe la imagen. Es la imagen la que pone el color. */
const SIN_TINTE: Color = [1, 1, 1]

export function construirSuelo(m: Malla, radio: number, sectores = 48): void {
  const base = m.vertices
  m.verticeSuelto(0, 0, 0, 0, 1, 0, SIN_TINTE, 0, 0, 0, 0)
  // El anillo lleva un vértice de más, el último encima del primero: así la costura de la
  // textura cae en un vértice y no se interpola entre el final y el principio.
  for (let i = 0; i <= sectores; i++) {
    const a = (i / sectores) * Math.PI * 2
    const x = Math.cos(a) * radio
    const z = Math.sin(a) * radio
    m.verticeSuelto(x, 0, z, 0, 1, 0, SIN_TINTE, 0, 0, x / METROS_POR_REPETICION, z / METROS_POR_REPETICION)
  }
  // (centro, siguiente, actual): con el ángulo creciendo, es el orden que mira hacia
  // arriba. Al revés la GPU se lo traga entero.
  for (let i = 0; i < sectores; i++) m.triangulo(base, base + 2 + i, base + 1 + i)
  m.textura = TEXTURA_DEL_SUELO
}
