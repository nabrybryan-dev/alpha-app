/**
 * ────────────────────────────────────────────────────────────────────────────
 * REPARTO FRACCIONADO: QUÉ GRUPOS ESTIMULA CADA EJERCICIO
 * ────────────────────────────────────────────────────────────────────────────
 * `grupoDeCategoria` (`domain/fatiga.ts`) manda cada ejercicio a **un solo
 * grupo**: moneda **directa**, las indirectas valen cero. Este módulo es la otra
 * moneda —**fraccionada**, las indirectas valen 0,5— que es la que mejor predice
 * adaptaciones según Pelland et al. (Sports Med 2026, 67 estudios).
 *
 * ⚠️ **Todavía no está conectado a nada.** Escribirlo no cambia lo que la app
 * cuenta hoy; el cambio de moneda es un paso aparte y hay que medir el salto por
 * grupo antes de tocar ningún landmark.
 *
 * Diseño, evidencia y cifras medidas contra la base:
 *   `docs/specs/2026-08-12-reparto-de-volumen-por-zona-diseno.md`
 *   `docs/specs/2026-08-12-biomecanica-de-la-contribucion.md`
 *
 * La escala tiene **tres valores y solo tres**:
 *
 *   1     grupo primario: el ejercicio existe para entrenarlo
 *   0,5   sinergista relevante: recibe estímulo real, no es el objetivo
 *   0     estabilizador o participación trivial: no aparece en la tabla
 *
 * El 0,5 no es una estimación nuestra, es el valor que usa la literatura. No
 * añadir granularidad (0,3 · 0,65): sería criterio disfrazado de dato.
 */

export type Grupo =
  | 'Pecho'
  | 'Hombros'
  | 'Espalda'
  | 'Erectores'
  | 'Bíceps'
  | 'Tríceps'
  | 'Cuádriceps'
  | 'Isquios'
  | 'Glúteos'
  | 'Aductores'
  | 'Pantorrillas'
  | 'Tibial'
  | 'Abdomen'

export type Movimiento =
  | 'fondos'
  | 'triceps'
  | 'curl-femoral'
  | 'zancada-split'
  | 'subida-al-cajon'
  | 'hip-thrust'
  | 'bisagra-rodilla-flexionada'
  | 'bisagra-rodilla-extendida'
  | 'extension-cadera'
  | 'abduccion'
  | 'aduccion'
  | 'sentadilla'
  | 'prensa'
  | 'extension-rodilla'
  | 'pantorrilla'
  | 'tibial'
  | 'apertura'
  | 'press-horizontal'
  | 'press-vertical'
  | 'elevacion-lateral'
  | 'deltoides-posterior'
  | 'pullover'
  | 'remo'
  | 'jalon'
  | 'trapecio'
  | 'curl-biceps'
  | 'core'

/** Cuánto de una serie de este ejercicio le llega a cada grupo. */
export type Contribucion = Partial<Record<Grupo, 1 | 0.5>>

/**
 * Catálogo cerrado, en **orden de evaluación**: el primer patrón que calza gana.
 * Se evalúa sobre "CATEGORÍA NOMBRE" en mayúsculas y sin diacríticos, igual que
 * `grupoDeCategoria`, porque la clave tiene que ser el **movimiento** y no la
 * categoría: en la base hay 210 categorías distintas para doce grupos, con 23
 * variantes solo de glúteo.
 *
 * ⚠️ **El orden es la parte frágil de esta tabla.** Cada entrada colocada fuera
 * de sitio se come ejercicios de la siguiente. Los cuatro casos que ya mordieron
 * están marcados abajo con «ORDEN:» y cubiertos por tests.
 */
const MOVIMIENTOS: { movimiento: Movimiento; patron: RegExp; excluye?: RegExp }[] = [
  // ORDEN: antes que `triceps`, que contenía FONDO y se tragaba los fondos en
  // paralelas —un compuesto de pecho— contándolos como tríceps puro.
  { movimiento: 'fondos', patron: /FONDO|PARALELAS|DIPS/ },
  { movimiento: 'triceps', patron: /TRICEPS|EXTENSION DE CODO|COPA/ },
  { movimiento: 'curl-femoral', patron: /CURL FEMORAL|FEMORAL|ISQUIOS|NORDICO/ },
  // ORDEN: antes que `zancada-split`, que lleva CAJON y STEP UP en su patrón y
  // se las llevaría enteras. El coach separó los dos el 2026-08-12: la subida al
  // cajón y la zancada inversa reparten al revés que la búlgara.
  {
    movimiento: 'subida-al-cajon',
    patron: /STEP ?UP|SUBIDA AL? CAJON|ZANCADA INVERSA|ZANCADA POSTERIOR/,
    excluye: /ATERRIZAJE|DROP|REACTIVA|RECEPCION/,
  },
  // ORDEN: antes que `sentadilla`, o la «sentadilla búlgara» contaría como
  // sentadilla bilateral. `excluye` deja fuera la mecánica de aterrizaje, que
  // dice «cajón» y no es trabajo de fuerza.
  {
    movimiento: 'zancada-split',
    patron: /ZANCADA|BULGARA|SPLIT|CAJON|ESTOCADA/,
    excluye: /ATERRIZAJE|DROP|REACTIVA|RECEPCION/,
  },
  { movimiento: 'hip-thrust', patron: /HIP THRUST|PUENTE|EMPUJE DE CADERA/ },
  // ORDEN: las dos ramas de bisagra que siguen van antes que `extension-cadera`
  // porque sus nombres contienen literalmente «extensión de cadera» («extensión
  // de cadera en banco 45°», «extensión de cadera entre piernas»).
  {
    movimiento: 'bisagra-rodilla-flexionada',
    patron: /BANCO 45|BANCO ROMANO|SILLA ROMANA|HIPEREXTENSION|EXTENSION LUMBAR/,
  },
  { movimiento: 'bisagra-rodilla-extendida', patron: /PULL ?-?THROUGH|ENTRE PIERNAS/ },
  { movimiento: 'extension-cadera', patron: /PATADA|EXTENSION DE CADERA|KICKBACK/ },
  { movimiento: 'abduccion', patron: /ABDUCCION|GLUTEO MEDIO/ },
  { movimiento: 'aduccion', patron: /ADUCCION|ADUCTOR/ },
  // ORDEN: el rumano y el stiff se reconocen antes que `PESO MUERTO`, o el
  // patrón genérico se los llevaría a rodilla flexionada.
  {
    movimiento: 'bisagra-rodilla-extendida',
    patron: /RUMANO|STIFF|PIERNAS? (RECTAS?|RIGIDAS?)/,
  },
  { movimiento: 'bisagra-rodilla-flexionada', patron: /PESO MUERTO|RACK PULL/ },
  {
    movimiento: 'bisagra-rodilla-extendida',
    patron: /BUENOS DIAS|GOOD MORNING|SWING|CADENA POSTERIOR|BISAGRA/,
  },
  { movimiento: 'sentadilla', patron: /SENTADILLA|HACK|PENDULO/ },
  { movimiento: 'prensa', patron: /PRENSA/ },
  {
    movimiento: 'extension-rodilla',
    patron: /EXTENSION (DE )?(RODILLA|CUADRICEPS)|CUADRICEPS|VASTO/,
  },
  { movimiento: 'pantorrilla', patron: /PANTORRILLA|GEMELO|SOLEO/ },
  { movimiento: 'tibial', patron: /TIBIAL|ARCO PLANTAR/ },
  { movimiento: 'apertura', patron: /APERTURA|CRUCE|PECK|CONTRACTOR/ },
  {
    movimiento: 'press-horizontal',
    patron:
      /PRESS (DE BANCA|PLANO|INCLINADO|DE PECHO)|EMPUJE (HORIZONTAL|INCLINADO|PECHO)|PECTORAL|PECHO/,
  },
  {
    movimiento: 'press-vertical',
    patron: /PRESS MILITAR|EMPUJE VERTICAL|PRESS DE HOMBRO|DELTOIDES FRONTAL/,
  },
  { movimiento: 'elevacion-lateral', patron: /ELEVACION(ES)? LATERAL|DELTOIDES LATERAL/ },
  {
    movimiento: 'deltoides-posterior',
    patron: /PAJARO|DELTOIDES POSTERIOR|FACE PULL|HOMBRO POSTERIOR/,
  },
  { movimiento: 'pullover', patron: /PULLOVER/ },
  { movimiento: 'remo', patron: /REMO|TRACCION HORIZONTAL/ },
  { movimiento: 'jalon', patron: /JALON|DOMINADA|TRACCION VERTICAL|ESPALDA/ },
  { movimiento: 'trapecio', patron: /TRAPECIO|ENCOGIMIENTO/ },
  { movimiento: 'curl-biceps', patron: /CURL|BICEPS/ },
  {
    movimiento: 'core',
    patron:
      /PLANCHA|ABDOMEN|CORE|OBLICUO|ANTIRROTACION|ANTI-ROTACION|ANTIEXTENSION|ANTI-EXTENSION|MCGILL|PALLOF/,
  },
]

/**
 * Lo que **no** suma volumen de hipertrofia: prevención, rehabilitación,
 * movilidad, cardio, pliometría e isometrías de sostén.
 *
 * ⚠️ **Se comprueba al FINAL, después del catálogo, y no es negociable.** La
 * primera versión de este archivo lo puso delante, por lo que parecía más
 * seguro, y medido contra la base **se tragaba 129 series de trabajo real**: el
 * `core` caía de 236 a 185 porque una plancha lleva «isometría» o «estabilidad»
 * en el nombre, y la sentadilla perdía 17 por lo mismo. Estas palabras aparecen
 * dentro de ejercicios legítimos; solo valen como red de seguridad para lo que
 * ningún patrón del catálogo reconoció.
 *
 * El caso que sí había que atajar —«drop squat desde cajón bajo», que calzaba
 * con `zancada-split` por la palabra «cajón»— se resuelve con el `excluye` de
 * ese patrón concreto, no castigando a toda la tabla.
 */
const NO_CUENTA =
  /PREV|REHAB|MOVILIDAD|CARDIO|BICICLETA|CAMINATA|ROTACION EXTERNA|ESCAPULAR|EQUILIBRIO|ISOMETRIA|SALTO|POGO|ATERRIZAJE|SUSPENSION|POSTURAL|ESTABILIDAD/

/**
 * El reparto por movimiento. Cada uno tiene **exactamente un** grupo primario:
 * un ejercicio sin primario no existe, y hay un test que lo vigila.
 */
export const CONTRIBUCION: Record<Movimiento, Contribucion> = {
  fondos: { Pecho: 1, Tríceps: 0.5, Hombros: 0.5 },
  triceps: { Tríceps: 1 },
  'curl-femoral': { Isquios: 1 },
  'zancada-split': { Cuádriceps: 1, Glúteos: 0.5 },
  // Criterio del coach (2026-08-12): la subida al cajón y la zancada inversa son
  // más cadera-dominantes que la búlgara, así que reparten al revés. Son 22
  // series.
  //
  // ⚠️ Tensión conocida con la taxonomía: dos de los cuatro nombres de esta
  // familia se llaman a sí mismos «dominante de rodilla» en la base. El coach
  // decidió con el gesto delante, no con la etiqueta; queda escrito por si algún
  // día se revisa.
  'subida-al-cajon': { Glúteos: 1, Cuádriceps: 0.5 },
  'hip-thrust': { Glúteos: 1, Isquios: 0.5 },
  // Criterio del coach (2026-08-12) contra la Regla 1 de la biomecánica, que
  // apuntaba a rodilla extendida para el banco romano. Va marcado a propósito.
  'bisagra-rodilla-flexionada': { Glúteos: 1, Isquios: 0.5, Cuádriceps: 0.5, Erectores: 0.5 },
  'bisagra-rodilla-extendida': { Isquios: 1, Glúteos: 0.5, Erectores: 0.5 },
  'extension-cadera': { Glúteos: 1 },
  abduccion: { Glúteos: 1 },
  aduccion: { Aductores: 1 },
  // El aductor mayor tiene a 90° de flexión de cadera un brazo de momento
  // extensor de 5,7–6,1 cm, por delante del glúteo (3,1–3,3). Dejarlo fuera no
  // era simplificar, era repartir mal.
  sentadilla: { Cuádriceps: 1, Glúteos: 0.5, Aductores: 0.5 },
  prensa: { Cuádriceps: 1, Glúteos: 0.5, Aductores: 0.5 },
  'extension-rodilla': { Cuádriceps: 1 },
  pantorrilla: { Pantorrillas: 1 },
  tibial: { Tibial: 1 },
  apertura: { Pecho: 1 },
  'press-horizontal': { Pecho: 1, Tríceps: 0.5, Hombros: 0.5 },
  'press-vertical': { Hombros: 1, Tríceps: 0.5 },
  'elevacion-lateral': { Hombros: 1 },
  'deltoides-posterior': { Hombros: 1, Espalda: 0.5 },
  pullover: { Espalda: 1, Pecho: 0.5 },
  // El remo es uno de los mayores contribuyentes al deltoides posterior y el
  // primer borrador lo omitía. Son 372 series: sin esto el hombro se subestima.
  remo: { Espalda: 1, Bíceps: 0.5, Hombros: 0.5 },
  jalon: { Espalda: 1, Bíceps: 0.5 },
  trapecio: { Espalda: 1 },
  'curl-biceps': { Bíceps: 1 },
  core: { Abdomen: 1 },
}

/** Cómo se ejecuta, a efectos de **impuesto de estabilización** y de nada más. */
export type Implemento = 'libre-bilateral' | 'libre-unilateral' | 'guiado'

const GUIADO = /SMITH|MAQUINA|MULTIPOWER|GUIAD|POLEA|PRENSA|HACK|PENDULO|BANDA/
const LIBRE = /BARRA|MANCUERNA|KETTLEBELL|PESA RUSA|DISCO|LANDMINE/
const UNILATERAL = /UNILATERAL|A UNA (MANO|PIERNA)|BULGARA|ZANCADA|ESTOCADA|STEP ?UP|SUBIDA AL? CAJON/

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

/**
 * Qué movimiento es, o `undefined` si no cuenta para hipertrofia o no se
 * reconoce. Medido contra las 5.249 series de la base: **0,8 % sin clasificar**
 * y 1,8 % en «no cuenta», que es lo correcto.
 */
export function reconocerMovimiento(categoria: string, nombre = ''): Movimiento | undefined {
  const texto = normalizar(`${categoria} ${nombre}`)
  const entrada = MOVIMIENTOS.find(
    (m) => m.patron.test(texto) && !(m.excluye?.test(texto) ?? false),
  )
  return entrada?.movimiento
}

/**
 * Distingue las dos razones de que un ejercicio no reparta volumen: que **no
 * deba** contar (prev, rehab, movilidad, cardio, pliometría) o que el catálogo
 * no lo reconozca, que es un agujero a tapar. Medido contra la base: 1,8 % de lo
 * primero y **0,8 % de lo segundo**.
 */
export function motivoSinContribucion(
  categoria: string,
  nombre = '',
): 'no-cuenta' | 'sin-clasificar' | undefined {
  if (reconocerMovimiento(categoria, nombre)) return undefined
  return NO_CUENTA.test(normalizar(`${categoria} ${nombre}`)) ? 'no-cuenta' : 'sin-clasificar'
}

/**
 * Con qué implemento se ejecuta. **Por defecto `guiado`**, que es el
 * conservador: no infla erectores con trabajo que quizá no los cargó. Hay 269
 * nombres en la base que no permiten distinguirlo y clasificarlos a mano sería
 * gastar criterio clínico en una variable de segundo orden.
 *
 * Lo guiado gana sobre lo libre: una «búlgara en Smith» lleva la palabra barra y
 * es unilateral, pero la máquina ya le quitó la demanda de estabilización.
 */
export function implementoDeEjercicio(categoria: string, nombre = ''): Implemento {
  const texto = normalizar(`${categoria} ${nombre}`)
  if (GUIADO.test(texto)) return 'guiado'
  if (!LIBRE.test(texto)) return 'guiado'
  return UNILATERAL.test(texto) ? 'libre-unilateral' : 'libre-bilateral'
}

/**
 * El reparto completo de una serie de este ejercicio, ya con el modificador de
 * implemento aplicado. Devuelve **un objeto nuevo**: la tabla no se puede mutar
 * desde fuera.
 *
 * ⚠️ El modificador toca **solo estabilizadores**, nunca el grupo primario ni
 * sus sinergistas. El implemento cambia quién estabiliza —el remo libre da
 * +34 % de erector espinal que el mismo remo en máquina— pero un metaanálisis
 * de peso libre contra máquina **no encontró diferencias en hipertrofia**.
 */
export function contribucionDeEjercicio(categoria: string, nombre = ''): Contribucion {
  const movimiento = reconocerMovimiento(categoria, nombre)
  if (!movimiento) return {}
  const base: Contribucion = { ...CONTRIBUCION[movimiento] }
  const implemento = implementoDeEjercicio(categoria, nombre)
  if (implemento === 'libre-bilateral') return { ...base, Erectores: subirMedio(base.Erectores) }
  if (implemento === 'libre-unilateral') return { ...base, Abdomen: subirMedio(base.Abdomen) }
  return base
}

/** Sube medio punto sin pasar de 1, que es el tope de la escala. */
function subirMedio(actual: 1 | 0.5 | undefined): 1 | 0.5 {
  return actual === undefined ? 0.5 : 1
}
