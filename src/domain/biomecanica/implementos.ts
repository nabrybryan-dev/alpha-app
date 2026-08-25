/**
 * Qué le hace el IMPLEMENTO a la medida, que no es lo mismo que qué le hace al
 * ejercicio.
 *
 * La tabla de `modelos.ts` decide el eje y la línea de fuerza a partir del
 * patrón. Eso basta mientras la carga sea una barra: una masa, en el plano
 * sagital, tirando vertical. En cuanto deja de serlo, el patrón sigue siendo el
 * mismo y **la medida cambia por completo**.
 *
 * Esta tabla no nació de un libro. Nació de catalogar 168 vídeos reales de
 * gimnasio uno a uno (`Cerebro Alpha/herramientas/encoder-camara/CORPUS.md` §6)
 * y encontrarse con que los tres orígenes de línea que la tabla contempla
 * —`carga-externa`, `centro-de-masas`, `cable`— no cubren lo que la gente usa:
 *
 *     barra        65 vídeos     el caso que la tabla ya sabía
 *     mancuernas   30            dos cargas, y de lado solo se ve una
 *     máquina      21            leva: el peso de la pila no es la fuerza en la mano
 *     Smith        19            raíl: el brazo lo decide el raíl, no el atleta
 *     polea        17            la dirección la fija el cable
 *     disco         1            el caso MÁS limpio de todos, y no tenía entrada
 *
 * ## La distinción que ordena la tabla: quién decide el brazo
 *
 * Con una barra libre, **el atleta decide dónde va la carga**, y por eso medir
 * la distancia horizontal entre el eje y la vertical de la barra mide algo sobre
 * él: mide su técnica. En un Smith o en una prensa, esa distancia la fija el
 * raíl. El número sigue saliendo, sigue variando entre repeticiones, y **ya no
 * habla del atleta**.
 *
 * Es el mismo error de categoría que la doctrina ya tiene escrito para la
 * dominada: medirla contra la línea de un cable que no existe da un número, y el
 * número es basura. Por eso `distanciaHorizontalVale` es un campo y no una nota.
 *
 * Fuente de la regla que se rompe:
 * `Cerebro Alpha/wiki/conocimiento/perfiles-de-resistencia.md` §2.1.
 */

import type { Articulacion, OrigenDeLinea, Vista } from './tipos'

export type Implemento =
  | 'barra'
  | 'mancuernas'
  | 'disco'
  | 'guiado-vertical'
  | 'guiado-inclinado'
  | 'polea'
  | 'polea-tobillera'
  | 'maquina'
  | 'peso-corporal'

export interface PerfilDeImplemento {
  nombre: string
  /** Cuando el implemento manda sobre el origen que declara el patrón. */
  linea?: OrigenDeLinea
  /**
   * Dónde entra la carga en el cuerpo. La tabla de `modelos.ts` da por hecho
   * que está en las manos, y en tres implementos no lo está.
   */
  aplicacion: 'manos' | 'tobillo' | 'hombros' | 'pelvis' | 'pies' | 'cuerpo'
  /** Cuántas masas independientes hay. Dos no es una con el doble de peso. */
  cargas: 1 | 2
  /**
   * Si sigue valiendo la regla de perfiles-de-resistencia §2.1 —brazo externo =
   * distancia horizontal eje↔carga—. Cuando es `false`, salen ÁNGULOS y no
   * momentos, y hay que decirlo antes de enseñar nada.
   */
  distanciaHorizontalVale: boolean
  /** Marcas que este implemento añade a las que ya pide el patrón. */
  marcasExtra?: readonly Articulacion[]
  /** Un plano que hace falta y que la vista del patrón no da. */
  vistaExtra?: Vista
  /** Lo que con este implemento NO se puede prometer. Sale a pantalla. */
  limite?: string
  porQue: string
}

export const IMPLEMENTOS: Readonly<Record<Implemento, PerfilDeImplemento>> = {
  barra: {
    nombre: 'barra',
    aplicacion: 'manos',
    cargas: 1,
    distanciaHorizontalVale: true,
    porQue:
      'Una masa, en el plano sagital, tirando vertical, y el atleta decide dónde ponerla. ' +
      'Es el caso para el que se escribió la regla de la distancia horizontal.',
  },

  disco: {
    nombre: 'disco a dos manos',
    aplicacion: 'manos',
    cargas: 1,
    distanciaHorizontalVale: true,
    porQue:
      'Carga única y centrada en el plano sagital, sin nada que tape al atleta: es el caso ' +
      'MÁS limpio de medir de todo el corpus. Una goblet o una sentadilla con disco valen ' +
      'más para calibrar el detector que un peso muerto pesado.',
  },

  mancuernas: {
    nombre: 'mancuernas (las dos)',
    aplicacion: 'manos',
    cargas: 2,
    distanciaHorizontalVale: true,
    limite:
      'desde el lateral solo se ve una mancuerna: la otra queda detrás y puede ir a otra ' +
      'altura. La simetría es una suposición, no una medida',
    porQue:
      'Dos masas independientes no son una con el doble de peso. Cada brazo puede llevar la ' +
      'suya a distinta altura y a distinta distancia del cuerpo, y desde el plano sagital eso ' +
      'no se ve — se ve la cercana tapando a la lejana.',
  },

  'guiado-vertical': {
    nombre: 'máquina guiada vertical (Smith)',
    aplicacion: 'manos',
    cargas: 1,
    distanciaHorizontalVale: false,
    limite:
      'el raíl impide que la barra se desplace, así que el brazo de momento lo fija la máquina ' +
      'y no el atleta: salen ángulos, no momentos',
    porQue:
      'El raíl ejerce una reacción HORIZONTAL que no se ve y que no está en el peso de los ' +
      'discos. La barra no puede alejarse ni acercarse del eje, de modo que la distancia ' +
      'horizontal deja de medir la técnica del atleta y pasa a medir dónde puso los pies. Son ' +
      '19 vídeos del corpus, y hoy la tabla los trataba como barra libre.',
  },

  'guiado-inclinado': {
    nombre: 'raíl inclinado (prensa, hack)',
    aplicacion: 'pies',
    cargas: 1,
    distanciaHorizontalVale: false,
    limite:
      'la carga corre por un raíl inclinado: su línea no es la vertical ni la de un cable, y ' +
      'ninguno de los tres orígenes de la tabla la describe',
    porQue:
      'En una prensa de 45° la fuerza va a lo largo del raíl, no hacia abajo, y además el ' +
      'respaldo se lleva parte de la reacción. Son 9 vídeos del corpus y ni siquiera tienen ' +
      'categoría en la taxonomía de 32: hoy heredarían el modelo de la sentadilla, que es de ' +
      'otro ejercicio.',
  },

  polea: {
    nombre: 'polea',
    linea: 'cable',
    aplicacion: 'manos',
    cargas: 1,
    distanciaHorizontalVale: false,
    limite:
      'hay que ver el punto de anclaje de la polea en el encuadre: sin él no hay dirección de ' +
      'cable, y sin dirección no hay brazo',
    porQue:
      'La dirección la fija el cable y no la gravedad, así que el brazo es la perpendicular a ' +
      'ESA línea, no la distancia horizontal. Lo bueno es que el cable se ve: en el corpus hay ' +
      'cuatro tomas donde entra entero en el encuadre y son las más medibles de la polea.',
  },

  'polea-tobillera': {
    nombre: 'polea con tobillera',
    linea: 'cable',
    aplicacion: 'tobillo',
    cargas: 1,
    distanciaHorizontalVale: false,
    marcasExtra: ['tobillo'],
    limite:
      'la carga entra por el TOBILLO, no por la mano: la tabla da por hecho lo contrario y sin ' +
      'corregirlo el brazo se mide contra el punto equivocado',
    porQue:
      'Las patadas de glúteo en polea son el caso: el cable tira del tobillo, así que el brazo ' +
      'en la cadera es la perpendicular del eje de cadera a la línea del cable que pasa por el ' +
      'tobillo. Medirlo contra la mano da un número, y el número no es de este ejercicio.',
  },

  maquina: {
    nombre: 'máquina de placas',
    aplicacion: 'manos',
    cargas: 1,
    distanciaHorizontalVale: false,
    limite:
      'la leva cambia la relación entre el peso de la pila y el momento a lo largo del ' +
      'recorrido: sin su curva no hay newtons, solo ángulos',
    porQue:
      'Una máquina bien hecha existe justamente para que la resistencia NO siga la curva de la ' +
      'gravedad. Eso es su virtud como ejercicio y su problema como instrumento: el peso ' +
      'seleccionado no es la fuerza en la mano, y la relación entre los dos es un dato del ' +
      'fabricante que no tenemos.',
  },

  'peso-corporal': {
    nombre: 'peso corporal',
    linea: 'centro-de-masas',
    aplicacion: 'cuerpo',
    cargas: 1,
    distanciaHorizontalVale: true,
    porQue:
      'No hay barra que seguir: la línea sale del centro de masas del cuerpo, igual que en la ' +
      'dominada y en el fondo, que la tabla ya trataba así por variante de nombre.',
  },
}

/**
 * El implemento declarado en el nombre del ejercicio.
 *
 * Mismo mecanismo que `VARIANTES` en `modelos.ts` y en `taxonomia.ts`, y por la
 * misma razón: en esta casa la ejecución vive en el nombre, no en un campo
 * aparte que alguien tendría que rellenar. «RDL CON MANCUERNAS A UNA MANO» ya
 * lleva dentro todo lo que hace falta.
 *
 * El orden importa: lo más específico primero. Una polea con tobillera también
 * casa con «polea», y una mancuerna a una mano también casa con «mancuerna».
 */
const DETECCION: readonly { patron: RegExp; implemento: Implemento }[] = [
  { patron: /TOBILLERA|EN EL TOBILLO/, implemento: 'polea-tobillera' },
  { patron: /SMITH|MULTIPOWER|MULTIFUERZA/, implemento: 'guiado-vertical' },
  { patron: /PRENSA|HACK/, implemento: 'guiado-inclinado' },
  { patron: /MANCUERNA/, implemento: 'mancuernas' },
  { patron: /GOBLET|COPA|CON DISCO|CON PLACA/, implemento: 'disco' },
  { patron: /POLEA|CABLE|JALON|CRUCE/, implemento: 'polea' },
  { patron: /MAQUINA|SELECTORIZAD/, implemento: 'maquina' },
  { patron: /PESO CORPORAL|SIN PESO|LASTRE/, implemento: 'peso-corporal' },
  { patron: /BARRA|BARBELL/, implemento: 'barra' },
]

/**
 * Que la carga vaya a un solo lado NO es un implemento: es una lateralidad, y
 * es ortogonal.
 *
 * Esto no se vio al diseñar la tabla, se vio al correrla contra los 168 vídeos:
 * «jalón unilateral en polea» salía clasificado como mancuerna, y con él se iba
 * la línea de cable. Un remo a una mano con mancuerna, un jalón unilateral en
 * polea y una prensa a una pierna comparten el problema mecánico —la carga
 * fuera del plano sagital— y no comparten implemento ninguno.
 *
 * El problema, que es el mismo en los tres: con la carga a un lado, el tronco
 * resiste una flexión lateral y la cadera de apoyo una aducción. Ninguna de las
 * dos se ve de perfil, y son justo las que deciden si el ejercicio es el que se
 * prescribió. En el corpus hay 12 vídeos así, todos grabados de lado, todos
 * midiendo la mitad del problema.
 */
const UNILATERAL = /UNILATERAL|A UNA MANO|UN BRAZO|A UN LADO|UNA PIERNA|UNA MANCUERNA/

export const LIMITE_UNILATERAL =
  'la carga está FUERA del plano sagital: genera un momento en el plano frontal —flexión ' +
  'lateral de tronco y aducción de la cadera de apoyo— que desde el lateral no existe'

/** Si el nombre declara que la carga va a un solo lado. */
export function esUnilateral(nombreEjercicio: string): boolean {
  return UNILATERAL.test(normalizar(nombreEjercicio))
}

/** Quita tildes y mayúsculas, igual que `palancas.ts`. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

/**
 * Qué implemento declara este nombre de ejercicio, o `undefined` si no dice
 * nada.
 *
 * `undefined` no es lo mismo que `barra`, y conviene no confundirlos: un nombre
 * que no declara implemento es un nombre sobre el que no sabemos, y suponer
 * barra ahí es exactamente cómo entraría un Smith por la puerta de atrás con el
 * modelo equivocado.
 */
export function implementoDe(nombreEjercicio: string): Implemento | undefined {
  const nombre = normalizar(nombreEjercicio)
  if (!nombre) return undefined
  return DETECCION.find((d) => d.patron.test(nombre))?.implemento
}
