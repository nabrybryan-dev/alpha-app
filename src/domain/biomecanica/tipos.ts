/**
 * El vocabulario de la tabla de palancas: qué es un eje, una vista, una línea
 * de fuerza. La tabla vive en `modelos.ts` y las consultas en `palancas.ts`,
 * que es por donde se entra y donde está escrito el porqué de todo esto.
 */

import type { Categoria, Grupo } from '../taxonomia'

export type Articulacion =
  | 'tobillo'
  | 'rodilla'
  | 'cadera'
  | 'lumbar'
  | 'escapula'
  | 'hombro'
  | 'codo'
  | 'muñeca'

export type Segmento =
  | 'pie'
  | 'pierna'
  | 'muslo'
  | 'pelvis'
  | 'torso'
  | 'brazo'
  | 'antebrazo'
  | 'mano'
  | 'cuerpo-entero'

/** Cuánto manda ese eje en el ejercicio. El principal es el que se mide primero. */
export type Protagonismo = 'principal' | 'secundario' | 'estabilizador'

/** Lo que hace el músculo en la fase concéntrica. `isometrico` = sostiene, no gira. */
export type Accion =
  | 'extension'
  | 'flexion'
  | 'abduccion'
  | 'aduccion'
  | 'rotacion'
  | 'flexion-plantar'
  | 'dorsiflexion'
  | 'retraccion'
  | 'isometrico'

/**
 * Cerrada = el extremo distal está fijo al mundo y el cuerpo se mueve sobre él
 * (sentadilla, dominada, fondo). Abierta = el extremo distal viaja libre y el
 * cuerpo está apoyado (extensión de rodilla, curl, jalón).
 *
 * No es una etiqueta de manual: decide **quién gira sobre quién**, y con eso,
 * cuál de los dos puntos de una marca es el eje y cuál el extremo que describe
 * el arco.
 */
export type Cadena = 'cerrada' | 'abierta'

export type OrigenDeLinea = 'carga-externa' | 'centro-de-masas' | 'cable'

/**
 * Dónde hay que poner la cámara para ver girar ese eje.
 *
 * A nivel de modelo es la vista que exige el EJE PRINCIPAL, no la que la gente
 * suele usar. La diferencia importa: un Pallof grabado de lado no devuelve un
 * número peor, devuelve ninguno, y es mejor que la app diga «esto se graba
 * desde arriba» a que enseñe un cero con cara de medida.
 *
 * No se puede deducir de la acción: la antirrotación de un Pallof es
 * `isometrico` y ocurre en el plano transverso, así que mirar la acción para
 * decidir el plano falla justo en el core, que es donde más caro sale
 * equivocarse. Va declarado eje por eje.
 *
 * `lateral` es el caso normal —la mayor parte del gimnasio ocurre en el plano
 * sagital— pero no es un defecto silencioso: está escrito en cada eje.
 */
export type Vista = 'lateral' | 'frontal' | 'cenital'

/**
 * Ejes que no se marcan sobre la piel y se estiman desde otras marcas.
 *
 * L5-S1 no tiene relieve donde pegar nada: se estima sobre la línea
 * cadera↔hombro, cerca del extremo de la cadera. La escápula se mueve bajo el
 * músculo y su marca de piel miente más que ninguna. Los dos son ejes reales y
 * hay que calcularlos, pero **su brazo arrastra más error que el de una
 * articulación marcada**, y eso tiene que llegar hasta la pantalla: un torque
 * lumbar y un torque de rodilla no se pueden enseñar con la misma confianza.
 */
export const EJES_DERIVADOS: Partial<Record<Articulacion, readonly Articulacion[]>> = {
  lumbar: ['cadera', 'hombro'],
  escapula: ['hombro'],
}

export interface Eje {
  articulacion: Articulacion
  protagonismo: Protagonismo
  accion: Accion
  /** Los grupos de `taxonomia.ts` que generan el momento interno en este eje. */
  motores: readonly Grupo[]
  /**
   * Brazo de momento interno en mm, como RANGO. De tabla, no medible con la
   * cámara, y variable con el ángulo articular: el patrón cualitativo es
   * consenso, los milímetros son orientativos (perfiles-de-resistencia §5.1).
   */
  brazoInternoMm: readonly [number, number]
  /** Desde dónde se ve girar este eje. */
  vista: Vista
  nota?: string
}

export interface Alineacion {
  /** Qué punto tiene que quedar sobre qué referencia. Es el consejo que sale a pantalla. */
  regla: string
  /** Cuánto se puede desviar antes de decir nada. Por debajo, el ruido de medida manda. */
  toleranciaMm: number
  porQue: string
}

export interface ModeloDePalanca {
  patron: Categoria
  /** Cuando el nombre del ejercicio declara una ejecución que cambia el modelo. */
  variante?: string
  cadena: Cadena
  /** Qué toca el mundo y no se mueve. */
  anclaje: string
  /** Lo que la fuerza muscular hace girar. */
  segmentosMoviles: readonly Segmento[]
  /** Contra qué se leen los ángulos: la vertical del mundo, o un segmento. */
  referencia: 'vertical' | Segmento
  /** Dónde se planta la cámara para este ejercicio. */
  vista: Vista
  /** Ejes de rotación, en orden de protagonismo. El primero es el que se mide. */
  ejes: readonly Eje[]
  linea: {
    origen: OrigenDeLinea
    nota?: string
  }
  /** Marcas que hay que ver para poder calcular algo. Sin todas, no hay número. */
  marcas: readonly Articulacion[]
  alineacion: Alineacion
  /**
   * Presente cuando el cuerpo se apoya en dos sitios y la regla de la distancia
   * horizontal NO basta. El texto dice qué falta para cerrar el cálculo.
   */
  dosApoyos?: string
}

/** Atajo para escribir la tabla sin repetir los nombres de campo en 29 entradas. */
export const M = (
  articulacion: Articulacion,
  protagonismo: Protagonismo,
  accion: Accion,
  motores: readonly Grupo[],
  brazoInternoMm: readonly [number, number],
  nota?: string,
  vista: Vista = 'lateral',
): Eje => ({ articulacion, protagonismo, accion, motores, brazoInternoMm, vista, nota })
