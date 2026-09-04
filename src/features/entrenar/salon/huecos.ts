/**
 * EL CONTRATO DEL SALÓN: dónde encaja cada pieza.
 *
 * La pantalla `/entrenar` era una columna con scroll: doce bloques y unos ciento veinte
 * nodos de texto, todos al mismo nivel y todos compitiendo. El salón no quita nada de
 * eso —**ninguna información que hoy muestra la app se puede perder**— sino que le da a
 * cada cosa un sitio con sentido físico: lo corto y esencial en las paredes, el sujeto
 * en el centro, y lo largo abajo, a un dedo de distancia.
 *
 * Este archivo es la frontera entre el motor y la interfaz. La capa de interfaz lee
 * `HUECOS` para saber QUÉ va en cada sitio y con qué tope; no decide la repartición por
 * su cuenta. Si un hueco no está aquí, no existe en el salón.
 *
 * ## La cuarta dimensión, que es literal
 *
 * A los tres ejes del espacio se suma un cuarto eje de navegación, W, que ATRAVIESA el
 * cuerpo en vez de rodearlo:
 *
 * - dedo en horizontal → X, Y, Z: se orbita ALREDEDOR del sujeto.
 * - dedo en vertical   → W: se ATRAVIESA el sujeto, de la piel al hueso.
 *
 * Los dos gestos son ortogonales a propósito: orbitar nunca cambia de capa y cambiar de
 * capa nunca mueve la cámara. Un gesto que hiciera las dos cosas dejaría al asesorado
 * sin saber si se ha movido él o se ha movido el cuerpo.
 */

/** Los cinco escalones del eje W, en el orden en que se atraviesan de fuera a dentro. */
export const CAPAS_W = [
  { w: 0, id: 'piel', nombre: 'Piel' },
  { w: 1, id: 'musculo-superficial', nombre: 'Músculo superficial' },
  { w: 2, id: 'musculo-profundo', nombre: 'Músculo profundo' },
  { w: 3, id: 'tendon', nombre: 'Tendón y tejido pasivo' },
  { w: 4, id: 'hueso', nombre: 'Hueso' },
] as const

/** Un escalón del eje W. `0` es la piel y `4` el hueso; no hay medias capas. */
export type NivelW = 0 | 1 | 2 | 3 | 4

/**
 * El tope de caracteres de un texto de pared, y el número más importante del archivo.
 *
 * Una pared no es una tarjeta: se lee de reojo, en escorzo y en movimiento, mientras la
 * cámara orbita. Cuarenta y dos caracteres es lo que cabe en una línea legible a esa
 * distancia sin partirla. Lo que no quepa **no se tira**: se va al panel de abajo, que
 * es lo que hace que recortar aquí no pierda nada.
 *
 * Vive aquí y no en `contenidoPared.ts` para que el tope y el hueco que lo impone sean
 * el mismo dato: dos números iguales en dos archivos es cómo se separan al primer ajuste.
 */
export const TOPE_PARED = 42

/**
 * El escorzo de un panel de pared: lo que hace que un rótulo parezca colgado de un muro.
 *
 * Un rótulo plano pegado al borde se lee como una etiqueta flotando sobre la imagen;
 * escorzado se lee como un muro alrededor del centro. Los grados son cortos —catorce—
 * porque esto se tiene que poder LEER: a treinta la línea de `TOPE_PARED` caracteres se
 * estrecha demasiado en el extremo lejano.
 *
 * Vive aquí, junto al tope, y por el mismo motivo. Los paneles del ejercicio
 * (`paredes/PanelPared.tsx`) y los de la prescripción sin sujeto
 * (`sinPatron/SalonSinSujeto.tsx`) son **la misma pared vista el mismo día**: si cada
 * archivo escribe sus grados, el día que uno se ajuste el salón tendrá dos muros con
 * inclinaciones distintas y nadie sabrá cuál es el bueno.
 *
 * `perspectiva` va en píxeles porque es lo que consume `perspective`, y se aplica en
 * CADA columna y no en un ancestro común: la propiedad solo alcanza a los hijos
 * directos, así que puesta más arriba el giro se aplicaría igual y no escorzaría —se
 * pagaría el coste sin ver el efecto y sin que nada se pusiera en rojo—.
 */
export const ESCORZO_DE_PARED = { grados: 14, perspectiva: 620 } as const

/**
 * LO QUE LA SALA LE DEJA LIBRE AL SUELO DEL SALÓN, medido desde el borde de la pantalla.
 *
 * La habitación no se centra a ojo en mitad del salón: se estira desde arriba hasta donde
 * empieza el mobiliario del suelo. Antes ocupaba un cuadrado centrado y por encima de él
 * quedaba una franja negra de casi un tercio de la pantalla — la franja donde acabaron
 * flotando los cuatro datos de la prescripción, que es justo el dashboard de tarjetas que
 * el salón vino a quitar. Con la sala estirada esa franja no existe: no hay sitio libre
 * arriba donde nada pueda flotar.
 *
 * Son dos medidas y no una porque el suelo tiene dos ocupaciones distintas:
 *
 * - `conRegistro` — hay ejercicio, así que abajo está la tarjeta de registrar la serie
 *   (carga, repeticiones y RIR) además del tirador del panel y de la barra de navegación.
 * - `sinRegistro` — la sesión metabólica no tiene ejercicios que registrar, así que abajo
 *   solo están el tirador y la barra, y la habitación baja casi hasta el borde.
 *
 * Las dos se cuentan desde el fondo de la ventana y no desde el marco con hueco para la
 * navegación, y es a propósito: el bloque contenedor de un hijo absoluto es la CAJA DE
 * RELLENO del ancestro posicionado, que incluye el relleno. Un `bottom` medido contra ese
 * marco no descontaría la barra, así que aquí se suma `--tope-nav` explícitamente.
 */
export const SUELO_DEL_SALON = {
  conRegistro: 'calc(var(--tope-nav) + 15rem)',
  sinRegistro: 'calc(var(--tope-nav) + 3.5rem)',
} as const

/** Dónde vive físicamente un hueco dentro del salón. */
export type AnclaDeHueco =
  /** El volumen central que la cámara orbita. Es el sujeto, no una caja de texto. */
  | 'orbita'
  /** Los muros del salón, a la altura de la mirada. Lo corto y esencial. */
  | 'pared'
  /** El suelo, al pie del sujeto: se alcanza sin apartar la vista del centro. */
  | 'suelo'
  /** El borde inferior de la pantalla, de donde se tira hacia arriba con el dedo. */
  | 'borde-inferior'
  /** El borde izquierdo, de donde se tira hacia dentro para sacar la ficha. */
  | 'borde-izquierdo'

/** Con qué gesto se llega a un hueco. */
export type GestoDeHueco =
  /** Dedo en horizontal: orbitar en X, Y, Z. */
  | 'orbitar'
  /** Dedo en vertical sobre el sujeto: atravesarlo por el eje W. */
  | 'atravesar'
  /** Dedo en vertical desde el borde de abajo: subir el panel. */
  | 'deslizar-arriba'
  /** Dedo en horizontal desde el borde izquierdo: sacar la ficha de la serie. */
  | 'deslizar-derecha'
  /** Sin gesto: está puesto y se queda puesto. */
  | 'ninguno'

export interface DefinicionDeHueco {
  /** Qué se cuelga aquí, en una frase. */
  contiene: string
  /** Dónde vive dentro del salón. */
  ancla: AnclaDeHueco
  /** Cómo se llega. */
  gesto: GestoDeHueco
  /**
   * Tope de caracteres por texto. `0` significa SIN TOPE — y solo lo lleva el panel de
   * abajo, que es adonde va todo lo que no cabe arriba. Un tope de 0 en un hueco de
   * arriba sería la forma de perder texto sin que nadie se entere.
   */
  topeDeTexto: number
  /**
   * En qué escalones del eje W sigue estando. Los huecos de información del ejercicio
   * no dependen de la capa: atravesar el cuerpo cambia lo que se VE del sujeto, no lo
   * que está prescrito. Solo el centro reacciona a W.
   */
  visibleEnW: readonly NivelW[]
}

/** Todos los escalones de W, para los huecos que no dependen de la capa. */
const TODO_W: readonly NivelW[] = [0, 1, 2, 3, 4]

/**
 * Los cinco huecos del salón. No hay más, y ese es el punto: en cuanto se admite un
 * sexto sitio «provisional» vuelve la columna con scroll por la puerta de atrás.
 */
export const HUECOS = {
  /**
   * LAS PAREDES — lo corto y esencial del ejercicio.
   *
   * Los nueve campos que `contenidoPared()` devuelve, ninguno de más de `TOPE_PARED`
   * caracteres: nombre, técnica, colocación del móvil, distancia, brazo de momento,
   * velocidad, series×reps y RIR. Es lo que hay que poder leer sin dejar de mirar al
   * sujeto. Todo lo que no cupo aquí está íntegro en `panelInferior`.
   */
  paredes: {
    contiene: 'Los nueve campos cortos del ejercicio, uno por panel de pared.',
    ancla: 'pared',
    gesto: 'orbitar',
    topeDeTexto: TOPE_PARED,
    visibleEnW: TODO_W,
  },

  /**
   * EL CENTRO — el sujeto anatómico.
   *
   * El único hueco que reacciona al eje W: atravesarlo cambia qué capa del cuerpo se
   * enseña, de la piel al hueso. No lleva texto suelto; lo que hay que decir del cuerpo
   * se dice con el cuerpo.
   */
  centro: {
    contiene: 'El sujeto anatómico 3D, en la capa de W que toque.',
    ancla: 'orbita',
    gesto: 'atravesar',
    topeDeTexto: 0,
    visibleEnW: TODO_W,
  },

  /**
   * LAS CUATRO ESTACIONES — la prescripción rodea al sujeto en vez de colgar del muro.
   *
   * Series, repeticiones, descanso y RIR dejan de ser campos de un cuadro de pared y pasan
   * a ser cuatro objetos del suelo alrededor del cuerpo, cada uno con su poste, su base y
   * un cartel que siempre mira a cámara. Es donde el diseño de la sala las pone, y donde
   * se leen sin apartar la vista del centro.
   *
   * SU GESTO ES ORBITAR, y por eso están aquí y no pegadas a la pantalla: giran con la
   * cámara, las de la espalda se apagan y las de atrás se levantan por encima de las de
   * delante. Un panel que no se moviera al orbitar sería interfaz sobre el cristal.
   *
   * Y NO SE QUEDAN ESCRITAS. La cifra entra, se lee tres segundos y se retira; lo que
   * permanece es el poste con su base, que no tapa nada. Ese ciclo es lo que permite
   * quitar de la pared los cuadros que llevaban estos mismos datos sin perderlos: la
   * prescripción se enseña cuando se necesita, no todo el rato.
   */
  estaciones: {
    contiene: 'Series, repeticiones, descanso y RIR, en cuatro postes alrededor del sujeto.',
    ancla: 'suelo',
    gesto: 'orbitar',
    topeDeTexto: TOPE_PARED,
    visibleEnW: TODO_W,
  },

  /**
   * LA FICHA DE LA SERIE — el registro vuelve a ser un hueco, y ahora es un CAJÓN.
   *
   * Estuvo en el borde de abajo, se mudó a la pared el 2026-09-02 —«este también va
   * explicado gráficamente en el esqueleto»— y ahí destapó dos cosas. La primera es de
   * sitio: los mandos se desplegaban dentro del cuadro, que cuelga a 1,62 m, y al crecer
   * empujaban contra el marcador de siete segmentos del muro. La segunda es de fondo: un
   * formulario que brota de un cuadro de pared convierte la pared en formulario.
   *
   * Así que la pared se queda con lo que sí es suyo —DECIR qué serie toca y con qué— y
   * llenar y guardar salen a un cajón que entra desde el borde izquierdo. Es un hueco y no
   * un cuadro porque tiene las tres cosas que definen uno: un ancla física (el borde), un
   * gesto propio (tirar hacia dentro) y contenido que no se recorta.
   *
   * SU GESTO NO PISA A NINGUNO. El horizontal sobre el sujeto orbita y el vertical sobre
   * el sujeto es el eje W; por eso el asidero es una franja de 24 px pegada al borde y no
   * la pantalla entera. Dentro de esa franja el arrastre es del cajón; fuera sigue siendo
   * de la cámara. Y es hermano del panel de abajo a propósito: el mismo verbo —tirar de un
   * borde— en dos ejes, así que descubrir uno enseña el otro.
   *
   * `topeDeTexto: 0` porque aquí no se recorta nada: son tres rótulos y tres cifras.
   */
  ficha: {
    contiene: 'La ficha de la serie: qué carga, cuántas repeticiones, qué RIR, y guardar.',
    ancla: 'borde-izquierdo',
    gesto: 'deslizar-derecha',
    topeDeTexto: 0,
    visibleEnW: TODO_W,
  },

  /**
   * EL REGISTRO YA NO ES UNA BARRA NI UN CUADRO SUELTO: es la `ficha` de aquí arriba.
   *
   * Se mudó el 2026-09-02 por petición de Bryan —«este también va explicado gráficamente
   * en el esqueleto»—, con el resto de las casillas. Deja de ser una barra pegada al
   * borde de abajo y pasa a colgar del muro de enfrente a 1,16 m, que es la altura a la
   * que se opera algo en un gimnasio.
   *
   * LO QUE SE PIERDE, y hay que decirlo porque este hueco lo llevaba escrito como
   * requisito: ya NO está garantizado que se alcance «con el pulgar sin girar la cámara».
   * Colgado de un muro, si el asesorado orbita hasta ponerse de espaldas a él, el mando
   * de guardar se le va de cuadro y tiene que volver. Era el precio de que la información
   * viva EN el salón y no encima, y es una decisión tomada, no un descuido: si en el
   * campo resulta que estorba, la salida es duplicar el mando —no devolver la barra—,
   * porque lo que Bryan rechazó fue tener casillas pegadas a los lados.
   *
   * Sigue estando en TODAS las capas de W: el cuadro no depende del escalón del cuerpo.
   */

  /**
   * EL PANEL DE ABAJO — lo largo, íntegro.
   *
   * Sube deslizando el dedo hacia arriba desde el borde inferior. Aquí va todo lo que
   * no cabía en una pared, SIN recortar: los cues completos, la nota del coach, la
   * prescripción compuesta, la ondulación serie a serie, los escenarios verde y rojo y
   * los límites del implemento. Por eso su tope es 0.
   *
   * Es la pieza que hace honesto el recorte de las paredes: sin este hueco, acortar a
   * 42 caracteres sería perder información, que es justo lo que no se puede hacer.
   */
  panelInferior: {
    contiene: 'Los textos completos que no caben en la pared. Nada se recorta.',
    ancla: 'borde-inferior',
    gesto: 'deslizar-arriba',
    topeDeTexto: 0,
    visibleEnW: TODO_W,
  },

  /**
   * SIN PATRÓN — la misma sala, con el centro vacío.
   *
   * No todos los ejercicios del catálogo tienen patrón anatómico. El salón **no cambia
   * de naturaleza** por eso: se abre igual, con su habitación —muro, riel del panel,
   * suelo con retícula y bordillo—, sus paredes con la prescripción y su panel de abajo.
   * Lo único que falta es el cuerpo en el centro. Un día un espacio y otro día una lista
   * de tarjetas negras es justo el dashboard que este salón vino a quitar.
   *
   * Y como no hay cuerpo, no hay eje W: `visibleEnW: [0]` no es una restricción de
   * visibilidad sino la constatación de que aquí solo existe el escalón de partida.
   */
  sinPatron: {
    contiene: 'La sala con el centro vacío y la prescripción colgada de los muros.',
    ancla: 'orbita',
    gesto: 'ninguno',
    topeDeTexto: TOPE_PARED,
    visibleEnW: [0],
  },
} as const satisfies Record<string, DefinicionDeHueco>

/** La clave de un hueco del salón. Es el tipo que consume la capa de interfaz. */
export type ClaveDeHueco = keyof typeof HUECOS
