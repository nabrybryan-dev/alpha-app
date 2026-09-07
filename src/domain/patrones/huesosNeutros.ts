/**
 * LOS HUESOS DE SIEMPRE: la definición del esqueleto con las proporciones originales,
 * las que llevaba el sujeto antes de que existieran los juegos por sexo.
 *
 * Viven aparte de `esqueleto.ts` por una razón de fontanería: `juegoDeHuesos.ts` los
 * necesita para derivar el juego neutro y los otros dos, y `esqueleto.ts` necesita a
 * `juegoDeHuesos.ts` para saber cuál es el juego por defecto. Si los dos se importaran el
 * uno al otro, el módulo que arrancara segundo leería `undefined`. Así que el DATO está
 * aquí, sin importar nada del rig, y los dos lo leen.
 *
 * Ya no son el juego por defecto —desde el 2026-09-06 lo es el varón real, ver
 * `SEXO_POR_DEFECTO`— pero siguen siendo la base de la que se derivan todos: cada juego
 * es «estos huesos, con estos largos».
 */

import { grados, type Vec3 } from './algebra'

export interface DefinicionHueso {
  nombre: string
  padre: string | null
  /** Desplazamiento desde el origen del padre. */
  desde: Vec3
  largo: number
  reposo: Vec3
  /**
   * Solo en los pies: cuánto hay del tobillo a la planta, para plantar al sujeto en el
   * suelo. Va por sexo desde el 2026-09-06 (Bryan): el varón del atlas tiene 6,2 cm, el
   * neutro de siempre 7,5. Sin él, `PLANTA_NEUTRA`.
   */
  planta?: number
}

const d = grados

export const ESQUELETO: DefinicionHueso[] = [
  { nombre: 'pelvis', padre: null, desde: [0, 0.95, 0], largo: 0.1, reposo: [0, 0, 0] },
  { nombre: 'lumbar', padre: 'pelvis', desde: [0, 0.06, -0.005], largo: 0.17, reposo: [0, 0, 0] },
  { nombre: 'torax', padre: 'lumbar', desde: [0, 0.17, 0], largo: 0.28, reposo: [0, 0, 0] },
  { nombre: 'cuello', padre: 'torax', desde: [0, 0.27, -0.015], largo: 0.08, reposo: [0, 0, 0] },
  { nombre: 'craneo', padre: 'cuello', desde: [0, 0.08, 0], largo: 0.16, reposo: [0, 0, 0] },

  { nombre: 'claviculaD', padre: 'torax', desde: [-0.02, 0.245, 0.035], largo: 0.155, reposo: [0, 0, d(72)] },
  { nombre: 'claviculaI', padre: 'torax', desde: [0.02, 0.245, 0.035], largo: 0.155, reposo: [0, 0, d(-72)] },
  { nombre: 'escapulaD', padre: 'torax', desde: [-0.055, 0.235, -0.045], largo: 0.15, reposo: [0, 0, d(160)] },
  { nombre: 'escapulaI', padre: 'torax', desde: [0.055, 0.235, -0.045], largo: 0.15, reposo: [0, 0, d(-160)] },

  // El brazo cuelga del TÓRAX, no de la clavícula. La clavícula lleva un reposo
  // de 72° en Z, así que el húmero heredaba un eje X casi vertical: rotar sobre
  // él no era flexión de hombro sino rotación axial, y la pose salía torcida.
  { nombre: 'brazoD', padre: 'torax', desde: [-0.168, 0.232, 0.008], largo: 0.31, reposo: [d(180), 0, 0] },
  { nombre: 'brazoI', padre: 'torax', desde: [0.168, 0.232, 0.008], largo: 0.31, reposo: [d(180), 0, 0] },
  { nombre: 'antebrazoD', padre: 'brazoD', desde: [0, 0.31, 0], largo: 0.26, reposo: [0, 0, 0] },
  { nombre: 'antebrazoI', padre: 'brazoI', desde: [0, 0.31, 0], largo: 0.26, reposo: [0, 0, 0] },
  { nombre: 'manoD', padre: 'antebrazoD', desde: [0, 0.26, 0], largo: 0.18, reposo: [0, 0, 0] },
  { nombre: 'manoI', padre: 'antebrazoI', desde: [0, 0.26, 0], largo: 0.18, reposo: [0, 0, 0] },

  { nombre: 'musloD', padre: 'pelvis', desde: [-0.088, 0.005, 0], largo: 0.45, reposo: [d(180), 0, 0] },
  { nombre: 'musloI', padre: 'pelvis', desde: [0.088, 0.005, 0], largo: 0.45, reposo: [d(180), 0, 0] },
  { nombre: 'tibiaD', padre: 'musloD', desde: [0, 0.45, 0], largo: 0.43, reposo: [0, 0, 0] },
  { nombre: 'tibiaI', padre: 'musloI', desde: [0, 0.45, 0], largo: 0.43, reposo: [0, 0, 0] },
  { nombre: 'pieD', padre: 'tibiaD', desde: [0, 0.43, 0], largo: 0.22, reposo: [d(-90), 0, 0] },
  { nombre: 'pieI', padre: 'tibiaI', desde: [0, 0.43, 0], largo: 0.22, reposo: [d(-90), 0, 0] },
]

/** Del tobillo a la planta en el neutro. Los juegos con medida llevan la suya. */
export const PLANTA_NEUTRA = 0.075
