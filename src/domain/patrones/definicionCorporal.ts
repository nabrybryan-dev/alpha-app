/**
 * UNA SOLA DEFINICIÓN CORPORAL, Y DE ELLA SALE TODO.
 *
 * ## El fallo que cierra
 *
 * Hasta ahora el visor sacaba el cuerpo de DOS SITIOS a la vez. La malla ósea y las
 * longitudes musculares en reposo salían de `precalculado(sexo, estaturaCm, proporciones)`
 * —el cuerpo de la persona— mientras que la traza del movimiento y el encuadre de cámara
 * salían de `esqueletoDe(sexo)`, un esqueleto definido SOLO por el sexo. O sea: a un
 * asesorado de 1,62 con fémur corto se le dibujaba su cuerpo, y encima se le pintaba el
 * arco de la barra de un varón de 1,714 del atlas.
 *
 * No se ve como un error: se ve como una traza que va «un poco por encima» de las manos.
 * Y no lo caza ninguna prueba de rango, porque los dos caminos son correctos por separado
 * — lo que está mal es que sean dos.
 *
 * ## Qué es una definición corporal
 *
 * El juego de medidas de una persona (`JuegoDeHuesos`) y los veintiún huesos que salen de
 * él, juntos y con nombre. Todo lo que dibuja o mide a esa persona —malla ósea,
 * longitudes en reposo, esqueleto de cada fase, traza, encuadre y los brazos de momento
 * que se calculan sobre el esqueleto resuelto— se pide a la MISMA definición y no puede
 * mezclar dos cuerpos, porque no hay dos de donde elegir.
 *
 * ## Lo que NO cambia
 *
 * Ni un byte del camino por defecto. `definicionDe('hombre')` devuelve exactamente el
 * array de `esqueletoDe('hombre')`, y `definicionDe('neutro')` el `ESQUELETO` de siempre:
 * las huellas de `juegoDeHuesos.test.ts` siguen valiendo. Lo que cambia es que el sexo
 * deja de ser una puerta trasera por la que entra un segundo cuerpo.
 *
 * ## Identidad estable
 *
 * `definicionDe` devuelve **el mismo objeto** para el mismo cuerpo, y de eso depende que
 * la malla y las longitudes en reposo se puedan cachear: reconstruir la malla ósea en
 * cada cuadro cuesta más que dibujarla. La clave la fabrica `claveDeCuerpo`.
 */

import type { Vec3 } from './algebra'
import type { Patron } from './catalogo'
import { encuadrar, esqueletoEnFase, trazaDelPatron, type Encuadre } from './escena'
import { juegoConProporciones } from './estatura'
import {
  resolver,
  type DefinicionHueso,
  type EsqueletoResuelto,
  type Pose,
} from './esqueleto'
import type { ProporcionesDelCuerpo } from './huellaArticular'
import { construirHuesos } from './huesos'
import {
  esqueletoConJuego,
  esqueletoDe,
  HUESOS_POR_DEFECTO,
  JUEGOS,
  SEXO_POR_DEFECTO,
  type JuegoDeHuesos,
  type Sexo,
} from './juegoDeHuesos'
import type { Malla } from './malla'
import { longitudesEnReposo } from './musculos'

/**
 * A qué altura se pone la pelvis para medir los músculos en reposo.
 *
 * Es la altura neutra de la pelvis del esqueleto original y estaba escrita a pelo en el
 * visor. Vive aquí porque el reposo tiene que ser el MISMO cada vez que se mide: si cada
 * capa lo pusiera a su altura, un músculo saldría estirado en una y en reposo en otra.
 *
 * No hace falta que sea la altura real de la cadera de esta persona —el largo de un
 * fascículo en reposo depende de dónde nacen y mueren sus anclajes en los huesos, no de a
 * qué altura del mundo esté el conjunto— y por eso no se toca al cambiar de juego.
 */
export const ALTURA_DE_REPOSO = 0.95

/**
 * EL CUERPO DE UNA PERSONA, en un solo objeto.
 *
 * `sexo`, `estaturaCm` y `proporciones` se guardan tal como entraron para poder decir de
 * dónde salió el cuerpo: sin ellos, un muñeco escalado y uno del atlas son
 * indistinguibles, y eso es justo lo que no se puede perder (ver `estatura.ts`: no medido
 * NO es una estimación).
 */
export interface DefinicionCorporal {
  sexo: Sexo
  /** La estatura de la ficha, si la hay. `undefined` es «no medida», no «media». */
  estaturaCm?: number
  /** Las razones entre segmentos de su pista de pose, si las hay. */
  proporciones?: ProporcionesDelCuerpo
  /** El juego de medidas del que se derivan los huesos, con su `fuente` escrita. */
  juego: JuegoDeHuesos
  /** Los veintiún huesos, listos para `resolver()`, `esqueletoEnFase()` y `construirHuesos()`. */
  huesos: readonly DefinicionHueso[]
  /** Clave estable de este cuerpo: dos lecturas del mismo cuerpo dan la misma. */
  clave: string
}

/**
 * La clave de un cuerpo.
 *
 * Sin estatura ni proporciones es el sexo a secas, y eso importa: el camino por defecto no
 * gana una clave compuesta ni una entrada de caché nueva.
 *
 * Las cinco razones entran redondeadas a la milésima porque dos lecturas que difieran en
 * una milésima son el mismo cuerpo y no merecen otra malla. Entran LAS CINCO, no tres:
 * `juegoConProporciones` reparte la estatura con fémur, tibia y torso pero ata los brazos
 * al fémur con `humero` y `antebrazo`, así que dos pistas iguales de piernas y distintas
 * de brazos son dos cuerpos distintos y tienen que tener dos claves.
 */
export function claveDeCuerpo(
  sexo: Sexo,
  estaturaCm?: number,
  proporciones?: ProporcionesDelCuerpo,
): string {
  if (estaturaCm === undefined && !proporciones) return sexo
  const p = proporciones
  const forma = p
    ? `|${p.femur.toFixed(3)},${p.tibia.toFixed(3)},${p.torso.toFixed(3)},` +
      `${p.humero.toFixed(3)},${p.antebrazo.toFixed(3)}`
    : ''
  return `${sexo}|${estaturaCm ?? '-'}${forma}`
}

const POR_CLAVE = new Map<string, DefinicionCorporal>()

/**
 * LA DEFINICIÓN CORPORAL DE UNA PERSONA: su sexo, su estatura y sus proporciones.
 *
 * Los tres argumentos son los que ya circulan por la app (`CuerpoDelAsesorado` trae los
 * dos últimos) y los dos últimos pueden faltar por separado:
 *
 *  - **sin nada**: el sujeto del atlas de su sexo, el de siempre;
 *  - **con estatura**: ese mismo cuerpo llevado a su talla (`juegoParaEstatura`);
 *  - **con las dos**: además, su estatura repartida con SUS palancas
 *    (`juegoConProporciones`).
 *
 * Devuelve siempre el mismo objeto para el mismo cuerpo. Quien quiera cachear algo
 * derivado —una malla, una traza— puede usar la definición como llave.
 */
export function definicionDe(
  sexo: Sexo = SEXO_POR_DEFECTO,
  estaturaCm?: number,
  proporciones?: ProporcionesDelCuerpo,
): DefinicionCorporal {
  const clave = claveDeCuerpo(sexo, estaturaCm, proporciones)
  const guardada = POR_CLAVE.get(clave)
  if (guardada) return guardada

  const base = JUEGOS[sexo]
  const juego = juegoConProporciones(base, proporciones, estaturaCm)
  // Cuando ni la estatura ni las proporciones mueven nada, el juego devuelto ES el del
  // atlas y entonces los huesos son los de `esqueletoDe`: el mismo array de siempre, sin
  // una copia nueva y sin un byte de diferencia.
  const huesos = juego === base ? esqueletoDe(sexo) : esqueletoConJuego(juego)
  const definicion: DefinicionCorporal = {
    sexo,
    estaturaCm,
    proporciones,
    juego,
    huesos,
    clave,
  }
  POR_CLAVE.set(clave, definicion)
  return definicion
}

const MALLAS = new WeakMap<DefinicionCorporal, Malla>()
const REPOSOS = new WeakMap<DefinicionCorporal, Record<string, number>>()
const ESQUELETOS_EN_REPOSO = new WeakMap<DefinicionCorporal, EsqueletoResuelto>()

/** La malla ósea de este cuerpo. Se construye una vez por definición. */
export function mallaOsea(definicion: DefinicionCorporal): Malla {
  let malla = MALLAS.get(definicion)
  if (!malla) {
    malla = construirHuesos(definicion.huesos)
    MALLAS.set(definicion, malla)
  }
  return malla
}

/** Este cuerpo de pie y sin pose, que es contra lo que se mide un músculo en reposo. */
export function esqueletoEnReposo(definicion: DefinicionCorporal): EsqueletoResuelto {
  let esq = ESQUELETOS_EN_REPOSO.get(definicion)
  if (!esq) {
    esq = resolver({}, [0, ALTURA_DE_REPOSO, 0], [0, 0, 0], definicion.huesos)
    ESQUELETOS_EN_REPOSO.set(definicion, esq)
  }
  return esq
}

/**
 * El largo en reposo de cada fascículo de este cuerpo.
 *
 * Es lo que convierte un largo instantáneo en una activación por estiramiento, así que
 * tiene que salir de los MISMOS huesos que la malla: medir la carne de un cuerpo contra
 * el reposo de otro da músculos permanentemente estirados o encogidos.
 */
export function reposoMuscular(definicion: DefinicionCorporal): Record<string, number> {
  let reposo = REPOSOS.get(definicion)
  if (!reposo) {
    reposo = longitudesEnReposo(esqueletoEnReposo(definicion))
    REPOSOS.set(definicion, reposo)
  }
  return reposo
}

/** El largo de cada uno de los veintiún huesos de este cuerpo, en metros. */
export function largosDeHueso(definicion: DefinicionCorporal): Record<string, number> {
  return esqueletoEnReposo(definicion).largo
}

/** Este cuerpo en una fase del patrón. Es `esqueletoEnFase` atado a una sola definición. */
export function esqueletoDeFase(
  definicion: DefinicionCorporal,
  patron: Patron,
  fase: number,
  sentido = 1,
  reloj = 0,
  medida?: Pose,
): EsqueletoResuelto {
  return esqueletoEnFase(patron, fase, sentido, reloj, medida, definicion.huesos)
}

/** La traza del movimiento de ESTE cuerpo. */
export function trazaDe(definicion: DefinicionCorporal, patron: Patron): Vec3[] | null {
  return trazaDelPatron(patron, definicion.huesos)
}

/** El encuadre de cámara de ESTE cuerpo. */
export function encuadreDe(definicion: DefinicionCorporal, patron: Patron): Encuadre {
  return encuadrar(patron, definicion.huesos)
}

/**
 * LOS ÁNGULOS ARTICULARES DE UNA POSE, en grados: cuánto se separa cada hueso de la
 * dirección de su padre.
 *
 * Sirve para lo que ninguna otra medida del rig sirve: comparar la POSE de dos cuerpos
 * distintos. Un punto del mundo depende del largo de los huesos —dos personas en la misma
 * sentadilla tienen la cadera a distinta altura— pero el ángulo de la rodilla no: la parte
 * de rotación de una matriz de mundo es el producto de las rotaciones de la cadena, y los
 * largos solo entran en la traslación.
 *
 * Con esto se comprueba lo que hay que comprobar al individualizar un cuerpo: que la
 * persona alta y la baja hacen **el mismo ejercicio** —los mismos ángulos en las mismas
 * fases— con **palancas distintas**. Si al cambiar el cuerpo cambiaran los ángulos, el
 * catálogo habría dejado de mandar.
 */
export function angulosArticulares(
  esq: EsqueletoResuelto,
  huesos: readonly DefinicionHueso[] = HUESOS_POR_DEFECTO,
): Record<string, number> {
  const salida: Record<string, number> = {}
  // El eje +Y del hueso en el mundo: la tercera columna de la matriz es la Z, la segunda
  // la Y, y es a lo largo de su +Y como apunta cada hueso (ver `puntoDeHueso`).
  const eje = (m: number[]): Vec3 => {
    const l = Math.hypot(m[4], m[5], m[6]) || 1
    return [m[4] / l, m[5] / l, m[6] / l]
  }
  for (const h of huesos) {
    const mio = esq.mundo[h.nombre]
    if (!mio) continue
    // Sin padre, contra la raíz: es la dirección del sujeto entero, y así la pelvis de
    // alguien tumbado no se lee como una pelvis flexionada.
    const suyo = h.padre ? esq.mundo[h.padre] : esq.raiz
    if (!suyo) continue
    const a = eje(mio)
    const b = eje(suyo)
    const coseno = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
    salida[h.nombre] = (Math.acos(coseno) * 180) / Math.PI
  }
  return salida
}
