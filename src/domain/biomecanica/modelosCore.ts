/**
 * Core, columna y los tres patrones sin modelo de palanca.
 *
 * Un trozo de la tabla de `modelos.ts`, partida por región para no pasar del
 * tamaño de archivo del proyecto. El porqué de cada campo está en `palancas.ts`.
 */

import type { Categoria } from '../taxonomia'
import { M, type ModeloDePalanca } from './tipos'

export const MODELOS_CORE: Partial<Record<Categoria, ModeloDePalanca | null>> = {
  // ───────────────────────────────────────────────────────────────────────────
  // Core y columna
  // ───────────────────────────────────────────────────────────────────────────
  ANTIEXTENSIÓN: {
    patron: 'ANTIEXTENSIÓN',
    cadena: 'cerrada',
    anclaje: 'los apoyos en el suelo',
    segmentosMoviles: ['torso'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M('lumbar', 'principal', 'isometrico', ['Abdomen'], [50, 60],
        'No hay recorrido: lo que se mide es el brazo, no el ángulo. Cuanto más lejos está el ' +
        'apoyo del centro de masas, mayor el momento que el abdomen tiene que anular.'),
    ],
    linea: {
      origen: 'centro-de-masas',
      nota: 'No hay barra: la línea es la vertical del centro de masas del cuerpo. Sin eso, aquí no hay número.',
    },
    marcas: ['hombro', 'cadera', 'rodilla', 'tobillo'],
    alineacion: {
      regla: 'la cadera en línea entre hombro y tobillo',
      toleranciaMm: 40,
      porQue:
        'Subir la cadera acorta el brazo y hace el ejercicio más fácil sin que se note en el ' +
        'cronómetro. Es la trampa más común del gimnasio y una cámara la ve perfectamente.',
    },
  },

  ANTIRROTACIÓN: {
    patron: 'ANTIRROTACIÓN',
    cadena: 'abierta',
    anclaje: 'los pies',
    segmentosMoviles: ['torso'],
    referencia: 'vertical',
    vista: 'cenital',
    ejes: [
      M('lumbar', 'principal', 'isometrico', ['Abdomen'], [40, 60],
        'El momento a resistir es de rotación, en el plano transverso.', 'cenital'),
    ],
    linea: { origen: 'cable' },
    marcas: ['cadera', 'hombro', 'codo'],
    alineacion: {
      regla: 'los hombros perpendiculares al cable, sin acompañar',
      toleranciaMm: 30,
      porQue:
        'Ocurre en el plano transverso: **una cámara sagital no lo mide**. Aquí solo se puede ' +
        'vigilar la trampa desde arriba o de frente, y conviene decirlo antes de prometer un número.',
    },
  },

  'ANTIFLEXIÓN LATERAL': {
    patron: 'ANTIFLEXIÓN LATERAL',
    cadena: 'cerrada',
    anclaje: 'el apoyo lateral en el suelo',
    segmentosMoviles: ['torso'],
    referencia: 'vertical',
    vista: 'frontal',
    ejes: [
      M('lumbar', 'principal', 'isometrico', ['Abdomen', 'Glúteos'], [40, 60], undefined, 'frontal'),
    ],
    linea: { origen: 'centro-de-masas' },
    marcas: ['hombro', 'cadera', 'tobillo'],
    alineacion: {
      regla: 'la cadera sin caer hacia el suelo',
      toleranciaMm: 30,
      porQue: 'Es plano frontal: la cámara tiene que estar de frente, no de lado.',
    },
  },

  'FLEXIÓN DE TRONCO': {
    patron: 'FLEXIÓN DE TRONCO',
    cadena: 'abierta',
    anclaje: 'la pelvis',
    segmentosMoviles: ['torso'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M('lumbar', 'principal', 'flexion', ['Abdomen'], [40, 60]),
      M('cadera', 'secundario', 'flexion', [], [30, 50],
        'El psoas no tiene grupo en la taxonomía. Si la cadera hace el trabajo, el abdomen apenas se acorta.'),
    ],
    linea: { origen: 'centro-de-masas' },
    marcas: ['hombro', 'cadera', 'rodilla'],
    alineacion: {
      regla: 'el recorrido en la columna, no en la cadera',
      toleranciaMm: 30,
      porQue: 'Distinguirlos es justo lo que una cámara sabe hacer y el ojo no.',
    },
  },

  'EXTENSIÓN LUMBAR': {
    patron: 'EXTENSIÓN LUMBAR',
    cadena: 'cerrada',
    anclaje: 'las piernas, sujetas al banco',
    segmentosMoviles: ['torso'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M('lumbar', 'principal', 'extension', ['Lumbares'], [50, 60]),
      M('cadera', 'principal', 'extension', ['Glúteos', 'Isquios'], [40, 70],
        'Los dos ejes se reparten el recorrido, y cuál manda depende de la inclinación del banco. ' +
        'Es el patrón donde más fácil es creer que se entrena una cosa y entrenar la otra.'),
    ],
    linea: {
      origen: 'centro-de-masas',
      nota: 'El peso del propio torso es la carga principal aunque se sostenga un disco.',
    },
    marcas: ['rodilla', 'cadera', 'hombro'],
    alineacion: {
      regla: 'sin pasar de la línea del cuerpo al subir',
      toleranciaMm: 30,
      porQue: 'Por encima de la horizontal el brazo externo ya está cayendo y lo único que crece es la compresión.',
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Sin modelo de palanca, a propósito
  // ───────────────────────────────────────────────────────────────────────────
  'PREV/REHAB': null,
  ACONDICIONAMIENTO: null,
  MOVILIDAD: null,
}
