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
  | 'banda'
  | 'peso-corporal'

export interface PerfilDeImplemento {
  nombre: string
  /** Cuando el implemento manda sobre el origen que declara el patrón. */
  linea?: OrigenDeLinea
  /**
   * Dónde entra la carga en el cuerpo. La tabla de `modelos.ts` da por hecho
   * que está en las manos, y en tres implementos no lo está.
   */
  aplicacion: 'manos' | 'tobillo' | 'hombros' | 'pelvis' | 'pies' | 'cuerpo' | 'espalda'
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
      'respaldo se lleva parte de la reacción. Son 9 vídeos del corpus, y la taxonomía sí los ' +
      'clasifica —van a la familia de la sentadilla—: el problema es justo ese, que así ' +
      'heredan un modelo de palanca que es de otro ejercicio.',
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

  banda: {
    nombre: 'banda elástica',
    // No es gravedad: la banda tira hacia su anclaje, igual que un cable. La diferencia con
    // la polea no es la dirección — es que la MAGNITUD tampoco es constante.
    linea: 'cable',
    aplicacion: 'manos',
    cargas: 1,
    distanciaHorizontalVale: false,
    limite:
      'la banda no tiene un peso: su fuerza crece con el estiramiento, así que sin saber ' +
      'cuánto se estira no hay newtons ni siquiera aproximados',
    porQue:
      'Entra en la tabla el 2026-09-06 porque faltaba y se estaba usando: band pull apart, ' +
      'rotación con banda, tibial posterior y apertura de banda son familias del censo de ' +
      'producción, y las cuatro salían sin implemento —o sea, sin nada que decir sobre su ' +
      'medida—. Es el ÚNICO implemento de la tabla cuya resistencia depende de la posición ' +
      'y no del peso: una barra de 20 kg pesa 20 arriba y abajo, y una banda tira poco al ' +
      'principio del recorrido y mucho al final. Por eso comparte con la polea que el brazo ' +
      'no sale de la distancia horizontal, y no comparte nada más: en la polea el número que ' +
      'falta es la dirección del cable, y aquí falta además la propia fuerza.',
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
  // LAS FAMILIAS QUE IMPLICAN SU IMPLEMENTO, al final y no antes: cualquier palabra
  // explícita de arriba gana. Un curl femoral es una máquina por definición —no existe
  // un curl femoral con barra—, un curl inclinado o martillo son de mancuernas, una
  // plancha con carga lleva un disco en la espalda y una dominada asistida es una
  // máquina. Medido el 2026-09-06: eran 6 de los 27 nombres del seed —el 22 %— y los seis
  // se resuelven por familia sin tener que renombrar una prescripción. La regla sigue
  // siendo que el nombre declare; esto solo recoge lo que el nombre ya dice de otra forma.
  { patron: /DOMINADA.*ASISTID|ASISTID.*DOMINADA|PULL.?UP ASISTID/, implemento: 'maquina' },
  { patron: /DOMINADA|PULL.?UP|CHIN.?UP|FONDOS?( EN PARALELAS)?$/, implemento: 'peso-corporal' },
  // «ACOSTADO» y «EN MAQUINA» entran desde el 2026-09-07: «FLEXION DE RODILLA ACOSTADO» salia
  // sin implemento y solo con camilla. Y la extension de rodilla va aqui por la misma razon
  // que el curl femoral: en esta casa no existe sin maquina, asi que un nombre que no lo
  // diga —«Extension de rodilla», «EXTENSION DE RODILLA, ARCO PARCIAL 90→45»— no es una
  // prescripcion incompleta, es la maquina dada por supuesta. Medido ese dia sobre los
  // nombres reales: tres de ellos salian con el sujeto sentado en el aire.
  { patron: /CURL FEMORAL|LEG CURL|FLEXION (DE )?RODILLA( (TUMBAD|SENTAD|ACOSTAD|DE PIE|EN MAQUINA))?|EXTENSION (DE )?RODILLA|LEG EXTENSION/, implemento: 'maquina' },
  { patron: /CURL.*(INCLINAD|MARTILLO|CONCENTRAD|ALTERN)/, implemento: 'mancuernas' },
  { patron: /PLANCHA CON (CARGA|PESO)/, implemento: 'disco' },
  { patron: /(GEMELO|TALON|TALONES|PANTORRILLA|CALF).*(DE PIE|SENTAD|PARAD)|(DE PIE|SENTAD|PARAD).*(GEMELO|TALON|TALONES|PANTORRILLA|CALF)/, implemento: 'maquina' },
  // LA BANDA, que hasta hoy no existía en la tabla. Va aquí abajo por la misma regla: si
  // el nombre dice «polea» o «mancuerna», gana la palabra explícita. Un `pull apart` no
  // lleva apellido porque no hay otra forma de hacerlo — es band pull apart o no es nada.
  { patron: /BANDA|ELASTICO|MINIBAND|MINI.?BAND|PULL.?APART/, implemento: 'banda' },
  // EL PESO CORPORAL POR DEFINICIÓN, y solo donde no hay otra forma de hacer el ejercicio.
  //
  // Es la parte donde más fácil sería pasarse, así que el criterio es estrecho: entra la
  // familia cuando añadirle carga la convierte en OTRO ejercicio con otro nombre —una
  // plancha con disco ya está tres líneas más arriba, un colgado con lastre se llama
  // «colgado con lastre»—, y se queda fuera todo lo que admite carga sin cambiar de nombre.
  // Por eso NO está aquí el paseo del granjero: se hace con mancuernas o con barra hexagonal
  // y el nombre no lo dice, así que `undefined` sigue siendo la respuesta honesta.
  //
  // Medido el 2026-09-06 sobre los `ejemplos` del catálogo: eran 37 de 89 sin implemento.
  { patron: /SALTO|POGO|DROP SQUAT|ATERRIZAJE|PLIOMETR|REACTIV/, implemento: 'peso-corporal' },
  { patron: /PLANCHA|DEAD ?BUG|BICHO MUERTO|HOLLOW|BIRD.?DOG|PERRO DE MUESTRA|SIDE BRIDGE|ISOMETRIA DE SOSTEN/, implemento: 'peso-corporal' },
  { patron: /MONOPODAL|EQUILIBRIO|SHORT FOOT|ARCO PLANTAR|APOYO ESTABLE/, implemento: 'peso-corporal' },
  { patron: /COLGAD|DEAD ?HANG|SUSPENSION/, implemento: 'peso-corporal' },
  { patron: /GATO.?CAMELLO|FOAM ROLLER|ROTACION TORACICA|MOVILIDAD/, implemento: 'peso-corporal' },
  { patron: /BANCO ROMANO|HIPEREXTENSION|BANCO 45|REVERSE HYPER/, implemento: 'peso-corporal' },
  { patron: /ELEVACION DE PUNTAS|TIBIALIS|TIBIAL ANTERIOR|DORSIFLEXION/, implemento: 'peso-corporal' },
  { patron: /90\/90|ROTACION (EXTERNA|INTERNA) DE CADERA|COPENHAGUE|CURL NORDICO|NORDICO|FLEXIONES|SENTADILLA A LA PARED/, implemento: 'peso-corporal' },
  // Un CRUNCH a secas es peso corporal. El de polea y el que lleva disco ganan antes, por
  // las reglas explícitas de arriba: aquí solo cae el que no dice nada, que es el que en el
  // censo de producción se escribe «CRUNCH» y punto.
  { patron: /CRUNCH/, implemento: 'peso-corporal' },
  // Y el PEC DECK es el nombre de la máquina, no del gesto: no existe un pec deck con
  // mancuernas. Igual la contractora. Dos familias más del censo que dejan de estar mudas.
  { patron: /PEC.?DECK|PECK.?DECK|CONTRACTORA?/, implemento: 'maquina' },
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
