/**
 * LOS HUESOS DEL SUJETO, POR SEXO.
 *
 * El sujeto de `esqueleto.ts` tiene proporciones inventadas. Medido contra dos
 * anatomías reales (2026-09-05), su tibia —0,43 m— es más larga que la de un varón de
 * referencia (0,377) y que la de una mujer (0,341), y su cadera está más alta que la
 * de los dos. Aquí viven las longitudes que sí están medidas, y de cada juego sale un
 * esqueleto con los mismos veintiún huesos, en el mismo orden y con los mismos
 * padres: solo cambian `desde` y `largo`.
 *
 * Tres juegos:
 *
 *  - `neutro`: el esqueleto de hoy, tal cual. ES EL QUE SE USA POR DEFECTO y no cambia
 *    ni un byte, porque cada patrón, cada prueba y cada foto aprobada están hechos con
 *    él. `esqueletoDe('neutro')` devuelve el mismo objeto `ESQUELETO`.
 *  - `hombre`: BodyParts3D 4.0, el varón adulto del atlas que ya está dentro de la app.
 *  - `mujer`: Human Reference Atlas v1.5 (3D Reference Organ Set for Female). Trae
 *    pierna, cadera y estatura; NO trae húmero ni radio, así que el brazo femenino es
 *    un SUPUESTO, escrito como tal más abajo.
 *
 * Las alturas de las articulaciones, de pie y desde el suelo, en metros —medidas con
 * `resolver({}, [0, 0, 0], [0, 0, 0])` y `puntoDeHueso()`, nunca sobre la malla de
 * `construirHuesos()`, que dibuja en el espacio local de cada hueso y ya engañó una vez:
 *
 *   articulación                neutro   hombre   mujer
 *   tobillo                     0,076    0,072    0,074
 *   rodilla                     0,505    0,449    0,415
 *   cadera (cabeza del fémur)   0,955    0,912    0,833
 *   hombro (cabeza del húmero)  1,412    1,415    —
 *   codo                        1,104    1,110    —
 *   muñeca                      0,846    0,884    —
 *   coronilla                   1,690    1,714    1,666
 *   medio hombro (eje → húmero) 0,168    0,190    —
 *
 * Lo que un juego decide: el largo de fémur, tibia, húmero y antebrazo; la altura de la
 * cadera; la estatura; y la anchura de hombros. Lo que no tiene medida —mano, pie,
 * anchura de cadera, grosor de nada— se queda como en el neutro.
 */

import { ESQUELETO, type DefinicionHueso } from './esqueleto'

export type Sexo = 'neutro' | 'hombre' | 'mujer'

/** En el orden en que se ofrecen: primero el que se usa si nadie elige. */
export const SEXOS: readonly Sexo[] = ['neutro', 'hombre', 'mujer']

export interface JuegoDeHuesos {
  sexo: Sexo
  /** De dónde salen las medidas, para que ningún número quede sin padre. */
  fuente: string
  /** Altura de la cabeza del fémur sobre el suelo, de pie. */
  cadera: number
  /** Altura de la coronilla sobre el suelo, de pie: la estatura. */
  coronilla: number
  femur: number
  tibia: number
  humero: number
  antebrazo: number
  /** Del eje del cuerpo al centro de la cabeza del húmero: media anchura de hombros. */
  medioHombro: number
}

const POR_NOMBRE: Record<string, DefinicionHueso> = Object.fromEntries(
  ESQUELETO.map((h) => [h.nombre, h]),
)

/** Altura a la que nace el último hueso de una cadena de `desde`, con la raíz en 0. */
const alturaDe = (cadena: string[]): number =>
  cadena.reduce((y, nombre) => y + POR_NOMBRE[nombre].desde[1], 0)

/**
 * El neutro se DERIVA de `ESQUELETO`, no se copia: si alguien toca un largo allí, las
 * razones con las que se construyen los otros dos juegos cambian con él.
 */
const NEUTRO: JuegoDeHuesos = {
  sexo: 'neutro',
  fuente: 'El esqueleto de siempre (esqueleto.ts): proporciones sin medir.',
  cadera: alturaDe(['pelvis', 'musloD']),
  coronilla: alturaDe(['pelvis', 'lumbar', 'torax', 'cuello', 'craneo']) + POR_NOMBRE.craneo.largo,
  femur: POR_NOMBRE.musloD.largo,
  tibia: POR_NOMBRE.tibiaD.largo,
  humero: POR_NOMBRE.brazoD.largo,
  antebrazo: POR_NOMBRE.antebrazoD.largo,
  medioHombro: -POR_NOMBRE.brazoD.desde[0],
}

/**
 * Los largos salen de restar alturas del atlas: fémur = cadera − rodilla, tibia =
 * rodilla − tobillo, húmero = hombro − codo, antebrazo = codo − muñeca.
 */
const HOMBRE: JuegoDeHuesos = {
  sexo: 'hombre',
  fuente: 'BodyParts3D 4.0, varón adulto; alturas medidas en el atlas el 2026-09-05.',
  cadera: 0.912,
  coronilla: 1.714,
  femur: 0.463,
  tibia: 0.377,
  humero: 0.305,
  antebrazo: 0.226,
  medioHombro: 0.19,
}

/**
 * SUPUESTO DEL BRAZO FEMENINO. El atlas femenino no trae húmero ni radio —sus 91 piezas
 * de esqueleto son la columna, dos rodillas y tejido óseo suelto—, así que el brazo y
 * los hombros de la mujer son los del varón escalados a su estatura (1,666 / 1,714).
 * Es una proporción, no una medida: el día que haya un atlas femenino con brazo, estos
 * tres números se sustituyen y el supuesto se borra.
 */
const ESCALA_MUJER_SOBRE_HOMBRE = 1.666 / 1.714

const MUJER: JuegoDeHuesos = {
  sexo: 'mujer',
  fuente:
    'Human Reference Atlas v1.5 (3D Reference Organ Set for Female) para pierna, ' +
    'cadera y estatura; el brazo es un SUPUESTO: el del varón a su estatura.',
  cadera: 0.833,
  coronilla: 1.666,
  femur: 0.418,
  tibia: 0.341,
  humero: HOMBRE.humero * ESCALA_MUJER_SOBRE_HOMBRE,
  antebrazo: HOMBRE.antebrazo * ESCALA_MUJER_SOBRE_HOMBRE,
  medioHombro: HOMBRE.medioHombro * ESCALA_MUJER_SOBRE_HOMBRE,
}

export const JUEGOS: Record<Sexo, JuegoDeHuesos> = { neutro: NEUTRO, hombre: HOMBRE, mujer: MUJER }

/**
 * El esqueleto de un sexo, listo para `resolver()`, `esqueletoEnFase()` y
 * `construirHuesos()`.
 *
 * AÚN NO SIGUE AL JUEGO: por ahora devuelve el neutro para los tres, y los guardianes de
 * `juegoDeHuesos.test.ts` que piden la rodilla del varón a 0,449 están en rojo a
 * propósito. Es el rastro de por qué existen.
 */
export function esqueletoDe(sexo: Sexo = 'neutro'): readonly DefinicionHueso[] {
  void sexo
  return ESQUELETO
}
