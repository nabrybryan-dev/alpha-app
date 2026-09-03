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

/**
 * ## El alto, también en metros, y también un tope
 *
 * `alto` acompaña a `ancho` desde el 2026-09-03 y sirve para una sola cosa: saber dónde
 * cae el borde de ARRIBA del cuadro antes de dibujarlo, que es lo que necesita
 * `asentarEnLaBanda()` para no dejarlo colgando por encima de la pantalla. Es un tope
 * declarado, no el alto real —el real lo pone el texto y solo se sabe al maquetar—, y que
 * el contenido lo respete se comprueba midiendo la pantalla con
 * `testigo/cuadros-en-pantalla.mjs`, no fiándose de este número.
 */

/** Un sitio de la pared, con su desvío respecto al ángulo de entrada. */
export interface SitioRelativo extends Omit<SitioDePared, 'azimut'> {
  /** Grados de desvío respecto al azimut de entrada del patrón. */
  desvio: number
}

/**
 * EL REPARTO, rehecho el 2026-09-03 con el campo horizontal MEDIDO.
 *
 * ## La franja de muro que cabe en pantalla mide 2,37 m
 *
 * El campo visual son 26° verticales, y en un 390 × 844 eso deja **12,18° horizontales**.
 * A los 11,1 m que hay del ojo al muro de enfrente, esos 12,18° son **2,37 m de pared**.
 * Ésa es toda la superficie de la que se puede colgar algo que se vea al abrir.
 *
 * El reparto anterior no lo sabía. Repartía por desvíos de ±8, ±34, 42, 62, 150 y 180, y
 * medido el 2026-09-03: **al abrir no entraba entero ni un cuadro** — tres se cortaban por
 * poco y el resto estaban fuera por cientos de píxeles. Un cuadro de 1 m ya se come el
 * 42 % del ancho, así que en el muro de enfrente no caben dos cosas: cabe **una**.
 *
 * ## Y entonces el muro de enfrente deja de ser un tablón de anuncios
 *
 * Enfrente va **una sola composición**, la que hay que leer sin buscar: qué ejercicio,
 * cómo se hace y con qué cifras. Debajo, el mando —lo único que se opera— y a un lado
 * para no caer en la vertical del sujeto. Las cifras de la serie NO se repiten aquí: ya
 * están en el marcador de siete segmentos que la sala construye en geometría, en el mismo
 * muro y a 1,85 m.
 *
 * Todo lo demás cuelga fuera de la ventana y **se encuentra girando**, que es lo que Bryan
 * pidió desde el principio: que el salón se pueda recorrer. Un cuadro que no se ve al
 * abrir no está perdido — está en la pared de al lado, como en una sala de verdad.
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
  /**
   * LA COMPOSICIÓN DE ENFRENTE: qué ejercicio, cómo se hace y sus cifras.
   *
   * **Desvío 0**, o sea centrado en el muro que se ve al entrar. Estuvo en −8 y ahí se
   * cortaba: 8° de muro son 0,95 m, y con el cuadro midiendo otro medio metro el borde
   * derecho caía fuera de la ventana de 2,37 m.
   *
   * **1,7 m de ancho** —el 72 % de la franja visible— y no 1,0: enfrente no hay dos
   * cuadros compitiendo, hay uno, así que puede ocupar el sitio de los dos. Ancho, el
   * nombre del ejercicio cabe en una línea y el cuadro baja de alto, que es lo que lo
   * saca del borde de arriba.
   *
   * Centrado no lo tapa el sujeto porque está a 2,24 m: por encima de la cabeza, que es
   * donde un gimnasio de verdad cuelga su tablón.
   */
  ejercicio: { desvio: 0, altura: 2.42, ancho: 1.9, alto: 1.5 },
  /**
   * Lo que ya se levantó hoy. **Fuera de la ventana de entrada, a un giro corto.**
   *
   * Estuvo enfrente y a la derecha, peleando con la ficha del ejercicio por la misma
   * franja de 2,37 m; se cortaba por la izquierda. Es la memoria de la sesión: se consulta
   * en el descanso, no durante la repetición, así que buscarla girando un poco la cabeza
   * es lo que se hace en una sala de verdad.
   */
  series: { desvio: -15, altura: 2.3, ancho: 0.9, alto: 0.5 },
  // LA CABECERA, EL CRONÓMETRO Y EL RITMO YA NO SON SITIOS.
  //
  // Colgaban en ±34 y 42, o sea a tres y cuatro anchos de pantalla de la ventana visible:
  // no se veían nunca al abrir, y cuando se veían eran tres fragmentos sueltos flotando
  // cada uno por su lado. Bryan lo dijo el 2026-09-03: «como si hubieses extraído todas
  // las partes de la aplicación y las hubieses pegado literal en las paredes».
  //
  // Con 2,37 m de muro visible no caben cuatro cuadros: cabe UNO. Así que la cabecera, el
  // cronómetro, el ejercicio, sus cifras y la marquesina son ahora un solo TABLÓN
  // compuesto, con jerarquía dentro — que es exactamente lo que hace el marcador de un
  // pabellón, y lo que el documento de referencia pedía con «in the visual language of a
  // stadium scoreboard».
  //
  // No se ha perdido un solo dato: se han dejado de repartir por paredes que nadie mira.
  /** La estación de grabación. Cuelga junto al trípode, que está a 180° de la entrada. */
  camara: { desvio: 150, altura: 2.3, ancho: 1.5, alto: 0.6 },
  /** Lo que viene después. En el muro de detrás: se consulta al terminar, no durante. */
  siguientes: { desvio: 180, altura: 2.4, ancho: 1.8, alto: 0.44 },
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
  // A 1,20 m y no a 1,55: medido en pantalla, a 1,55 el mando se MONTABA ENCIMA de la
  // fila de cifras del tablón —29 px de solape— porque el tablón, al asentarse contra el
  // margen de arriba, había bajado su borde inferior hasta ahí. Dos cuadros de la misma
  // pared no pueden ocupar el mismo trozo de muro, y eso ahora lo vigila una prueba.
  // 1,20 m es además la altura a la que se apoya la mano en un banco.
  registro: { desvio: 2, altura: 1.16, ancho: 1.45, alto: 0.46 },
  /** El eje W: los cinco escalones del cuerpo, en su propia columna del muro. */
  ejeW: { desvio: 62, altura: 2.3, ancho: 0.62, alto: 0.5 },
} as const satisfies Record<string, SitioRelativo>

/** Resuelve un sitio relativo contra el ángulo desde el que se entró al salón. */
export function sitioEn(sitio: SitioRelativo, azimutDeEntrada: number): SitioDePared {
  return {
    azimut: azimutDeEntrada + 180 + sitio.desvio,
    altura: sitio.altura,
    ancho: sitio.ancho,
    alto: sitio.alto,
  }
}
