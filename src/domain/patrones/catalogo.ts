/**
 * Catálogo de patrones de movimiento.
 *
 * Son los patrones que aparecen en prácticamente todos los microciclos, así que
 * casi ningún asesorado se queda sin ver estos. El orden es el de peso real en
 * el catálogo de ejercicios, no alfabético.
 *
 * Deliberadamente **no** se guardan aquí las cifras de uso —cuántas veces se
 * prescribe cada patrón, en cuántas sesiones, en cuántos microciclos—. Este
 * repositorio es público y el tamaño de la operación no tiene por qué vivir en
 * el código; si alguna vista las quiere mostrar, se consultan en ejecución por
 * la capa de datos, como cualquier otro dato de negocio.
 *
 * Cada ficha lleva:
 *   inicio / medio / fin  poses en canales anatómicos, en grados
 *   raizInicio / raizFin  traslación de la pelvis; el apoyo corrige la altura
 *   giroInicio / giroFin  rotación de la pelvis: es lo que inclina el TRONCO
 *   activacion            de 0 a 1 por músculo; sufijo ':D' / ':I' si es unilateral
 *   seguimiento           punto cuya trayectoria dibuja el arco del movimiento
 *   camara                ángulo de partida: desde dónde se lee el patrón
 *   foco                  hueso cuya articulación proximal se encuadra de cerca
 */

import type { Vec3 } from './algebra'
import type { Apoyo, Lado, Pose } from './esqueleto'
import type { Activacion } from './musculos'

export interface Patron {
  id: string
  /** Coincide con la categoría que trae el ejercicio del microciclo. */
  categoria: string
  titulo: string
  ejemplos: string
  resumen: string
  claves: string[]
  errores: string[]
  apoyo: Apoyo
  alturaApoyo?: number
  /** Qué pies apoyan planos. Si no se dice, los dos cuando el apoyo es suelo. */
  pies?: Lado[]
  giro?: Vec3
  giroInicio?: Vec3
  giroFin?: Vec3
  raizInicio: Vec3
  raizFin: Vec3
  inicio: Pose
  medio?: Pose
  fin: Pose
  activacion: Activacion
  seguimiento?: [string, number, Vec3]
  camara: { azimut: number; elevacion: number }
  /** El patrón contrapone un fallo y su corrección en vez de un recorrido. */
  invertido?: boolean
  /**
   * Encuadre de estudio: el hueso distal de la articulación que se quiere ver
   * de cerca, con su lado (`antebrazoD`).
   *
   * Los ejercicios no lo llevan —ahí manda el encuadre por musculatura, que es
   * lo que enseña el gesto—. Lo usan las demostraciones de una articulación
   * suelta, donde encuadrar los músculos que la cruzan abarcaría desde la
   * escápula hasta la mano y dejaría el codo del tamaño de una uña.
   */
  foco?: string
  /**
   * Dónde se atasca la subida, de 0 (nada más arrancar) a 1 (al final).
   *
   * El punto en el que la barra se frena no cae en el mismo sitio en cada
   * ejercicio, porque depende de cómo empeora el brazo de momento. Solo se
   * declara donde hay medida publicada; el resto usa el valor de en medio, que
   * es preferible a inventarle un número a cada patrón.
   */
  estancamiento?: number
  /**
   * Si el extremo de la cadena está fijo contra algo que no se mueve.
   *
   * **Cerrada**: el pie está en el suelo o la mano en una barra fija, así que lo
   * que se mueve es el cuerpo. En una sentadilla la tibia no puede irse a
   * ninguna parte: es el fémur el que baja sobre ella, y la pelvis la que se
   * mueve sobre el fémur.
   *
   * **Abierta**: el extremo va libre y se mueve él. En una extensión de rodilla
   * el fémur está quieto contra el asiento y la tibia sube.
   *
   * No es una etiqueta de manual: decide **qué segmento hay que decir que se
   * mueve**. Sin esto el desglose contaba siempre lo mismo —«tibia sobre
   * fémur»— y en una sentadilla eso se lee como un curl femoral, que es el
   * ejercicio contrario.
   */
  cadena: 'cerrada' | 'abierta'
}

export const PATRONES: Patron[] = [
  {
    id: 'extension_cadera',
    cadena: 'cerrada',
    categoria: 'EXTENSIÓN DE CADERA',
    // En el hip thrust el momento extensor es máximo con la cadera cerca de 90°
    // —abajo— y decae hacia la extensión completa: cuesta nada más arrancar.
    estancamiento: 0.16,
    titulo: 'Extensión de cadera',
    ejemplos: 'Empuje de cadera · Patada de glúteo en polea · Empuje de cadera con barra',
    resumen:
      'La cadera pasa de flexión a alineación con el tronco. Es el patrón más prescrito de todo Alpha y el que más glúteo produce por repetición.',
    claves: [
      'Empuja el suelo con los talones, no con la punta.',
      'Termina la repetición metiendo la pelvis, no arqueando la espalda baja.',
      'Barbilla al pecho: si la mirada sube, la lumbar se lleva el trabajo.',
    ],
    errores: [
      'Buscar más rango arqueando la lumbar en vez de extender la cadera.',
      'Apoyar los pies demasiado cerca y convertirlo en un ejercicio de cuádriceps.',
    ],
    apoyo: 'suelo',
    giroInicio: [-52, 0, 0],
    giroFin: [-74, 0, 0],
    raizInicio: [0, 0.34, 0],
    raizFin: [0, 0.50, 0],
    inicio: { caderaFlex: 68, rodillaFlex: 122, toraxFlex: 12, hombroFlex: 16, hombroAbd: 18, codoFlex: 74, pelvisBascula: -8 },
    fin: { caderaFlex: 4, rodillaFlex: 88, toraxFlex: 6, pelvisBascula: 16, hombroFlex: 10, hombroAbd: 16, codoFlex: 68 },
    activacion: { 'gluteo_mayor.inferior': 1, 'gluteo_mayor.superior': 0.9, 'isquiotibiales.biceps_larga': 0.7, 'isquiotibiales.semitendinoso': 0.65, 'isquiotibiales.semimembranoso': 0.65, 'isquiotibiales.biceps_corta': 0.35, 'aductores.mayor': 0.5, cuadriceps: 0.3, recto_abdominal: 0.35, erectores: 0.3 },
    seguimiento: ['pelvis', 0.4, [0, 0, 0.06]],
    camara: { azimut: 32, elevacion: 6 },
  },
  {
    id: 'sentadilla',
    cadena: 'cerrada',
    categoria: 'SENTADILLA',
    // La fuerza es mínima en los primeros 15 cm sobre la posición más baja de la
    // barra, que en un recorrido de medio metro cae en el primer cuarto.
    estancamiento: 0.24,
    titulo: 'Sentadilla',
    ejemplos: 'Prensa de piernas a 45° · Sentadilla hack · Sentadilla en Smith',
    resumen:
      'Cadera y rodilla se flexionan a la vez mientras el tronco aguanta. Es el patrón que más masa de cuádriceps y glúteo mueve por sesión.',
    claves: [
      'Reparte el peso entre el talón y la base del dedo gordo.',
      'Las rodillas siguen la dirección de los pies; no se meten hacia dentro.',
      'Baja hasta donde puedas mantener la espalda neutra, ni un centímetro más.',
    ],
    errores: [
      'Que los talones se despeguen: casi siempre es falta de dorsiflexión de tobillo.',
      'Redondear la zona lumbar al final del recorrido para ganar profundidad.',
    ],
    apoyo: 'suelo',
    giroInicio: [0, 0, 0],
    giroFin: [16, 0, 0],
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.60, 0.02],
    inicio: { hombroFlex: 8, codoFlex: 20, caderaAbd: 4, rodillaFlex: 4 },
    medio: { caderaFlex: 52, rodillaFlex: 78, toraxFlex: 15, caderaAbd: 8, hombroFlex: 18, codoFlex: 30 },
    fin: { caderaFlex: 126, rodillaFlex: 139, toraxFlex: 24, caderaAbd: 13, hombroFlex: 16, codoFlex: 32 },
    activacion: { 'cuadriceps.vasto_lateral': 1, 'cuadriceps.vasto_medial': 1, 'cuadriceps.vasto_intermedio': 0.95, 'cuadriceps.recto': 0.55, gluteo_mayor: 0.95, 'aductores.mayor': 0.7, 'aductores.largo': 0.5, erectores: 0.7, 'triceps_sural.soleo': 0.45, isquiotibiales: 0.35, recto_abdominal: 0.4, oblicuos: 0.35, gluteo_medio: 0.45 },
    seguimiento: ['pelvis', 0, [0, 0, 0.10]],
    camara: { azimut: 30, elevacion: 4 },
  },
  {
    id: 'bisagra_cadera',
    cadena: 'cerrada',
    categoria: 'BISAGRA DE CADERA',
    titulo: 'Bisagra de cadera',
    ejemplos: 'Peso muerto rumano · Peso muerto rumano con mancuernas · Peso muerto parcial desde rack',
    resumen:
      'La cadera se echa atrás con la rodilla casi fija. Es el patrón que separa a quien entrena isquios de quien se hace daño en la espalda.',
    claves: [
      'Lleva la cadera hacia atrás, no bajes el pecho: el movimiento nace atrás.',
      'La rodilla se dobla un poco y se queda ahí; no acompaña.',
      'La barra roza el muslo todo el recorrido.',
    ],
    errores: [
      'Convertirlo en sentadilla: si la rodilla viaja, el isquio deja de estirarse.',
      'Perder la espalda neutra abajo, que es donde la carga sobre el disco es máxima.',
    ],
    apoyo: 'suelo',
    giroInicio: [-4, 0, 0],
    giroFin: [84, 0, 0],
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, -0.12],
    inicio: { hombroFlex: 6, codoFlex: 4, caderaFlex: -6 },
    fin: { caderaFlex: 98, rodillaFlex: 14, toraxFlex: 3, hombroFlex: -10, codoFlex: 3 },
    activacion: { flexores_carpo: 0.65, extensores_carpo: 0.52, 'isquiotibiales.biceps_larga': 1, 'isquiotibiales.semitendinoso': 1, 'isquiotibiales.semimembranoso': 1, 'isquiotibiales.biceps_corta': 0.4, gluteo_mayor: 0.9, erectores: 0.85, 'aductores.mayor': 0.4, dorsal_ancho: 0.4, 'trapecio.medio': 0.35, 'triceps_sural.gastro_medial': 0.25, cuadrado_lumbar: 0.4 },
    seguimiento: ['mano', 0.6, [0, 0, 0]],
    camara: { azimut: 78, elevacion: 4 },
  },
  {
    id: 'flexion_rodilla',
    cadena: 'abierta',
    categoria: 'FLEXIÓN DE RODILLA',
    titulo: 'Flexión de rodilla',
    ejemplos: 'Flexión de rodilla tumbado en máquina · Flexión de rodilla de pie (unilateral)',
    resumen:
      'El talón viaja hacia el glúteo. Aísla el isquio en su otra función: la que la bisagra de cadera no entrena.',
    claves: [
      'Sube rápido y baja lento: el freno es donde está el estímulo.',
      'La cadera no se despega del apoyo; si se levanta, la lumbar compensa.',
      'Punta del pie relajada: forzarla mete al gemelo en el trabajo.',
    ],
    errores: [
      'Dar un tirón inicial con la cadera para arrancar la carga.',
      'Recorrido corto: quedarse a media flexión deja fuera el pico de tensión.',
    ],
    apoyo: 'ninguno',
    giro: [90, 0, 0],
    raizInicio: [0, 0.32, 0.05],
    raizFin: [0, 0.32, 0.05],
    inicio: { rodillaFlex: 2, hombroFlex: 150, codoFlex: 22, caderaFlex: -8 },
    fin: { rodillaFlex: 134, hombroFlex: 150, codoFlex: 18, caderaFlex: -2 },
    activacion: { isquiotibiales: 1, 'triceps_sural.gastro_medial': 0.55, 'triceps_sural.gastro_lateral': 0.55, poplíteo: 0.4, gluteo_mayor: 0.25 },
    seguimiento: ['pie', 0.2, [0, 0, 0]],
    camara: { azimut: 62, elevacion: 14 },
  },
  {
    id: 'sentadilla_unilateral',
    cadena: 'cerrada',
    categoria: 'SENTADILLA UNILATERAL',
    titulo: 'Sentadilla unilateral',
    ejemplos: 'Sentadilla búlgara con mancuernas · Búlgara en Smith · Zancada con mancuernas',
    resumen:
      'Una pierna soporta y la otra solo estabiliza. Además del cuádriceps, obliga al glúteo medio a impedir que la pelvis se caiga de lado.',
    claves: [
      'El peso vive en la pierna de delante; la de atrás solo hace equilibrio.',
      'La cadera baja recta: si la pelvis se inclina, el glúteo medio no está trabajando.',
      'Tronco ligeramente adelante para repartir entre cuádriceps y glúteo.',
    ],
    errores: [
      'Empujar con la pierna de atrás y convertirlo en una sentadilla a dos piernas.',
      'Dejar que la rodilla de delante se meta hacia dentro al subir.',
    ],
    apoyo: 'suelo',
    pies: ['D'],
    giroInicio: [4, 0, 0],
    giroFin: [12, 0, 0],
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.70, 0],
    inicio: { caderaFlexD: 32, rodillaFlexD: 26, caderaFlexI: -24, rodillaFlexI: 26, tobilloPlantarI: 20, hombroFlex: 8, codoFlex: 14 },
    fin: { caderaFlexD: 112, rodillaFlexD: 138, caderaFlexI: -26, rodillaFlexI: 116, tobilloPlantarI: 44, toraxFlex: 15, hombroFlex: 12, codoFlex: 18 },
    activacion: { 'cuadriceps.vasto_lateral:D': 1, 'cuadriceps.vasto_medial:D': 1, 'cuadriceps.vasto_intermedio:D': 0.95, 'cuadriceps.recto:D': 0.5, 'gluteo_mayor:D': 0.9, 'gluteo_medio:D': 0.85, 'gluteo_menor:D': 0.6, 'aductores:D': 0.5, 'isquiotibiales:D': 0.4, 'cuadriceps:I': 0.4, 'gluteo_medio:I': 0.3, oblicuos: 0.4, cuadrado_lumbar: 0.45, erectores: 0.5 },
    seguimiento: ['pelvis', 0, [0, 0, 0.10]],
    camara: { azimut: 52, elevacion: 6 },
  },
  {
    id: 'flexion_plantar',
    cadena: 'cerrada',
    categoria: 'FLEXIÓN PLANTAR',
    titulo: 'Flexión plantar',
    ejemplos: 'Elevación de talones en máquina · Elevación de talones sentado',
    resumen:
      'El talón sube y el cuerpo entero con él. Recorrido corto y muy fácil de hacer mal: casi todo el mundo rebota en lugar de contraer.',
    claves: [
      'Sube hasta el tope y aguanta un segundo arriba.',
      'Baja hasta notar el estiramiento completo antes de la siguiente.',
      'Con la rodilla estirada trabaja el gemelo; sentado, el sóleo.',
    ],
    errores: [
      'Rebotar con el tendón en vez de mover con el músculo.',
      'Recorrido de la mitad: es el error más repetido de todo el catálogo.',
    ],
    apoyo: 'suelo',
    pies: [],
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { tobilloPlantar: -20, hombroFlex: 4, rodillaFlex: 3 },
    fin: { tobilloPlantar: 46, hombroFlex: 4, rodillaFlex: 0 },
    activacion: { 'triceps_sural.gastro_medial': 1, 'triceps_sural.gastro_lateral': 1, 'triceps_sural.soleo': 0.95, peroneos: 0.3, isquiotibiales: 0.2 },
    seguimiento: ['tibia', 0.9, [0, 0, 0.04]],
    camara: { azimut: 66, elevacion: 2 },
  },
  {
    id: 'extension_rodilla',
    cadena: 'abierta',
    categoria: 'EXTENSIÓN DE RODILLA',
    titulo: 'Extensión de rodilla',
    ejemplos: 'Extensión de rodilla en máquina',
    resumen:
      'El único patrón que aísla el cuádriceps sin que la cadera ayude. Por eso es tan útil cuando falta volumen en el vasto medial.',
    claves: [
      'Extiende del todo y aprieta arriba un instante.',
      'La espalda pegada al respaldo; si te despegas, la cadera está ayudando.',
      'Baja controlado: la fase de bajada es la mitad del ejercicio.',
    ],
    errores: [
      'Impulsar con el tronco para arrancar el peso.',
      'Parar antes de la extensión completa, justo donde el cuádriceps más trabaja.',
    ],
    apoyo: 'ninguno',
    raizInicio: [0, 0.52, 0],
    raizFin: [0, 0.52, 0],
    inicio: { caderaFlex: 88, rodillaFlex: 108, toraxFlex: -6, hombroFlex: 22, codoFlex: 44 },
    fin: { caderaFlex: 86, rodillaFlex: 2, toraxFlex: -8, hombroFlex: 20, codoFlex: 40 },
    activacion: { 'cuadriceps.vasto_lateral': 1, 'cuadriceps.vasto_medial': 1, 'cuadriceps.vasto_intermedio': 1, 'cuadriceps.recto': 0.85, tibial_anterior: 0.25, recto_abdominal: 0.2 },
    seguimiento: ['pie', 0.3, [0, 0, 0]],
    camara: { azimut: 58, elevacion: 8 },
  },
  {
    id: 'abduccion_cadera',
    cadena: 'abierta',
    categoria: 'ABDUCCIÓN DE CADERA',
    titulo: 'Abducción de cadera',
    ejemplos: 'Abducción de cadera en máquina · Abducción de cadera en polea',
    resumen:
      'La pierna se separa de la línea media. Es el trabajo directo del glúteo medio, el músculo que sostiene la pelvis al caminar y al correr.',
    claves: [
      'Separa sin girar la pelvis: el tronco se queda quieto.',
      'Empuja con el lateral de la cadera, no con la rodilla.',
      'Aguanta arriba: el glúteo medio responde muy bien a la pausa.',
    ],
    errores: [
      'Inclinar el torso hacia el lado contrario para ganar rango falso.',
      'Rotar el fémur hacia fuera y pasar el trabajo al tensor de la fascia lata.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { caderaAbdD: -8, hombroFlex: 6, codoFlex: 12 },
    fin: { caderaAbdD: 48, pelvisLat: -4, hombroFlex: 8, codoFlex: 14 },
    activacion: { 'gluteo_medio:D': 1, 'gluteo_menor:D': 0.85, 'tfl:D': 0.85, 'gluteo_mayor.superior:D': 0.6, 'cuadrado_lumbar:I': 0.4, 'oblicuos:I': 0.4, 'gluteo_medio:I': 0.45, erectores: 0.3 },
    seguimiento: ['pie', 0.5, [0, 0, 0]],
    camara: { azimut: 5, elevacion: 6 },
  },
  {
    id: 'aduccion_cadera',
    cadena: 'abierta',
    categoria: 'ADUCCIÓN DE CADERA',
    titulo: 'Aducción de cadera',
    ejemplos: 'Aducción de cadera en máquina · Plancha copenhague',
    resumen:
      'La pierna vuelve hacia la línea media. El aductor es además extensor de cadera, por eso también trabaja en cada sentadilla profunda.',
    claves: [
      'Junta con la parte interna del muslo, no tirando de la rodilla.',
      'Pelvis quieta: el movimiento es solo de la cadera.',
      'Controla la apertura; ahí es donde se gana rango útil.',
    ],
    errores: [
      'Dejar caer el peso en la apertura en vez de frenarlo.',
      'Rango excesivo en frío, que es donde aparecen las molestias de pubis.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { caderaAbdD: 48, caderaAbdI: 8, hombroFlex: 6, codoFlex: 12 },
    fin: { caderaAbdD: -4, caderaAbdI: 6, hombroFlex: 6, codoFlex: 12 },
    activacion: { 'aductores.mayor': 1, 'aductores.largo': 1, 'aductores.gracil': 0.85, 'gluteo_mayor.inferior': 0.3, recto_abdominal: 0.25, 'gluteo_medio:I': 0.4 },
    seguimiento: ['pie', 0.5, [0, 0, 0]],
    camara: { azimut: 8, elevacion: 6 },
  },
  {
    id: 'traccion_horizontal',
    cadena: 'abierta',
    categoria: 'TRACCIÓN HORIZONTAL',
    titulo: 'Tracción horizontal',
    ejemplos: 'Remo en máquina · Remo con barra · Remo con mancuernas (unilateral)',
    resumen:
      'El patrón más universal de todo Alpha: aparece en 111 de los 113 microciclos. El codo viaja hacia atrás y la escápula se retrae.',
    claves: [
      'Empieza el tirón juntando los omóplatos, no doblando el codo.',
      'Lleva el codo hacia la cadera, rozando las costillas.',
      'Suelta hasta estirar del todo y deja que la escápula se separe.',
    ],
    errores: [
      'Tirar solo con el bíceps: la espalda se queda sin estímulo.',
      'Balancear el tronco para acompañar el peso.',
    ],
    apoyo: 'suelo',
    giroInicio: [64, 0, 0],
    giroFin: [64, 0, 0],
    raizInicio: [0, 0.95, -0.06],
    raizFin: [0, 0.95, -0.06],
    inicio: { caderaFlex: 62, rodillaFlex: 16, hombroFlex: 78, codoFlex: 6, escapulaProt: 28 },
    fin: { caderaFlex: 62, rodillaFlex: 16, hombroFlex: 2, hombroAbd: 8, codoFlex: 112, escapulaProt: -32 },
    activacion: { flexores_carpo: 0.6, extensores_carpo: 0.48, dorsal_ancho: 1, 'trapecio.medio': 0.9, 'trapecio.inferior': 0.6, 'trapecio.superior': 0.3, romboides: 0.9, 'deltoides.posterior': 0.8, redondo_mayor: 0.75, biceps: 0.75, braquial: 0.65, braquiorradial: 0.5, erectores: 0.6, isquiotibiales: 0.4, 'manguito.infraespinoso': 0.4 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 68, elevacion: 8 },
  },
  {
    id: 'traccion_vertical',
    cadena: 'abierta',
    categoria: 'TRACCIÓN VERTICAL',
    titulo: 'Tracción vertical',
    ejemplos: 'Jalón al pecho en polea (prono / neutro / unilateral)',
    resumen:
      'El brazo baja desde encima de la cabeza. Es el patrón que construye la anchura del dorsal, y depende de que la escápula descienda antes que el codo.',
    claves: [
      'Antes de tirar, baja el hombro: primero desciende la escápula.',
      'Lleva los codos hacia los bolsillos, no hacia atrás.',
      'Pecho alto y mirada al frente durante todo el recorrido.',
    ],
    errores: [
      'Echar el cuerpo atrás para ayudarse con el peso.',
      'Tirar de la barra a la nuca, que castiga el hombro sin dar más dorsal.',
    ],
    apoyo: 'ninguno',
    raizInicio: [0, 0.60, 0],
    raizFin: [0, 0.60, 0],
    inicio: { hombroFlex: 168, hombroAbd: 24, codoFlex: 4, escapulaElev: 30, caderaFlex: 86, rodillaFlex: 82, toraxFlex: -2 },
    fin: { hombroFlex: 32, hombroAbd: 32, codoFlex: 130, escapulaProt: -24, escapulaElev: -16, toraxFlex: -16, caderaFlex: 86, rodillaFlex: 82 },
    activacion: { flexores_carpo: 0.6, extensores_carpo: 0.48, dorsal_ancho: 1, redondo_mayor: 0.9, 'trapecio.inferior': 0.75, 'trapecio.medio': 0.5, biceps: 0.8, braquial: 0.7, braquiorradial: 0.5, romboides: 0.6, 'deltoides.posterior': 0.5, 'pectoral_mayor.esternocostal': 0.3, recto_abdominal: 0.35 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 22, elevacion: 6 },
  },
  {
    id: 'abduccion_hombro',
    cadena: 'abierta',
    categoria: 'ABDUCCIÓN DE HOMBRO',
    titulo: 'Abducción de hombro',
    ejemplos: 'Elevación lateral con mancuernas · Elevación lateral en polea',
    resumen:
      'El brazo sube por el lateral. Es el único patrón que carga el deltoides medio de forma directa, y el que da la anchura visible del hombro.',
    claves: [
      'Sube hasta la altura del hombro, ni un dedo más.',
      'Codo ligeramente por delante del cuerpo, no clavado al lado.',
      'Guía el movimiento con el codo, no con la mano.',
    ],
    errores: [
      'Encoger el trapecio y subir el hombro entero con el brazo.',
      'Impulsar con las piernas para vencer un peso que es demasiado.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { hombroAbd: -4, codoFlex: 10, toraxFlex: 4 },
    fin: { hombroAbd: 96, hombroFlex: 14, codoFlex: 20, escapulaElev: 14, toraxFlex: 3 },
    activacion: { flexores_carpo: 0.45, extensores_carpo: 0.36, 'deltoides.medio': 1, 'manguito.supraespinoso': 0.85, 'trapecio.superior': 0.55, 'trapecio.inferior': 0.4, serrato: 0.6, 'deltoides.anterior': 0.45, 'deltoides.posterior': 0.35 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 12, elevacion: 4 },
  },
  {
    id: 'abduccion_horizontal',
    cadena: 'abierta',
    categoria: 'ABDUCCIÓN HORIZONTAL',
    titulo: 'Abducción horizontal',
    ejemplos: 'Apertura inversa en máquina · Face pull en polea alta',
    resumen:
      'Con el brazo a la altura del hombro, se abre hacia fuera. Es el contrapeso directo de todo el volumen de empuje horizontal.',
    claves: [
      'Abre con el codo, la mano solo acompaña.',
      'Junta los omóplatos al final del recorrido.',
      'Cuello largo: el trapecio superior no debe encogerse.',
    ],
    errores: [
      'Doblar el codo progresivamente y convertirlo en un remo.',
      'Arquear la espalda para llegar más lejos.',
    ],
    apoyo: 'suelo',
    giroInicio: [60, 0, 0],
    giroFin: [60, 0, 0],
    raizInicio: [0, 0.95, -0.05],
    raizFin: [0, 0.95, -0.05],
    inicio: { caderaFlex: 58, rodillaFlex: 16, hombroFlex: 76, hombroAbd: -2, codoFlex: 14, escapulaProt: 26 },
    fin: { caderaFlex: 58, rodillaFlex: 16, hombroFlex: 74, hombroAbd: 92, codoFlex: 22, escapulaProt: -32 },
    activacion: { flexores_carpo: 0.45, extensores_carpo: 0.36, 'deltoides.posterior': 1, 'trapecio.medio': 0.9, 'trapecio.inferior': 0.55, romboides: 0.85, 'manguito.infraespinoso': 0.65, 'manguito.redondo_menor': 0.6, 'deltoides.medio': 0.4, erectores: 0.5, isquiotibiales: 0.35 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 26, elevacion: 44 },
  },
  {
    id: 'flexion_codo',
    cadena: 'abierta',
    categoria: 'FLEXIÓN DE CODO',
    titulo: 'Flexión de codo',
    ejemplos: 'Curl de bíceps con barra Z · Curl martillo',
    resumen:
      'La mano se acerca al hombro. Aislamiento puro del bíceps y el braquial; el detalle que decide cuál de los dos trabaja es la posición de la muñeca.',
    claves: [
      'El codo se queda pegado al costado y no viaja hacia delante.',
      'Sube girando la palma hacia arriba: el bíceps también supina.',
      'Baja hasta extender del todo antes de la siguiente.',
    ],
    errores: [
      'Balancear el tronco para arrancar el peso, que es la señal de exceso de carga.',
      'Adelantar el codo arriba, con lo que el hombro se lleva la tensión.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { codoFlex: 2, antebrazoRot: 20, hombroFlex: -8 },
    fin: { codoFlex: 150, antebrazoRot: -35, hombroFlex: 16 },
    activacion: { flexores_carpo: 0.5, extensores_carpo: 0.4, 'biceps.larga': 1, 'biceps.corta': 1, braquial: 0.9, braquiorradial: 0.7, 'deltoides.anterior': 0.3, pronador_redondo: 0.25 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 42, elevacion: 6 },
  },
  {
    id: 'extension_codo',
    cadena: 'abierta',
    categoria: 'EXTENSIÓN DE CODO',
    titulo: 'Extensión de codo',
    ejemplos: 'Extensión de codo en polea · Extensión de codo unilateral',
    resumen:
      'El antebrazo empuja hacia abajo con el codo clavado al costado. El tríceps es dos tercios del volumen del brazo; aquí mandan sus cabezas lateral y medial, porque la larga trabaja acortada con el brazo pegado.',
    claves: [
      'Extiende del todo y aprieta un instante al final.',
      'El codo apunta al frente y se queda ahí, quieto.',
      'Cuanto más arriba el brazo, más estira la cabeza larga.',
    ],
    errores: [
      'Abrir los codos hacia fuera al extender.',
      'Mover el hombro en vez del codo: entonces es un pullover, no una extensión.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    // Pushdown en polea, que es lo que dicen sus ejemplos y lo que se programa:
    // el codo pegado al costado y quieto, el antebrazo empujando hacia abajo.
    // Estaba modelado con los brazos sobre la cabeza —extensión francesa—, un
    // ejercicio real pero distinto del que las fichas prometen.
    inicio: { hombroFlex: 24, hombroAbd: 6, codoFlex: 132, toraxFlex: 4, caderaFlex: 8, rodillaFlex: 10 },
    fin: { hombroFlex: 16, hombroAbd: 6, codoFlex: 6, toraxFlex: 4, caderaFlex: 8, rodillaFlex: 10 },
    // En el pushdown mandan la lateral y la medial: la cabeza larga cruza el
    // hombro, y con el brazo pegado al costado trabaja acortada y pierde
    // protagonismo. Era al reves cuando el patron estaba sobre la cabeza.
    activacion: { flexores_carpo: 0.45, extensores_carpo: 0.36, 'triceps.larga': 0.6, 'triceps.lateral': 1, 'triceps.medial': 1, serrato: 0.35, recto_abdominal: 0.3, 'deltoides.posterior': 0.3 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 46, elevacion: 10 },
  },
  {
    id: 'empuje_vertical',
    cadena: 'abierta',
    categoria: 'EMPUJE VERTICAL',
    titulo: 'Empuje vertical',
    ejemplos: 'Press de hombro con mancuernas · Press de hombro en máquina · Press militar',
    resumen:
      'El brazo empuja por encima de la cabeza. Exige que la escápula rote hacia arriba: sin eso, el hombro pellizca antes de llegar al final.',
    claves: [
      'Aprieta el glúteo y el abdomen: sin base, la lumbar se arquea.',
      'Deja que el hombro suba con el brazo en la última parte del recorrido.',
      'Codos ligeramente adelante, no abiertos en cruz.',
    ],
    errores: [
      'Arquear la espalda baja para convertirlo en un press inclinado de pie.',
      'Frenar a media altura, justo donde el deltoides deja de acortarse.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { hombroAbd: 68, hombroFlex: 18, codoFlex: 118, escapulaElev: 0 },
    fin: { hombroAbd: 172, hombroFlex: 6, codoFlex: 4, escapulaElev: 26, toraxFlex: -4 },
    activacion: { flexores_carpo: 0.5, extensores_carpo: 0.4, 'deltoides.anterior': 1, 'deltoides.medio': 0.9, 'deltoides.posterior': 0.3, 'triceps.lateral': 0.85, 'triceps.medial': 0.85, 'triceps.larga': 0.6, serrato: 0.75, 'trapecio.superior': 0.6, 'trapecio.inferior': 0.5, 'manguito.supraespinoso': 0.4, 'pectoral_mayor.clavicular': 0.45, recto_abdominal: 0.4, erectores: 0.35, gluteo_mayor: 0.3 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 18, elevacion: 2 },
  },
  {
    id: 'antiextension',
    cadena: 'cerrada',
    categoria: 'ANTIEXTENSIÓN',
    titulo: 'Antiextensión',
    ejemplos: 'Plancha a peso corporal · Dead bug en el suelo',
    resumen:
      'El único patrón donde no hay que mover nada, sino impedir que la espalda se arquee. Se muestra el fallo y su corrección, porque ahí está toda la técnica.',
    claves: [
      'Mete la pelvis: las costillas bajan hacia la cadera.',
      'Empuja el suelo con los antebrazos para separar los omóplatos.',
      'Si dejas de sentir el abdomen, la serie ya terminó aunque aguantes.',
    ],
    errores: [
      'Dejar caer la cadera: la lumbar aguanta lo que debería aguantar el abdomen.',
      'Subir el glúteo y quitarle toda la palanca al ejercicio.',
    ],
    apoyo: 'ninguno',
    giro: [86, 0, 0],
    raizInicio: [0, 0.44, 0],
    raizFin: [0, 0.40, 0],
    inicio: { lumbarFlex: -24, pelvisBascula: -20, toraxFlex: -10, hombroFlex: 84, codoFlex: 92, rodillaFlex: 6, escapulaProt: -16 },
    fin: { lumbarFlex: 10, pelvisBascula: 16, toraxFlex: 3, hombroFlex: 88, codoFlex: 90, rodillaFlex: 0, escapulaProt: 22 },
    activacion: { recto_abdominal: 1, transverso: 0.9, oblicuos: 0.85, serrato: 0.75, gluteo_mayor: 0.55, cuadriceps: 0.4, erectores: 0.3, triceps: 0.3 },
    seguimiento: ['pelvis', 0, [0, 0, 0.05]],
    camara: { azimut: 74, elevacion: 12 },
    invertido: true,
  },
  {
    id: 'empuje_horizontal',
    cadena: 'abierta',
    categoria: 'EMPUJE HORIZONTAL',
    // En el banca el mínimo de velocidad queda bastante por encima del pecho, no
    // al despegar: ahí los músculos trabajan en una longitud mala.
    estancamiento: 0.52,
    titulo: 'Empuje horizontal',
    ejemplos: 'Press de pecho con mancuernas · Press de pecho con barra',
    resumen:
      'El brazo empuja hacia delante desde el pecho. La escápula se queda retraída y fija: es la plataforma sobre la que empuja el pectoral.',
    claves: [
      'Junta los omóplatos y déjalos ahí todo el recorrido.',
      'Los codos a unos 45° del cuerpo, ni pegados ni en cruz.',
      'Baja hasta rozar el pecho si el hombro te lo permite sin dolor.',
    ],
    errores: [
      'Abrir los codos a 90°, que es la vía rápida a la molestia de hombro.',
      'Rebotar la barra en el pecho para pasar el punto difícil.',
    ],
    apoyo: 'ninguno',
    giro: [-88, 0, 0],
    raizInicio: [0, 0.50, 0],
    raizFin: [0, 0.50, 0],
    inicio: { hombroAbd: 42, hombroFlex: 62, codoFlex: 100, escapulaProt: -28, caderaFlex: 42, rodillaFlex: 78 },
    fin: { hombroAbd: 18, hombroFlex: 88, codoFlex: 4, escapulaProt: 12, caderaFlex: 42, rodillaFlex: 78 },
    activacion: { flexores_carpo: 0.5, extensores_carpo: 0.4, 'pectoral_mayor.esternocostal': 1, 'pectoral_mayor.clavicular': 0.6, 'pectoral_mayor.abdominal': 0.5, 'deltoides.anterior': 0.85, 'triceps.lateral': 0.8, 'triceps.medial': 0.8, 'triceps.larga': 0.55, serrato: 0.5, biceps: 0.2, 'manguito.subescapular': 0.35 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 34, elevacion: 46 },
  },
  {
    id: 'empuje_inclinado',
    cadena: 'abierta',
    categoria: 'EMPUJE INCLINADO',
    titulo: 'Empuje inclinado',
    ejemplos: 'Press de pecho con barra en banco inclinado · Press inclinado con mancuernas',
    resumen:
      'Mismo empuje, con el banco inclinado. El cambio de ángulo desplaza el trabajo a las fibras claviculares del pectoral, la parte alta del pecho.',
    claves: [
      'Inclinación de 30 a 45°: por encima ya es un press de hombro.',
      'Escápulas retraídas y pegadas al respaldo.',
      'Baja hacia la parte alta del pecho, no hacia el cuello.',
    ],
    errores: [
      'Inclinar demasiado el banco y quedarse sin estímulo de pecho.',
      'Despegar el glúteo del banco para ayudarse.',
    ],
    apoyo: 'ninguno',
    giro: [-52, 0, 0],
    raizInicio: [0, 0.52, 0],
    raizFin: [0, 0.52, 0],
    inicio: { hombroAbd: 38, hombroFlex: 66, codoFlex: 102, escapulaProt: -28, caderaFlex: 62, rodillaFlex: 84 },
    fin: { hombroAbd: 16, hombroFlex: 92, codoFlex: 6, escapulaProt: 10, caderaFlex: 62, rodillaFlex: 84 },
    activacion: { flexores_carpo: 0.5, extensores_carpo: 0.4, 'pectoral_mayor.clavicular': 1, 'pectoral_mayor.esternocostal': 0.7, 'deltoides.anterior': 0.95, 'triceps.lateral': 0.75, 'triceps.medial': 0.75, serrato: 0.5, 'manguito.subescapular': 0.3 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 34, elevacion: 40 },
  },
  {
    id: 'extension_hombro',
    cadena: 'abierta',
    categoria: 'EXTENSIÓN DE HOMBRO',
    titulo: 'Extensión de hombro',
    ejemplos: 'Pullover en polea · Jalón con brazo recto · Pullover con mancuerna',
    resumen:
      'El brazo baja estirado desde encima de la cabeza hasta el muslo. Es la única forma de cargar el dorsal sin que el codo se lleve el trabajo.',
    claves: [
      'El codo se queda casi estirado todo el recorrido: si se dobla, pasa a ser una tracción.',
      'Arranca con el brazo lo más arriba que llegues sin arquear la espalda.',
      'Termina llevando la mano al muslo, no a mitad de camino.',
    ],
    errores: [
      'Doblar el codo y convertirlo en un jalón: el dorsal deja de estar solo.',
      'Arquear la lumbar para ganar recorrido arriba, en vez de ganarlo con el hombro.',
    ],
    apoyo: 'suelo',
    giroInicio: [12, 0, 0],
    giroFin: [12, 0, 0],
    raizInicio: [0, 0.95, -0.02],
    raizFin: [0, 0.95, -0.02],
    inicio: { hombroFlex: 152, codoFlex: 12, caderaFlex: 14, rodillaFlex: 10, escapulaRotAsc: 34, escapulaElev: 12 },
    fin: { hombroFlex: 6, codoFlex: 16, caderaFlex: 14, rodillaFlex: 10, escapulaRotAsc: 2, escapulaElev: -8, escapulaProt: -14 },
    activacion: {
      'dorsal_ancho.costal': 1,
      'dorsal_ancho.vertebral': 0.95,
      'dorsal_ancho.iliaca': 0.85,
      redondo_mayor: 0.95,
      'triceps.larga': 0.7,
      'deltoides.posterior': 0.55,
      'pectoral_mayor.esternocostal': 0.45,
      'trapecio.inferior': 0.5,
      recto_abdominal: 0.4,
      'triceps.lateral': 0.3,
    },
    seguimiento: ['manoD', 0.6, [0, 0, 0]],
    camara: { azimut: 84, elevacion: 8 },
  },
  {
    id: 'antirrotacion',
    cadena: 'abierta',
    categoria: 'ANTIRROTACIÓN',
    titulo: 'Antirrotación',
    ejemplos: 'Pallof press de pie · Pallof press arrodillado',
    resumen:
      'Las manos salen del pecho hacia delante mientras algo tira de ellas hacia un lado. El tronco no gira, y ese es todo el ejercicio.',
    claves: [
      'Los hombros y la cadera miran al frente de principio a fin.',
      'Cuanto más lejos llegan las manos, más palanca tiene la carga para girarte.',
      'Aprieta el glúteo: si la pelvis se suelta, el giro empieza abajo.',
    ],
    errores: [
      'Dejar que el tronco acompañe al cable: entonces no es antirrotación, es rotación con peso.',
      'Sacar la cadera hacia el lado contrario para compensar en vez de aguantar con el abdomen.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { hombroFlex: 42, codoFlex: 118, caderaFlex: 12, rodillaFlex: 14, toraxRot: 10, lumbarRot: 5, escapulaProt: 6 },
    fin: { hombroFlex: 74, codoFlex: 12, caderaFlex: 12, rodillaFlex: 14, toraxRot: 2, lumbarRot: 1, escapulaProt: 20 },
    activacion: {
      'oblicuos.externo': 1,
      'oblicuos.interno': 1,
      transverso: 0.95,
      cuadrado_lumbar: 0.8,
      recto_abdominal: 0.75,
      serrato: 0.6,
      gluteo_mayor: 0.85,
      gluteo_medio: 0.8,
      'cuadriceps.vasto_lateral': 0.75,
      'cuadriceps.vasto_medial': 0.75,
      'erectores.longisimo': 0.7,
      'triceps.lateral': 0.5,
      'deltoides.anterior': 0.45,
    },
    seguimiento: ['manoD', 0.6, [0, 0, 0]],
    // Menos picado que un plano cenital puro: desde muy arriba el sujeto se ve
    // en escorzo y no se distingue si el tronco gira, que es lo único que hay
    // que mirar aquí.
    camara: { azimut: 34, elevacion: 32 },
  },
  {
    id: 'retraccion_escapular',
    cadena: 'abierta',
    categoria: 'RETRACCIÓN ESCAPULAR',
    titulo: 'Retracción escapular',
    ejemplos: 'Band pull apart · Retracción en polea · Face pull',
    resumen:
      'Los omóplatos se juntan sin que el codo haga nada. Es el gesto que sostiene cualquier tracción, y casi nadie lo entrena solo.',
    claves: [
      'Junta los omóplatos, no las manos: el movimiento nace en la espalda.',
      'Los codos se quedan como están; si se doblan, entra el bíceps.',
      'Sin encoger: el hombro no sube hacia la oreja.',
    ],
    errores: [
      'Encoger los hombros y llamarlo retracción: eso es elevación, y trabaja el trapecio de arriba.',
      'Arquear la espalda para juntar más: el recorrido lo pone el omóplato, no la lumbar.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { hombroFlex: 78, hombroAbd: 14, codoFlex: 16, escapulaProt: 26, caderaFlex: 6, rodillaFlex: 8 },
    fin: { hombroFlex: 26, hombroAbd: 62, codoFlex: 20, escapulaProt: -34, caderaFlex: 6, rodillaFlex: 8 },
    activacion: {
      'romboides.mayor': 1,
      'romboides.menor': 1,
      'trapecio.medio': 1,
      'trapecio.inferior': 0.8,
      'deltoides.posterior': 0.75,
      'manguito.infraespinoso': 0.6,
      'manguito.redondo_menor': 0.55,
      'erectores.longisimo': 0.35,
      'trapecio.superior': 0.3,
    },
    seguimiento: ['manoD', 0.6, [0, 0, 0]],
    camara: { azimut: 24, elevacion: 46 },
  },
  {
    id: 'apertura_pecho',
    cadena: 'abierta',
    categoria: 'APERTURA DE PECHO',
    titulo: 'Apertura de pecho',
    ejemplos: 'Aperturas con mancuerna · Pec deck · Cruce en polea',
    resumen:
      'Los brazos se abren y se cierran en arco, con el codo casi fijo. Carga el pectoral en toda su longitud sin que el tríceps ayude.',
    claves: [
      'El codo mantiene su ángulo: es un arco, no un empuje.',
      'Abre hasta notar el pecho estirado, sin pasarte de la línea del hombro.',
      'Cierra hasta juntar: la última parte del recorrido es la que más acorta.',
    ],
    errores: [
      'Doblar y estirar el codo, que lo convierte en un press con peor palanca.',
      'Abrir por detrás de la línea del hombro buscando estiramiento: ahí manda la cápsula, no el músculo.',
    ],
    apoyo: 'ninguno',
    // Boca ARRIBA, como el press de banca: el giro estaba en +88 y el sujeto
    // hacía las aperturas boca abajo, con las manos bajando en el cierre.
    giro: [-88, 0, 0],
    raizInicio: [0, 0.55, 0],
    raizFin: [0, 0.55, 0],
    inicio: { hombroAbd: 78, hombroFlex: 74, codoFlex: 26, hombroRot: 14, escapulaProt: -18, caderaFlex: 4, rodillaFlex: 84 },
    fin: { hombroAbd: -12, hombroFlex: 90, codoFlex: 34, hombroRot: 0, escapulaProt: 16, caderaFlex: 4, rodillaFlex: 84 },
    activacion: {
      'pectoral_mayor.esternocostal': 1,
      'pectoral_mayor.clavicular': 0.9,
      'pectoral_mayor.abdominal': 0.7,
      'deltoides.anterior': 0.75,
      coracobraquial: 0.6,
      'biceps.corta': 0.4,
      serrato: 0.45,
      pectoral_menor: 0.4,
      'manguito.subescapular': 0.4,
    },
    seguimiento: ['manoD', 0.6, [0, 0, 0]],
    camara: { azimut: 18, elevacion: 40 },
  },
  {
    id: 'antiflexion_lateral',
    cadena: 'cerrada',
    categoria: 'ANTIFLEXIÓN LATERAL',
    titulo: 'Antiflexión lateral',
    ejemplos: 'Paseo del granjero a una mano · Maleta · Plancha lateral',
    resumen:
      'Un peso a un solo lado tira del tronco hacia abajo y hay que impedir que se incline. No se mueve nada: se sostiene.',
    claves: [
      'Los dos hombros a la misma altura, como si llevaras una bandeja en la cabeza.',
      'La cadera del lado cargado no se sube ni se cae.',
      'Camina o aguanta respirando: si contienes el aire, el abdomen deja de trabajar.',
    ],
    errores: [
      'Inclinarse hacia el peso, que es rendirse a lo que el ejercicio pide resistir.',
      'Inclinarse al lado contrario para hacer contrapeso: la lumbar acaba comprimida igual.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { lumbarLat: 27, toraxLat: 24, pelvisLat: 18, hombroFlex: 4, codoFlex: 6, caderaFlex: 4, escapulaElev: -14 },
    fin: { lumbarLat: -1, toraxLat: 0, pelvisLat: -3, hombroFlex: 4, codoFlex: 6, caderaFlex: 4, escapulaElev: 3 },
    activacion: {
      cuadrado_lumbar: 1,
      'oblicuos.externo': 0.95,
      'oblicuos.interno': 0.95,
      transverso: 0.8,
      'erectores.iliocostal': 0.75,
      'erectores.longisimo': 0.7,
      gluteo_medio: 0.7,
      'trapecio.superior': 0.55,
      flexores_carpo: 0.6,
      recto_abdominal: 0.4,
    },
    seguimiento: ['torax', 1, [0.05, 0, 0]],
    camara: { azimut: 4, elevacion: 8 },
    invertido: true,
  },
  {
    id: 'dorsiflexion',
    cadena: 'cerrada',
    categoria: 'DORSIFLEXIÓN',
    titulo: 'Dorsiflexión',
    ejemplos: 'Elevación de puntas · Tibialis raise con la espalda en la pared',
    resumen:
      'Las puntas de los pies suben con los talones clavados. Es el gemelo al revés, y el que sostiene la rodilla al bajar de un salto.',
    claves: [
      'Los talones no se mueven: solo suben las puntas.',
      'Sube hasta el tope y baja despacio, que es donde de verdad trabaja.',
      'Si te apoyas en la pared, mantén la cadera pegada para no ayudarte con el tronco.',
    ],
    errores: [
      'Balancear el cuerpo hacia atrás para levantar la punta sin usar la pierna.',
      'Rango corto: es un músculo pequeño y el recorrido completo es casi todo el estímulo.',
    ],
    apoyo: 'suelo',
    // Sin apoyo plantar a propósito: aquí el talón se queda y la punta sube, así
    // que forzar la planta horizontal borraría justo el gesto que se enseña.
    pies: [],
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { tobilloPlantar: 18, rodillaFlex: 14, caderaFlex: 12, hombroFlex: 2, codoFlex: 8 },
    fin: { tobilloPlantar: -19, rodillaFlex: 14, caderaFlex: 12, hombroFlex: 2, codoFlex: 8 },
    activacion: {
      tibial_anterior: 1,
      'peroneos.largo': 0.35,
      'cuadriceps.vasto_lateral': 0.3,
      'cuadriceps.vasto_medial': 0.3,
      gluteo_mayor: 0.25,
    },
    // Se traza la punta del pie y no el final del hueso: es lo que de verdad
    // sube, y sobre un hueso tan corto la diferencia decide si el arco se ve.
    seguimiento: ['pieD', 1, [0, 0, 0.05]],
    camara: { azimut: 86, elevacion: 10 },
  },
  {
    id: 'flexion_tronco',
    cadena: 'abierta',
    categoria: 'FLEXIÓN DE TRONCO',
    titulo: 'Flexión de tronco',
    ejemplos: 'Crunch en polea arrodillado · Crunch abdominal',
    resumen:
      'Las costillas se acercan a la cadera enrollando la espalda. La cadera no participa: en cuanto entra, el trabajo se va al psoas.',
    claves: [
      'Enrolla la columna vértebra a vértebra, no bajes en bloque.',
      'La cadera se queda quieta: el recorrido es corto y eso es correcto.',
      'Suelta el aire al bajar, que es lo que termina de cerrar las costillas.',
    ],
    errores: [
      'Flexionar la cadera en vez de la columna: entonces tira el psoas y la lumbar se comprime.',
      'Tirar con los brazos del cable o de la nuca para bajar más de lo que da el abdomen.',
    ],
    apoyo: 'ninguno',
    raizInicio: [0, 0.62, 0],
    raizFin: [0, 0.58, 0],
    inicio: { lumbarFlex: -12, toraxFlex: -8, caderaFlex: 92, rodillaFlex: 128, hombroFlex: 148, codoFlex: 142, cuelloFlex: -8 },
    fin: { lumbarFlex: 34, toraxFlex: 42, caderaFlex: 92, rodillaFlex: 128, hombroFlex: 144, codoFlex: 140, cuelloFlex: 24 },
    activacion: {
      recto_abdominal: 1,
      'oblicuos.externo': 0.8,
      'oblicuos.interno': 0.75,
      transverso: 0.6,
      esternocleidomastoideo: 0.35,
      'dorsal_ancho.costal': 0.35,
      'triceps.larga': 0.3,
    },
    seguimiento: ['torax', 1, [0, 0, 0]],
    camara: { azimut: 84, elevacion: 8 },
  },
  {
    id: 'salto',
    cadena: 'cerrada',
    categoria: 'POTENCIA · REACTIVA',
    titulo: 'Salto',
    ejemplos: 'Salto al cajón · Drop squat · Pogo jumps · Salto horizontal',
    resumen:
      'Bajar deprisa para poder subir deprisa. Aquí no cuenta el peso movido sino el tiempo: el suelo se empuja en un instante y se aterriza amortiguando.',
    claves: [
      'Baja rápido y corto: la potencia sale del rebote, no de bajar mucho.',
      'Aterriza con la rodilla y la cadera dobladas, nunca con la pierna clavada.',
      'Si el aterrizaje suena fuerte, estás frenando con la articulación en vez de con el músculo.',
    ],
    errores: [
      'Aterrizar con la rodilla hacia dentro, que es el gesto que más lesiona.',
      'Encadenar saltos cansado: la potencia se entrena fresco o deja de ser potencia.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.72, 0],
    raizFin: [0, 1.02, 0],
    inicio: { caderaFlex: 68, rodillaFlex: 74, tobilloPlantar: -16, toraxFlex: 18, hombroFlex: -34, codoFlex: 26 },
    fin: { caderaFlex: 4, rodillaFlex: 6, tobilloPlantar: 42, toraxFlex: 2, hombroFlex: 96, codoFlex: 12 },
    activacion: {
      'cuadriceps.vasto_lateral': 1,
      'cuadriceps.vasto_medial': 1,
      'cuadriceps.recto': 0.85,
      gluteo_mayor: 1,
      'triceps_sural.gastro_medial': 0.95,
      'triceps_sural.gastro_lateral': 0.95,
      'triceps_sural.soleo': 0.8,
      'isquiotibiales.biceps_larga': 0.7,
      'cuadriceps.vasto_intermedio': 0.8,
      gluteo_medio: 0.6,
      'erectores.longisimo': 0.5,
      'deltoides.anterior': 0.4,
    },
    seguimiento: ['pelvis', 0.4, [0, 0, 0.04]],
    camara: { azimut: 78, elevacion: 10 },
  },
  {
    id: 'rotacion_externa_hombro',
    cadena: 'abierta',
    categoria: 'ROTACIÓN EXTERNA',
    titulo: 'Rotación externa de hombro',
    ejemplos: 'Rotación externa en polea · Rotación con banda · Band pull apart',
    resumen:
      'El antebrazo gira hacia fuera con el codo pegado al costado. Es poca carga y mucho detalle: sostiene el hombro en todo lo demás que se hace.',
    claves: [
      'El codo pegado al costado y doblado a noventa grados, quieto.',
      'Gira desde el hombro: el antebrazo solo va montado en el giro.',
      'Carga ligera. Si necesitas impulso, el manguito ya no está trabajando.',
    ],
    errores: [
      'Separar el codo del costado, que cambia el ejercicio al deltoides.',
      'Girar el tronco para ganar recorrido en vez de girar el hombro.',
    ],
    apoyo: 'suelo',
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { hombroRot: -58, codoFlex: 90, hombroAbd: 8, escapulaProt: 12, caderaFlex: 4, rodillaFlex: 6 },
    fin: { hombroRot: 46, codoFlex: 90, hombroAbd: 10, escapulaProt: -18, caderaFlex: 4, rodillaFlex: 6 },
    activacion: {
      'manguito.infraespinoso': 1,
      'manguito.redondo_menor': 1,
      'manguito.supraespinoso': 0.6,
      'deltoides.posterior': 0.65,
      'romboides.mayor': 0.5,
      'trapecio.medio': 0.5,
      'trapecio.inferior': 0.45,
      'manguito.subescapular': 0.35,
    },
    seguimiento: ['manoD', 0.6, [0, 0, 0]],
    camara: { azimut: 26, elevacion: 56 },
  },
  {
    id: 'movilidad_toracica',
    cadena: 'cerrada',
    categoria: 'MOVILIDAD',
    titulo: 'Movilidad torácica',
    ejemplos: 'Extensión en foam roller · Gato-camello · Rotación torácica',
    resumen:
      'La espalda de arriba se abre y se cierra. No se busca fuerza sino recorrido: lo que no da la torácica acaba pidiéndoselo a la lumbar o al hombro.',
    claves: [
      'El movimiento es de las costillas hacia arriba, no de la zona baja.',
      'Ve despacio y respira: aquí manda el tiempo, no la carga.',
      'Si la lumbar se arquea para ayudar, has perdido el ejercicio.',
    ],
    errores: [
      'Compensar con la lumbar, que ya es la parte de la espalda que más se mueve.',
      'Buscar el rango a tirones en vez de con recorridos lentos y repetidos.',
    ],
    apoyo: 'ninguno',
    // La raíz se inclina MÁS cuando la columna se extiende. Es la cadena
    // cerrada hecha a mano: las manos están plantadas, así que el arco de la
    // espalda no puede levantar el tronco entero —se hunde entre los apoyos,
    // que es la vaca del gato-camello—. Sin esto las manos subían un metro.
    giroInicio: [72, 0, 0],
    giroFin: [92, 0, 0],
    raizInicio: [0, 0.68, 0],
    raizFin: [0, 0.72, 0],
    inicio: { toraxFlex: 34, lumbarFlex: 12, cuelloFlex: 26, caderaFlex: 88, rodillaFlex: 92, hombroFlex: 108, codoFlex: 16, escapulaProt: 24 },
    fin: { toraxFlex: -20, lumbarFlex: -6, cuelloFlex: -22, caderaFlex: 88, rodillaFlex: 92, hombroFlex: 106, codoFlex: 12, escapulaProt: -14 },
    activacion: {
      'erectores.longisimo': 1,
      'erectores.espinal': 0.95,
      'erectores.iliocostal': 0.8,
      'trapecio.medio': 0.6,
      'trapecio.inferior': 0.6,
      recto_abdominal: 0.5,
      'oblicuos.externo': 0.45,
      esplenio: 0.5,
      serrato: 0.4,
    },
    seguimiento: ['torax', 1, [0, 0, 0]],
    camara: { azimut: 82, elevacion: 12 },
  },
  {
    id: 'apoyo_una_pierna',
    cadena: 'cerrada',
    categoria: 'APOYO A UNA PIERNA',
    titulo: 'Apoyo a una pierna',
    ejemplos: 'Apoyo monopodal · Monopodal con alcance · Short foot',
    resumen:
      'Estar de pie sobre una pierna sin que la cadera se caiga. Parece que no pasa nada, y está trabajando todo el lateral de la cadera y el pie.',
    claves: [
      'La cadera del lado que no apoya se queda arriba, a la altura de la otra.',
      'Reparte el peso en el pie entero, no solo en el borde.',
      'Mira a un punto fijo: el equilibrio se entrena también con la vista.',
    ],
    errores: [
      'Dejar caer la cadera libre: eso es lo que el glúteo medio tiene que impedir.',
      'Rodilla hacia dentro, que es la misma falla que aparece luego al aterrizar o al bajar escaleras.',
    ],
    apoyo: 'suelo',
    pies: ['D'],
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    inicio: { pelvisLat: -21, caderaAbdI: 10, caderaFlexI: 62, rodillaFlexI: 112, lumbarLat: 16, hombroFlex: 12, codoFlex: 14 },
    fin: { pelvisLat: 6, caderaAbdI: 4, caderaFlexI: 62, rodillaFlexI: 112, lumbarLat: -2, hombroFlex: 16, codoFlex: 12 },
    activacion: {
      'gluteo_medio:D': 1,
      'gluteo_menor:D': 0.95,
      gluteo_mayor: 0.7,
      'cuadriceps.vasto_lateral:D': 0.7,
      'cuadriceps.vasto_medial:D': 0.7,
      cuadrado_lumbar: 0.7,
      'oblicuos.externo': 0.6,
      'triceps_sural.soleo:D': 0.75,
      tibial_anterior: 0.65,
      'peroneos.largo:D': 0.7,
      'erectores.iliocostal': 0.5,
    },
    seguimiento: ['pelvis', 0, [0.05, 0, 0]],
    // De tres cuartos y no de frente. La caída de cadera se lee en el plano
    // frontal, pero la pierna levantada se flexiona hacia delante y de frente
    // sale escorzada: parecía que el sujeto estaba de pie sobre las dos.
    camara: { azimut: 34, elevacion: 10 },
    invertido: true,
  },
  {
    id: 'suspension',
    cadena: 'cerrada',
    categoria: 'SUSPENSIÓN',
    titulo: 'Suspensión',
    ejemplos: 'Dead hang en barra · Colgado activo · Suspensión con agarre',
    resumen:
      'Colgarse de la barra y aguantar. Trabaja el agarre y descomprime el hombro, y es el paso previo para quien todavía no hace dominadas.',
    claves: [
      'Empieza colgado del todo y después mete los omóplatos hacia abajo.',
      'Aguanta respirando, sin balancearte.',
      'La serie termina cuando la mano se abre, no antes.',
    ],
    errores: [
      'Colgar con el hombro totalmente suelto todo el rato: descomprime, pero no entrena nada.',
      'Balancearse, que le quita el trabajo al agarre y se lo pasa al impulso.',
    ],
    apoyo: 'manos',
    alturaApoyo: 2.28,
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 1.0, 0],
    inicio: { hombroFlex: 172, codoFlex: 6, escapulaElev: 42, escapulaRotAsc: 48, caderaFlex: 8, rodillaFlex: 22 },
    fin: { hombroFlex: 168, codoFlex: 8, escapulaElev: -12, escapulaRotAsc: 22, caderaFlex: 6, rodillaFlex: 18, escapulaProt: -16 },
    activacion: {
      flexores_carpo: 1,
      'dorsal_ancho.costal': 0.8,
      'dorsal_ancho.vertebral': 0.75,
      'trapecio.inferior': 0.85,
      'trapecio.medio': 0.7,
      serrato: 0.6,
      'romboides.mayor': 0.6,
      redondo_mayor: 0.55,
      braquiorradial: 0.6,
      recto_abdominal: 0.45,
      'manguito.infraespinoso': 0.4,
    },
    // Sin traza a propósito: es una isometría de sostén y no hay trayectoria que
    // dibujar. El cuerpo sube menos de un centímetro al deprimir el omóplato,
    // porque en el rig el brazo cuelga del tórax y no de la escápula, así que
    // cualquier arco aquí sería inventado.
    camara: { azimut: 80, elevacion: 6 },
  },
]

export const PATRON_POR_ID: Record<string, Patron> = Object.fromEntries(
  PATRONES.map((p) => [p.id, p]),
)

/** Sin tildes y en mayúsculas: las dos listas las escriben personas distintas. */
export function normalizarCategoria(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()
}

/**
 * Categorías que no se llaman igual que su patrón.
 *
 * El vocabulario de categorías se consolidó de 51 a 30 nombres, pero por los
 * microciclos —y por el seed de demo— siguen circulando los de antes, además de
 * los que nombran el músculo en vez del gesto. Sin esta tabla el botón del
 * visor no aparece en media sesión, que es peor que no tenerlo: parece roto.
 *
 * Es la misma solución que usa `domain/demos.ts` con los vídeos, y por el mismo
 * motivo. Lo que no está aquí se busca tal cual.
 */
const ALIAS: Record<string, string> = {
  'DOMINANTE DE CADERA': 'BISAGRA DE CADERA',
  BISAGRA: 'BISAGRA DE CADERA',
  'CADENA POSTERIOR': 'BISAGRA DE CADERA',
  ISQUIOS: 'BISAGRA DE CADERA',
  GLUTEO: 'EXTENSION DE CADERA',
  'DOMINANTE DE RODILLA': 'SENTADILLA',
  CUADRICEPS: 'SENTADILLA',
  PIERNA: 'SENTADILLA',
  ZANCADA: 'SENTADILLA UNILATERAL',
  'UNILATERAL DE PIERNA': 'SENTADILLA UNILATERAL',
  CORE: 'ANTIEXTENSION',
  ABDOMEN: 'ANTIEXTENSION',
  JALON: 'TRACCION VERTICAL',
  DOMINADA: 'TRACCION VERTICAL',
  REMO: 'TRACCION HORIZONTAL',
  ESPALDA: 'TRACCION HORIZONTAL',
  EMPUJE: 'EMPUJE HORIZONTAL',
  PECHO: 'EMPUJE HORIZONTAL',
  HOMBRO: 'EMPUJE VERTICAL',
  BICEPS: 'FLEXION DE CODO',
  TRICEPS: 'EXTENSION DE CODO',
  PANTORRILLA: 'FLEXION PLANTAR',
  GEMELOS: 'FLEXION PLANTAR',
}

/**
 * El patrón que le toca a un ejercicio.
 *
 * Se busca por la categoría, que es el nombre del patrón de movimiento y ya
 * viene en el microciclo: no hace falta tocar ningún dato ni añadir un campo
 * nuevo para que los microciclos ya cargados tengan visor.
 */
/**
 * Cuando la categoría no es un gesto, sino para qué sirve.
 *
 * `PREV/REHAB`, `MOVILIDAD`, `ACONDICIONAMIENTO` y `POTENCIA · REACTIVA` no
 * nombran un patrón: dicen a qué viene el ejercicio. Dentro caben cosas que no
 * se parecen en nada —una rotación de manguito y un salto al cajón comparten
 * categoría—, así que por categoría no se puede acertar.
 *
 * Se mira el nombre. El orden importa: gana la primera que encaja, así que lo
 * específico va antes que lo general.
 */
const POR_NOMBRE: [RegExp, string][] = [
  [/rotaci[oó]n externa|manguito|pull apart|control escapular/, 'rotacion_externa_hombro'],
  [/salto|pogo|drop squat|aterrizaje|lanzamiento|trineo|reactiv/, 'salto'],
  [/colgad|dead hang|suspensi[oó]n/, 'suspension'],
  [/monopodal|equilibrio|short foot|apoyo estable a una pierna/, 'apoyo_una_pierna'],
  [/movilidad|foam roller|gato-camello|occiput|rom de hombro/, 'movilidad_toracica'],
  [/activaci[oó]n gl[uú]tea|puente de isquios/, 'extension_cadera'],
  [/copenhague|cossack/, 'aduccion_cadera'],
  [/bird-?dog/, 'antiextension'],
  [/gemelo|talón colgando|talon colgando/, 'flexion_plantar'],
]

/**
 * Lo que se queda fuera, y por qué.
 *
 * El cardio no tiene un gesto resistido que enseñar en la esfera, y un cribado
 * de banderas rojas no es un ejercicio. Enseñar aquí un patrón cualquiera sería
 * peor que no enseñar ninguno.
 */
const SIN_PATRON = /bicicleta|cinta|el[ií]ptica|zona 2|rodada|circuito|cardio|cribado/

export function patronDeCategoria(categoria: string | undefined, nombre?: string): Patron | undefined {
  if (!categoria) return undefined
  const normalizada = normalizarCategoria(categoria)
  const buscada = ALIAS[normalizada] ?? normalizada
  const porCategoria = PATRONES.find((p) => normalizarCategoria(p.categoria) === buscada)
  if (porCategoria) return porCategoria

  // Solo si la categoría no dio nada: cuando la categoría nombra el gesto, es
  // más fiable que el nombre del ejercicio, que lo escribe el coach a mano.
  if (!nombre) return undefined
  const texto = nombre.toLowerCase()
  if (SIN_PATRON.test(texto)) return undefined
  const id = POR_NOMBRE.find(([re]) => re.test(texto))?.[1]
  return id ? PATRON_POR_ID[id] : undefined
}
