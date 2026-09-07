import { M, type ModeloDePalanca } from './tipos'
import { VARIANTES } from './modelos'

/**
 * La mecánica de la dominada, tal cual la declara la variante de TRACCIÓN VERTICAL: manos
 * fijas al mundo, el cuerpo gira, línea desde el centro de masas. La ficha de la dominada
 * asistida la reutiliza en vez de copiarla: lo que se descuenta es peso, no mecánica.
 */
function mecanicaDeLaDominada(): ModeloDePalanca {
  const dominada = VARIANTES['TRACCIÓN VERTICAL']?.find((v) => v.modelo.variante === 'DOMINADA')
  if (!dominada) throw new Error('la variante DOMINADA de TRACCIÓN VERTICAL ya no existe')
  return dominada.modelo
}

/**
 * LOS PATRONES QUE NO TIENEN CATEGORÍA CANÓNICA, y por qué necesitan tabla propia.
 *
 * `MODELOS` está indexado por `Categoria`, o sea por las 34 canónicas de `taxonomia.ts`. El
 * catálogo 3D, en cambio, tiene fichas cuya categoría **no está en esa lista**:
 * `POTENCIA · REACTIVA`, `ROTACIÓN EXTERNA`, `APOYO A UNA PIERNA` y `SUSPENSIÓN`. La tabla ni
 * siquiera las puede nombrar, así que `modeloDePalanca()` devolvía `undefined` y el salón
 * dibujaba el sujeto **sin una sola flecha de fuerza**.
 *
 * No era un detalle del catálogo. Medido el 2026-09-06 sobre el censo de producción, son
 * **22 de las 150 familias que sí tienen sujeto** —el 15 %— y casi todas de PREV/REHAB, que
 * es justo donde el asesorado más necesita entender qué está sosteniendo:
 *
 *     salto                     6   trineo, pogo, saltos cortos, aterrizaje, reactiva, pliometría
 *     rotacion_externa_hombro   5   manguito, rotador, rotación externa, pull apart, control escapular
 *     apoyo_una_pierna          5   apoyo estable, monopodal, equilibrio, arco plantar, short foot
 *     suspension                3   suspensión, dead hang, colgado en barra
 *     movilidad_toracica        3   movilidad, dislocación, foam roller
 *
 * Las tres últimas NO entran aquí y siguen sin modelo: `MOVILIDAD` sí es canónica y su
 * entrada en `MODELOS_CORE` está escrita `null` a propósito —una movilidad no tiene carga
 * contra la que medir palanca—. Eso no es un hueco, es una decisión, y se queda como está.
 *
 * ## Por qué la categoría del ejercicio no sirve y la de la ficha sí
 *
 * Los cinco de manguito llegan con categoría `PREV/REHAB`, que está escrita `null` con toda
 * la razón: «para prevención» no es un gesto, y dentro cabe cualquier cosa. Pero la lista por
 * nombre de `catalogo.ts` ya ha decidido **qué gesto es** —`rotacion_externa_hombro`— antes
 * de llegar hasta aquí, y de un gesto concreto sí se sabe la mecánica. Lo que no se puede
 * modelar es la intención; el movimiento, sí.
 *
 * ## De dónde salen los brazos internos
 *
 * De las entradas hermanas de esta misma tabla, no de una fuente nueva: la abducción de
 * cadera ya vale `[30, 50]` en `ABDUCCIÓN DE CADERA`, la flexión plantar `[40, 55]`, la
 * retracción escapular `[20, 40]` y el hombro en abducción o isometría `[20, 30]`. Reusarlos
 * es lo correcto y lo comprobable: un número inventado aquí saldría a pantalla con la misma
 * cara que uno medido.
 *
 * ## El campo `patron` dice una categoría que no es la suya
 *
 * `ModeloDePalanca.patron` es de tipo `Categoria` y estas cuatro claves no lo son. Se declara
 * la canónica cuya mecánica comparten —un salto ES la extensión de una sentadilla, hecha
 * deprisa— y el nombre real vive en la clave del registro. Es feo y es a propósito: la
 * alternativa era meter cuatro nombres en la taxonomía que clasifica la base de producción,
 * y eso cambia cómo se cuenta el volumen de todo el mundo. Esa decisión es de Bryan.
 */
export const MODELOS_DE_FICHA: Readonly<Record<string, ModeloDePalanca>> = {
  /**
   * EL FACE PULL, con ficha propia desde el 2026-09-07. Tres ejes a la vez —el hombro
   * abduciendo en horizontal y rotando hacia fuera, y el codo doblándose— con la línea
   * fijada por el cable, que baja desde una polea alta. Va aparte de ABDUCCIÓN HORIZONTAL
   * porque ahí el codo es una bisagra bloqueada y aquí es un motor.
   */
  'FACE PULL': {
    patron: 'ABDUCCIÓN HORIZONTAL',
    cadena: 'abierta',
    anclaje: 'el torso, de pie',
    segmentosMoviles: ['brazo', 'antebrazo'],
    referencia: 'torso',
    vista: 'lateral',
    ejes: [
      M('hombro', 'principal', 'abduccion', ['Hombros', 'Espalda'], [20, 30], undefined, 'frontal'),
      M('hombro', 'principal', 'rotacion', ['Hombros'], [15, 25],
        'La rotación externa es lo que separa un face pull de un remo alto: los nudillos acaban ' +
          'mirando hacia atrás, no hacia abajo.'),
      M('codo', 'secundario', 'flexion', ['Bíceps'], [25, 35]),
      M('escapula', 'secundario', 'retraccion', ['Espalda'], [20, 40], undefined, 'frontal'),
    ],
    linea: { origen: 'cable' },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'los codos a la altura de los ojos al final, y el tronco quieto',
      toleranciaMm: 25,
      porQue: 'Con los codos bajos el dorsal se lleva el trabajo y el ejercicio se vuelve un remo.',
    },
  },

  /**
   * EL CURL FEMORAL SENTADO, con ficha propia desde el 2026-09-07. La misma mecánica que
   * FLEXIÓN DE RODILLA —el propio modelo lo dice: «tumbado y sentado no son el mismo
   * ejercicio»— con el fémur sujeto por el acolchado en vez de por la camilla, y la cadera
   * flexionada, que es lo que alarga el isquio desde el arranque.
   */
  'FLEXIÓN DE RODILLA SENTADO': {
    patron: 'FLEXIÓN DE RODILLA',
    cadena: 'abierta',
    anclaje: 'el fémur, bajo el acolchado del asiento',
    segmentosMoviles: ['pierna'],
    referencia: 'muslo',
    vista: 'lateral',
    ejes: [
      M('rodilla', 'principal', 'flexion', ['Isquios'], [30, 40]),
      M('cadera', 'secundario', 'isometrico', ['Glúteos'], [50, 70],
        'Sentado la cadera va a 90°: el isquio arranca largo y eso cambia la fuerza disponible ' +
          'respecto al tumbado.'),
    ],
    linea: { origen: 'cable' },
    marcas: ['cadera', 'rodilla', 'tobillo'],
    alineacion: {
      regla: 'la pelvis pegada al asiento',
      toleranciaMm: 20,
      porQue: 'Si la cadera se levanta, el recorrido lo hace la pelvis y el isquio se acorta menos de lo que parece.',
    },
  },

  /**
   * LA APERTURA INVERSA SENTADA, con ficha propia desde el 2026-09-07.
   *
   * Los mismos dos ejes que ABDUCCIÓN HORIZONTAL —es el mismo gesto— y lo único que cambia
   * es el anclaje: el pecho contra el apoyo de la máquina, no el tronco sosteniéndose solo.
   * Por eso va aparte y no hereda: el tronco deja de ser un estabilizador que se mide.
   */
  'APERTURA INVERSA EN MÁQUINA': {
    patron: 'ABDUCCIÓN HORIZONTAL',
    cadena: 'abierta',
    anclaje: 'el pecho contra el apoyo de la máquina',
    segmentosMoviles: ['brazo'],
    referencia: 'torso',
    vista: 'frontal',
    ejes: [
      M('hombro', 'principal', 'abduccion', ['Hombros', 'Espalda'], [20, 30], undefined, 'frontal'),
      M('escapula', 'secundario', 'retraccion', ['Espalda'], [20, 40], undefined, 'frontal'),
    ],
    linea: {
      origen: 'carga-externa',
      nota: 'El brazo de la máquina gira sobre un eje vertical: la fuerza es horizontal, perpendicular al brazo.',
    },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el pecho pegado al apoyo y el codo a la altura del hombro',
      toleranciaMm: 25,
      porQue: 'Despegar el pecho convierte la apertura en un remo; bajar el codo mete al dorsal.',
    },
    limite:
      'la leva de la máquina decide cuánto de las placas llega a la mano en cada punto del ' +
      'arco, y eso no se ve desde fuera: el brazo de momento se mide, el peso no se convierte',
  },

  /**
   * LA PRENSA, que nace con ficha propia el 2026-09-06.
   *
   * Comparte los tres ejes de la sentadilla —es el mismo gesto— y se separa en lo único que
   * de verdad la distingue: el tronco no sostiene nada. Ahí está su valor y su límite, y por
   * eso el modelo va aparte en vez de heredar el de SENTADILLA: el anclaje es el respaldo,
   * no el suelo, y la línea la fija el raíl y no la vertical.
   */
  PRENSA: {
    patron: 'SENTADILLA',
    cadena: 'cerrada',
    anclaje: 'la espalda contra el respaldo y los pies contra el carro',
    segmentosMoviles: ['muslo', 'pierna'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M(
        'rodilla',
        'principal',
        'extension',
        ['Cuádriceps'],
        [40, 50],
        'Con la espalda apoyada, la rodilla se lleva más proporción del trabajo que en una ' +
          'sentadilla libre: no hay tronco que sostener ni equilibrio que gastar.',
      ),
      M('cadera', 'principal', 'extension', ['Glúteos', 'Aductores'], [50, 70]),
      M('tobillo', 'estabilizador', 'isometrico', ['Pantorrillas'], [40, 55]),
    ],
    linea: {
      origen: 'carga-externa',
      nota:
        'El carro corre por un raíl a 45°, así que la fuerza NO va hacia abajo: va a lo ' +
        'largo del raíl. Es la dirección que ninguna vertical describe.',
    },
    marcas: ['tobillo', 'rodilla', 'cadera'],
    alineacion: {
      regla: 'la cadera pegada al asiento en todo el recorrido',
      toleranciaMm: 25,
      porQue:
        'El fallo de la prensa tiene nombre: bajar hasta que la pelvis se enrolla y despega ' +
        'del respaldo. Ahí la carga deja de ir por las piernas y pasa por la lumbar.',
    },
    limite:
      'el raíl fija la dirección de la fuerza, así que el brazo de momento NO sale de la ' +
      'distancia horizontal a la vertical de la carga: sale de la distancia al raíl. Y el ' +
      'peso de las placas no es el peso que llega al pie: el ángulo del raíl lo reparte',
  },

  'POTENCIA · REACTIVA': {
    patron: 'SENTADILLA',
    cadena: 'cerrada',
    anclaje: 'los pies en el suelo, hasta que dejan de estarlo',
    segmentosMoviles: ['muslo', 'pierna', 'torso'],
    referencia: 'vertical',
    vista: 'lateral',
    ejes: [
      M(
        'cadera',
        'principal',
        'extension',
        ['Glúteos', 'Isquios'],
        [50, 70],
        'La triple extensión se mide entera: en un salto los tres ejes son principales, y eso ' +
          'es lo que lo separa de la sentadilla, donde el tobillo solo acompaña.',
      ),
      M('rodilla', 'principal', 'extension', ['Cuádriceps'], [40, 50]),
      M(
        'tobillo',
        'principal',
        'flexion-plantar',
        ['Pantorrillas'],
        [40, 55],
        'Es el último eslabón y el que decide la altura: el que se queda corto en un pogo.',
      ),
    ],
    linea: {
      origen: 'centro-de-masas',
      nota: 'No hay carga externa: la línea es la vertical del centro de masas del cuerpo.',
    },
    marcas: ['tobillo', 'rodilla', 'cadera', 'hombro'],
    alineacion: {
      regla: 'el centro de masas sobre el mediopié al despegar y al caer',
      toleranciaMm: 30,
      porQue:
        'Un despegue con el peso en el talón pierde el tobillo, y una caída con el peso ' +
        'adelantado la aguanta la rodilla. Las dos se ven de lado y las dos son la lesión.',
    },
    limite:
      'de un salto lo que importa es la POTENCIA, y la potencia es fuerza por velocidad: el ' +
      'brazo de momento da la mitad de la cuenta y la otra mitad la pone el tiempo, que ' +
      'necesita fotogramas suficientes. Sin eso salen ángulos, no vatios',
  },

  'ROTACIÓN EXTERNA': {
    patron: 'ABDUCCIÓN DE HOMBRO',
    cadena: 'abierta',
    anclaje: 'el codo contra el costado',
    segmentosMoviles: ['antebrazo'],
    // CENITAL, y no es un capricho: el antebrazo gira en el plano transverso. De lado el
    // recorrido entero se proyecta sobre un punto y la medida sale cero con cara de dato.
    // Es el mismo motivo por el que el Pallof se graba desde arriba.
    vista: 'cenital',
    referencia: 'vertical',
    ejes: [
      M(
        'hombro',
        'principal',
        'rotacion',
        ['Hombros'],
        [20, 30],
        'El manguito tiene uno de los brazos internos más cortos del cuerpo: por eso aquí la ' +
          'carga es ridícula al lado de la de un press y aun así el ejercicio cuesta.',
        'cenital',
      ),
      M(
        'escapula',
        'estabilizador',
        'retraccion',
        ['Espalda'],
        [20, 40],
        'Si la escápula no sujeta, el húmero rota sobre una base que se mueve y el recorrido ' +
          'que se mide no es el de la articulación.',
      ),
    ],
    linea: {
      origen: 'cable',
      nota:
        'Banda o polea: la dirección la fija el anclaje, no la gravedad. Con banda, además, ' +
        'la fuerza crece con el estiramiento.',
    },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el codo pegado al costado y a noventa grados, quieto',
      toleranciaMm: 30,
      porQue:
        'Separar el codo cambia el ejercicio al deltoides posterior sin que el peso ni el ' +
        'recorrido cambien. Es la compensación más común del manguito y se ve de frente.',
    },
  },

  'APOYO A UNA PIERNA': {
    patron: 'ABDUCCIÓN DE CADERA',
    cadena: 'cerrada',
    anclaje: 'el pie de apoyo',
    segmentosMoviles: ['torso', 'pelvis'],
    // FRONTAL. Lo que se sostiene aquí es que la pelvis no caiga hacia el lado sin apoyo, y
    // eso pasa entero en el plano frontal: de perfil no se ve caer nada.
    vista: 'frontal',
    referencia: 'vertical',
    ejes: [
      M(
        'cadera',
        'principal',
        'abduccion',
        ['Glúteos'],
        [30, 50],
        'No gira: sostiene. El brazo externo es la distancia de la cadera de apoyo a la ' +
          'vertical del centro de masas, y crece justo cuando la pelvis empieza a caerse.',
        'frontal',
      ),
      M(
        'tobillo',
        'secundario',
        'isometrico',
        ['Pantorrillas'],
        [40, 55],
        'El pie corrige lo que la cadera no llega a corregir, y por eso el arco plantar y el ' +
          'equilibrio monopodal son el mismo trabajo mirado desde dos alturas.',
        'frontal',
      ),
    ],
    linea: {
      origen: 'centro-de-masas',
      nota: 'Sin carga externa la única línea posible es la del peso del cuerpo.',
    },
    marcas: ['tobillo', 'rodilla', 'cadera', 'hombro'],
    alineacion: {
      regla: 'la pelvis a nivel: las dos crestas a la misma altura',
      toleranciaMm: 20,
      porQue:
        'La caída de la pelvis del lado libre es la señal de que el glúteo medio no llega, y ' +
        'es lo que acaba doliendo en la rodilla del lado que apoya. Veinte milímetros porque ' +
        'la referencia es la cresta ilíaca, que sí se marca en la piel.',
    },
  },

  /** La dominada a secas (`dominada`): cuelga con las piernas estiradas. Su mecánica, la de siempre. */
  DOMINADA: mecanicaDeLaDominada(),
  /** Ficha propia (`dominada_asistida`) porque su sujeto se arrodilla en la máquina. */
  'DOMINADA ASISTIDA': mecanicaDeLaDominada(),

  SUSPENSIÓN: {
    patron: 'TRACCIÓN VERTICAL',
    cadena: 'cerrada',
    anclaje: 'las manos en la barra',
    segmentosMoviles: ['torso'],
    referencia: 'vertical',
    vista: 'frontal',
    ejes: [
      M(
        'escapula',
        'principal',
        'retraccion',
        ['Espalda'],
        [20, 40],
        'Lo único que se mueve en un colgado activo es el omóplato bajando sobre la caja: un ' +
          'par de centímetros de recorrido y todo el ejercicio.',
        'frontal',
      ),
      M(
        'hombro',
        'estabilizador',
        'isometrico',
        ['Espalda', 'Hombros'],
        [20, 30],
        'Sostiene la cabeza del húmero contra la tracción. No gira.',
      ),
    ],
    linea: {
      origen: 'centro-de-masas',
      nota: 'El cuerpo cuelga de las manos: la línea es la vertical de su propio peso.',
    },
    marcas: ['hombro', 'codo', 'muñeca'],
    alineacion: {
      regla: 'el cuerpo quieto bajo las manos, sin balanceo',
      toleranciaMm: 40,
      porQue:
        'El balanceo convierte el agarre en un problema de inercia y le quita el trabajo al ' +
        'omóplato, que es a lo que se cuelga uno.',
    },
    limite:
      'colgado recto el brazo de momento es CASI CERO por definición —el cuerpo cae bajo las ' +
      'manos—, y eso no es que no haya carga: es que la carga es TRACCIÓN y no momento. Un ' +
      'brazo pequeño aquí no significa un ejercicio fácil, significa que la palanca no es la ' +
      'magnitud que lo describe',
  },
}
