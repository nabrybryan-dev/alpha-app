import type { ProporcionesDelCuerpo } from './huellaArticular'
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

/**
 * EL CUERPO DE LA PERSONA: su estatura Y SUS PALANCAS.
 *
 * Es la mitad que faltaba. `juegoParaEstatura` arregla el error grande —que uno de 1,60 se
 * vea como uno de 1,90— pero deja dos personas de la misma altura con el mismo cuerpo, y
 * eso es justo lo que NO es verdad: «una sentadilla con fémur largo no es la misma
 * sentadilla». Con las proporciones que salen de su pista de pose
 * (`proporcionesDePista`), el sujeto pasa a tener las palancas de la persona.
 *
 * ## Cómo se reparte, y por qué así
 *
 * La estatura MANDA y no se toca: es el único número medido en metros que hay, y salir de
 * la ficha con 1,72 para acabar dibujando 1,68 sería estropear el dato bueno con el
 * aproximado. Así que lo que hacen las proporciones es **repartir** esa estatura, no
 * cambiarla.
 *
 * De los cinco segmentos que la pista mide, tres levantan del suelo —fémur, tibia y
 * tronco— y dos no —húmero y antebrazo—. Entonces:
 *
 *  1. La altura disponible del tobillo a la coronilla es `estatura − planta`, y se reparte
 *     entre fémur, tibia y tronco según las razones de la persona, renormalizadas entre
 *     esos tres.
 *  2. Los brazos NO caben en ese reparto porque no suman altura, así que se atan al fémur:
 *     si la persona tiene el húmero 1,1 veces su fémur, el muñeco también.
 *
 * ## Lo que sigue sin medirse
 *
 * `medioHombro` —la media anchura de hombros— no está en la pista: una toma sagital no ve
 * la anchura. Se queda escalada con la estatura, o sea con la proporción del atlas. Y la
 * `planta` tampoco se mide: es hueso y tejido bajo el tobillo, y en la pista el pie casi
 * siempre está tapado.
 *
 * Se dicen las dos en vez de repartirlas también: un número repartido a ojo se mezcla con
 * los medidos y ya no se distingue cuál era cuál.
 */
export function juegoConProporciones(
  juego: JuegoDeHuesos,
  proporciones: ProporcionesDelCuerpo | undefined,
  estaturaCm: number | undefined,
): JuegoDeHuesos {
  const base = juegoParaEstatura(juego, estaturaCm)
  if (!proporciones) return base
  const { femur, tibia, torso } = proporciones
  const enPie = femur + tibia + torso
  if (!(enPie > 0) || !(proporciones.femur > 0)) return base

  // Lo que hay del tobillo a la coronilla: la estatura menos lo que el pie hunde el tobillo.
  const disponible = base.coronilla - base.planta
  const femurNuevo = (disponible * femur) / enPie
  const tibiaNueva = (disponible * tibia) / enPie
  // Los brazos se atan al fémur, que es el segmento mejor visto de la pista en una
  // sentadilla y el que más manda en la geometría del gesto.
  const porFemur = femurNuevo / proporciones.femur
  return {
    ...base,
    fuente: `${base.fuente} Y REPARTIDA con las proporciones de su pista de pose (${proporciones.fotogramas} fotogramas): fémur, tibia y tronco por sus razones medidas; brazos atados al fémur; anchura de hombros y planta sin medir, del atlas.`,
    femur: femurNuevo,
    tibia: tibiaNueva,
    humero: porFemur * proporciones.humero,
    antebrazo: porFemur * proporciones.antebrazo,
    cadera: base.planta + tibiaNueva + femurNuevo,
  }
}
