import { grados, V, type Vec3 } from '../../../domain/patrones/algebra'
import { Malla, type Color } from '../../../domain/patrones/malla'
// `geometria.ts` no existe en `main` y `src/domain/**` es de solo lectura, así que la
// primitiva que se orienta sola vive en `sala.ts`. Se importa en vez de copiarse: dos
// copias de la regla de enrollado es como vuelven las caras del revés.
import { cuadro } from './sala'

/**
 * El trípode con el móvil encima: el objeto que se coloca.
 *
 * ## Por qué es un objeto y no una marca
 *
 * Antes la estación era una huella pintada en el suelo. Una huella dice DÓNDE, y no
 * dice nada de lo demás: a qué altura, mirando a dónde, si el sujeto cabe. Un trípode
 * con su móvil dice las tres cosas de un vistazo, y sobre todo **se puede mover**.
 *
 * Ese es el salto. La puerta de encuadre del encoder hoy solo habla DESPUÉS: grabas,
 * y te dice que la toma no valía. Aquí se puede ensayar antes, con la misma regla, y
 * la mala colocación se descubre sin haber hecho la serie.
 *
 * ## La regla es la de verdad, no una copia
 *
 * Este módulo NO decide si un encuadre vale. Traduce una colocación —ángulo, distancia,
 * altura— a la entrada que espera `encuadre()` del núcleo, y quien juzga es
 * `calificarEncuadre()`, la misma función que juzga una toma real.
 *
 * Copiarla aquí habría sido lo fácil y lo peor: dos puertas que empiezan iguales y se
 * separan en el primer ajuste, y entonces el ensayo enseña a colocar el móvil donde la
 * medición ya no lo admite. Este archivo se queda en geometría y aritmética de cámara.
 *
 * ## El móvil se dibuja en vertical
 *
 * Porque es como se graba: un cuerpo es más alto que ancho, y en horizontal el atleta
 * no cabe sin alejarse tanto que el disco baje de los 80 px que la puerta exige.
 */

const PATA: Color = [0.19, 0.205, 0.235]
const COLUMNA: Color = [0.26, 0.28, 0.32]
const CUERPO_MOVIL: Color = [0.07, 0.075, 0.085]
const PANTALLA: Color = [0.3, 0.34, 0.4]
const OJO: Color = [0.62, 0.2, 0.2]

const ARRIBA: Vec3 = [0, 1, 0]

/** Dónde está y cómo mira el trípode. Es lo único que el asesorado cambia. */
export interface Colocacion {
  /** Grados alrededor del sujeto. 180 es el perfil, que es el sitio bueno. */
  anguloGrados: number
  /** Metros del sujeto a la lente. */
  distancia: number
  /** Metros de la lente sobre el suelo. */
  altura: number
}

/**
 * Cuánto se desvía esta colocación del perfil.
 *
 * El desvío es lo que la puerta mide: cuántos grados se sale la barra del plano de
 * imagen. Con el sujeto mirando a +Z, el plano bueno es el perpendicular al sagital, o
 * sea el eje X — 0° o 180°. La distancia angular al más cercano de los dos es el desvío.
 */
export function desvioDe(anguloGrados: number): number {
  const a = ((anguloGrados % 360) + 360) % 360
  return Math.min(Math.abs(a - 180), Math.abs(a - 0), Math.abs(a - 360))
}

/**
 * Un rectángulo con normal libre. Delega en la primitiva que SE ORIENTA SOLA: se le
 * dice hacia dónde mira la cara y ella decide el enrollado. Escribir el orden a mano
 * fue lo que dejó el escenario entero de espaldas y sin dar un solo error.
 */
const cara = cuadro

/** Un prisma de sección cuadrada entre dos puntos, para patas y columna. */
function viga(m: Malla, a: Vec3, b: Vec3, grosor: number, c: Color): void {
  const eje = V.normalizar(V.restar(b, a))
  // Una perpendicular cualquiera que no sea paralela al eje.
  const aux: Vec3 = Math.abs(eje[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
  const u = V.escalar(V.normalizar(V.cruz(eje, aux)), grosor / 2)
  const w = V.escalar(V.normalizar(V.cruz(eje, u)), grosor / 2)

  const esquinas = (p: Vec3): Vec3[] => [
    V.sumar(V.sumar(p, u), w),
    V.sumar(V.restar(p, u), w),
    V.restar(V.restar(p, u), w),
    V.restar(V.sumar(p, u), w),
  ]
  const A = esquinas(a)
  const B = esquinas(b)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const nr = V.normalizar(V.cruz(V.restar(A[j], A[i]), eje))
    cara(m, [A[i], B[i], B[j], A[j]], nr, c)
  }
}

/**
 * El trípode entero, ya colocado.
 *
 * Las tres patas se abren hacia fuera desde la base de la columna. La de atrás va en
 * la dirección contraria al sujeto: es como se planta de verdad, para que el
 * contrapeso no quede en el camino de quien entrena.
 */
export function construirTripode(m: Malla, c: Colocacion): void {
  const a = grados(c.anguloGrados)
  const cx = Math.cos(a) * c.distancia
  const cz = Math.sin(a) * c.distancia

  // Hacia dónde mira: al centro de la escena.
  const mira = V.normalizar([-cx, 0, -cz])
  const lado: Vec3 = [-mira[2], 0, mira[0]]

  const pieDeColumna = 0.12
  const base: Vec3 = [cx, pieDeColumna, cz]

  // Tres patas a 120°, con la primera apuntando al lado contrario del sujeto.
  const alcance = 0.34
  for (const giro of [0, 120, 240]) {
    const g = grados(giro)
    const dir: Vec3 = [
      -mira[0] * Math.cos(g) + lado[0] * Math.sin(g),
      0,
      -mira[2] * Math.cos(g) + lado[2] * Math.sin(g),
    ]
    viga(m, base, [cx + dir[0] * alcance, 0, cz + dir[2] * alcance], 0.028, PATA)
  }

  // La columna hasta la altura de la lente.
  viga(m, base, [cx, c.altura, cz], 0.034, COLUMNA)

  // El móvil: una placa vertical, de canto al sujeto. Se dibuja por las dos caras
  // porque la cámara orbita y se ve tanto la pantalla como el respaldo.
  const anchoMovil = 0.075
  const altoMovil = 0.155
  const centro: Vec3 = [cx, c.altura, cz]
  const u = V.escalar(lado, anchoMovil / 2)
  const arribaM: Vec3 = [0, altoMovil / 2, 0]
  const esquinas: [Vec3, Vec3, Vec3, Vec3] = [
    V.restar(V.restar(centro, u), arribaM),
    V.restar(V.sumar(centro, u), arribaM),
    V.sumar(V.sumar(centro, u), arribaM),
    V.sumar(V.restar(centro, u), arribaM),
  ]
  cara(m, esquinas, V.escalar(mira, -1), PANTALLA)
  cara(m, [esquinas[3], esquinas[2], esquinas[1], esquinas[0]], mira, CUERPO_MOVIL)

  // El ojo de la lente, del lado que mira al sujeto. Es el detalle que dice hacia
  // dónde apunta sin necesidad de una flecha.
  const ojo = V.sumar(V.sumar(centro, V.escalar(mira, 0.006)), [0, altoMovil * 0.3, 0])
  const r = 0.014
  const k = m.vertices
  m.vertice(ojo, mira, OJO, 0)
  const n = 10
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    m.vertice(
      V.sumar(ojo, V.sumar(V.escalar(lado, Math.cos(t) * r), [0, Math.sin(t) * r, 0])),
      mira,
      OJO,
      0,
    )
  }
  // El abanico también se enrolla al derecho, o la lente desaparece justo
  // desde el lado al que apunta — que es el único desde el que importa verla.
  for (let i = 0; i < n; i++) m.triangulo(k, k + 2 + i, k + 1 + i)

  // La mira en el suelo: del pie del trípode a la placa. Enseña que la lente y el
  // sujeto comparten eje, que es la condición de que la medida valga.
  const largo = c.distancia - 0.45
  if (largo > 0.1) {
    const ancho = 0.012
    const p: Vec3 = [cx, 0.0062, cz]
    const q0 = V.sumar(p, V.escalar(lado, ancho))
    const q1 = V.restar(p, V.escalar(lado, ancho))
    // Antihoraria vista desde arriba, o el motor la descarta por trasera.
    cara(
      m,
      [q0, V.sumar(q0, V.escalar(mira, largo)), V.sumar(q1, V.escalar(mira, largo)), q1],
      ARRIBA,
      OJO,
    )
  }
}
