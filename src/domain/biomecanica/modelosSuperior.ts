/**
 * Empujes, tracciones y brazos.
 *
 * Un trozo de la tabla de `modelos.ts`, partida por región para no pasar del
 * tamaño de archivo del proyecto. El porqué de cada campo está en `palancas.ts`.
 */

import type { Categoria } from '../taxonomia'
import { M, type ModeloDePalanca } from './tipos'

export const MODELOS_SUPERIOR: Partial<Record<Categoria, ModeloDePalanca | null>> = {
  // ───────────────────────────────────────────────────────────────────────────
  // Empujes
  // ───────────────────────────────────────────────────────────────────────────
  'EMPUJE HORIZONTAL': {
    patron: 'EMPUJE HORIZONTAL',
    cadena: 'abierta',
    anclaje: 'el torso, contra el banco',
    segmentosMoviles: ['brazo', 'antebrazo'],
    referencia: 'torso',
    vista: 'lateral',
    ejes: [
      M('hombro', 'principal', 'aduccion', ['Pecho', 'Hombros'], [20, 40],
        'Aducción horizontal: el brazo cruza hacia la línea media. El brazo interno del ' +
        'deltoides varía mucho con el ángulo de abducción del codo.'),
      M('codo', 'principal', 'extension', ['Tríceps'], [20, 25]),
      M('escapula', 'estabilizador', 'retraccion', ['Espalda'], [20, 40],
        'La escápula es la base sobre la que empuja el húmero. Si no está fija, el hombro empuja desde el aire.'),
      M('muñeca', 'estabilizador', 'isometrico', [], [15, 25],
        'Sin grupo propio en la taxonomía. Si la barra no cae sobre el codo, aquí aparece un momento que nadie quiere.'),
    ],
    linea: { origen: 'carga-externa' },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'la muñeca en vertical sobre el codo',
      toleranciaMm: 25,
      porQue:
        'Con el antebrazo vertical, todo el momento va a hombro y codo, que es lo que ' +
        'queremos. Inclinado, aparece momento en la muñeca y una parte de la fuerza se ' +
        'gasta en sostener la barra en vez de moverla.',
    },
  },

  'EMPUJE INCLINADO': {
    patron: 'EMPUJE INCLINADO',
    cadena: 'abierta',
    anclaje: 'el torso, contra el respaldo inclinado',
    segmentosMoviles: ['brazo', 'antebrazo'],
    referencia: 'torso',
    vista: 'lateral',
    ejes: [
      M('hombro', 'principal', 'flexion', ['Pecho', 'Hombros'], [20, 40],
        'Cuanto más vertical el respaldo, más flexión y menos aducción: el reparto se corre al deltoides anterior.'),
      M('codo', 'principal', 'extension', ['Tríceps'], [20, 25]),
      M('escapula', 'estabilizador', 'retraccion', ['Espalda'], [20, 40]),
      M('muñeca', 'estabilizador', 'isometrico', [], [15, 25],
        'Como en el banco plano: si la barra no cae sobre el codo, aquí aparece un momento ' +
        'que nadie quiere y parte de la fuerza se gasta en sostenerla.'),
    ],
    linea: { origen: 'carga-externa' },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'la muñeca en vertical sobre el codo',
      toleranciaMm: 25,
      porQue: 'La misma razón que en el plano; el ángulo del banco no la cambia.',
    },
  },

  'EMPUJE VERTICAL': {
    patron: 'EMPUJE VERTICAL',
    cadena: 'abierta',
    anclaje: 'los pies en el suelo; el torso sostiene',
    segmentosMoviles: ['brazo', 'antebrazo'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M('hombro', 'principal', 'abduccion', ['Hombros'], [20, 30]),
      M('codo', 'principal', 'extension', ['Tríceps'], [20, 25]),
      M('lumbar', 'estabilizador', 'isometrico', ['Abdomen', 'Lumbares'], [50, 60],
        'La carga está por encima de la cabeza: cualquier desvío por delante se paga en la lumbar con un brazo largo.'),
      M('escapula', 'secundario', 'retraccion', ['Espalda'], [20, 40]),
      M('muñeca', 'estabilizador', 'isometrico', [], [15, 25],
        'Con la carga por encima de la cabeza, una muñeca caída manda la barra por delante ' +
        'del codo y de paso alarga el brazo en la lumbar.'),
    ],
    linea: { origen: 'carga-externa' },
    marcas: ['tobillo', 'cadera', 'hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'la barra sobre el mediopié al bloquear, con el codo bajo la muñeca',
      toleranciaMm: 25,
      porQue:
        'Es el mismo criterio de la sentadilla y por la misma razón: la vertical del centro ' +
        'de masas del sistema cae dentro de la base de apoyo o no se sostiene.',
    },
  },

  'APERTURA DE PECHO': {
    patron: 'APERTURA DE PECHO',
    cadena: 'abierta',
    anclaje: 'el torso',
    segmentosMoviles: ['brazo'],
    referencia: 'torso',
    vista: 'cenital',
    ejes: [
      M('hombro', 'principal', 'aduccion', ['Pecho', 'Hombros'], [20, 40],
        'Con el codo casi fijo, el brazo entero es la palanca: el brazo externo es la distancia ' +
        'del hombro a la mano, y por eso pesa tanto con tan poca carga.', 'cenital'),
      M('codo', 'estabilizador', 'isometrico', ['Tríceps'], [20, 25],
        'No gira, y ése es su trabajo: en cuanto gira, la apertura pasa a ser un press.',
        'cenital'),
    ],
    linea: { origen: 'carga-externa', nota: 'En polea, la del cable.' },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el ángulo del codo constante durante todo el recorrido',
      toleranciaMm: 30,
      porQue: 'Si el codo se cierra, deja de ser apertura y pasa a ser press: el brazo se acorta y la carga cae.',
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Tracciones
  // ───────────────────────────────────────────────────────────────────────────
  'TRACCIÓN VERTICAL': {
    patron: 'TRACCIÓN VERTICAL',
    cadena: 'abierta',
    anclaje: 'el torso, contra el asiento del jalón',
    segmentosMoviles: ['brazo', 'antebrazo'],
    referencia: 'torso',
    vista: 'lateral',
    ejes: [
      M('hombro', 'principal', 'aduccion', ['Espalda'], [30, 50]),
      M('codo', 'principal', 'flexion', ['Bíceps'], [20, 40],
        'Braquial y braquiorradial trabajan aquí tanto o más que el bíceps, y no tienen grupo ' +
        'propio en la taxonomía: se contabilizan dentro de Bíceps. Es una simplificación conocida.'),
      M('escapula', 'principal', 'retraccion', ['Espalda'], [20, 40],
        'Depresión y rotación descendente. Sin ella el dorsal no tiene desde dónde tirar.'),
    ],
    linea: { origen: 'cable' },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el torso estable, sin ganar recorrido echándose atrás',
      toleranciaMm: 30,
      porQue: 'Inclinarse convierte el jalón en un remo y cambia el eje protagonista sin avisar.',
    },
  },

  'TRACCIÓN HORIZONTAL': {
    patron: 'TRACCIÓN HORIZONTAL',
    cadena: 'abierta',
    anclaje: 'los pies y la cadera; el torso sostiene inclinado',
    segmentosMoviles: ['brazo', 'antebrazo'],
    referencia: 'torso',
    vista: 'lateral',
    ejes: [
      M('hombro', 'principal', 'extension', ['Espalda', 'Hombros'], [30, 50]),
      M('codo', 'principal', 'flexion', ['Bíceps'], [20, 40]),
      M('escapula', 'principal', 'retraccion', ['Espalda'], [20, 40],
        'Trapecio medio y romboides. Es el eje que distingue un remo de un curl con impulso.'),
      M('lumbar', 'estabilizador', 'isometrico', ['Lumbares'], [50, 60],
        'Con el torso inclinado el brazo externo lumbar es grande TODA la serie, aunque la ' +
        'lumbar no se mueva. En remo con barra suele ser el eje que primero falla.'),
      M('cadera', 'estabilizador', 'isometrico', ['Isquios', 'Glúteos'], [40, 70]),
    ],
    linea: { origen: 'carga-externa', nota: 'En remo en polea, la del cable.' },
    marcas: ['cadera', 'hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el ángulo del torso constante durante toda la serie',
      toleranciaMm: 30,
      porQue:
        'Si el torso sube al tirar, la carga se levanta con la cadera y el momento no llega ' +
        'a la espalda. Y es lo primero que cambia con la fatiga, así que sirve de aviso.',
    },
  },

  'EXTENSIÓN DE HOMBRO': {
    patron: 'EXTENSIÓN DE HOMBRO',
    cadena: 'abierta',
    anclaje: 'el torso',
    segmentosMoviles: ['brazo'],
    referencia: 'torso',
    vista: 'lateral',
    ejes: [
      M('hombro', 'principal', 'extension', ['Espalda', 'Tríceps'], [30, 50]),
      M('escapula', 'secundario', 'retraccion', ['Espalda'], [20, 40]),
    ],
    linea: { origen: 'cable' },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el codo sin abrirse hacia fuera',
      toleranciaMm: 25,
      porQue: 'Si se abre, el patrón se convierte en abducción horizontal y cambia de músculo.',
    },
  },

  'RETRACCIÓN ESCAPULAR': {
    patron: 'RETRACCIÓN ESCAPULAR',
    cadena: 'abierta',
    anclaje: 'el torso',
    segmentosMoviles: ['brazo'],
    referencia: 'torso',
    vista: 'lateral',
    ejes: [
      M('escapula', 'principal', 'retraccion', ['Espalda', 'Hombros'], [20, 40],
        'El recorrido escapular es de centímetros: es el patrón con menos rango de la tabla ' +
        'y el que más resolución de cámara exige para decir algo.'),
    ],
    linea: { origen: 'cable' },
    marcas: ['hombro', 'codo'],
    alineacion: {
      regla: 'el codo sin flexionarse: el recorrido lo hace la escápula',
      toleranciaMm: 20,
      porQue: 'Con el codo colaborando, el ejercicio pasa a ser un remo y la escápula deja de ser el eje.',
    },
  },

  'ABDUCCIÓN DE HOMBRO': {
    patron: 'ABDUCCIÓN DE HOMBRO',
    cadena: 'abierta',
    anclaje: 'el torso',
    segmentosMoviles: ['brazo'],
    referencia: 'torso',
    vista: 'frontal',
    ejes: [
      M('hombro', 'principal', 'abduccion', ['Hombros'], [20, 30],
        'El brazo interno del deltoides crece con la abducción: es débil abajo por dentro y por fuera a la vez.', 'frontal'),
      M('escapula', 'secundario', 'retraccion', ['Espalda'], [20, 40],
        'Por encima de ~90° la escápula tiene que rotar o el hombro choca.', 'frontal'),
      M('codo', 'estabilizador', 'isometrico', ['Tríceps'], [20, 25],
        'Sostiene el ángulo. Cerrarlo al subir acorta la palanca justo donde el ejercicio pesa.',
        'frontal'),
    ],
    linea: { origen: 'carga-externa' },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'sin balanceo del torso, y el codo por encima de la muñeca',
      toleranciaMm: 25,
      porQue:
        'El pico de brazo externo está en la horizontal (perfiles-de-resistencia §3): es ' +
        'justo donde se hace trampa con el torso, porque es donde de verdad pesa.',
    },
  },

  'ABDUCCIÓN HORIZONTAL': {
    patron: 'ABDUCCIÓN HORIZONTAL',
    cadena: 'abierta',
    anclaje: 'el torso',
    segmentosMoviles: ['brazo'],
    referencia: 'torso',
    vista: 'frontal',
    ejes: [
      M('hombro', 'principal', 'abduccion', ['Hombros', 'Espalda'], [20, 30], undefined, 'frontal'),
      M('escapula', 'secundario', 'retraccion', ['Espalda'], [20, 40], undefined, 'frontal'),
    ],
    linea: { origen: 'cable' },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el torso quieto y el codo a la altura del hombro',
      toleranciaMm: 25,
      porQue: 'Bajar el codo mete al dorsal y saca al deltoides posterior.',
    },
  },

  'FLEXIÓN DE HOMBRO': {
    patron: 'FLEXIÓN DE HOMBRO',
    cadena: 'abierta',
    anclaje: 'el torso',
    segmentosMoviles: ['brazo'],
    referencia: 'torso',
    vista: 'lateral',
    ejes: [
      M('hombro', 'principal', 'flexion', ['Hombros', 'Pecho'], [20, 30]),
      M('lumbar', 'estabilizador', 'isometrico', ['Abdomen'], [50, 60],
        'La carga por delante del cuerpo tira de la lumbar con un brazo largo.'),
    ],
    linea: { origen: 'carga-externa' },
    marcas: ['cadera', 'hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'sin arquear la lumbar al pasar la horizontal',
      toleranciaMm: 25,
      porQue: 'Es donde el brazo externo es máximo, y arquear es la forma de esquivarlo.',
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Brazos
  // ───────────────────────────────────────────────────────────────────────────
  'FLEXIÓN DE CODO': {
    patron: 'FLEXIÓN DE CODO',
    cadena: 'abierta',
    anclaje: 'el húmero, contra el torso o el atril',
    segmentosMoviles: ['antebrazo'],
    referencia: 'brazo',
    vista: 'lateral',
    ejes: [
      M('codo', 'principal', 'flexion', ['Bíceps'], [20, 40],
        'Máximo alrededor de 90-100° de flexión y bastante menor en extensión completa.'),
      M('hombro', 'estabilizador', 'isometrico', ['Hombros'], [20, 30],
        'Si el codo viaja hacia delante, el hombro empieza a flexionar y roba recorrido al bíceps.'),
    ],
    linea: {
      origen: 'carga-externa',
      nota:
        'El caso de manual: con el brazo colgando, el brazo de momento es ≈ 0 y el bíceps ' +
        'está en su longitud máxima. Máximo estiramiento con carga cero.',
    },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el codo quieto, pegado al costado',
      toleranciaMm: 20,
      porQue: 'Es la única forma de que el recorrido medido sea recorrido del codo y no del hombro.',
    },
  },

  'EXTENSIÓN DE CODO': {
    patron: 'EXTENSIÓN DE CODO',
    cadena: 'abierta',
    anclaje: 'el húmero',
    segmentosMoviles: ['antebrazo'],
    referencia: 'brazo',
    vista: 'lateral',
    ejes: [
      M('codo', 'principal', 'extension', ['Tríceps'], [20, 25]),
      M('hombro', 'secundario', 'isometrico', ['Hombros'], [20, 30],
        'La posición del hombro decide la longitud de la porción larga del tríceps: por encima ' +
        'de la cabeza y a lo largo del cuerpo no son el mismo ejercicio.'),
    ],
    linea: { origen: 'cable' },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el codo quieto',
      toleranciaMm: 20,
      porQue: 'Si el codo baja, el dorsal entra a ayudar y el tríceps deja de ser el que manda.',
    },
  },
}
