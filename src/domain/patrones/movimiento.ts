/**
 * Capa de movimiento: convierte las dos poses clave de un patrón en algo que se
 * mueve como una persona y no como un maniquí articulado.
 *
 * Son cuatro cosas, y la primera es la que más se nota:
 *
 *  1. **Retardo distal.** En un movimiento real las articulaciones no llegan a
 *     la vez: la cadera arranca, la rodilla la sigue y el tobillo cierra el
 *     último. Interpolarlo todo con la misma fase es lo que hace que una
 *     animación se vea a robot, por muy correctos que sean los ángulos.
 *  2. **Respiración.** El tórax no es una pieza rígida, y se espira en el
 *     esfuerzo.
 *  3. **Balanceo y mirada.** Nadie está perfectamente quieto, y la cabeza
 *     compensa la inclinación del tronco para no perder el horizonte.
 *  4. **Vida en lo que no trabaja.** Las extremidades que no son el motor del
 *     patrón acompañan un poco, y no igual la derecha que la izquierda.
 *
 * Todo pasa por un último filtro de rango articular, para que ninguna capa
 * pueda empujar una articulación a un ángulo que un cuerpo no alcanza.
 */

import { entre, limitar, type Vec3 } from './algebra'
import { mezclarVec, type Pose } from './esqueleto'
import type { Patron } from './catalogo'
import { RANGO_POR_CANAL } from './articulaciones'

/**
 * Topes articulares. Se derivan del catálogo de `articulaciones.ts` para que no
 * existan dos listas de rangos: la que se le explica al asesorado y la que de
 * verdad recorta el ángulo tienen que ser la misma, o el visor acabaría
 * enseñando un límite y aplicando otro.
 */
export const RANGO = RANGO_POR_CANAL

/**
 * Retardo de cada eslabón, en fracción de la repetición. El orden es el de la
 * cadena cinética: lo proximal manda y lo distal obedece.
 */
const RETARDO: [string, number][] = [
  ['pelvis', 0], ['lumbar', 0.015], ['torax', 0.028],
  ['cuello', 0.055], ['craneo', 0.07],
  ['cadera', 0], ['rodilla', 0.042], ['tobillo', 0.082],
  ['escapula', 0.012], ['hombro', 0.03], ['codo', 0.068], ['antebrazoRot', 0.085],
  ['muneca', 0.11],
]

export function retardoDe(canal: string): number {
  let r = 0
  // Gana el prefijo más largo que encaje, para que un canal más específico no
  // caiga en el genérico si algún día se añade.
  let mejor = -1
  for (const [prefijo, v] of RETARDO) {
    if (canal.startsWith(prefijo) && prefijo.length > mejor) {
      mejor = prefijo.length
      r = v
    }
  }
  return r
}

/**
 * Canales que reciben «vida» cuando el patrón no los mueve, con su amplitud en
 * grados y la frecuencia de su oscilación libre. Las frecuencias no son
 * múltiplos entre sí para que el conjunto no se sincronice ni se note el bucle.
 */
const VIDA: [string, number, number][] = [
  ['rodillaFlex', 3.2, 0.71], ['caderaFlex', 2.4, 0.53], ['caderaAbd', 1.4, 0.61],
  ['caderaRot', 2.2, 0.43], ['codoFlex', 5.5, 0.83], ['hombroFlex', 4.2, 0.67],
  ['hombroAbd', 2.8, 0.79], ['hombroRot', 3.4, 0.47], ['muneca', 8.0, 0.97],
  ['antebrazoRot', 6.5, 0.59], ['escapulaProt', 2.6, 0.73], ['toraxRot', 1.8, 0.37],
]

const raizDe = (canal: string): string => canal.replace(/[DI]$/, '')

function limitarCanal(canal: string, v: number): number {
  const r = RANGO[canal]
  return r ? limitar(v, r[0], r[1]) : v
}

/**
 * Valor de un canal en una fase dada, pasando por inicio → medio → fin.
 *
 * ## Por qué ya no son dos rectas
 *
 * Hasta el 2026-09-04 esto era `entre(a, medio)` hasta la mitad y `entre(medio, b)`
 * después: dos segmentos rectos con un CODO en la pose de en medio. El reloj de la
 * repetición ya era suave —freno en el estancamiento, asentamiento arriba, bajada más
 * lenta— pero el ángulo de cada articulación cambiaba de pendiente de golpe a mitad de
 * recorrido, en todos los canales con pose intermedia y en todas las repeticiones. Es la
 * firma de un maniquí: velocidad articular discontinua, por muy correctos que sean los
 * ángulos. Bryan lo pidió como «que los movimientos sean mucho más naturales».
 *
 * ## Qué es ahora
 *
 * Un cúbico de Hermite MONÓTONO (Fritsch–Carlson) por los tres puntos. Tres propiedades,
 * y las tres hacen falta:
 *
 * - **pasa exactamente por las tres poses**: el catálogo sigue mandando;
 * - **la pendiente es continua en la pose de en medio**: se acabó el codo;
 * - **no rebasa ninguna pose**: una rodilla que tiene que llegar a 139° no pasa por 142°
 *   por el camino. Un spline corriente sí lo haría, y un rebase de tres grados en el
 *   tope de una sentadilla es una rodilla que se hiperextiende en cada repetición.
 *
 * En los extremos la tangente es la secante de su lado y NO cero. Cero suavizaría otra
 * vez el arranque, y el arranque ya lo suaviza el reloj de la repetición: dos suavizados
 * encadenados dan un sujeto que tarda en arrancar y se lee como pesado. Cada capa hace lo
 * suyo — el reloj el tiempo, esta curva el espacio.
 *
 * Cuando la pose de en medio es exactamente la media de los extremos, la curva ES la
 * recta: los patrones sin curvatura real no cambian ni una décima.
 */
export function canalEnFase(patron: Patron, canal: string, f: number): number {
  const a = patron.inicio[canal] ?? 0
  const b = patron.fin[canal] ?? 0
  const medio = patron.medio?.[canal]
  if (medio === undefined) return entre(a, b, f)
  return hermiteMonotona(a, medio, b, limitar(f, 0, 1))
}

/**
 * Cúbico de Hermite monótono por (0, a), (0,5, m) y (1, b).
 *
 * Las pendientes de los extremos son las secantes de su tramo. La del medio es la MEDIA
 * ARMÓNICA de las dos secantes cuando tienen el mismo signo, y cero cuando cambian de
 * signo o alguna es nula: es la regla de Fritsch–Carlson y lo que garantiza que la curva
 * nunca se sale del intervalo entre poses consecutivas.
 */
export function hermiteMonotona(a: number, m: number, b: number, f: number): number {
  const h = 0.5
  const s1 = (m - a) / h
  const s2 = (b - m) / h
  const d0 = s1
  const d2 = s2
  const d1 = s1 * s2 <= 0 ? 0 : (2 * s1 * s2) / (s1 + s2)
  // Tramo y parámetro local en [0, 1].
  const primero = f < h
  const t = primero ? f / h : (f - h) / h
  const p0 = primero ? a : m
  const p1 = primero ? m : b
  const t0 = primero ? d0 : d1
  const t1 = primero ? d1 : d2
  const t2 = t * t
  const t3 = t2 * t
  return (
    (2 * t3 - 3 * t2 + 1) * p0 +
    (t3 - 2 * t2 + t) * h * t0 +
    (-2 * t3 + 3 * t2) * p1 +
    (t3 - t2) * h * t1
  )
}

export interface PoseCompleta {
  pose: Pose
  desplazamiento: Vec3
  giroRaiz: Vec3
}

/**
 * Pose completa para una fase.
 *
 * `sentido` es +1 subiendo y −1 bajando: el retardo tiene que ir hacia atrás en
 * el tiempo, no hacia una fase fija. `reloj` alimenta las oscilaciones libres;
 * con 0 el resultado es determinista, que es lo que necesitan el encuadre y las
 * pruebas.
 */
export function poseAnimada(
  patron: Patron,
  fase: number,
  sentido: number,
  reloj: number,
): PoseCompleta {
  const d = sentido >= 0 ? 1 : -1
  const pose: Pose = {}

  // --- 1. Base con retardo distal -----------------------------------------
  const canales = new Set([...Object.keys(patron.inicio), ...Object.keys(patron.fin)])
  for (const c of canales) {
    const f = limitar(fase - retardoDe(raizDe(c)) * d, 0, 1)
    pose[c] = canalEnFase(patron, c, f)
  }

  const giroRaiz = mezclarVec(patron.giroInicio ?? patron.giro, patron.giroFin ?? patron.giro, fase)
  const desplazamiento = mezclarVec(patron.raizInicio, patron.raizFin, fase)

  const leer = (c: string, s: string): number => pose[c + s] ?? pose[c] ?? 0
  const sumar = (c: string, s: string, v: number): void => {
    pose[c + s] = leer(c, s) + v
  }

  // --- 2. Respiración ------------------------------------------------------
  // Se espira en la fase de esfuerzo: el pecho está más lleno abajo que arriba.
  // Y por debajo corre un ciclo libre para que el torso nunca quede rígido.
  const respiracion = Math.cos(fase * Math.PI) * 0.7 + Math.sin(reloj * 1.15) * 0.3
  pose.toraxFlex = (pose.toraxFlex ?? 0) - respiracion * 1.7
  pose.escapulaElev = (pose.escapulaElev ?? 0) + respiracion * 1.3

  // --- 3. Balanceo postural ------------------------------------------------
  // Solo de pie: nadie aguanta una vertical perfecta. Menos de un grado, lo
  // justo para que el cuerpo parezca vivo sin distraer de lo que se explica.
  if (patron.apoyo === 'suelo') {
    const s1 = Math.sin(reloj * 0.83)
    const s2 = Math.sin(reloj * 1.31 + 1.7)
    pose.pelvisLat = (pose.pelvisLat ?? 0) + s1 * 0.75 + s2 * 0.3
    pose.toraxLat = (pose.toraxLat ?? 0) - s1 * 0.5
    pose.pelvisRot = (pose.pelvisRot ?? 0) + s2 * 0.55
  }

  // --- 4. Mirada al horizonte ---------------------------------------------
  // La cabeza compensa parte de la inclinación del tronco. Esto sustituyó a
  // veintitrés ángulos de cuello escritos a mano que había que recalcular cada
  // vez que se tocaba la inclinación de un patrón.
  const inclinacion = giroRaiz[0] + (pose.lumbarFlex ?? 0) + (pose.toraxFlex ?? 0)
  pose.cuelloFlex = (pose.cuelloFlex ?? 0) - inclinacion * 0.62
  pose.craneoFlex = (pose.craneoFlex ?? 0) - inclinacion * 0.12

  // --- 5. Vida en lo que no trabaja ---------------------------------------
  const esMotor = (c: string): boolean =>
    Math.abs((patron.fin[c] ?? 0) - (patron.inicio[c] ?? 0)) > 6 ||
    patron.inicio[c + 'D'] !== undefined ||
    patron.fin[c + 'D'] !== undefined ||
    patron.inicio[c + 'I'] !== undefined ||
    patron.fin[c + 'I'] !== undefined

  // Campana centrada a mitad de repetición: el acompañamiento es máximo durante
  // el recorrido y se apaga en los extremos, donde el cuerpo se fija.
  const campana = Math.sin(limitar(fase, 0, 1) * Math.PI)

  for (const [c, amplitud, frecuencia] of VIDA) {
    if (esMotor(c)) continue
    for (const [s, desfase] of [['D', 0], ['I', 2.4]] as [string, number][]) {
      // La derecha y la izquierda nunca hacen lo mismo a la vez: la simetría
      // perfecta es justo lo que hace que un cuerpo parezca un maniquí.
      const libre = Math.sin(reloj * frecuencia + desfase)
      const acompanamiento = Math.sin(fase * Math.PI + desfase * 0.35)
      sumar(c, s, amplitud * (campana * acompanamiento * 0.6 + libre * 0.4))
    }
  }

  // --- 6. Contrapeso de brazos --------------------------------------------
  // Cuando el motor del patrón es el tren inferior, los brazos se adelantan
  // para equilibrar. Sin esto el sujeto baja a una sentadilla con los brazos
  // clavados al costado, que es algo que no hace nadie.
  if (!esMotor('hombroFlex') && !esMotor('hombroAbd') && patron.apoyo === 'suelo') {
    for (const s of ['D', 'I']) {
      sumar('hombroFlex', s, campana * 9 + fase * 4)
      sumar('codoFlex', s, campana * 7)
    }
  }

  // --- 7. Tope anatómico ---------------------------------------------------
  for (const c of Object.keys(pose)) pose[c] = limitarCanal(raizDe(c), pose[c])

  return { pose, desplazamiento, giroRaiz }
}
