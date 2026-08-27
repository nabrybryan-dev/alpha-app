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

/**
 * Rangos articulares, en grados. Rangos de referencia de goniometría clínica,
 * redondeados. Funcionan como tope duro, no como orientación.
 */
export const RANGO: Record<string, [number, number]> = {
  caderaFlex: [-30, 135], caderaAbd: [-32, 50], caderaRot: [-45, 45],
  rodillaFlex: [0, 145],
  tobilloPlantar: [-38, 58],
  hombroFlex: [-62, 178], hombroAbd: [-12, 180], hombroRot: [-95, 100],
  codoFlex: [0, 152], antebrazoRot: [-88, 88], muneca: [-75, 82],
  lumbarFlex: [-28, 62], lumbarLat: [-32, 32], lumbarRot: [-16, 16],
  toraxFlex: [-32, 48], toraxLat: [-38, 38], toraxRot: [-42, 42],
  cuelloFlex: [-58, 68], craneoFlex: [-32, 32],
  escapulaProt: [0, 38], escapulaRetr: [0, 38], escapulaElev: [-18, 48],
  pelvisBascula: [-28, 28], pelvisLat: [-22, 22], pelvisRot: [-32, 32],
}

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

/** Valor de un canal en una fase dada, interpolando inicio → medio → fin. */
export function canalEnFase(patron: Patron, canal: string, f: number): number {
  const a = patron.inicio[canal] ?? 0
  const b = patron.fin[canal] ?? 0
  const medio = patron.medio?.[canal]
  if (medio === undefined) return entre(a, b, f)
  // La pose intermedia deja curvar la trayectoria donde el punto medio real no
  // es la media de los extremos: la rodilla de una sentadilla adelanta pronto y
  // después es la cadera la que sigue bajando.
  return f < 0.5 ? entre(a, medio, f / 0.5) : entre(medio, b, (f - 0.5) / 0.5)
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
