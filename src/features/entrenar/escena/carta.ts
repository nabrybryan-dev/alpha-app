import { BAHIA } from '../../../domain/escenario/laboratorio'
import { ENCUADRE_SALA, SALA } from './sala'

/**
 * LA CARTA DEL ESPACIO: el plano cartesiano del salón, declarado en un solo sitio.
 *
 * ## Por qué existe
 *
 * Todo lo que hay en el salón —el esqueleto, la sala, la cámara, los cuadros de pared,
 * las estaciones, el trípode— vive en el mismo espacio, y ese espacio estaba definido en
 * SEIS comentarios de seis archivos distintos. Cada uno decía una parte: `esqueleto.ts`
 * que el sujeto mira a +Z, `sala.ts` que la pared está a 7 m, `laboratorio.ts` que el
 * suelo es Y=0, `geometriaDeCuadro.ts` la convención del azimut… Ninguna prueba afirmaba
 * ninguna. Un marco de referencia que solo vive en comentarios se cumple mientras alguien
 * se acuerde, y el día que alguien ponga la derecha en +X nada se pondrá en rojo: el
 * sujeto saldrá espejado y los cuadros colgarán del muro equivocado, y los dos se verán
 * «casi bien».
 *
 * Bryan lo pidió el 2026-09-04 con estas palabras: «precisar más las dimensiones del
 * salón, todo lo que tiene que ver con el plano cartesiano en cuatro dimensiones, que
 * referencies muy bien sus puntos específicos, sus medidas». Esto es eso: la carta, y
 * `carta.test.ts` es lo que la contrasta con los objetos de verdad.
 *
 * ## Las cuatro dimensiones
 *
 * Tres son del espacio y una lo atraviesa:
 *
 * - **X** — lateral. **La derecha anatómica del sujeto cae en −X.** Es lo que ve el
 *   asesorado si se mira al espejo, que es la referencia con la que corrige su técnica.
 * - **Y** — vertical, hacia arriba. **El suelo es Y = 0**, en metros.
 * - **Z** — profundidad. **El sujeto mira hacia +Z.** Su plano sagital es X = 0.
 * - **W** — la profundidad DEL CUERPO, no del espacio: cinco escalones de la piel (0) al
 *   hueso (4). No es un eje geométrico —no tiene metros— y por eso no se dibuja: se
 *   atraviesa. Ver `capas/nivelesAnatomicos.ts`.
 *
 * ## La convención de la cámara
 *
 * La órbita se describe con **azimut, elevación y distancia** alrededor de un centro.
 * **Azimut 0 mira desde +Z hacia el centro**, o sea desde delante del sujeto; **90** desde
 * su izquierda (+X); **180** desde detrás. La elevación sube la cámara sobre el
 * horizonte. Es la MISMA convención en el motor, en el proyector de los cuadros y en las
 * estaciones: si una discrepara medio grado, flotaría.
 *
 * ## LAS DOS CONVENCIONES DE ÁNGULO, y esto es lo que más importa saber
 *
 * En este espacio conviven dos formas de medir un ángulo alrededor del sujeto, y las dos
 * son correctas en su sitio:
 *
 * - **La de la CÁMARA**: `x = sin(a)`, `z = cos(a)`. Cero en +Z. La usan la órbita, el
 *   proyector de los cuadros de pared, las estaciones y `puntoEnElSuelo()` de aquí.
 * - **La de la SALA**: `x = cos(a)`, `z = sin(a)`. Cero en +X. La usa `sala.ts` para
 *   colgar los tres marcadores a 120° y para plantar la estación de grabación.
 *
 * Están giradas un cuarto de vuelta y en sentido contrario: **cámara = 90° − sala**. Por
 * eso «la estación está a 180°» y «la estación está en el perfil del sujeto» son la misma
 * frase: 180° de sala son 270° de cámara, o sea −X, el lado derecho anatómico.
 *
 * NO se unifican aquí. La de la sala está en la geometría que Bryan pidió no tocar, y las
 * dos ya tienen pruebas propias. Lo que hace la carta es DECIRLO y clavar la relación con
 * una prueba: el día que alguien cambie una sin la otra, `carta.test.ts` se pone en rojo
 * en vez de que el trípode aparezca en la pared equivocada.
 *
 * ## Las unidades
 *
 * **Metros y grados.** Sin excepción en el espacio; los píxeles aparecen solo al proyectar
 * a la pantalla, y ahí los pone el proyector. Un número sin unidad en este espacio es un
 * error, no una convención implícita.
 */

/** La talla del sujeto de referencia, en metros. Las proporciones del esqueleto salen de ella. */
export const TALLA = 1.7

/** Dónde está la pelvis de pie, en metros sobre el suelo. Es la raíz del esqueleto. */
export const ALTURA_DE_LA_PELVIS = 0.95

/**
 * LA CARTA. Todo en metros y grados, y todo con su fuente: cada número apunta al objeto
 * que lo define de verdad, para que esto sea un ÍNDICE y no una segunda copia.
 */
export const CARTA = {
  ejes: {
    X: 'lateral · la derecha anatómica del sujeto en −X',
    Y: 'vertical · el suelo en Y = 0',
    Z: 'profundidad · el sujeto mira a +Z; su plano sagital es X = 0',
    W: 'la profundidad del cuerpo · piel 0 → hueso 4; se atraviesa, no se dibuja',
  },
  unidades: { longitud: 'metros', angulo: 'grados' },

  /** El sujeto. */
  sujeto: {
    talla: TALLA,
    pelvis: ALTURA_DE_LA_PELVIS,
    mira: [0, 0, 1] as const,
    derecha: [-1, 0, 0] as const,
  },

  /** Los radios concéntricos de la sala, de dentro afuera. */
  radios: {
    /** La placa de fuerza: donde se pone el sujeto. */
    placa: BAHIA.radioPlaca,
    /** El bordillo de la bahía: 30 cm de alto, un umbral y no un muro. */
    bahia: BAHIA.radioBahia,
    /** Hasta dónde llega el suelo dibujado; más allá la bruma lo tapa. */
    suelo: BAHIA.radioSuelo,
    /** La pared. Por encima del radio de órbita a propósito: nunca se interpone. */
    pared: SALA.radio,
  },

  /** La cámara del salón, tal como entra. */
  camara: {
    distancia: ENCUADRE_SALA.distancia,
    centro: ENCUADRE_SALA.centro,
    elevacionMaxima: ENCUADRE_SALA.elevacionMaxima,
    convencion: 'azimut 0 mira desde +Z; 90 desde +X; 180 desde −Z',
  },

  /** La estación de grabación: el contrato del encoder. */
  estacion: SALA.estacion,
} as const

/**
 * EL AZIMUT DESDE EL QUE SE VE UN PUNTO DEL SUELO, en la convención de la carta.
 *
 * Es la única fórmula que hace falta para colocar cosas por azimut, y por eso está aquí y
 * no repetida en cada sitio que la usa: `atan2(x, z)` en grados, con 0 en +Z y creciendo
 * hacia +X. Escrita al revés —`atan2(z, x)`— sale con 0 en +X, y todo lo que se cuelgue
 * con ella cae un cuarto de vuelta más allá sin que ninguna prueba lo diga.
 */
export function azimutDe(x: number, z: number): number {
  const grados = (Math.atan2(x, z) * 180) / Math.PI
  return ((grados % 360) + 360) % 360
}

/**
 * De un ángulo de la SALA (0 en +X) a un azimut de CÁMARA (0 en +Z).
 *
 * `sala.ts` planta el trípode con `x = cos(a)`, `z = sin(a)`; la cámara y los cuadros con
 * `x = sin(a)`, `z = cos(a)`. Un mismo punto del suelo se llama `a` en una y `90 − a` en la
 * otra. Es la única conversión que hay que hacer para colgar algo de cámara donde la sala
 * puso un objeto, y por eso está aquí una vez.
 */
export function azimutDeCamaraDesdeSala(anguloDeSala: number): number {
  return ((90 - anguloDeSala) % 360 + 360) % 360
}

/** El punto del suelo a un radio y un azimut, en la convención de la CÁMARA. */
export function puntoEnElSuelo(radio: number, azimut: number): [number, number, number] {
  const a = (azimut * Math.PI) / 180
  return [Math.sin(a) * radio, 0, Math.cos(a) * radio]
}
