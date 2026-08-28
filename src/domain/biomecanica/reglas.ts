/**
 * Qué tiene que hacer cada eje NO protagonista para que el protagonista trabaje.
 *
 * Viven aquí y no dentro de la tabla por una razón práctica: éste es el texto
 * que un asesorado va a leer en el móvil entre serie y serie, y conviene poder
 * leerlo todo junto y de una vez para ver si se contradice, si se repite, o si
 * alguna frase suena a jerga. Repartido entre 29 entradas de tabla nadie lo
 * revisa completo nunca.
 *
 * La idea de fondo, que es la que ordena todo lo demás: **la carga va al eje
 * protagonista solo si los otros ejes no se la quedan por el camino.** Un eje
 * mal colocado se queda una parte de la exigencia, y el ejercicio deja de
 * estimular lo que se prescribió sin que nada avise — la serie sale, las
 * repeticiones salen, y el estímulo no está donde debía.
 *
 * De ahí los dos trabajos posibles, `neutralizar` y `congelar`, explicados en
 * `ReglaDeEje` (`tipos.ts`).
 *
 * Fuente de verdad: `Cerebro Alpha/wiki/conocimiento/segmentos-ejes-y-palancas.md`.
 */

import type { Categoria } from '../taxonomia'
import type { Articulacion, ReglaDeEje } from './tipos'

export const REGLAS_DE_EJE: Partial<
  Record<Categoria, Partial<Record<Articulacion, ReglaDeEje>>>
> = {
  // ───────────────────────────────────────────────────────────────────────────
  // Tren inferior
  // ───────────────────────────────────────────────────────────────────────────
  'BISAGRA DE CADERA': {
    // El caso que enseña la idea entera.
    rodilla: {
      tipo: 'neutralizar',
      regla: 'la rodilla en vertical sobre el tobillo',
      toleranciaMm: 30,
      porQue:
        'Ahí la rodilla no tiene brazo de momento y no se queda nada: toda la exigencia ' +
        'sigue hasta la cadera, que es lo que se quiere estimular. Adelantada, una parte ' +
        'se va al cuádriceps y la bisagra deja de ser una bisagra.',
    },
    lumbar: {
      tipo: 'congelar',
      regla: 'la misma curva de columna de principio a fin',
      toleranciaMm: 25,
      porQue:
        'Si la espalda se redondea al bajar, el brazo en L5-S1 crece sin que cambie el ' +
        'ángulo de cadera: la exigencia sube por un camino que no se ve en el recorrido.',
    },
  },

  SENTADILLA: {
    lumbar: {
      tipo: 'congelar',
      regla: 'el ángulo del torso constante durante todo el descenso',
      toleranciaMm: 30,
      porQue:
        'La inclinación del torso es lo que reparte el momento entre rodilla y cadera. ' +
        'Si cambia a mitad de la bajada, el ejercicio cambia de destinatario a mitad de ' +
        'la repetición.',
    },
  },

  'SENTADILLA UNILATERAL': {
    lumbar: {
      tipo: 'congelar',
      regla: 'el ángulo del torso constante: es lo que define la variante',
      toleranciaMm: 25,
      porQue:
        'Vertical manda el glúteo; inclinado manda el aductor. Un ángulo que se mueve ' +
        'dentro de la serie es un ejercicio distinto del que se prescribió.',
    },
  },

  'EXTENSIÓN DE CADERA': {
    rodilla: {
      tipo: 'neutralizar',
      regla: 'la tibia vertical en el bloqueo',
      toleranciaMm: 30,
      porQue:
        'Con la tibia vertical la rodilla no reclama nada y el reparto entre los dos ' +
        'apoyos manda la carga a la cadera. Con el pie adelantado, se va a los isquios.',
    },
  },

  'FLEXIÓN DE RODILLA': {
    cadera: {
      tipo: 'neutralizar',
      regla: 'la pelvis pegada a la camilla',
      toleranciaMm: 25,
      porQue:
        'Si la cadera se despega, parte del recorrido lo hace la pelvis y el isquio se ' +
        'acorta menos de lo que marca la máquina.',
    },
  },

  // EXTENSIÓN DE RODILLA no lleva reglas a propósito: la cadera ahí es el
  // ANCLAJE —el fémur contra el asiento—, no un eje. Su único eje es la
  // rodilla, y por eso es el patrón más limpio de medir de toda la tabla.
  // Dónde se coloca el respaldo cambia la longitud del recto femoral, pero eso
  // es un ajuste de la máquina, no una palanca que la cámara pueda comprobar.

  'FLEXIÓN PLANTAR': {
    rodilla: {
      tipo: 'congelar',
      regla: 'la rodilla extendida y quieta',
      toleranciaMm: 20,
      porQue:
        'Con la rodilla flexionada el gemelo se acorta y cede el trabajo al sóleo. No es ' +
        'peor ni mejor: es otro ejercicio, y conviene saber cuál se está haciendo.',
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Empujes
  // ───────────────────────────────────────────────────────────────────────────
  'EMPUJE HORIZONTAL': {
    muñeca: {
      tipo: 'neutralizar',
      regla: 'la muñeca en vertical sobre el codo',
      toleranciaMm: 25,
      porQue:
        'Con el antebrazo vertical la muñeca no tiene brazo y todo el momento llega a ' +
        'hombro y codo. Inclinado, parte de la fuerza se gasta en sostener la barra en ' +
        'vez de moverla.',
    },
    escapula: {
      tipo: 'congelar',
      regla: 'las escápulas retraídas y quietas contra el banco',
      toleranciaMm: 20,
      porQue: 'La escápula es la base desde la que empuja el húmero. Si se mueve, el hombro empuja desde el aire.',
    },
  },

  'EMPUJE INCLINADO': {
    muñeca: {
      tipo: 'neutralizar',
      regla: 'la muñeca en vertical sobre el codo',
      toleranciaMm: 25,
      porQue: 'La misma razón que en el banco plano: el ángulo del respaldo no la cambia.',
    },
  },

  'EMPUJE VERTICAL': {
    muñeca: {
      tipo: 'neutralizar',
      regla: 'la muñeca sobre el codo',
      toleranciaMm: 25,
      porQue: 'Con el antebrazo vertical el momento llega entero a hombro y tríceps.',
    },
    lumbar: {
      tipo: 'neutralizar',
      regla: 'la barra sobre el mediopié, sin arquear la lumbar',
      toleranciaMm: 25,
      porQue:
        'La carga está por encima de la cabeza: cualquier desvío por delante se paga en ' +
        'la lumbar con un brazo muy largo, y arquear es la forma de esquivar el trabajo ' +
        'del hombro.',
    },
  },

  'APERTURA DE PECHO': {
    codo: {
      tipo: 'congelar',
      regla: 'el ángulo del codo constante en todo el recorrido',
      toleranciaMm: 30,
      porQue: 'Si el codo se cierra deja de ser apertura y pasa a ser press: el brazo se acorta y la carga cae.',
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Tracciones y brazos
  // ───────────────────────────────────────────────────────────────────────────
  'TRACCIÓN HORIZONTAL': {
    lumbar: {
      tipo: 'congelar',
      regla: 'el ángulo del torso constante durante toda la serie',
      toleranciaMm: 30,
      porQue:
        'Si el torso sube al tirar, la carga se levanta con la cadera y el momento no ' +
        'llega a la espalda. Es lo primero que cambia con la fatiga, así que sirve de aviso.',
    },
  },

  'FLEXIÓN DE CODO': {
    hombro: {
      tipo: 'neutralizar',
      regla: 'el codo en vertical bajo el hombro, pegado al costado',
      toleranciaMm: 20,
      porQue:
        'Ahí el hombro no tiene nada que hacer y el recorrido medido es recorrido del ' +
        'codo. Si el codo viaja adelante, el hombro flexiona y roba parte del trabajo.',
    },
  },

  'EXTENSIÓN DE CODO': {
    hombro: {
      tipo: 'congelar',
      regla: 'el codo quieto donde empezó',
      toleranciaMm: 20,
      porQue: 'Si el codo baja, el dorsal entra a ayudar y el tríceps deja de ser el que manda.',
    },
  },

  'ABDUCCIÓN DE HOMBRO': {
    codo: {
      tipo: 'congelar',
      regla: 'el ángulo del codo constante, sin cerrarlo al subir',
      toleranciaMm: 25,
      porQue:
        'Cerrar el codo acorta el brazo de momento justo en la horizontal, que es donde ' +
        'el ejercicio de verdad pesa. Es hacer trampa sin bajar el peso.',
    },
  },

  'FLEXIÓN DE HOMBRO': {
    lumbar: {
      tipo: 'neutralizar',
      regla: 'sin arquear la lumbar al pasar la horizontal',
      toleranciaMm: 25,
      porQue: 'Es donde el brazo externo del hombro es máximo, y arquear es la forma de esquivarlo.',
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Core
  // ───────────────────────────────────────────────────────────────────────────
  'FLEXIÓN DE TRONCO': {
    cadera: {
      tipo: 'neutralizar',
      regla: 'sin empujar con las piernas: el recorrido lo hace la columna',
      toleranciaMm: 30,
      porQue: 'Si el trabajo lo hace la cadera, el abdomen apenas se acorta aunque el torso suba igual.',
    },
  },

  ANTIEXTENSIÓN: {
    lumbar: {
      tipo: 'congelar',
      regla: 'la cadera en línea entre hombro y tobillo',
      toleranciaMm: 40,
      porQue:
        'Aquí no se neutraliza nada: subir la cadera ACORTA el brazo y hace el ejercicio ' +
        'más fácil sin que se note en el cronómetro. Es la trampa más común del gimnasio, ' +
        'y una cámara la ve perfectamente.',
    },
  },
}
