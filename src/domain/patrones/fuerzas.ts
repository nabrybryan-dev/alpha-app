import type { BrazoDeMomento } from '../biomecanica/brazosDeMomento'
import { grados, limitar, V, type Vec3 } from './algebra'
import { elipsoide, Malla, tubo, tuboDiscontinuo, type Color } from './malla'

/**
 * LAS FUERZAS, DIBUJADAS: el brazo de momento y el par, en la escena.
 *
 * Es la dirección A del lienzo «Fuerzas en el salón» (2026-09-04): por cada eje que
 * gira, un **segmento** horizontal de la articulación a la vertical de la carga —el
 * brazo—, un **arco** en la articulación que barre más cuanto más largo es el brazo —el
 * par—, y una marca en el eje. Y la vertical de la carga, fina y a trazos, que es la línea
 * contra la que se mide: distinta de la plomada gris del centro de masas, que dice otra
 * cosa (el equilibrio).
 *
 * Se dibuja en GEOMETRÍA, como los dígitos del muro, y no como texto encima del salón: el
 * salón se toca y se mira, no se lee. La cifra en centímetros no va aquí; irá, si va, en
 * la letra mínima del salón y apagable.
 *
 * Los ejes secundarios salen translúcidos: están, pero no compiten con el principal.
 *
 * Y todo va ENCIMA (`Malla.encima`): el motor lo dibuja sin prueba de profundidad, porque
 * el eje de la cadera está dentro del glúteo y el brazo cruza el muslo; con profundidad
 * se veían a trozos, medido en el testigo el 2026-09-04.
 *
 * ## El arco gira donde gira la articulación, y por eso a veces no está
 *
 * El arco vive en el plano REAL del giro —el plano vertical que contiene el brazo de
 * momento—, no de cara a la cámara. Decisión de Bryan del 2026-09-04, sabiendo el canje:
 * un aro de hula-hoop visto de canto es un palito. Medido sobre el catálogo: con el plano
 * de frente el arco mide entre 26 y 71 px de ancho; de canto se queda en 0-3 px
 * (elevaciones laterales 0-1 px, press militar 1-15 px) — una astilla vertical que no dice
 * nada y sí tapa. Así que **de canto se retira**, y se retira adelgazando (`GROSOR`
 * multiplicado por `visibilidadDelPlano`), no desapareciendo de golpe: al orbitar el aro
 * se afina hasta irse en vez de dar un salto. Lo que queda entonces es la varilla, la
 * marca del eje y la vertical de la carga, que sí se leen desde cualquier sitio.
 */

const ROJO: Color = [1, 0.12, 0.12]
const ROJO_APAGADO: Color = [0.62, 0.1, 0.1]
const ALFA_SECUNDARIO = 0.5

/**
 * QUÉ PARTE DEL HUESO MIDE EL RADIO DEL ARCO.
 *
 * El arco tiene que salir del volumen de la carne —el centro de la cadera está a 10-12 cm
 * de la piel del glúteo— y a la vez encoger con la persona cuando la cámara la deja
 * pequeña. Las dos cosas las cumple un radio que sale del hueso que cuelga del eje: un
 * 32 % del fémur son 14 cm en el sujeto del catálogo, que es lo que hacía falta, y en la
 * lumbar son 5 y no 15, que es lo que evita el aro gigante en mitad de la espalda.
 */
const PARTE_DEL_HUESO = 0.32
/** Si el rig no da el hueso, un largo de emergencia para no dibujar un punto. */
const HUESO_POR_DEFECTO = 0.4
/** Cuánto barre el arco por centímetro de brazo. 6°/cm: 10 cm son 60°, 18 cm son 108°. */
const GRADOS_POR_CM = 6
const BARRIDO_MINIMO = 12
/**
 * El tope del barrido. Era 150° y a partir de ahí el arco se cierra en rueda: pasa de
 * leerse como un giro a leerse como un objeto suelto en la escena.
 */
const BARRIDO_MAXIMO = 110
const GROSOR = 0.005

/**
 * CUÁNTO SE VE EL PLANO DEL ARCO DESDE DONDE MIRA LA CÁMARA: 1 de frente, 0 de canto.
 *
 * Es el coseno del ángulo entre la normal del plano del arco y la mirada. Los dos topes
 * salen de medir el catálogo con la cámara del salón: por encima de 0,70 el arco mide
 * 26 px o más de ancho (sentadilla 0,87-0,93; peso muerto 0,96; curl 0,66-0,71); por
 * debajo de 0,40 no pasa de 3 px (press militar 0,29; elevaciones laterales 0,02-0,19).
 */
const PLANO_DE_FRENTE = 0.7
const PLANO_DE_CANTO = 0.4

export function visibilidadDelPlano(normal: Vec3, mirada: Vec3): number {
  const cara = Math.abs(V.punto(normal, mirada))
  return limitar((cara - PLANO_DE_CANTO) / (PLANO_DE_FRENTE - PLANO_DE_CANTO), 0, 1)
}

/** Por debajo de esto el arco no se dibuja: un tubo de radio casi cero es basura. */
const VISIBILIDAD_MINIMA = 0.06

function dibujarBrazo(m: Malla, b: BrazoDeMomento, color: Color, ojo: Vec3 | undefined, conArco: boolean): void {
  // El segmento, de la articulación a la vertical de la carga. Con varios puntos y no dos:
  // los marcos del tubo necesitan una dirección en cada anillo, y con dos puntos el
  // primero salía degenerado —un plano gris del tamaño de la sala—.
  if (b.metros > 0.004) {
    const tramo: Vec3[] = []
    for (let k = 0; k <= 4; k++) tramo.push(V.entre(b.eje, b.pie, k / 4))
    tubo(m, tramo, () => 0.0045, { radial: 6, color, tapar: true })
  }
  // La marca en el eje.
  elipsoide(m, b.eje, [0.011, 0.011, 0.011], { hueso: 0, color, su: 8, sv: 6 })
  if (!conArco) return
  // El arco: arranca hacia la carga y sube. Sin brazo apreciable arranca hacia delante.
  const u: Vec3 = b.metros > 0.004 ? V.normalizar(V.restar(b.pie, b.eje)) : [0, 0, 1]
  const arriba: Vec3 = [0, 1, 0]
  // De canto no se dibuja, y el paso de un sitio a otro se hace afinando el trazo.
  const visible = ojo ? visibilidadDelPlano(V.normalizar(V.cruz(u, arriba)), V.normalizar(V.restar(b.eje, ojo))) : 1
  if (visible < VISIBILIDAD_MINIMA) return
  const barrido = grados(limitar(b.metros * 100 * GRADOS_POR_CM, BARRIDO_MINIMO, BARRIDO_MAXIMO))
  const radio = (b.largo > 0 ? b.largo : HUESO_POR_DEFECTO) * PARTE_DEL_HUESO
  const N = 24
  const puntos: Vec3[] = []
  for (let k = 0; k <= N; k++) {
    const a = (barrido * k) / N
    puntos.push(V.sumar(b.eje, V.sumar(V.escalar(u, Math.cos(a) * radio), V.escalar(arriba, Math.sin(a) * radio))))
  }
  tubo(m, puntos, () => GROSOR * visible, { radial: 6, color, tapar: true })
}

/**
 * Las mallas de las fuerzas: la primera opaca (ejes principales y la vertical de la carga),
 * la segunda translúcida (secundarios). Una malla sin vértices no se sube: quien llama lo
 * mira.
 *
 * `ojo` es de dónde mira la cámara, y decide si el arco se ve de frente o de canto. Sin
 * él —en las pruebas de geometría pura— el arco se dibuja entero.
 *
 * **El arco es del eje PRINCIPAL.** Los secundarios se quedan con la varilla y la marca:
 * el tobillo de la sentadilla llegó a tener 20 cm de brazo, y su aro salía a la altura del
 * tobillo —y = 850 de una pantalla de 844—, tumbado sobre la línea del suelo al lado de
 * los pies. Parecía una rueda apoyada en el salón, que es exactamente lo que no es.
 */
export function mallasDeFuerzas(brazos: readonly BrazoDeMomento[], ojo?: Vec3): Malla[] {
  const principal = new Malla(2048)
  const secundaria = new Malla(1024)
  secundaria.alfa = ALFA_SECUNDARIO
  // Encima del cuerpo: un brazo que la carne tapa a trozos no mide nada.
  principal.encima = true
  secundaria.encima = true
  if (!brazos.length) return [principal, secundaria]

  // La vertical de la carga, de la carga al suelo: la línea contra la que se mide.
  const pieMasAlto = brazos.reduce((a, b) => (b.pie[1] > a[1] ? b.pie : a), brazos[0].pie)
  const carga: Vec3 = [pieMasAlto[0], pieMasAlto[1] + 0.02, pieMasAlto[2]]
  tuboDiscontinuo(principal, [carga, [carga[0], 0.005, carga[2]]], 0.003, ROJO_APAGADO, ROJO_APAGADO, 1, 0.03, 0.03)

  for (const b of brazos) {
    const esPrincipal = b.protagonismo === 'principal'
    dibujarBrazo(esPrincipal ? principal : secundaria, b, ROJO, ojo, esPrincipal)
  }
  return [principal, secundaria]
}
