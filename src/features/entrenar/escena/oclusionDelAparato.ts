import type { Patron } from '../../../domain/patrones/catalogo'
import { esqueletoEnFase } from '../../../domain/patrones/escena'
import { puntoDeHueso } from '../../../domain/patrones/esqueleto'
import { Malla } from '../../../domain/patrones/malla'
import type { Vec3 } from '../../../domain/patrones/algebra'
import { camaraDelSalon, proyectar } from './encuadreDelSalon'
import { construirImplementos, type EscenaDeImplementos } from './implementos'

/**
 * EL APARATO QUE TAPA A LA PERSONA SE VUELVE TRANSLÚCIDO.
 *
 * Nace el 2026-09-05, al arreglar el encuadre: con el press de pecho en máquina por fin
 * dentro del cuadro, lo que se veía era una plancha gris con dos manos asomando por los
 * lados. La máquina se planta entre la cámara y la persona, y un aparato que tapa a la
 * persona cuenta el ejercicio al revés: el salón está para ver el gesto, no el hierro.
 *
 * ## Se mide, no se decide por tipo de máquina
 *
 * La primera idea —«las máquinas de placas, translúcidas siempre»— era una regla por
 * clase, y medirla la tiró: el remo en máquina, la abducción y la elevación de talones
 * llevan la misma máquina de placas que el press y **no tapan nada** (0 %), porque desde
 * el ángulo de su patrón la pila queda detrás del cuerpo. Y la caja de pantalla
 * tampoco sirve: el Smith «solapa» el 100 % del cuerpo y tapa el 0 %, porque sus raíles
 * lo flanquean. Lo que sí separa es contar **puntos del cuerpo con un vértice del aparato
 * encima y más cerca de la cámara**, con la misma cámara con la que se encuadra:
 *
 *   press de pecho en máquina     36 %     press de hombro en máquina      24 %
 *   elevación lateral en polea    19 %     abducción de cadera en polea    14 %
 *   apertura inversa en máquina   10 %     ——————————————————————————————————
 *   flexión de rodilla, extensión de rodilla, jalón, retracción en polea   5 %
 *   los otros trece                0-2 %
 *
 * Se mira la PEOR de tres fases del recorrido, no una: el press de hombro tapa 0 % en el
 * medio y 24 % arriba, y un aparato que tapa a la persona en el final del gesto la tapa.
 * Dos grupos y un hueco entre el 5 y el 10. El tope va en el hueco.
 *
 * ## Lo que se vuelve translúcido y lo que no
 *
 * Solo el APARATO —máquina, polea, raíles—, y solo cuando tapa. Lo que se lleva en las
 * manos —barra, mancuernas, disco— va siempre opaco: es la carga, y es lo que el brazo de
 * momento mide. El motor ya sabe dibujar una malla translúcida detrás de las opacas sin
 * escribir profundidad (`Malla.alfa`), así que la persona se ve a través del aparato sin
 * que el aparato desaparezca: sigue diciendo que el cuerpo va apoyado, y dónde.
 */

/**
 * A partir de qué parte del cuerpo tapada el aparato se vuelve translúcido.
 *
 * Ocho por ciento: cae en el hueco medido entre el 5 % (una pila que roza un pie o un
 * jalón que roza la cabeza) y el 10 % (una máquina delante de un brazo que trabaja). No
 * se pone SOBRE un dato para que un patrón no baile de un lado a otro con un ángulo.
 */
export const UMBRAL_DE_OCLUSION = 0.08

/**
 * Cuánto se ve del aparato cuando tapa. Treinta por ciento: se sigue leyendo la forma de
 * la máquina y su sitio, y la persona se lee entera a través.
 */
export const ALFA_DEL_APARATO_QUE_TAPA = 0.3

/** Un vértice del aparato a menos de esto del punto del cuerpo, en pantalla, lo tapa. */
const RADIO_EN_PANTALLA = 12
/** Y tiene que estar más cerca de la cámara que el punto por al menos esto, en metros. */
const HOLGURA_DE_PROFUNDIDAD = 0.02

/** El hierro de las manos por un lado y el aparato por otro. */
export function partirImplementos(escena: EscenaDeImplementos): {
  hierro: EscenaDeImplementos
  aparato: EscenaDeImplementos
} {
  return {
    hierro: { ...escena, piezas: escena.piezas.filter((p) => p.pieza !== 'maquina') },
    aparato: { ...escena, piezas: escena.piezas.filter((p) => p.pieza === 'maquina') },
  }
}

function verticesDe(m: Malla): Vec3[] {
  const salida: Vec3[] = []
  for (let i = 0; i < m.vertices; i++) {
    salida.push([m.posicion[i * 3], m.posicion[i * 3 + 1], m.posicion[i * 3 + 2]])
  }
  return salida
}

/**
 * Qué parte del cuerpo queda tapada por el aparato, de 0 a 1, en la fase que peor sale
 * de las tres que se miran. Pura: sirve para el guardián y para el visor.
 */
export function parteDelCuerpoTapada(patron: Patron, aparato: EscenaDeImplementos): number {
  if (!aparato.piezas.length) return 0
  const { vista, proy } = camaraDelSalon(patron)
  let peor = 0
  for (const fase of [0, 0.5, 1]) {
    const esq = esqueletoEnFase(patron, fase)
    const malla = new Malla(4096)
    construirImplementos(malla, aparato, esq)
    const encima = verticesDe(malla)
      .map((v) => proyectar(vista, proy, v))
      .filter((q): q is { x: number; y: number; z: number } => q !== null)
    let tapados = 0
    let total = 0
    for (const hueso of Object.keys(esq.mundo)) {
      for (const t of [0, 1]) {
        const q = proyectar(vista, proy, puntoDeHueso(esq, hueso, t))
        if (!q) continue
        total++
        if (
          encima.some(
            (v) =>
              Math.abs(v.x - q.x) < RADIO_EN_PANTALLA &&
              Math.abs(v.y - q.y) < RADIO_EN_PANTALLA &&
              v.z < q.z - HOLGURA_DE_PROFUNDIDAD,
          )
        ) {
          tapados++
        }
      }
    }
    if (total) peor = Math.max(peor, tapados / total)
  }
  return peor
}

/** Se calcula una vez por patrón y escena: ni el aparato ni la cámara cambian por fotograma. */
const memoria = new Map<string, boolean>()

export function aparatoTapaAlCuerpo(patron: Patron, aparato: EscenaDeImplementos): boolean {
  const clave = patron.id + '|' + aparato.piezas.map((p) => p.pieza + ':' + (('forma' in p && p.forma) || '')).join(',')
  const guardado = memoria.get(clave)
  if (guardado !== undefined) return guardado
  const tapa = parteDelCuerpoTapada(patron, aparato) >= UMBRAL_DE_OCLUSION
  memoria.set(clave, tapa)
  return tapa
}
