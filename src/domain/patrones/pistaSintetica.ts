import type { FotogramaDePista, PistaDePose, PuntoDePista } from './huellaArticular'

/**
 * VERDAD SINTÉTICA: una pista de pose fabricada desde ángulos conocidos.
 *
 * Es el mismo principio que `cuerpo-sintetico.py` en las herramientas del encoder: para
 * saber si la lectura de ángulos acierta hace falta una pista cuyos ángulos se conozcan
 * de antemano, y un vídeo de gimnasio no los trae. Aquí se construye una persona de
 * perfil —mirando a +x de la imagen— con una cadena tobillo→rodilla→cadera→hombro y
 * hombro→codo→muñeca, y se le hacen las repeticiones que se pidan. Todo en píxeles de
 * imagen, con la y hacia abajo, que es como lo escribe `articulaciones.py`.
 *
 * Vive fuera de los tests porque lo usan dos: el del dominio y el del importador.
 */
export interface AngulosSinteticos {
  /** Flexión de rodilla, en grados. */
  rodilla: number
  /** Flexión de cadera del rig: el muslo respecto a la pelvis vertical, en grados. */
  cadera: number
  /** Inclinación del tronco respecto a la vertical, en grados. */
  tronco: number
  /** Flexión de hombro (brazo colgando = 0), en grados. */
  hombro: number
  /** Flexión de codo, en grados. */
  codo: number
}

/**
 * Los largos de la persona sintética, en píxeles.
 *
 * Se pueden cambiar desde fuera desde el 2026-09-06: hicieron falta para comprobar que la
 * lectura de PROPORCIONES recupera los largos que se le metieron. Con un solo cuerpo no se
 * puede distinguir «lo lee bien» de «devuelve siempre lo mismo».
 */
export interface LargosSinteticos {
  tibia: number
  femur: number
  torso: number
  humero: number
  antebrazo: number
}

export const LARGO: LargosSinteticos = { tibia: 400, femur: 400, torso: 500, humero: 250, antebrazo: 250 }
const RAD = Math.PI / 180

/** La pose de un instante, como puntos de imagen. Los dos lados salen iguales: es de perfil. */
export function puntosDe(
  a: AngulosSinteticos,
  visibilidad = 0.95,
  largo: LargosSinteticos = LARGO,
): Record<string, PuntoDePista> {
  // La rodilla se dobla repartiendo la flexión entre la tibia (hacia delante) y el
  // fémur (hacia atrás), de forma que rodilla = a_tibia + a_femur y cadera = a_femur.
  const aTibia = a.rodilla - a.cadera
  const aFemur = a.cadera
  const tobillo: [number, number] = [500, 900]
  const rodilla: [number, number] = [tobillo[0] + largo.tibia * Math.sin(aTibia * RAD), tobillo[1] - largo.tibia * Math.cos(aTibia * RAD)]
  const cadera: [number, number] = [rodilla[0] - largo.femur * Math.sin(aFemur * RAD), rodilla[1] - largo.femur * Math.cos(aFemur * RAD)]
  const hombro: [number, number] = [cadera[0] + largo.torso * Math.sin(a.tronco * RAD), cadera[1] - largo.torso * Math.cos(a.tronco * RAD)]
  // El brazo cuelga a lo largo del tronco —que va inclinado `tronco` hacia delante, así
  // que colgar es apuntar `tronco` hacia ATRÁS de la vertical— y se flexiona hacia
  // delante desde ahí. Escrito al revés (tronco + hombro) el hombro leía 2·tronco + hombro.
  const dirBrazo = a.hombro - a.tronco
  const codo: [number, number] = [hombro[0] + largo.humero * Math.sin(dirBrazo * RAD), hombro[1] + largo.humero * Math.cos(dirBrazo * RAD)]
  const dirAntebrazo = dirBrazo + a.codo
  const muneca: [number, number] = [codo[0] + largo.antebrazo * Math.sin(dirAntebrazo * RAD), codo[1] + largo.antebrazo * Math.cos(dirAntebrazo * RAD)]
  const p = (q: [number, number]): PuntoDePista => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100, visibilidad]
  const puntos: Record<string, PuntoDePista> = {}
  for (const l of ['d', 'i']) {
    puntos[`hombro_${l}`] = p(hombro)
    puntos[`codo_${l}`] = p(codo)
    puntos[`muneca_${l}`] = p(muneca)
    puntos[`cadera_${l}`] = p(cadera)
    puntos[`rodilla_${l}`] = p(rodilla)
    puntos[`tobillo_${l}`] = p(tobillo)
  }
  return puntos
}

/**
 * Una pista de `repeticiones` sentadillas de `periodoSeg` cada una, a `fps`.
 *
 * La rodilla va de 0 a `rodillaMax` con un coseno; la cadera es el 75 % de la rodilla, el
 * tronco el 25 %. Hombro y codo se quedan fijos: es lo que hace comprobable que un canal
 * que no se mueve salga plano.
 */
export function pistaSintetica(opciones: {
  repeticiones?: number
  periodoSeg?: number
  fps?: number
  rodillaMax?: number
  hombro?: number
  codo?: number
  sinPersonaCada?: number
  /** Los largos de la persona, en píxeles. Sin ellos, los de siempre. */
  largo?: LargosSinteticos
} = {}): PistaDePose {
  const { repeticiones = 2, periodoSeg = 2, fps = 30, rodillaMax = 120, hombro = 20, codo = 30, sinPersonaCada = 0, largo = LARGO } = opciones
  const fotogramas: FotogramaDePista[] = []
  const total = Math.round(repeticiones * periodoSeg * fps)
  for (let k = 0; k <= total; k++) {
    const t = k / fps
    if (sinPersonaCada > 0 && k % sinPersonaCada === sinPersonaCada - 1) {
      fotogramas.push({ t: Math.round(t * 10000) / 10000, puntos: null })
      continue
    }
    const rodilla = (rodillaMax * (1 - Math.cos((2 * Math.PI * t) / periodoSeg))) / 2
    fotogramas.push({
      t: Math.round(t * 10000) / 10000,
      puntos: puntosDe({ rodilla, cadera: rodilla * 0.75, tronco: rodilla * 0.25, hombro, codo }, 0.95, largo),
    })
  }
  return { video: 'sintetico.mp4', ancho: 1080, alto: 1920, fps, fotogramas }
}
