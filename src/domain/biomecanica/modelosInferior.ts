/**
 * Sentadillas, bisagras, rodilla y tobillo.
 *
 * Un trozo de la tabla de `modelos.ts`, partida por región para no pasar del
 * tamaño de archivo del proyecto. El porqué de cada campo está en `palancas.ts`.
 */

import type { Categoria } from '../taxonomia'
import { M, type ModeloDePalanca } from './tipos'

export const MODELOS_INFERIOR: Partial<Record<Categoria, ModeloDePalanca | null>> = {
  // ───────────────────────────────────────────────────────────────────────────
  // Tren inferior
  // ───────────────────────────────────────────────────────────────────────────
  SENTADILLA: {
    patron: 'SENTADILLA',
    cadena: 'cerrada',
    anclaje: 'los pies en el suelo',
    segmentosMoviles: ['muslo', 'pierna', 'torso'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M('rodilla', 'principal', 'extension', ['Cuádriceps'], [40, 50],
        'Máximo en flexión media por el efecto espaciador de la rótula; decrece en flexión profunda.'),
      M('cadera', 'principal', 'extension', ['Glúteos', 'Isquios', 'Aductores'], [50, 70],
        'El aductor magno extiende cadera y por eso está en la taxonomía como aporte indirecto.'),
      M('lumbar', 'estabilizador', 'isometrico', ['Lumbares', 'Abdomen'], [50, 60],
        'No gira: sostiene. Su brazo externo crece con la inclinación del torso.'),
      M('tobillo', 'secundario', 'flexion-plantar', ['Pantorrillas'], [40, 55]),
    ],
    linea: {
      origen: 'carga-externa',
      nota:
        'La vertical por la barra aproxima bien al centro de masas del sistema cuando la ' +
        'carga pesa más o menos como el propio cuerpo. Por debajo de eso —sentadilla ' +
        'con barra vacía, goblet ligera— hay que usar el centro de masas o el brazo sale corto.',
    },
    marcas: ['tobillo', 'rodilla', 'cadera', 'hombro'],
    alineacion: {
      regla: 'la barra sobre el mediopié',
      toleranciaMm: 25,
      porQue:
        'Es la única posición en la que el sistema no se cae: la vertical del centro de ' +
        'masas tiene que caer dentro de la base de apoyo. Fuera de ahí no es cuestión de ' +
        'técnica, es que hay que dar un paso.',
    },
  },

  'SENTADILLA UNILATERAL': {
    patron: 'SENTADILLA UNILATERAL',
    cadena: 'cerrada',
    anclaje: 'el pie delantero en el suelo',
    segmentosMoviles: ['muslo', 'pierna', 'torso'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M('cadera', 'principal', 'extension', ['Glúteos', 'Aductores'], [50, 70],
        'Cuál de los dos manda lo decide la inclinación del torso: es la variante, no el patrón.'),
      M('rodilla', 'secundario', 'extension', ['Cuádriceps'], [40, 50]),
      M('cadera', 'estabilizador', 'abduccion', ['Glúteos'], [30, 50],
        'En unilateral la pelvis cae hacia el lado libre y el glúteo medio lo frena. ' +
        'Ese momento frontal NO se ve en el plano sagital: la cámara de lado no lo mide.', 'frontal'),
      // `accion` es lo que hace el MÚSCULO en la fase concéntrica, y el tríceps
      // sural plantiflexiona: en la subida empuja el suelo, igual que en la
      // sentadilla a dos piernas. Aquí ponía `dorsiflexion` por lo que dice la
      // nota —el RANGO de dorsiflexión disponible—, que es otra cosa: un tope
      // articular no es una acción muscular, y confundirlos deja al tríceps
      // sural declarado como motor de lo que frena.
      M('tobillo', 'secundario', 'flexion-plantar', ['Pantorrillas'], [40, 55],
        'El RANGO de dorsiflexión disponible —no la acción— limita cuánto puede avanzar la ' +
        'rodilla, y con ello el reparto entre rodilla y cadera. Con poco tobillo, el torso se ' +
        'inclina para compensar y el ejercicio se va al glúteo sin que nadie lo haya decidido.'),
      M('lumbar', 'estabilizador', 'isometrico', ['Lumbares', 'Abdomen'], [50, 60],
        'Aquí el torso no es un acompañante: su ángulo ES la variante. Vertical manda el ' +
        'glúteo, inclinado manda el aductor, y el eje lumbar es el que lo delata.'),
    ],
    linea: { origen: 'carga-externa' },
    marcas: ['tobillo', 'rodilla', 'cadera', 'hombro'],
    alineacion: {
      regla: 'la carga sobre el mediopié del pie delantero',
      toleranciaMm: 25,
      porQue:
        'La base de apoyo útil es la del pie delantero: el de atrás sostiene mucho menos ' +
        'de lo que parece.',
    },
  },

  'BISAGRA DE CADERA': {
    patron: 'BISAGRA DE CADERA',
    cadena: 'cerrada',
    anclaje: 'los pies en el suelo',
    segmentosMoviles: ['torso', 'pelvis'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M('cadera', 'principal', 'extension', ['Isquios', 'Glúteos'], [40, 70]),
      M('lumbar', 'principal', 'isometrico', ['Lumbares'], [50, 60],
        'En bisagra el eje L5-S1 no es un estabilizador de acompañamiento: su brazo externo ' +
        'es casi el mismo que el de la cadera y sostiene el peso del propio torso. Es el eje ' +
        'que decide si el ejercicio es seguro.'),
      M('escapula', 'estabilizador', 'retraccion', ['Espalda'], [20, 40],
        'El trapecio sostiene la escápula contra el tirón de la carga; si cede, el torso se ' +
        'redondea y el brazo lumbar crece sin que cambie el ángulo de cadera.'),
      M('rodilla', 'secundario', 'extension', ['Cuádriceps'], [40, 50],
        'Poco recorrido a propósito: si la rodilla se flexiona, deja de ser bisagra.'),
    ],
    linea: {
      origen: 'carga-externa',
      nota:
        'Con carga ligera el peso del propio torso genera un momento comparable o mayor que ' +
        'el de la barra, y la línea de la barra sola se queda corta. Por debajo de ~40 % del ' +
        'peso corporal, el centro de masas del torso manda.',
    },
    marcas: ['tobillo', 'rodilla', 'cadera', 'hombro'],
    alineacion: {
      regla: 'la barra pegada a la pierna, con la tibia casi vertical',
      toleranciaMm: 30,
      porQue:
        'Cada centímetro que la barra se separa del muslo es un centímetro más de brazo en ' +
        'la cadera Y en la lumbar a la vez. Es el ajuste con más efecto por menos esfuerzo ' +
        'de todo el gimnasio.',
    },
  },

  'EXTENSIÓN DE CADERA': {
    patron: 'EXTENSIÓN DE CADERA',
    cadena: 'cerrada',
    anclaje: 'los pies en el suelo y las escápulas en el banco',
    segmentosMoviles: ['pelvis', 'torso'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M('cadera', 'principal', 'extension', ['Glúteos', 'Isquios'], [50, 70]),
      M('rodilla', 'secundario', 'extension', ['Cuádriceps'], [40, 50]),
      M('lumbar', 'estabilizador', 'isometrico', ['Abdomen', 'Lumbares'], [50, 60],
        'Si el glúteo no llega, la extensión la acaba la lumbar y el ejercicio cambia de sitio.'),
    ],
    linea: { origen: 'carga-externa' },
    marcas: ['rodilla', 'cadera', 'hombro'],
    alineacion: {
      regla: 'la tibia vertical en el bloqueo y el torso paralelo al suelo',
      toleranciaMm: 30,
      porQue:
        'Es la geometría con la que el reparto entre los dos apoyos manda la mayor parte de ' +
        'la carga a la cadera. Con el pie adelantado, la carga se va a los isquios.',
    },
    dosApoyos:
      'El cuerpo se apoya en el banco y en los pies, y la barra descansa sobre la pelvis. ' +
      'El brazo de momento en la cadera NO es la distancia horizontal barra↔cadera —que es ' +
      'casi cero— sino el resultado del reparto de la carga entre los dos apoyos. La cámara ' +
      'mide la geometría; el reparto exige una hipótesis estática. Hasta que esté, este ' +
      'patrón devuelve ángulos, no newtons.',
  },

  'ABDUCCIÓN DE CADERA': {
    patron: 'ABDUCCIÓN DE CADERA',
    cadena: 'abierta',
    anclaje: 'la pelvis, contra el suelo o la máquina',
    segmentosMoviles: ['muslo'],
    referencia: 'pelvis',
    vista: 'frontal',
    ejes: [M('cadera', 'principal', 'abduccion', ['Glúteos'], [30, 50], undefined, 'frontal')],
    linea: { origen: 'carga-externa', nota: 'En máquina o con banda, la línea es la del implemento.' },
    marcas: ['cadera', 'rodilla'],
    alineacion: {
      regla: 'la pelvis quieta: si rota, el movimiento lo hace la columna',
      toleranciaMm: 20,
      porQue: 'Es el fallo típico. Y ocurre en el plano frontal, que una cámara de lado no ve.',
    },
  },

  'ADUCCIÓN DE CADERA': {
    patron: 'ADUCCIÓN DE CADERA',
    cadena: 'abierta',
    anclaje: 'la pelvis, contra la máquina',
    segmentosMoviles: ['muslo'],
    referencia: 'pelvis',
    vista: 'frontal',
    ejes: [M('cadera', 'principal', 'aduccion', ['Aductores'], [30, 50], undefined, 'frontal')],
    linea: { origen: 'cable' },
    marcas: ['cadera', 'rodilla'],
    alineacion: {
      regla: 'la pelvis quieta y el torso sin inclinarse hacia el lado que trabaja',
      toleranciaMm: 20,
      porQue: 'Inclinarse cambia el brazo sin que se note en el recorrido.',
    },
  },

  'ROTACIÓN DE CADERA': {
    patron: 'ROTACIÓN DE CADERA',
    cadena: 'abierta',
    anclaje: 'la pelvis',
    segmentosMoviles: ['muslo'],
    referencia: 'pelvis',
    vista: 'cenital',
    ejes: [M('cadera', 'principal', 'rotacion', ['Glúteos'], [20, 40], undefined, 'cenital')],
    linea: { origen: 'cable' },
    marcas: ['cadera', 'rodilla'],
    alineacion: {
      regla: 'sin acompañar con la pelvis',
      toleranciaMm: 20,
      porQue: 'La rotación ocurre en el plano transverso: una cámara sagital NO la mide. Aquí solo se vigila la trampa.',
    },
  },

  'EXTENSIÓN DE RODILLA': {
    patron: 'EXTENSIÓN DE RODILLA',
    cadena: 'abierta',
    anclaje: 'el fémur, contra el asiento de la máquina',
    segmentosMoviles: ['pierna'],
    referencia: 'muslo',
    vista: 'lateral',
    ejes: [
      M('rodilla', 'principal', 'extension', ['Cuádriceps'], [40, 50],
        'El único eje. Por eso es el patrón más limpio de medir de toda la tabla.'),
    ],
    linea: {
      origen: 'cable',
      nota:
        'En máquina la línea la fija la leva o el cable, no la gravedad. La distancia ' +
        'horizontal deja de servir: hay que medir la perpendicular a la línea real del implemento.',
    },
    marcas: ['rodilla', 'tobillo'],
    alineacion: {
      regla: 'el eje de la máquina alineado con el cóndilo femoral',
      toleranciaMm: 15,
      porQue:
        'Es el único ejercicio donde el eje mecánico es AJUSTABLE y casi nadie lo ajusta. ' +
        'Descuadrado, el momento real no es el que marca la pila.',
    },
  },

  'FLEXIÓN DE RODILLA': {
    patron: 'FLEXIÓN DE RODILLA',
    cadena: 'abierta',
    anclaje: 'el fémur, contra la camilla',
    segmentosMoviles: ['pierna'],
    referencia: 'muslo',
    vista: 'lateral',
    ejes: [
      M('rodilla', 'principal', 'flexion', ['Isquios'], [30, 40]),
      M('cadera', 'secundario', 'isometrico', ['Glúteos'], [50, 70],
        'La posición de la cadera decide la longitud del isquio, y con ella la fuerza disponible. ' +
        'Tumbado y sentado no son el mismo ejercicio.'),
    ],
    linea: { origen: 'cable' },
    marcas: ['cadera', 'rodilla', 'tobillo'],
    alineacion: {
      regla: 'la pelvis pegada a la camilla',
      toleranciaMm: 20,
      porQue: 'Si la cadera se despega, el recorrido lo hace la pelvis y el isquio se acorta menos de lo que parece.',
    },
  },

  'FLEXIÓN PLANTAR': {
    patron: 'FLEXIÓN PLANTAR',
    cadena: 'cerrada',
    anclaje: 'el antepié sobre el escalón',
    segmentosMoviles: ['pierna', 'cuerpo-entero'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M('tobillo', 'principal', 'flexion-plantar', ['Pantorrillas'], [40, 55]),
      M('rodilla', 'secundario', 'isometrico', ['Cuádriceps'], [40, 50],
        'Con la rodilla flexionada el gemelo se acorta y cede el protagonismo al sóleo.'),
    ],
    linea: { origen: 'carga-externa' },
    marcas: ['rodilla', 'tobillo'],
    alineacion: {
      regla: 'la carga en vertical sobre el antepié',
      toleranciaMm: 20,
      porQue: 'El brazo externo aquí es la distancia del eje del tobillo a la cabeza del metatarso: es corto, y cualquier desvío pesa mucho en proporción.',
    },
  },

  DORSIFLEXIÓN: {
    patron: 'DORSIFLEXIÓN',
    cadena: 'abierta',
    anclaje: 'la pierna',
    segmentosMoviles: ['pie'],
    referencia: 'pierna',
    vista: 'lateral',
    // Quien dorsiflexiona es el TIBIAL ANTERIOR, y no tiene grupo en el PANEL.
    // Hasta el 2026-08-27 aquí ponía `Pantorrillas`, que es su antagonista: el
    // tríceps sural plantiflexiona. El error venía de la fuente de verdad y se
    // corrigió en la taxonomía el mismo día (§3bis nota 4), donde DORSIFLEXIÓN
    // pasó a no acreditar volumen a nadie.
    ejes: [
      {
        ...M('tobillo', 'principal', 'dorsiflexion', [], [30, 45]),
        motorSinGrupo: 'tibial anterior',
      },
    ],
    linea: { origen: 'carga-externa' },
    marcas: ['rodilla', 'tobillo'],
    alineacion: {
      regla: 'la pierna quieta',
      toleranciaMm: 20,
      porQue: 'Si la pierna acompaña, el recorrido del pie no es el recorrido articular.',
    },
  },
}
