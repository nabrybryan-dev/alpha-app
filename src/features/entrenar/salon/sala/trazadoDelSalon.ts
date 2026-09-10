/**
 * LA HABITACIÓN, TRAZADA: cuatro paredes en perspectiva de un punto.
 *
 * El salón tenía sala en dos sitios y en ninguno de los dos se veía cuando había alguien
 * dentro. La del lienzo —`escena/sala.ts`, en WebGL— existe, pero el lienzo llenaba media
 * pantalla y el resto era negro liso; la de `sinPatron/trazadoDeSala.ts` solo se monta los
 * días sin sujeto. Bryan lo dijo con las palabras exactas: «el salón no ocupaba la
 * pantalla, era una franja apretada entre texto arriba y texto abajo».
 *
 * Esto es la arquitectura del salón dibujada A PANTALLA COMPLETA y por encima del lienzo:
 * suelo, techo, dos muros laterales y el muro del fondo, con el riel del que cuelgan los
 * rótulos y el rodapié donde apoya el mobiliario. Va en trazo y sin relleno opaco, así que
 * el sujeto del lienzo se sigue viendo entero por debajo — la habitación lo RODEA, no lo
 * tapa.
 *
 * ## Por qué un punto de fuga y no dos
 *
 * Porque la cámara del salón mira de frente y el formato es 9:16. Con dos puntos de fuga
 * el muro del fondo se inclina y en un teléfono vertical eso se lee como una sala torcida.
 * Con uno solo, las cuatro paredes convergen al centro del cuadro y la pantalla se lee
 * como un pasillo hacia el sujeto: es la composición que sostiene el contraluz, porque
 * deja el fondo detrás de la silueta y no a un lado.
 *
 * ## Puro, y trazado una sola vez
 *
 * No hay React aquí, ni medidas del navegador: entran constantes y salen cadenas de `d`.
 * Se llama al cargar el módulo y el resultado es una constante para toda la vida de la
 * app. La sala no cambia con la serie, ni con la capa del eje W, ni con el ejercicio: es
 * la habitación, y una habitación que se recalcula sesenta veces por segundo para dibujar
 * exactamente lo mismo es trabajo tirado en el hilo que anima al sujeto.
 */

/** El lienzo del trazado. 9:16 exacto: es el formato del encargo. */
export const LIENZO = { ancho: 360, alto: 640 } as const

/**
 * El punto de fuga, y por qué no está en el centro geométrico.
 *
 * Está en `y = 300` y no en `320`: un pelo por encima de la mitad. Con el punto de fuga
 * en el centro exacto el suelo y el techo salen simétricos y el cuadro se vuelve plano;
 * subiéndolo un poco se ve más suelo que techo, que es lo que ve alguien de pie en un
 * gimnasio y lo que deja sitio abajo para el mobiliario.
 */
const FUGA = { x: 180, y: 300 } as const

/**
 * EL MURO DEL FONDO: el rectángulo al que convergen los otros cuatro planos.
 *
 * Su tamaño es lo que decide cuánta habitación se ve. Estrecho, la sala parece un túnel y
 * los muros laterales se comen la pantalla; ancho, apenas hay escorzo y vuelve a ser un
 * marco plano. Estos números dejan los muros laterales ocupando el 18 % de cada lado —lo
 * justo para que el rótulo colgado de ellos se lea escorzado— y el fondo libre en el
 * centro, que es donde va el sujeto.
 */
const FONDO = { izq: 66, der: 294, arriba: 108, abajo: 452 } as const

/** La altura del riel de los rótulos sobre el muro del fondo. */
const RIEL_FONDO = 190
/** La altura del rodapié sobre el muro del fondo. */
const RODAPIE_FONDO = 440
/** La altura del remate del techo sobre el muro del fondo. */
const REMATE_FONDO = 118

/**
 * Dónde corta el borde de la pantalla la recta que va del punto de fuga a un punto.
 *
 * Es la operación que hace toda la perspectiva de un punto: cualquier línea del suelo, del
 * techo o de un muro lateral es la prolongación de una recta que sale del punto de fuga.
 * Se prolonga hasta `x = 0` o hasta `x = ancho` según el lado y se devuelve la altura a la
 * que llega.
 *
 * Devuelve solo la `y` porque la `x` ya la sabe quien llama: es el borde.
 */
function alBorde(x: number, y: number, lado: 'izq' | 'der'): number {
  const bordeX = lado === 'izq' ? 0 : LIENZO.ancho
  const dx = x - FUGA.x
  if (dx === 0) return y
  const t = (bordeX - FUGA.x) / dx
  return FUGA.y + (y - FUGA.y) * t
}

/** Una línea recta, en la forma que espera el atributo `d` de un `<path>`. */
function linea(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

/**
 * Las cuatro esquinas de la habitación: las aristas donde se juntan dos planos.
 *
 * Son las que hacen que esto se lea como una caja y no como cuatro trapecios sueltos.
 */
function aristas(): string {
  return [
    linea(0, 0, FONDO.izq, FONDO.arriba),
    linea(LIENZO.ancho, 0, FONDO.der, FONDO.arriba),
    linea(0, LIENZO.alto, FONDO.izq, FONDO.abajo),
    linea(LIENZO.ancho, LIENZO.alto, FONDO.der, FONDO.abajo),
  ].join(' ')
}

/**
 * LA RETÍCULA DEL SUELO, que es lo que convierte el suelo en suelo.
 *
 * Sin ella el plano de abajo es una mancha oscura; con ella se ve la profundidad, porque
 * los cuadros se aprietan según se alejan. Son dos familias de líneas:
 *
 * - las que van hacia el fondo, que convergen todas en el punto de fuga;
 * - las transversales, que NO están repartidas a intervalos iguales sino en progresión
 *   geométrica. Repartidas a intervalos iguales el suelo se lee como una escalera plana:
 *   en perspectiva real, la distancia entre dos líneas del suelo se encoge según se aleja,
 *   y esa es justo la señal de profundidad que se está buscando.
 */
function sueloReticula(): string {
  const trazos: string[] = []

  // Las que se van al fondo. Nacen repartidas en el borde de abajo, que es el plano más
  // cercano y por tanto el único donde el reparto es uniforme de verdad.
  for (let i = 0; i <= 8; i += 1) {
    const x0 = (LIENZO.ancho * i) / 8
    const t = (LIENZO.alto - FONDO.abajo) / (LIENZO.alto - FUGA.y)
    trazos.push(linea(x0, LIENZO.alto, x0 + (FUGA.x - x0) * t, FONDO.abajo))
  }

  // Las transversales. `razon` es cuánto queda del alto del suelo al llegar al fondo; la
  // progresión geométrica entre 1 y esa razón es la que da el apretado de la perspectiva.
  const frente = LIENZO.alto - FUGA.y
  const razon = (FONDO.abajo - FUGA.y) / frente
  for (let i = 1; i <= 6; i += 1) {
    const y = FUGA.y + frente * razon ** (i / 6)
    // El ancho del suelo a esa altura: se interpola contra la arista, que es la que marca
    // dónde acaba el suelo y empieza el muro.
    const avance = (LIENZO.alto - y) / (LIENZO.alto - FONDO.abajo)
    const x1 = FONDO.izq * avance
    trazos.push(linea(x1, y, LIENZO.ancho - x1, y))
  }

  return trazos.join(' ')
}

/**
 * Un horizonte del muro: la misma altura, dicha en los tres planos a la vez.
 *
 * El riel, el rodapié y el remate son líneas horizontales en el muro del fondo que
 * CONTINÚAN por los dos muros laterales hasta salirse del cuadro. Es lo que hace que los
 * tres planos se lean como la misma pared doblada y no como tres superficies distintas.
 */
function horizonte(yFondo: number): string {
  return [
    linea(0, alBorde(FONDO.izq, yFondo, 'izq'), FONDO.izq, yFondo),
    linea(FONDO.izq, yFondo, FONDO.der, yFondo),
    linea(FONDO.der, yFondo, LIENZO.ancho, alBorde(FONDO.der, yFondo, 'der')),
  ].join(' ')
}

export interface TrazadoDelSalon {
  /** El plano del suelo, para rellenar. */
  suelo: string
  /** El plano del techo, para rellenar. */
  techo: string
  /** Los dos muros laterales, para rellenar con el degradado del claroscuro. */
  muroIzquierdo: string
  muroDerecho: string
  /** El muro del fondo, para rellenar. */
  muroDelFondo: string
  /** Las cuatro aristas de la caja. */
  aristas: string
  /** La retícula del suelo. */
  reticula: string
  /** El riel del que cuelgan los rótulos. */
  riel: string
  /** El rodapié, donde apoya el mobiliario. */
  rodapie: string
  /** El remate del techo. */
  remate: string
  /** Dónde cae el suelo bajo el sujeto, para apoyar la sombra. */
  apoyo: { cx: number; cy: number; rx: number; ry: number }
}

/** La habitación entera, trazada. */
export function trazarSalon(): TrazadoDelSalon {
  const { ancho, alto } = LIENZO
  return {
    suelo: `M 0 ${alto} L ${ancho} ${alto} L ${FONDO.der} ${FONDO.abajo} L ${FONDO.izq} ${FONDO.abajo} Z`,
    techo: `M 0 0 L ${ancho} 0 L ${FONDO.der} ${FONDO.arriba} L ${FONDO.izq} ${FONDO.arriba} Z`,
    muroIzquierdo: `M 0 0 L ${FONDO.izq} ${FONDO.arriba} L ${FONDO.izq} ${FONDO.abajo} L 0 ${alto} Z`,
    muroDerecho: `M ${ancho} 0 L ${FONDO.der} ${FONDO.arriba} L ${FONDO.der} ${FONDO.abajo} L ${ancho} ${alto} Z`,
    muroDelFondo: `M ${FONDO.izq} ${FONDO.arriba} L ${FONDO.der} ${FONDO.arriba} L ${FONDO.der} ${FONDO.abajo} L ${FONDO.izq} ${FONDO.abajo} Z`,
    aristas: aristas(),
    reticula: sueloReticula(),
    riel: horizonte(RIEL_FONDO),
    rodapie: horizonte(RODAPIE_FONDO),
    remate: horizonte(REMATE_FONDO),
    // La sombra se apoya donde el sujeto pisa: en el eje del cuadro, sobre el suelo, algo
    // por delante del muro del fondo. Es la pieza que impide que la silueta flote.
    apoyo: { cx: FUGA.x, cy: 522, rx: 118, ry: 21 },
  }
}
