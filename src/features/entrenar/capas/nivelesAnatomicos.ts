/**
 * EL EJE W: los cinco niveles que atraviesan al sujeto.
 *
 * `huecos.ts` dice DÓNDE va cada cosa en el salón; este archivo dice QUÉ se ve del
 * cuerpo en cada escalón del cuarto eje. Orbitar (X, Y, Z) no cambia de nivel y
 * cambiar de nivel no mueve la cámara: son dos gestos ortogonales a propósito.
 *
 *     W=0 piel │ W=1 músculo superficial │ W=2 músculo profundo │ W=3 tendón │ W=4 hueso
 *
 * ## Los nombres son los del código, no una taxonomía nueva
 *
 * Cada nivel enumera estructuras REALES del sujeto, con el identificador con el que
 * ya están escritas en `src/domain/patrones/`:
 *
 * - `musculos` → ids de `MUSCULOS` (`gluteo_mayor`, `dorsal_ancho`, `poplíteo`…).
 * - `porcionesPasivas` → claves de `clavePorcion()` (`cuadriceps.recto`, `biceps.larga`…).
 * - `articulaciones` → ids de `ARTICULACIONES` (`cadera`, `escapulotoracica`…).
 * - `huesos` → nombres de `ESQUELETO` (`pelvis`, `musloD`, `escapulaI`…).
 *
 * Inventar un nombre aquí sería crear una segunda anatomía que se separaría de la
 * primera al primer cambio. Por eso `estructurasDesconocidas()` existe y por eso la
 * lista de huesos se DERIVA de `ESQUELETO` en vez de copiarse.
 *
 * ## Lo que este archivo NO hace
 *
 * Es el contrato, no el pintor. Declara qué debe verse; quien construya la malla lee
 * de aquí.
 *
 * ## Qué sabe encender y apagar el motor, medido
 *
 * `motor.ts` no conoce ningún nombre. `Motor.subir(mallas: Malla[])` concatena las
 * mallas que le den en un único búfer y las pinta con un solo `drawElements`, y una
 * `Malla` de `malla.ts` guarda por vértice posición, normal, color, índice de hueso y
 * fase de fibra —nunca a qué estructura pertenece—. Lo único que se enciende o se
 * apaga, por tanto, es una malla entera: la que se mete en el array o no se mete.
 *
 * A esa granularidad, los nombres casan. Ejercitando los constructores reales:
 *
 * - `piezas` son las dos mallas del sujeto que existen: `construirHuesos()` levanta
 *   13 774 vértices y `construirMusculos()` 14 488. No hay una tercera.
 * - los 21 `huesos` que declara el nivel 4 son EXACTAMENTE los 21 índices de `a_hueso`
 *   con geometría en `construirHuesos()`: ninguno declarado sin dibujar, ninguno
 *   dibujado sin declarar. Es la única correspondencia por nombre que llega al motor,
 *   y está completa.
 * - `acabado` cambia lo que se sube de verdad: la misma geometría con activación y sin
 *   ella difiere en 10 608 de las 43 464 componentes de color. `envolvente` y
 *   `activacion` no son dos etiquetas para lo mismo.
 * - los cinco niveles mandan al motor cinco combinaciones distintas de malla y color:
 *   músculo plano; músculo coloreado; músculo coloreado con hueso; músculo plano con
 *   hueso; hueso solo.
 * - `musculos`, `porcionesPasivas` y `articulaciones` no llegan al motor por nombre
 *   —no puede— y se resuelven contra el catálogo: `estructurasDesconocidas()` sale
 *   vacía y `musculosSinNivel()` también.
 *
 * Falta un escalón para que la distinción superficial/profundo se VEA:
 * `construirMusculos()` dibuja siempre las setenta porciones y no admite filtro, así
 * que hoy los niveles 0 a 3 mandan las mismas setenta y el reparto de veinte y
 * diecisiete todavía no recorta nada. Quien monte la capa de interfaz tiene que
 * recorrer `PORCIONES` y saltarse las que el nivel no lista; el dato para hacerlo está
 * aquí. Y lo que se ha medido es lo que ENTRA en `subir()`, no una captura de
 * pantalla: el píxel lo firma un ojo, no este archivo.
 */

import { ESQUELETO } from '../../../domain/patrones/esqueleto'
import { ARTICULACIONES } from '../../../domain/patrones/articulaciones'
import { MUSCULO_POR_ID, PORCION_POR_CLAVE } from '../../../domain/patrones/musculos'
import type { NivelW } from '../salon/huecos'

/**
 * Los constructores de malla del sujeto que enciende un nivel.
 *
 * Son los dos que existen hoy: `construirMusculos()` y `construirHuesos()`. El
 * escenario —bahía, sala, trípode— y las guías —plomada, traza— no son estructuras
 * del sujeto y no se apagan con W: quien entrena no deja de necesitar el suelo por
 * mirar un tendón.
 */
export type PiezaDelSujeto = 'musculos' | 'huesos'

/**
 * Cómo se pinta el músculo en un nivel.
 *
 * - `envolvente`: sin color de activación, todo en `COLOR_PASIVO`. Se consigue
 *   llamando a `construirMusculos()` con una activación vacía —`activacionDe()`
 *   devuelve 0 y `colorDeMusculo(0)` es `COLOR_PASIVO`—, así que no hace falta tocar
 *   `musculos.ts`. Es la superficie, no el trabajo.
 * - `activacion`: el color dice cuánto trabaja cada porción, que es lo que enseña el
 *   visor de hoy.
 * - `ninguno`: en este nivel no se dibuja músculo.
 */
export type AcabadoMuscular = 'envolvente' | 'activacion' | 'ninguno'

export interface NivelAnatomico {
  /** Su sitio en el eje W. Coincide con el índice en `NIVELES_ANATOMICOS`. */
  w: NivelW
  /** El mismo id que usa `CAPAS_W` en `huecos.ts`. */
  id: 'piel' | 'musculo-superficial' | 'musculo-profundo' | 'tendon' | 'hueso'
  /** Cómo se llama en pantalla. */
  nombre: string
  /** Qué se está mirando, en una frase corta: es el rótulo del nivel. */
  resumen: string
  /** Constructores de malla encendidos aquí. */
  piezas: readonly PiezaDelSujeto[]
  /** Ids de `MUSCULOS` visibles. */
  musculos: readonly string[]
  /** Cómo se pintan esos músculos. */
  acabado: AcabadoMuscular
  /** Claves de porción que se leen como tejido pasivo (`clavePorcion()`). */
  porcionesPasivas: readonly string[]
  /** Ids de `ARTICULACIONES` cuyos topes se enseñan aquí. */
  articulaciones: readonly string[]
  /** Nombres de hueso de `ESQUELETO`. */
  huesos: readonly string[]
}

/** Todos los huesos del rig, tal y como los nombra `ESQUELETO`. Derivado, no copiado. */
const HUESOS_DEL_RIG: readonly string[] = ESQUELETO.map((h) => h.nombre)

/** Todas las articulaciones del catálogo, por id. */
const TODAS_LAS_ARTICULACIONES: readonly string[] = ARTICULACIONES.map((a) => a.id)

/**
 * EL PRIMER PLANO MUSCULAR: lo que se ve al mirar a alguien.
 *
 * Los veinte músculos que modelan el relieve del cuerpo. La frontera es la de siempre
 * en anatomía de superficie —lo que se palpa sin apartar nada—, y por eso el glúteo
 * medio no está aquí y el mayor sí, o el trapecio y el dorsal tapan a los romboides.
 */
const SUPERFICIALES: readonly string[] = [
  // Cadera y muslo
  'gluteo_mayor',
  'tfl',
  'cuadriceps',
  'isquiotibiales',
  // Pierna
  'triceps_sural',
  'tibial_anterior',
  'peroneos',
  // Tronco
  'recto_abdominal',
  'oblicuos',
  'trapecio',
  'dorsal_ancho',
  'pectoral_mayor',
  'serrato',
  'esternocleidomastoideo',
  // Hombro y brazo
  'deltoides',
  'biceps',
  'triceps',
  'braquiorradial',
  'flexores_carpo',
  'extensores_carpo',
]

/**
 * EL SEGUNDO PLANO: lo que hay que apartar algo para ver.
 *
 * Los diecisiete restantes. Es aquí donde vive casi todo lo que un preparador tiene
 * que explicar y nadie ve: el psoas, el manguito, el transverso, el cuadrado lumbar.
 *
 * Juntos, `SUPERFICIALES` y `PROFUNDOS` son los treinta y siete músculos del catálogo,
 * sin repetir ninguno y sin dejarse ninguno: `musculosSinNivel()` lo comprueba. Que sea
 * una partición es la garantía de que atravesar el cuerpo no pierde músculos por el
 * camino, que es la misma regla del salón entero.
 */
const PROFUNDOS: readonly string[] = [
  // Cadera
  'gluteo_medio',
  'gluteo_menor',
  'aductores',
  'psoas_iliaco',
  // Rodilla
  'poplíteo',
  // Tronco
  'erectores',
  'transverso',
  'cuadrado_lumbar',
  'escalenos',
  'esplenio',
  // Cintura escapular y hombro
  'romboides',
  'pectoral_menor',
  'manguito',
  'redondo_mayor',
  'coracobraquial',
  // Brazo
  'braquial',
  'pronador_redondo',
]

/**
 * LAS PORCIONES QUE TIRAN DE DOS SITIOS A LA VEZ.
 *
 * Son las diecisiete que el catálogo marca `biarticular: true`, y no están aquí por
 * capricho: una porción biarticular es la que se queda corta o se queda larga por lo
 * que hace la OTRA articulación, y esa tensión pasiva es exactamente el tema del nivel
 * 3. El recto femoral no da todo su recorrido en sentadilla y la cabeza larga del
 * tríceps solo se estira con el brazo elevado por esto mismo.
 *
 * Se declaran por clave de porción y no por músculo porque el reparto es dentro del
 * músculo: en el bíceps femoral la larga es biarticular y la corta no.
 */
const BIARTICULARES: readonly string[] = [
  'tfl.unico',
  'aductores.gracil',
  'psoas_iliaco.psoas',
  'cuadriceps.recto',
  'isquiotibiales.biceps_larga',
  'isquiotibiales.semitendinoso',
  'isquiotibiales.semimembranoso',
  'triceps_sural.gastro_medial',
  'triceps_sural.gastro_lateral',
  'biceps.larga',
  'biceps.corta',
  'triceps.larga',
  'flexores_carpo.unico',
  'extensores_carpo.unico',
  'esternocleidomastoideo.esternal',
  'esternocleidomastoideo.clavicular',
  'esplenio.esplenio',
]

/**
 * Los cinco niveles, en el orden en que se atraviesan de fuera a dentro.
 *
 * El índice del array ES el valor de W: `NIVELES_ANATOMICOS[2]` es el músculo profundo.
 * Reordenarlos rompería el eje, y por eso `NIVEL_POR_W` se deriva del array en vez de
 * escribirse aparte.
 */
export const NIVELES_ANATOMICOS: readonly NivelAnatomico[] = [
  {
    w: 0,
    id: 'piel',
    nombre: 'Piel',
    resumen: 'La superficie: la forma que se ve en el espejo.',
    // No hay malla de piel en el código: `construirHuesos()` y `construirMusculos()`
    // son las dos únicas del sujeto. Así que la superficie se dibuja con la
    // envolvente de los músculos del primer plano, apagados y todos del mismo color.
    // Es lo más externo que el motor sabe construir hoy, y queda dicho: **no es piel**,
    // y entre porción y porción se verá el hueco. La malla cerrada está pendiente y
    // vive en `malla.ts`, que necesita permiso de Bryan.
    piezas: ['musculos'],
    musculos: SUPERFICIALES,
    acabado: 'envolvente',
    porcionesPasivas: [],
    articulaciones: [],
    huesos: [],
  },
  {
    w: 1,
    id: 'musculo-superficial',
    nombre: 'Músculo superficial',
    resumen: 'El primer plano, coloreado por lo que trabaja.',
    // Mismos músculos que en la piel y, sin embargo, otra pantalla: aquí el color
    // vuelve a decir cuánto trabaja cada porción. Atravesar de 0 a 1 es encender el
    // trabajo sobre la misma silueta, que es la transición que explica el ejercicio.
    piezas: ['musculos'],
    musculos: SUPERFICIALES,
    acabado: 'activacion',
    porcionesPasivas: [],
    articulaciones: [],
    huesos: [],
  },
  {
    w: 2,
    id: 'musculo-profundo',
    nombre: 'Músculo profundo',
    resumen: 'Lo que trabaja debajo y no se ve nunca.',
    // Solo el segundo plano: si se dejara también el primero, el nivel 2 sería el 1
    // con cosas encima y no se vería el psoas, que es justo lo que se viene a ver.
    // El hueso entra como referencia; sin él, un manguito rotador flotando no se
    // entiende.
    piezas: ['musculos', 'huesos'],
    musculos: PROFUNDOS,
    acabado: 'activacion',
    porcionesPasivas: [],
    articulaciones: TODAS_LAS_ARTICULACIONES,
    huesos: HUESOS_DEL_RIG,
  },
  {
    w: 3,
    id: 'tendon',
    nombre: 'Tendón y tejido pasivo',
    resumen: 'Lo que frena sin contraerse: tendón, tope y palanca.',
    // El nivel del «no puede»: las porciones biarticulares, que se tensan por lo que
    // hace la articulación de al lado, y los topes de `ARTICULACIONES.noPuede`, que
    // son ligamento y hueso, no músculo. El esqueleto se queda encendido porque un
    // tendón sin su inserción es una cuerda en el aire.
    piezas: ['musculos', 'huesos'],
    musculos: [],
    acabado: 'envolvente',
    porcionesPasivas: BIARTICULARES,
    articulaciones: TODAS_LAS_ARTICULACIONES,
    huesos: HUESOS_DEL_RIG,
  },
  {
    w: 4,
    id: 'hueso',
    nombre: 'Hueso',
    resumen: 'La palanca desnuda: los veintiún huesos del rig.',
    // El fondo del eje. Sin nada de tejido blando encima se ve la máquina: qué gira
    // sobre qué y con cuánto brazo. Es el nivel donde el arco del movimiento y la
    // plomada del peso se leen sin estorbo.
    piezas: ['huesos'],
    musculos: [],
    acabado: 'ninguno',
    porcionesPasivas: [],
    articulaciones: TODAS_LAS_ARTICULACIONES,
    huesos: HUESOS_DEL_RIG,
  },
]

/** El nivel que corresponde a un valor de W. */
export const NIVEL_POR_W: Record<NivelW, NivelAnatomico> = {
  0: NIVELES_ANATOMICOS[0],
  1: NIVELES_ANATOMICOS[1],
  2: NIVELES_ANATOMICOS[2],
  3: NIVELES_ANATOMICOS[3],
  4: NIVELES_ANATOMICOS[4],
}

/**
 * Todo lo que se ve en un nivel, en una sola lista de identificadores.
 *
 * Sirve para lo que preguntaría cualquiera que audite esto: «¿qué se ve exactamente
 * en la capa 3?». Ninguna de las cinco devuelve una lista vacía, y ese es el mínimo
 * que hace que el eje tenga cinco escalones de verdad y no tres con dos huecos.
 */
export function estructurasDe(w: NivelW): string[] {
  const n = NIVEL_POR_W[w]
  return [...n.musculos, ...n.porcionesPasivas, ...n.articulaciones, ...n.huesos]
}

/** Si un músculo del catálogo se dibuja en este nivel. */
export function musculoVisibleEn(w: NivelW, musculoId: string): boolean {
  return NIVEL_POR_W[w].musculos.includes(musculoId)
}

/**
 * Los músculos del catálogo que no están en ningún nivel, y los que están en dos.
 *
 * El reparto entre superficial y profundo tiene que ser una partición: si un músculo
 * se cae de los dos lados desaparece del salón sin que nadie se entere, que es
 * exactamente la pérdida de información que el encargo prohíbe. Devuelve dos listas
 * vacías cuando el reparto está bien.
 */
export function musculosSinNivel(): { fuera: string[]; repetidos: string[] } {
  const cuenta = new Map<string, number>()
  for (const id of [...SUPERFICIALES, ...PROFUNDOS]) {
    cuenta.set(id, (cuenta.get(id) ?? 0) + 1)
  }
  const fuera = Object.keys(MUSCULO_POR_ID).filter((id) => !cuenta.has(id))
  const repetidos = [...cuenta].filter(([, n]) => n > 1).map(([id]) => id)
  return { fuera, repetidos }
}

/**
 * Los identificadores declarados aquí que NO existen en el catálogo real.
 *
 * Una lista vacía es la prueba de que este archivo no ha inventado taxonomía: cada
 * nombre se resuelve contra `MUSCULO_POR_ID`, `PORCION_POR_CLAVE`, `ARTICULACIONES` y
 * `ESQUELETO`. Un id mal escrito no rompe ningún tipo —son strings— y sin esto se
 * quedaría dentro para siempre, dibujando nada.
 */
export function estructurasDesconocidas(): string[] {
  const huesos = new Set(HUESOS_DEL_RIG)
  const articulaciones = new Set(TODAS_LAS_ARTICULACIONES)
  const malas: string[] = []
  for (const n of NIVELES_ANATOMICOS) {
    for (const id of n.musculos) if (!MUSCULO_POR_ID[id]) malas.push(`musculo:${id}`)
    for (const c of n.porcionesPasivas) if (!PORCION_POR_CLAVE[c]) malas.push(`porcion:${c}`)
    for (const a of n.articulaciones) if (!articulaciones.has(a)) malas.push(`articulacion:${a}`)
    for (const h of n.huesos) if (!huesos.has(h)) malas.push(`hueso:${h}`)
  }
  return [...new Set(malas)]
}
