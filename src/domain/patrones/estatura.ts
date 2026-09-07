import type { JuegoDeHuesos } from './juegoDeHuesos'

/**
 * EL MUÑECO CON LA ESTATURA DEL ASESORADO.
 *
 * Hasta el 2026-09-06 el sujeto del salón medía lo mismo para todo el mundo: el varón de
 * BodyParts3D, 1,714 m. Una persona de 1,60 y otra de 1,90 veían **el mismo cuerpo**
 * haciendo su sentadilla, y no es un detalle estético — es que la geometría del ejercicio
 * depende de cuánto mides. La misma barra, la misma profundidad y el mismo ángulo de
 * tronco no son lo mismo en dos cuerpos distintos.
 *
 * ## De dónde sale la estatura, y de dónde NO
 *
 * De `MedidaCorporal.alturaCm`, que es **obligatorio** en la ficha: todo asesorado que
 * tenga una medida tiene estatura. No sale del encoder: el encoder mide **brazos de
 * momento en milímetros por fotograma**, que es otra cosa, y no da largos de segmento.
 *
 * ## LO QUE ESTO NO HACE, y hay que decirlo antes que lo que hace
 *
 * **No individualiza las proporciones.** Con la estatura sola lo único que se puede hacer
 * es escalar el juego entero por un factor, así que el asesorado sale con las proporciones
 * de su juego —las del atlas— estiradas o encogidas hasta su altura.
 *
 * Y el caso que motivó el encargo es justamente el que NO se resuelve así: dos personas de
 * 1,75 con fémures distintos siguen viéndose iguales, y su sentadilla no lo es. Eso pide
 * medir el fémur, y hoy no se mide. Se queda escrito aquí en vez de disimulado, porque un
 * escalado proporcional presentado como «tus medidas» sería justo el tipo de número que
 * parece un dato y no lo es.
 *
 * Lo que sí se gana no es poco: que alguien de 1,60 deje de verse como uno de 1,90. Ese es
 * el error grande, y es el que se va.
 *
 * El día que haya largos medidos, entran por esta misma puerta y mandan sobre el factor:
 * `juegoParaEstatura` construye un juego, y un juego con largos reales es un juego mejor.
 *
 * ## Por qué se escalan las ocho longitudes y no solo la altura
 *
 * Porque `JuegoDeHuesos` no es una altura con adornos: es el conjunto de medidas del que
 * `esqueletoConJuego` deriva los veintiún huesos. Estirar solo `coronilla` daría un tronco
 * largo sobre piernas de otro, que es peor que no tocar nada. Se escalan todas por el mismo
 * factor —incluida la planta y la media anchura de hombros— y así el cuerpo entero cambia
 * de talla conservando su forma.
 */

/** Estaturas fuera de esto no se escalan: es un dato mal metido, no una persona. */
export const ESTATURA_MINIMA_CM = 130
export const ESTATURA_MAXIMA_CM = 220

/**
 * El juego de huesos de un sexo, llevado a la estatura de una persona.
 *
 * Devuelve el juego original tal cual cuando la estatura no sirve —no medida, absurda, o
 * ya es la del juego—, y eso es a propósito: **no medido no es cero, y tampoco es una
 * estimación**. Sin dato, el muñeco es el del atlas y nadie ha fingido nada.
 */
export function juegoParaEstatura(
  juego: JuegoDeHuesos,
  estaturaCm: number | undefined,
): JuegoDeHuesos {
  if (
    estaturaCm === undefined ||
    !Number.isFinite(estaturaCm) ||
    estaturaCm < ESTATURA_MINIMA_CM ||
    estaturaCm > ESTATURA_MAXIMA_CM
  ) {
    return juego
  }
  const k = estaturaCm / 100 / juego.coronilla
  // Un factor de 1 devuelve el mismo objeto: quien compare por identidad —una caché de
  // esqueletos, por ejemplo— no debe ver un juego nuevo por una estatura que no cambia nada.
  if (Math.abs(k - 1) < 1e-9) return juego
  return {
    ...juego,
    fuente: `${juego.fuente} Escalado a ${estaturaCm} cm de estatura (×${k.toFixed(3)}); las PROPORCIONES siguen siendo las del atlas, no las de la persona.`,
    cadera: juego.cadera * k,
    coronilla: juego.coronilla * k,
    femur: juego.femur * k,
    tibia: juego.tibia * k,
    humero: juego.humero * k,
    antebrazo: juego.antebrazo * k,
    medioHombro: juego.medioHombro * k,
    planta: juego.planta * k,
  }
}

/**
 * La estatura que vale de una lista de medidas: la de la MÁS RECIENTE que la traiga.
 *
 * No la media ni la primera. Una persona crece, se mide mal un día, o le toman la altura
 * con zapatos: lo que hay que dibujar es lo último que se sabe de ella. Y las medidas del
 * repo no vienen ordenadas por contrato, así que aquí se ordena en vez de suponerlo.
 */
export function estaturaVigente(
  medidas: readonly { fecha: string; alturaCm?: number }[] | undefined,
): number | undefined {
  if (!medidas?.length) return undefined
  const conAltura = medidas.filter((m) => Number.isFinite(m.alturaCm))
  if (!conAltura.length) return undefined
  return [...conAltura].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0].alturaCm
}
