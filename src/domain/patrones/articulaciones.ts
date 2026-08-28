/**
 * Catálogo articular: qué puede hacer cada articulación, en qué plano y hasta
 * dónde.
 *
 * Esto no es documentación: es la fuente de la que salen los topes que aplica
 * la capa de movimiento. Un canal que no aparezca aquí no existe, y un ángulo
 * fuera de rango se recorta.
 *
 * Lo que de verdad hay que entender de una articulación no es solo lo que hace,
 * sino **lo que no puede hacer**. El codo no se dobla hacia atrás porque el
 * olécranon topa con su fosa, y el giro de la palma no es del codo sino de la
 * radiocubital. Por eso cada articulación lleva su lista de imposibles: es lo
 * que evita que una animación invente un movimiento para que le cuadre la pose.
 */

export type Plano = 'sagital' | 'frontal' | 'transverso'

export const NOMBRE_DE_PLANO: Record<Plano, string> = {
  sagital: 'Plano sagital',
  frontal: 'Plano frontal',
  transverso: 'Plano transverso',
}

export type TipoArticular =
  | 'bisagra'
  | 'esferoidea'
  | 'trocoide'
  | 'condilea'
  | 'plana'
  | 'compuesta'

export const NOMBRE_DE_TIPO: Record<TipoArticular, string> = {
  bisagra: 'Bisagra',
  esferoidea: 'Esferoidea',
  trocoide: 'Trocoide',
  condilea: 'Condílea',
  plana: 'Plana',
  compuesta: 'Compuesta',
}

export interface EjeArticular {
  /** Canal de pose que lo mueve. */
  canal: string
  plano: Plano
  /** Cómo se llama ir hacia el positivo y hacia el negativo. */
  positivo: string
  negativo: string
  /** Grados. El primero es el tope negativo. */
  rango: [number, number]
}

export interface Articulacion {
  id: string
  nombre: string
  tipo: TipoArticular
  /** Grados de libertad reales: uno, dos o tres ejes. */
  segmentoFijo: string
  segmentoMovil: string
  /** Huesos del rig que quedan por encima y por debajo de la articulación. */
  huesoProximal: string
  huesoDistal: string
  ejes: EjeArticular[]
  /** Lo que NO puede hacer, y por qué. */
  noPuede: string[]
}

export const ARTICULACIONES: Articulacion[] = [
  {
    id: 'cadera',
    nombre: 'Cadera',
    tipo: 'esferoidea',
    segmentoFijo: 'Pelvis',
    segmentoMovil: 'Fémur',
    huesoProximal: 'pelvis',
    huesoDistal: 'muslo',
    ejes: [
      { canal: 'caderaFlex', plano: 'sagital', positivo: 'Flexión', negativo: 'Extensión', rango: [-30, 135] },
      { canal: 'caderaAbd', plano: 'frontal', positivo: 'Abducción', negativo: 'Aducción', rango: [-32, 50] },
      { canal: 'caderaRot', plano: 'transverso', positivo: 'Rotación externa', negativo: 'Rotación interna', rango: [-45, 45] },
    ],
    noPuede: [
      'La extensión termina hacia los 30°: la sujeta el ligamento iliofemoral, no el músculo.',
      'La flexión llega mucho más lejos con la rodilla doblada que con la pierna recta, porque el isquiotibial deja de frenarla.',
    ],
  },
  {
    id: 'rodilla',
    nombre: 'Rodilla',
    tipo: 'bisagra',
    segmentoFijo: 'Fémur',
    segmentoMovil: 'Tibia',
    huesoProximal: 'muslo',
    huesoDistal: 'tibia',
    ejes: [
      { canal: 'rodillaFlex', plano: 'sagital', positivo: 'Flexión', negativo: 'Extensión', rango: [0, 145] },
    ],
    noPuede: [
      'No se dobla hacia el otro lado: en extensión completa se bloquea y ahí acaba el recorrido.',
      'No separa ni junta. Si la rodilla se mete hacia dentro, el movimiento viene de la cadera, no de ella.',
      'Solo rota unos grados, y únicamente estando doblada.',
    ],
  },
  {
    id: 'tobillo',
    nombre: 'Tobillo',
    tipo: 'bisagra',
    segmentoFijo: 'Tibia y peroné',
    segmentoMovil: 'Astrágalo y pie',
    huesoProximal: 'tibia',
    huesoDistal: 'pie',
    ejes: [
      { canal: 'tobilloPlantar', plano: 'sagital', positivo: 'Flexión plantar', negativo: 'Dorsiflexión', rango: [-38, 58] },
    ],
    noPuede: [
      'La dorsiflexión se acaba pronto, hacia los 38°, y es lo que despega el talón en una sentadilla profunda.',
      'Llevar el pie hacia dentro o hacia fuera no es del tobillo: es de la articulación subastragalina, por debajo.',
    ],
  },
  {
    id: 'hombro',
    nombre: 'Hombro',
    tipo: 'esferoidea',
    segmentoFijo: 'Escápula',
    segmentoMovil: 'Húmero',
    huesoProximal: 'escapula',
    huesoDistal: 'brazo',
    ejes: [
      { canal: 'hombroFlex', plano: 'sagital', positivo: 'Flexión', negativo: 'Extensión', rango: [-62, 178] },
      { canal: 'hombroAbd', plano: 'frontal', positivo: 'Abducción', negativo: 'Aducción', rango: [-12, 180] },
      { canal: 'hombroRot', plano: 'transverso', positivo: 'Rotación externa', negativo: 'Rotación interna', rango: [-95, 100] },
    ],
    noPuede: [
      'Llegar arriba del todo sin la escápula: pasados los 120° la escápula tiene que rotar, o el hombro pellizca.',
      'Es la articulación con más recorrido del cuerpo, y por eso la que menos se sujeta sola: la centra el manguito.',
    ],
  },
  {
    id: 'escapulotoracica',
    nombre: 'Escápula',
    tipo: 'plana',
    segmentoFijo: 'Caja torácica',
    segmentoMovil: 'Escápula',
    huesoProximal: 'torax',
    huesoDistal: 'escapula',
    ejes: [
      { canal: 'escapulaProt', plano: 'transverso', positivo: 'Protracción', negativo: 'Retracción', rango: [0, 38] },
      { canal: 'escapulaRetr', plano: 'transverso', positivo: 'Retracción', negativo: 'Protracción', rango: [0, 38] },
      { canal: 'escapulaElev', plano: 'frontal', positivo: 'Elevación', negativo: 'Descenso', rango: [-18, 48] },
    ],
    noPuede: [
      'No es una articulación de verdad: la escápula se desliza sobre las costillas y la sujetan los músculos.',
      'Por eso, si el serrato no entra, se despega y el hombro se queda sin base para empujar.',
    ],
  },
  {
    id: 'codo',
    nombre: 'Codo',
    tipo: 'bisagra',
    segmentoFijo: 'Húmero',
    segmentoMovil: 'Cúbito',
    huesoProximal: 'brazo',
    huesoDistal: 'antebrazo',
    ejes: [
      { canal: 'codoFlex', plano: 'sagital', positivo: 'Flexión', negativo: 'Extensión', rango: [0, 152] },
    ],
    noPuede: [
      'No se dobla hacia atrás. La extensión termina en 0° cuando el olécranon topa con su fosa: es hueso contra hueso, no músculo.',
      'No separa ni junta el antebrazo: no tiene eje frontal.',
      'Girar la palma NO es del codo. Eso ocurre en la radiocubital, donde el radio rueda sobre el cúbito.',
    ],
  },
  {
    id: 'radiocubital',
    nombre: 'Radiocubital',
    tipo: 'trocoide',
    segmentoFijo: 'Cúbito',
    segmentoMovil: 'Radio',
    huesoProximal: 'brazo',
    huesoDistal: 'antebrazo',
    ejes: [
      { canal: 'antebrazoRot', plano: 'transverso', positivo: 'Supinación', negativo: 'Pronación', rango: [-88, 88] },
    ],
    noPuede: [
      'Es lo que gira la palma, y decide cuánto trabaja el bíceps: con la palma hacia abajo pierde su ventaja.',
      'Con el codo estirado parece que gira más, pero ahí una parte la está poniendo el hombro.',
    ],
  },
  {
    id: 'muneca',
    nombre: 'Muñeca',
    tipo: 'condilea',
    segmentoFijo: 'Radio y cúbito',
    segmentoMovil: 'Carpo',
    huesoProximal: 'antebrazo',
    huesoDistal: 'mano',
    ejes: [
      { canal: 'muneca', plano: 'sagital', positivo: 'Flexión', negativo: 'Extensión', rango: [-75, 82] },
    ],
    noPuede: [
      'No rota sobre sí misma: lo que parece giro de muñeca viene del antebrazo.',
      'En casi todo empuje su trabajo es no moverse, y aguantar la carga alineada con el antebrazo.',
    ],
  },
  {
    id: 'lumbar',
    nombre: 'Columna lumbar',
    tipo: 'compuesta',
    segmentoFijo: 'Pelvis',
    segmentoMovil: 'Vértebras lumbares',
    huesoProximal: 'pelvis',
    huesoDistal: 'lumbar',
    ejes: [
      { canal: 'lumbarFlex', plano: 'sagital', positivo: 'Flexión', negativo: 'Extensión', rango: [-28, 62] },
      { canal: 'lumbarLat', plano: 'frontal', positivo: 'Inclinación', negativo: 'Inclinación contraria', rango: [-32, 32] },
      { canal: 'lumbarRot', plano: 'transverso', positivo: 'Rotación', negativo: 'Rotación contraria', rango: [-16, 16] },
    ],
    noPuede: [
      'Apenas rota: unos 16° en total. La orientación de sus carillas lo impide, y forzarlo es donde se hace daño.',
      'La flexión que parece de la lumbar suele ser de la cadera. Cuando de verdad es lumbar, con carga, es el problema.',
    ],
  },
  {
    id: 'toracica',
    nombre: 'Columna torácica',
    tipo: 'compuesta',
    segmentoFijo: 'Vértebras lumbares',
    segmentoMovil: 'Vértebras torácicas',
    huesoProximal: 'lumbar',
    huesoDistal: 'torax',
    ejes: [
      { canal: 'toraxFlex', plano: 'sagital', positivo: 'Flexión', negativo: 'Extensión', rango: [-32, 48] },
      { canal: 'toraxLat', plano: 'frontal', positivo: 'Inclinación', negativo: 'Inclinación contraria', rango: [-38, 38] },
      { canal: 'toraxRot', plano: 'transverso', positivo: 'Rotación', negativo: 'Rotación contraria', rango: [-42, 42] },
    ],
    noPuede: [
      'La sujetan las costillas, así que se flexiona menos que la lumbar, pero rota mucho más.',
      'Si no extiende bien, el brazo no llega arriba del todo y el hombro lo paga.',
    ],
  },
  {
    id: 'cuello',
    nombre: 'Cuello',
    tipo: 'compuesta',
    segmentoFijo: 'Vértebras torácicas',
    segmentoMovil: 'Vértebras cervicales',
    huesoProximal: 'torax',
    huesoDistal: 'cuello',
    ejes: [
      { canal: 'cuelloFlex', plano: 'sagital', positivo: 'Flexión', negativo: 'Extensión', rango: [-58, 68] },
    ],
    noPuede: [
      'Su trabajo aquí es sostener la mirada, y por eso compensa la inclinación del tronco casi sin que se note.',
    ],
  },
  {
    id: 'pelvis',
    nombre: 'Pelvis',
    tipo: 'compuesta',
    segmentoFijo: 'Suelo, a través de las piernas',
    segmentoMovil: 'Pelvis',
    huesoProximal: 'pelvis',
    huesoDistal: 'lumbar',
    ejes: [
      { canal: 'pelvisBascula', plano: 'sagital', positivo: 'Retroversión', negativo: 'Anteversión', rango: [-28, 28] },
      { canal: 'pelvisLat', plano: 'frontal', positivo: 'Caída contraria', negativo: 'Caída', rango: [-22, 22] },
      { canal: 'pelvisRot', plano: 'transverso', positivo: 'Rotación', negativo: 'Rotación contraria', rango: [-32, 32] },
    ],
    noPuede: [
      'No se mueve sola: lo que bascula la pelvis son la cadera y la lumbar tirando de ella.',
      'Su caída lateral al apoyar en una pierna es la prueba de si el glúteo medio está sujetando.',
    ],
  },
  {
    id: 'craneo',
    nombre: 'Cabeza',
    tipo: 'compuesta',
    segmentoFijo: 'Vértebras cervicales',
    segmentoMovil: 'Cráneo',
    huesoProximal: 'cuello',
    huesoDistal: 'craneo',
    ejes: [
      { canal: 'craneoFlex', plano: 'sagital', positivo: 'Flexión', negativo: 'Extensión', rango: [-32, 32] },
    ],
    noPuede: ['El asentimiento ocurre entre el cráneo y el atlas, y es un recorrido corto.'],
  },
]

/** Canal → el eje que lo mueve y la articulación a la que pertenece. */
export const EJE_POR_CANAL: Record<string, { articulacion: Articulacion; eje: EjeArticular }> =
  Object.fromEntries(
    ARTICULACIONES.flatMap((articulacion) =>
      articulacion.ejes.map((eje) => [eje.canal, { articulacion, eje }]),
    ),
  )

/**
 * Los topes que aplica la capa de movimiento, derivados del catálogo.
 *
 * Se generan aquí para que no haya dos listas de rangos que se desincronicen:
 * la que se le enseña al asesorado y la que de verdad recorta el ángulo tienen
 * que ser la misma.
 */
export const RANGO_POR_CANAL: Record<string, [number, number]> = Object.fromEntries(
  ARTICULACIONES.flatMap((a) => a.ejes.map((e) => [e.canal, e.rango])),
)
