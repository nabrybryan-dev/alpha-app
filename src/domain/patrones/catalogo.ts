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
}

export const PATRONES: Patron[] = [
  {
    id: 'extension_cadera',
    categoria: 'EXTENSIÓN DE CADERA',
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
    categoria: 'SENTADILLA',
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
    fin: { caderaFlex: 76, rodillaFlex: 16, toraxFlex: 3, hombroFlex: -10, codoFlex: 3 },
    activacion: { flexores_carpo: 0.65, extensores_carpo: 0.52, 'isquiotibiales.biceps_larga': 1, 'isquiotibiales.semitendinoso': 1, 'isquiotibiales.semimembranoso': 1, 'isquiotibiales.biceps_corta': 0.4, gluteo_mayor: 0.9, erectores: 0.85, 'aductores.mayor': 0.4, dorsal_ancho: 0.4, 'trapecio.medio': 0.35, 'triceps_sural.gastro_medial': 0.25, cuadrado_lumbar: 0.4 },
    seguimiento: ['mano', 0.6, [0, 0, 0]],
    camara: { azimut: 78, elevacion: 4 },
  },
  {
    id: 'flexion_rodilla',
    categoria: 'FLEXIÓN DE RODILLA',
    titulo: 'Flexión de rodilla',
    ejemplos: 'Flexión de rodilla en máquina (sentado) · Flexión de rodilla en máquina (tumbado)',
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
    inicio: { caderaFlex: 58, rodillaFlex: 24, hombroFlex: 78, codoFlex: 6, escapulaProt: 28 },
    fin: { caderaFlex: 58, rodillaFlex: 24, hombroFlex: 2, hombroAbd: 8, codoFlex: 112, escapulaProt: -32 },
    activacion: { flexores_carpo: 0.6, extensores_carpo: 0.48, dorsal_ancho: 1, 'trapecio.medio': 0.9, 'trapecio.inferior': 0.6, 'trapecio.superior': 0.3, romboides: 0.9, 'deltoides.posterior': 0.8, redondo_mayor: 0.75, biceps: 0.75, braquial: 0.65, braquiorradial: 0.5, erectores: 0.6, isquiotibiales: 0.4, 'manguito.infraespinoso': 0.4 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 68, elevacion: 8 },
  },
  {
    id: 'traccion_vertical',
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
    inicio: { caderaFlex: 54, rodillaFlex: 22, hombroFlex: 76, hombroAbd: -2, codoFlex: 14, escapulaProt: 26 },
    fin: { caderaFlex: 54, rodillaFlex: 22, hombroFlex: 74, hombroAbd: 92, codoFlex: 22, escapulaProt: -32 },
    activacion: { flexores_carpo: 0.45, extensores_carpo: 0.36, 'deltoides.posterior': 1, 'trapecio.medio': 0.9, 'trapecio.inferior': 0.55, romboides: 0.85, 'manguito.infraespinoso': 0.65, 'manguito.redondo_menor': 0.6, 'deltoides.medio': 0.4, erectores: 0.5, isquiotibiales: 0.35 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 26, elevacion: 44 },
  },
  {
    id: 'flexion_codo',
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
    categoria: 'EXTENSIÓN DE CODO',
    titulo: 'Extensión de codo',
    ejemplos: 'Extensión de codo en polea · Extensión de codo unilateral',
    resumen:
      'El antebrazo se separa del brazo. El tríceps es dos tercios del volumen del brazo, y su cabeza larga solo se estira con el hombro flexionado.',
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
    inicio: { hombroFlex: 166, hombroAbd: 14, codoFlex: 148, toraxFlex: -6 },
    fin: { hombroFlex: 168, hombroAbd: 12, codoFlex: 2, toraxFlex: -4 },
    activacion: { flexores_carpo: 0.45, extensores_carpo: 0.36, 'triceps.larga': 1, 'triceps.lateral': 0.9, 'triceps.medial': 0.9, serrato: 0.35, recto_abdominal: 0.3, 'deltoides.posterior': 0.3 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 46, elevacion: 10 },
  },
  {
    id: 'empuje_vertical',
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
    categoria: 'EMPUJE HORIZONTAL',
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
    inicio: { hombroAbd: 68, hombroFlex: 4, codoFlex: 112, escapulaProt: -28, caderaFlex: 42, rodillaFlex: 78 },
    fin: { hombroAbd: 32, hombroFlex: 20, codoFlex: 2, escapulaProt: 12, caderaFlex: 42, rodillaFlex: 78 },
    activacion: { flexores_carpo: 0.5, extensores_carpo: 0.4, 'pectoral_mayor.esternocostal': 1, 'pectoral_mayor.clavicular': 0.6, 'pectoral_mayor.abdominal': 0.5, 'deltoides.anterior': 0.85, 'triceps.lateral': 0.8, 'triceps.medial': 0.8, 'triceps.larga': 0.55, serrato: 0.5, biceps: 0.2, 'manguito.subescapular': 0.35 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 34, elevacion: 46 },
  },
  {
    id: 'empuje_inclinado',
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
    inicio: { hombroAbd: 64, hombroFlex: 6, codoFlex: 110, escapulaProt: -28, caderaFlex: 62, rodillaFlex: 84 },
    fin: { hombroAbd: 30, hombroFlex: 24, codoFlex: 2, escapulaProt: 10, caderaFlex: 62, rodillaFlex: 84 },
    activacion: { flexores_carpo: 0.5, extensores_carpo: 0.4, 'pectoral_mayor.clavicular': 1, 'pectoral_mayor.esternocostal': 0.7, 'deltoides.anterior': 0.95, 'triceps.lateral': 0.75, 'triceps.medial': 0.75, serrato: 0.5, 'manguito.subescapular': 0.3 },
    seguimiento: ['mano', 0.5, [0, 0, 0]],
    camara: { azimut: 34, elevacion: 40 },
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
export function patronDeCategoria(categoria: string | undefined): Patron | undefined {
  if (!categoria) return undefined
  const normalizada = normalizarCategoria(categoria)
  const buscada = ALIAS[normalizada] ?? normalizada
  return PATRONES.find((p) => normalizarCategoria(p.categoria) === buscada)
}
