import type { Vec3 } from '../../../domain/patrones/algebra'
import { Malla, type Color } from '../../../domain/patrones/malla'
import { caja } from './piezas'

/**
 * EL HIERRO DE LA SALA: un perímetro de estaciones alrededor de la bahía.
 *
 * ## Por qué existe
 *
 * Hasta el 2026-09-02 la sala eran cuatro paredes, tres marcadores y la estación. Se
 * dibujaba y no se leía como un gimnasio, y el motivo salió al construir el boceto: **en
 * un 9:16 una sala no se lee por sus esquinas, se lee por sus objetos.**
 *
 * ## POR QUÉ HAY DIEZ ESTACIONES Y NO CUATRO, que es la decisión de este archivo
 *
 * El campo visual del salón son **26° verticales** (`CAMPO_VISUAL`), y en un lienzo de
 * 414 × 736 eso deja **14,8° horizontales**. A nueve metros —lo que hay desde la cámara
 * hasta la pared de enfrente— por esa rendija solo se ve una franja de **2,6 m de ancho**.
 * Nada más.
 *
 * El primer intento puso cuatro muebles buenos en cuatro ángulos, y se midió: los cuatro
 * fuera de cuadro, con la sala pintando exactamente los mismos píxeles que sin ellos. No
 * estaban mal hechos; estaban donde no se miraba. Y no hay un ángulo bueno: el azimut de
 * entrada lo pone cada patrón —72° para la sentadilla, otro para el remo—, así que un
 * mueble en un sitio fijo se ve en unos ejercicios y en otros no.
 *
 * La salida es la de un gimnasio de verdad: **hierro en todo el perímetro**. Con una
 * estación cada 36°, se mire por donde se mire hay algo detrás del sujeto.
 *
 * ## Y por qué son cajas y no cilindros
 *
 * Porque diez estaciones con discos redondos no caben en el presupuesto.
 * `informes/presupuesto-de-fotograma.md` midió que el fotograma gasta 13,9 ms de los 16,7
 * que hay a 60 Hz, y que el margen es **≈ 7.500 vértices**. Un disco de doce lados cuesta
 * 76 vértices; una caja, 24. A nueve metros y por un objetivo de 15°, un disco de goma
 * mide unos cuarenta píxeles: la diferencia entre el redondo y la caja no se ve, y la de
 * coste sí. Es un nivel de detalle elegido por la distancia, no una simplificación por
 * pereza — y por eso está dicho aquí y no escondido.
 *
 * ## Dónde, respecto a la órbita
 *
 * Todo vive **más lejos que el radio de órbita** (`ENCUADRE_SALA.distancia`, 4,6 m) y
 * dentro del muro. Es la misma regla con la que la sala puso su pared a 7,0 m: fuera de
 * la órbita, el hierro está siempre al otro lado del sujeto y no lo tapa nunca, gire por
 * donde gire.
 */

/**
 * EL TONO DEL HIERRO, y por qué es tan alto para una sala negra.
 *
 * El muro está en 0,062 lineal —negro mate, que es lo que pide el documento maestro— y el
 * primer intento pintó el acero en 0,22. Sobre el papel son tres veces y media más claro;
 * en pantalla, después del mapeo de tonos y de las capas de claroscuro que van encima del
 * lienzo, la diferencia se comía casi entera y el perímetro se leía como pared.
 *
 * Se comprobó con un cebo: una caja BLANCA en el mismo sitio salió enorme y clarísima, así
 * que ni la geometría ni la colocación estaban mal — estaba mal el tono. Estos valores son
 * los que separan el hierro del muro sin encender la sala: lo que se ilumina es el
 * equipamiento, no el ambiente, que es como está iluminado un gimnasio de verdad.
 */
const ACERO: Color = [0.46, 0.485, 0.53]
const ACERO_OSCURO: Color = [0.3, 0.315, 0.35]
const GOMA: Color = [0.19, 0.2, 0.22]
const CROMO: Color = [0.72, 0.75, 0.8]
const TAPIZADO: Color = [0.34, 0.35, 0.38]
const LUZ: Color = [0.88, 0.92, 0.97]
const ACENTO: Color = [0.62, 0.14, 0.14]

/**
 * Un sólido del perímetro, colocado por AZIMUT DE CÁMARA y con su cara mirando al centro.
 *
 * El azimut es el que ya usa la órbita —`[sin(az), y, cos(az)] · radio`, con el cero
 * mirando a +Z, que es hacia donde mira el sujeto— y no el seno y coseno de siempre. Se
 * escribe así para que poner un mueble «detrás del sujeto» sea sumarle 180 al azimut de
 * entrada del patrón, y no una conversión que nadie recuerda al mes siguiente.
 *
 * `dl` separa piezas dentro de una misma estación, a lo ancho; `dr` acerca o aleja del
 * muro. Las dos van en metros y en los ejes de la estación, no en los del mundo.
 */
function pieza(
  m: Malla,
  az: number,
  radio: number,
  dl: number,
  y: number,
  medias: Vec3,
  c: Color,
): void {
  const a = (az * Math.PI) / 180
  const sin = Math.sin(a)
  const cos = Math.cos(a)
  caja(m, [sin * radio + cos * dl, y, cos * radio - sin * dl], medias, az, c)
}

/** LA JAULA: cuatro montantes, el travesaño de arriba y la barra puesta en los ganchos. */
function jaula(m: Malla, az: number, r: number): void {
  for (const dl of [-0.66, 0.66]) {
    for (const dr of [-0.5, 0.5]) pieza(m, az, r + dr, dl, 1.15, [0.05, 1.15, 0.05], ACERO)
    pieza(m, az, r, dl, 2.28, [0.05, 0.05, 0.55], ACERO)
  }
  pieza(m, az, r - 0.5, 0, 2.28, [0.71, 0.05, 0.05], ACERO)
  // La barra en los ganchos. Sin ella una jaula es un andamio.
  pieza(m, az, r - 0.42, 0, 1.42, [1.05, 0.016, 0.016], CROMO)
  for (const dl of [-0.84, 0.84]) pieza(m, az, r - 0.42, dl, 1.42, [0.05, 0.225, 0.225], GOMA)
}

/** EL ÁRBOL DE DISCOS: el poste y los discos ensartados, de mayor a menor. */
function arbolDeDiscos(m: Malla, az: number, r: number): void {
  pieza(m, az, r, 0, 0.05, [0.34, 0.05, 0.34], ACERO_OSCURO)
  pieza(m, az, r, 0, 0.7, [0.05, 0.65, 0.05], ACERO)
  let y = 0.16
  for (const rad of [0.225, 0.225, 0.2, 0.17]) {
    pieza(m, az, r, 0, y, [rad, rad, 0.03], GOMA)
    y += 0.07
  }
}

/** EL BANCO PLANO: colchoneta, dos patas y la base. */
function banco(m: Malla, az: number, r: number): void {
  pieza(m, az, r, 0, 0.45, [0.16, 0.05, 0.62], TAPIZADO)
  for (const dr of [-0.45, 0.45]) pieza(m, az, r + dr, 0, 0.2, [0.06, 0.2, 0.06], ACERO)
  pieza(m, az, r, 0, 0.03, [0.2, 0.03, 0.7], ACERO_OSCURO)
}

/** EL SOPORTE DE MANCUERNAS: dos baldas y tres pares tumbados en cada una. */
function mancuernas(m: Malla, az: number, r: number): void {
  pieza(m, az, r, 0, 0.42, [0.9, 0.05, 0.2], ACERO_OSCURO)
  pieza(m, az, r, 0, 0.14, [0.9, 0.06, 0.26], ACERO_OSCURO)
  for (const dl of [-0.55, 0, 0.55]) {
    for (const y of [0.56, 0.27]) pieza(m, az, r, dl, y, [0.16, 0.09, 0.09], CROMO)
  }
}

/**
 * LAS ESTACIONES DEL PERÍMETRO, una cada 18°.
 *
 * DIECIOCHO GRADOS Y NO TREINTA Y SEIS, y el número está medido, no elegido. La ventana
 * que el objetivo deja ver del perímetro es de **±13°** alrededor de la dirección opuesta
 * a la cámara: media anchura del cuadro (207 px) sobre la distancia focal (1594) da 7,4°
 * de campo, y a 5,95 m de radio y 10,5 de profundidad eso se abre a trece.
 *
 * Con una estación cada 36° hay vueltas en las que NINGUNA cae dentro, y se midió: con
 * cuatro tipos repartidos así, detrás del sujeto quedaba solo un banco y la sala ganaba
 * 726 píxeles. Cada 18° la más cercana está siempre a menos de nueve grados, así que
 * mires por donde mires hay hierro detrás.
 *
 * El orden alterna a propósito: dos jaulas seguidas se leerían como un patrón repetido y
 * delatarían que esto se genera. Y la jaula sale una de cada cuatro porque es la pieza
 * alta —2,3 m— y la que más dice «gimnasio»: con ella cada 72° casi nunca falta.
 */
const CICLO: readonly ((m: Malla, az: number, r: number) => void)[] = [
  jaula,
  arbolDeDiscos,
  banco,
  mancuernas,
]
/**
 * DIECISÉIS, que es el número más bajo que aún cumple la garantía.
 *
 * Con 16 estaciones el paso es de 22,5° y la más cercana queda siempre a menos de 11,25°
 * — dentro de la ventana de ±13°. Veinte también valía y costaba un quinto más: 4.651
 * vértices contra 3.900, sobre un margen de fotograma de 7.500 que ya está medido en
 * `informes/presupuesto-de-fotograma.md`. Cuando dos números cumplen, se coge el barato.
 */
const ESTACIONES = 16
const PASO = 360 / ESTACIONES

/**
 * LAS LUMINARIAS Y LAS TIRAS DE ACENTO.
 *
 * Las luminarias no iluminan: el motor no tiene luces dinámicas y añadirlas costaría el
 * fotograma entero. Son paneles claros en el techo, y con eso basta — lo que hace que un
 * techo se lea como techo es que tenga algo, no que ese algo emita.
 */
function luces(m: Malla, alto: number): void {
  for (let i = 0; i < 8; i++) pieza(m, i * 45, 3.6, 0, alto - 0.07, [0.6, 0.03, 0.16], LUZ)
  // Las tiras rojas de los muros. Son el acento del sistema y aquí hacen de referencia de
  // altura: se lee de un vistazo cuánto mide la sala.
  for (let i = 0; i < 10; i++) pieza(m, i * 36 + 18, 6.88, 0, 1.6, [0.045, 1.15, 0.03], ACENTO)
}

/**
 * Todo el mobiliario de la sala.
 *
 * El radio y el alto llegan desde `sala.ts` para que el hierro no tenga que saberse los
 * números: si la sala crece, el mobiliario crece con ella y nadie tiene que acordarse de
 * dos sitios.
 */
export function construirMobiliario(m: Malla, radioSala: number, altoSala: number): void {
  // El anillo del hierro: pegado al muro y muy por fuera del radio de órbita.
  const anillo = radioSala - 1.05
  for (let i = 0; i < ESTACIONES; i++) CICLO[i % CICLO.length](m, i * PASO, anillo)
  luces(m, altoSala)
}
