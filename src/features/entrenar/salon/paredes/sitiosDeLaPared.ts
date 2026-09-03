import type { SitioDePared } from './geometriaDeCuadro'

/**
 * DÓNDE CUELGA CADA COSA EN LOS MUROS DEL SALÓN.
 *
 * Un solo sitio con todos los sitios, y no repartidos por los componentes, por lo mismo
 * que `TOPE_PARED` vive en `huecos.ts`: dos archivos decidiendo la misma colocación se
 * separan al primer ajuste, y entonces dos cuadros se solapan sin que nadie sepa cuál
 * manda.
 *
 * ## Los azimuts son RELATIVOS a la entrada, y ésa es la decisión importante
 *
 * El ángulo desde el que se entra al salón lo pone cada patrón (`patron.camara.azimut`):
 * 72° para la sentadilla, otro para el remo. Si los cuadros colgaran de azimuts absolutos,
 * cada ejercicio enseñaría una pared distinta al abrir y la pantalla no tendría dos veces
 * la misma cara. Colgando por DESVÍO respecto a la entrada, el reparto es siempre el
 * mismo: se abre y lo que hay delante es lo mismo, gire quien gire después.
 *
 * ## Las alturas: por encima de la cabeza
 *
 * El sujeto ocupa el centro del cuadro y su cabeza llega a 1,75 m. Un cuadro colgado a esa
 * altura queda medio tapado por el cuerpo. A partir de 2,4 m el cuerpo ya no llega, y el
 * muro tiene 4,2: hay sitio de sobra. Es además cómo se cuelga la información en un
 * gimnasio de verdad —los relojes y las pantallas van altos, porque abajo hay hierro.
 *
 * ## El ancho, en metros
 *
 * `ancho` va en metros porque es el ancho del CUADRO, no el del panel en pantalla: al
 * acercarse crece y al alejarse encoge. Medido: 1,6 m en la pared de 7 m son 220 px, el
 * 53 % del ancho de un 414 × 736. Ése es el tamaño de un cuadro que se lee. Por debajo de
 * 1,2 m el texto deja de caber; por encima de 2,2 m tapa la sala.
 */

/** Un sitio de la pared, con su desvío respecto al ángulo de entrada. */
export interface SitioRelativo extends Omit<SitioDePared, 'azimut'> {
  /** Grados de desvío respecto al azimut de entrada del patrón. */
  desvio: number
}

/**
 * El reparto.
 *
 * En el muro de enfrente —el que se ve al entrar— van las dos cosas que se miran sin
 * buscar: qué toca ahora y qué se acaba de levantar. Lo demás se reparte a los lados y
 * detrás, y se encuentra girando. Es lo que Bryan pidió: que el salón se pueda recorrer y
 * que la información esté EN él, no encima.
 */
/**
 * LA BANDA ÚTIL DEL MURO, medida y no elegida.
 *
 * A 11,1 m de profundidad —lo que hay de la cámara al muro de enfrente— el cuadro abarca
 * ±2,56 m de alto alrededor del punto que la cámara mira a esa distancia, que cae en 0,52
 * m del suelo porque la cámara mira un poco hacia abajo. Eso deja **de −2,0 a 3,1 m**.
 *
 * Y por abajo manda el sujeto: su cabeza llega a 1,75 m y ocupa el centro del cuadro, así
 * que un cuadro colgado por debajo de 1,9 m queda medio tapado por el cuerpo.
 *
 * Entre las dos, la banda donde un cuadro se ve entero y no pisa al sujeto va de **1,9 a
 * 2,9 m**. Los primeros números que puse —3,5 m— salían en y = −62 de una pantalla de
 * 736: por encima del borde, y desde fuera eso se ve igual que no haberlos dibujado.
 */
/**
 * CUÁNTO CABE EN EL MURO DE ENFRENTE, que es lo que decide el reparto.
 *
 * Por encima del sujeto quedan unos 280 px de alto útiles, y un cuadro con contenido ocupa
 * cerca de 100. Son DOS filas, no tres. Con cinco cuadros en ese muro se pisaban entre
 * ellos —el del día se montaba encima del ejercicio— y ninguna altura los separaba sin
 * salirse por arriba.
 *
 * Así que en el muro de enfrente se queda lo que se mira SIN buscar: el ejercicio, lo que
 * ya se levantó y el mando de registrar. El día y el cronómetro pasan a los muros
 * laterales: se miran de reojo, y girar un poco la cabeza para ver el reloj es lo que se
 * hace en una sala de verdad.
 */
export const SITIOS = {
  /** Qué ejercicio, cómo se hace, cuántas series y hasta dónde. El cuadro grande. */
  ejercicio: { desvio: -8, altura: 2.24, ancho: 1.0 },
  /** Lo que ya se levantó hoy. Enfrente y a la derecha, como un marcador de pabellón. */
  series: { desvio: 8, altura: 2.24, ancho: 0.78 },
  /** Microciclo y nombre del día: la cabecera de la sesión. Alto y centrado. */
  dia: { desvio: -34, altura: 2.45, ancho: 1.05 },
  /** El cronómetro, junto a la cabecera y a su misma altura. */
  cronometro: { desvio: 34, altura: 2.45, ancho: 1.0 },
  /** El ritmo de la sesión y la marquesina de avisos: una banda ancha y baja. */
  ritmo: { desvio: 42, altura: 2.4, ancho: 1.3 },
  /** La estación de grabación. Cuelga junto al trípode, que está a 180° de la entrada. */
  camara: { desvio: 150, altura: 2.3, ancho: 1.5 },
  /** Lo que viene después. En el muro de detrás: se consulta al terminar, no durante. */
  siguientes: { desvio: 180, altura: 2.4, ancho: 1.8 },
  /**
   * Registrar la serie. A un LADO del sujeto, nunca encima.
   *
   * Estuvo en el centro del muro de enfrente (desvío 0) y ahí quedaba justo sobre el
   * cuerpo: Bryan lo vio y lo dijo en una frase — «colocaste el letrero en el sujeto, y
   * no es así; se ve horrible». Tenía razón, y el arreglo no es moverlo un poco: es que
   * NADA se cuelgue en la vertical del sujeto, que ocupa el tercio central del cuadro.
   *
   * Las CIFRAS ya no viven aquí: están en el marcador de siete segmentos del muro de
   * enfrente, en geometría, que es lo que Bryan pidió con «si vas a colocar los números,
   * colócalos literal en una pared». Este cuadro se queda con lo que no puede estar en
   * geometría: el mando de guardar y el editor de la serie.
   *
   * Desvío POSITIVO: en esta convención el positivo cae a la izquierda del cuadro, y ahí
   * es donde queda sitio — a la derecha ya cuelga la ficha del ejercicio.
   */
  registro: { desvio: 7.5, altura: 1.5, ancho: 0.92 },
  /** El eje W: los cinco escalones del cuerpo, en su propia columna del muro. */
  ejeW: { desvio: 62, altura: 2.3, ancho: 0.62 },
} as const satisfies Record<string, SitioRelativo>

/** Resuelve un sitio relativo contra el ángulo desde el que se entró al salón. */
export function sitioEn(sitio: SitioRelativo, azimutDeEntrada: number): SitioDePared {
  return { azimut: azimutDeEntrada + 180 + sitio.desvio, altura: sitio.altura, ancho: sitio.ancho }
}
