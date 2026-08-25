/**
 * Taxonomía de categorías por acción articular y su equivalencia a grupos
 * musculares.
 *
 * Dos preguntas distintas, que antes vivían mezcladas en una lista de regex:
 *
 *   1. ¿Qué movimiento es?  → la CATEGORÍA (32 acciones articulares).
 *   2. ¿Qué parte estimula? → los APORTES de esa categoría a cada grupo.
 *
 * El volumen se cuenta en **moneda fraccionada**: el trabajo directo vale 1
 * serie y el indirecto 0,5 (Pelland et al., Sports Med 2026; 56(2):481-505).
 * Antes se contaba en directo, así que el PANEL medía por debajo: un peso
 * muerto rumano daba 1 a isquios y 0 a glúteos.
 *
 * Fuente de verdad de la tabla:
 * `Cerebro Alpha/wiki/estructura-excel/04-taxonomia-categorias.md` §3bis.
 */

export type Grupo =
  | 'Pecho'
  | 'Hombros'
  | 'Espalda'
  | 'Bíceps'
  | 'Tríceps'
  | 'Cuádriceps'
  | 'Isquios'
  | 'Glúteos'
  | 'Aductores'
  | 'Pantorrillas'
  | 'Abdomen'
  | 'Lumbares'

/** Orden de presentación en el PANEL y en el mapa de fatiga. */
export const ORDEN_GRUPOS: readonly Grupo[] = [
  'Pecho',
  'Hombros',
  'Espalda',
  'Bíceps',
  'Tríceps',
  'Cuádriceps',
  'Isquios',
  'Glúteos',
  'Aductores',
  'Pantorrillas',
  'Abdomen',
  'Lumbares',
]

/** Cuánto suma una serie de esta categoría al grupo: 1 directo, 0,5 indirecto. */
export type Factor = 1 | 0.5

export interface Aporte {
  readonly grupo: Grupo
  readonly factor: Factor
}

export const CATEGORIAS = [
  'BISAGRA DE CADERA',
  'EXTENSIÓN DE CADERA',
  'ABDUCCIÓN DE CADERA',
  'ADUCCIÓN DE CADERA',
  'ROTACIÓN DE CADERA',
  'SENTADILLA',
  'SENTADILLA UNILATERAL',
  'EXTENSIÓN DE RODILLA',
  'FLEXIÓN DE RODILLA',
  'FLEXIÓN PLANTAR',
  'DORSIFLEXIÓN',
  'EMPUJE HORIZONTAL',
  'EMPUJE INCLINADO',
  'EMPUJE VERTICAL',
  'APERTURA DE PECHO',
  'TRACCIÓN VERTICAL',
  'TRACCIÓN HORIZONTAL',
  'EXTENSIÓN DE HOMBRO',
  'RETRACCIÓN ESCAPULAR',
  'ABDUCCIÓN DE HOMBRO',
  'ABDUCCIÓN HORIZONTAL',
  'FLEXIÓN DE HOMBRO',
  'FLEXIÓN DE CODO',
  'EXTENSIÓN DE CODO',
  'ANTIEXTENSIÓN',
  'ANTIRROTACIÓN',
  'ANTIFLEXIÓN LATERAL',
  'FLEXIÓN DE TRONCO',
  'EXTENSIÓN LUMBAR',
  'PREV/REHAB',
  'ACONDICIONAMIENTO',
  'MOVILIDAD',
] as const

export type Categoria = (typeof CATEGORIAS)[number]

const directo = (grupo: Grupo): Aporte => ({ grupo, factor: 1 })
const indirecto = (grupo: Grupo): Aporte => ({ grupo, factor: 0.5 })

/**
 * Tabla de equivalencia categoría → grupos. Las tres últimas categorías no
 * suman volumen a propósito: son tejido, metabólico y rango, no hipertrofia.
 */
const EQUIVALENCIA: Readonly<Record<Categoria, readonly Aporte[]>> = {
  'BISAGRA DE CADERA': [directo('Isquios'), indirecto('Glúteos'), indirecto('Lumbares')],
  'EXTENSIÓN DE CADERA': [directo('Glúteos'), indirecto('Isquios')],
  'ABDUCCIÓN DE CADERA': [directo('Glúteos')],
  'ADUCCIÓN DE CADERA': [directo('Aductores')],
  'ROTACIÓN DE CADERA': [indirecto('Glúteos')],
  SENTADILLA: [directo('Cuádriceps'), indirecto('Glúteos'), indirecto('Aductores')],
  // El default es el vector de torso vertical: ver VARIANTES más abajo.
  'SENTADILLA UNILATERAL': [directo('Glúteos'), indirecto('Cuádriceps')],
  'EXTENSIÓN DE RODILLA': [directo('Cuádriceps')],
  'FLEXIÓN DE RODILLA': [directo('Isquios')],
  'FLEXIÓN PLANTAR': [directo('Pantorrillas')],
  DORSIFLEXIÓN: [indirecto('Pantorrillas')],
  'EMPUJE HORIZONTAL': [directo('Pecho'), indirecto('Tríceps'), indirecto('Hombros')],
  'EMPUJE INCLINADO': [directo('Pecho'), indirecto('Hombros'), indirecto('Tríceps')],
  'EMPUJE VERTICAL': [directo('Hombros'), indirecto('Tríceps'), indirecto('Pecho')],
  'APERTURA DE PECHO': [directo('Pecho'), indirecto('Hombros')],
  'TRACCIÓN VERTICAL': [directo('Espalda'), indirecto('Bíceps')],
  'TRACCIÓN HORIZONTAL': [directo('Espalda'), indirecto('Bíceps'), indirecto('Hombros')],
  'EXTENSIÓN DE HOMBRO': [directo('Espalda'), indirecto('Tríceps')],
  'RETRACCIÓN ESCAPULAR': [directo('Espalda'), indirecto('Hombros')],
  'ABDUCCIÓN DE HOMBRO': [directo('Hombros')],
  'ABDUCCIÓN HORIZONTAL': [directo('Hombros'), indirecto('Espalda')],
  'FLEXIÓN DE HOMBRO': [directo('Hombros'), indirecto('Pecho')],
  'FLEXIÓN DE CODO': [directo('Bíceps')],
  'EXTENSIÓN DE CODO': [directo('Tríceps')],
  ANTIEXTENSIÓN: [directo('Abdomen')],
  ANTIRROTACIÓN: [directo('Abdomen')],
  'ANTIFLEXIÓN LATERAL': [directo('Abdomen'), indirecto('Glúteos')],
  'FLEXIÓN DE TRONCO': [directo('Abdomen')],
  'EXTENSIÓN LUMBAR': [directo('Lumbares'), indirecto('Glúteos'), indirecto('Isquios')],
  'PREV/REHAB': [],
  ACONDICIONAMIENTO: [],
  MOVILIDAD: [],
}

/**
 * La variante de ejecución redistribuye el estímulo dentro de un mismo patrón.
 *
 * En la sentadilla unilateral el músculo primario cambia según el ángulo del
 * torso, la posición de la carga y la dorsiflexión disponible (análisis de
 * Bryan, 2026-08-13): con el torso vertical el centro se corre adelante y crece
 * el brazo de momento externo en la cadera, así que manda el glúteo; con el
 * torso inclinado manda el aductor. **En ninguno de los tres vectores el
 * cuádriceps es el primario.**
 *
 * La variante NO es una categoría: el patrón es el mismo en los tres. Vive en
 * el paréntesis del nombre, que desde el 2026-08-15 es obligatorio declarar en
 * toda búlgara, zancada y sentadilla a una pierna.
 */
const VARIANTES: Partial<Record<Categoria, readonly { patron: RegExp; aportes: readonly Aporte[] }[]>> = {
  /**
   * Los combinados cobran por las DOS mitades.
   *
   * «PRESS MILITAR + CURL BÍCEPS» estaba en FLEXIÓN DE CODO, así que solo
   * acreditaba bíceps: la mitad del press desaparecía del recuento. No es un
   * ejercicio de bíceps con un adorno — cada repetición hace las dos cosas y
   * las dos son trabajo efectivo, así que las dos van a 1.
   *
   * El tríceps entra a 0,5: acompaña la extensión de codo del press, no la
   * dirige.
   */
  'FLEXIÓN DE CODO': [
    {
      patron: /PRESS MILITAR|PRESS HOMBRO|EMPUJE VERTICAL/,
      aportes: [directo('Bíceps'), directo('Hombros'), indirecto('Tríceps')],
    },
  ],
  'SENTADILLA UNILATERAL': [
    { patron: /TORSO INCLINADO/, aportes: [directo('Aductores'), indirecto('Glúteos')] },
    { patron: /TORSO VERTICAL/, aportes: [directo('Glúteos'), indirecto('Cuádriceps')] },
    { patron: /IPSILATERAL/, aportes: [directo('Glúteos'), indirecto('Cuádriceps')] },
  ],
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

/** Índice por forma normalizada, para tolerar acentos y mayúsculas de la base. */
const POR_NOMBRE = new Map<string, Categoria>(
  CATEGORIAS.map((categoria) => [normalizar(categoria), categoria]),
)

/** La categoría canónica equivalente, o `undefined` si es de la taxonomía vieja. */
export function categoriaCanonica(categoria: string): Categoria | undefined {
  return POR_NOMBRE.get(normalizar(categoria))
}

/**
 * Compatibilidad con la taxonomía vieja mientras quede sin migrar.
 *
 * La base todavía tiene categorías por grupo muscular (`AISLAMIENTO GLÚTEOS`) y
 * categorías sucias con basura de programación (`EMPUJE PECHO (REST-PAUSE)`,
 * `GLÚTEO FINISHER`, `PRIORIDAD 1`). Sin esta capa, el volumen de esos
 * microciclos desaparecería del PANEL el día que se despliegue la tabla nueva.
 *
 * Devuelve **solo el aporte directo**: no se inventa el indirecto sobre una
 * categoría que no dice qué movimiento es.
 *
 * Se mira en tres pasos, **nunca sobre el texto de categoría y nombre juntos**:
 * mezclarlos hace que «Jalón al pecho» calce con el patrón de pecho antes que
 * con el de espalda.
 *
 *   1. La categoría, si nombra un grupo o un patrón claro (`DELTOIDES
 *      POSTERIORES` + «Face pull» es hombro, no espalda).
 *   2. El nombre del ejercicio.
 *   3. Las categorías ambiguas por construcción (`DOMINANTE DE CADERA`, que
 *      tanto vale para un peso muerto rumano como para un empuje de cadera).
 *      Van al final justo para que el nombre las gane.
 *
 * Dentro de cada paso gana el primer patrón, así que el orden de la lista
 * importa: `Espalda` va antes que `Pecho` por la misma razón del jalón.
 */
const HEREDADAS: readonly { grupo: Grupo; patron: RegExp }[] = [
  { grupo: 'Espalda', patron: /TRACCION|ESPALDA|REMO|JALON|PULLOVER|PULLDOWN|FACE PULL|DORSAL|TRAPECIO/ },
  { grupo: 'Pecho', patron: /PECHO|PECTORAL|PRESS (PLANO|INCLINADO|DE BANCA)|APERTURA/ },
  { grupo: 'Hombros', patron: /EMPUJE VERTICAL|DELTOIDES|ELEVACION(ES)? LATERAL|PRESS MILITAR|HOMBRO/ },
  { grupo: 'Bíceps', patron: /BICEPS|CURL MARTILLO/ },
  { grupo: 'Tríceps', patron: /TRICEPS|EXTENSION DE CODO/ },
  { grupo: 'Cuádriceps', patron: /SENTADILLA|CUADRICEPS|PRENSA|EXTENSION (DE )?RODILLA|DOMINANTE DE RODILLA|PIERNA UNILATERAL|ZANCADA|BULGARA/ },
  { grupo: 'Isquios', patron: /BISAGRA|ISQUIOS|FEMORAL|PESO MUERTO/ },
  { grupo: 'Glúteos', patron: /GLUTEO|HIP THRUST|ABDUCCION|HIPEREXTENSION/ },
  { grupo: 'Aductores', patron: /ADUCTOR|ADUCCION/ },
  { grupo: 'Pantorrillas', patron: /PANTORRILLA|GEMELO|SOLEO/ },
  { grupo: 'Abdomen', patron: /ABDOMEN|CORE|PLANCHA|PALLOF/ },
  { grupo: 'Lumbares', patron: /LUMBAR/ },
]

/** Categorías que no deciden por sí solas: el nombre del ejercicio manda. */
const AMBIGUAS: readonly { grupo: Grupo; patron: RegExp }[] = [
  { grupo: 'Glúteos', patron: /DOMINANTE DE CADERA/ },
]

function buscar(texto: string, lista: readonly { grupo: Grupo; patron: RegExp }[]): Grupo | undefined {
  if (!texto) return undefined
  return lista.find((h) => h.patron.test(texto))?.grupo
}

function aportesHeredados(categoria: string, nombreEjercicio: string): readonly Aporte[] {
  const cat = normalizar(categoria)
  const grupo =
    buscar(cat, HEREDADAS) ?? buscar(normalizar(nombreEjercicio), HEREDADAS) ?? buscar(cat, AMBIGUAS)
  return grupo ? [directo(grupo)] : []
}

/**
 * Qué grupos estimula un ejercicio y con qué peso. Devuelve `[]` cuando la
 * categoría no suma volumen (PREV/REHAB, acondicionamiento, movilidad) o cuando
 * no se pudo reconocer.
 */
export function aportesDeCategoria(
  categoria: string,
  nombreEjercicio = '',
): readonly Aporte[] {
  const canonica = categoriaCanonica(categoria)
  if (!canonica) return aportesHeredados(categoria, nombreEjercicio)

  // Si el nombre declara una variante de ejecución, manda sobre el reparto
  // por defecto de la categoría.
  const variantes = VARIANTES[canonica]
  if (variantes) {
    const nombre = normalizar(nombreEjercicio)
    const declarada = variantes.find((v) => v.patron.test(nombre))
    if (declarada) return declarada.aportes
  }
  return EQUIVALENCIA[canonica]
}

/** El grupo que recibe el trabajo directo. Para etiquetar, no para contar. */
export function grupoPrimario(categoria: string, nombreEjercicio = ''): Grupo | undefined {
  return aportesDeCategoria(categoria, nombreEjercicio).find((a) => a.factor === 1)?.grupo
}

/**
 * Dónde cae el pico de exigencia externa de cada categoría.
 *
 * Regla, de `Cerebro Alpha/wiki/conocimiento/perfiles-de-resistencia.md` §2.1: con
 * peso libre la carga tira siempre vertical, así que el brazo de momento externo
 * es la distancia HORIZONTAL entre la articulación y la carga. **El pico está
 * donde el segmento queda más horizontal.**
 *
 * Para qué sirve: decidir si el cue necesita el ancla de «parciales en reserva».
 * Lo que hace ambigua una serie no es dónde está el pico, sino si al fallar
 * quedan parciales — y eso pasa en `medio` igual que en `final`. En `inicio`
 * no: si no puedes iniciar la repetición, no hay repetición.
 *
 * ⚠ Una categoría no fija del todo el perfil: la leva de la máquina lo modifica
 * (§7.1: las levas no igualan la curva humana). Cuatro entradas siguen marcadas
 * para revisión del coach — sobre todo APERTURA DE PECHO, que con mancuerna pica
 * abajo y en pec deck pica al cierre.
 *
 * ## Dos resueltas el 2026-08-25, y la primera enseña algo
 *
 * **FLEXIÓN DE RODILLA.** La regla de §2.1 sola dice `inicio`: la tibia está más
 * horizontal con la rodilla extendida, tanto sentado como tumbado. Pero el coach,
 * preguntado por cómo falla la gente en SU máquina, responde que «sigue moviendo
 * un trozo sin llegar a cerrar todo el ROM». **La leva no deja que la resistencia
 * caiga**, así que el punto duro está al cerrar y quedan parciales. Va `final`.
 *
 * Es el aviso de §7.1 hecho caso concreto: en máquina, la regla de la palanca no
 * basta y **manda la observación**. Se intentó zanjarlo con datos —dispersión del
 * RIR declarado por categoría, 186 series— y no discrimina: los ejercicios de
 * fallo limpio y los de fallo con parciales salen mezclados, porque el RIR
 * declarado sigue a la prescripción y no a la sensación.
 *
 * El reparto de la cartera era 14 activos sentado y 11 tumbado —los dos brazos de
 * Maeo 2021 (PMID 33009197)—, y la respuesta vale para los dos: no cambia dónde
 * se falla, cambia a qué longitud se carga el isquio.
 *
 * **TRACCIÓN HORIZONTAL.** Aquí la regla y la observación coinciden: al tirar, el
 * antebrazo va hacia la horizontal y el brazo de momento sobre el codo CRECE, así
 * que el punto duro es el cierre. Se falla sin tocar el torso, dejando recorrido.
 * Vale igual en peso libre (14 activos) y en polea o máquina (21): la carga tira
 * distinto pero el fallo ocurre en el mismo sitio.
 *
 * Las categorías sin entrada son isométricas o no van al fallo.
 */
export type PicoDeExigencia = 'inicio' | 'medio' | 'final'

export const PICO_DE_EXIGENCIA: Partial<Record<Categoria, PicoDeExigencia>> = {
  'BISAGRA DE CADERA': 'inicio',
  'EXTENSIÓN DE CADERA': 'final',
  'ABDUCCIÓN DE CADERA': 'final', // ⚠ revisar: máquina sentado vs polea
  'ADUCCIÓN DE CADERA': 'final', // ⚠ revisar: la leva manda
  'ROTACIÓN DE CADERA': 'medio',
  SENTADILLA: 'inicio',
  'SENTADILLA UNILATERAL': 'inicio',
  'EXTENSIÓN DE RODILLA': 'final',
  'FLEXIÓN DE RODILLA': 'final', // confirmado por el coach 2026-08-25, ver nota abajo
  'FLEXIÓN PLANTAR': 'inicio',
  DORSIFLEXIÓN: 'final',
  'EMPUJE HORIZONTAL': 'inicio',
  'EMPUJE INCLINADO': 'inicio',
  'EMPUJE VERTICAL': 'inicio',
  'APERTURA DE PECHO': 'inicio', // ⚠ revisar: mancuerna sí, pec deck no
  'TRACCIÓN VERTICAL': 'inicio',
  'TRACCIÓN HORIZONTAL': 'final', // confirmado 2026-08-25: se falla sin cerrar, en barra y en polea
  'EXTENSIÓN DE HOMBRO': 'inicio',
  'RETRACCIÓN ESCAPULAR': 'final',
  'ABDUCCIÓN DE HOMBRO': 'medio',
  'ABDUCCIÓN HORIZONTAL': 'final',
  'FLEXIÓN DE HOMBRO': 'medio',
  'FLEXIÓN DE CODO': 'medio',
  'EXTENSIÓN DE CODO': 'medio', // ⚠ revisar: press francés ≠ polea
  'FLEXIÓN DE TRONCO': 'medio',
  'EXTENSIÓN LUMBAR': 'inicio',
}

/**
 * Categorías con carga axial. El ancla **nunca** se inyecta aquí.
 *
 * El ancla dice «acaba cuando no puedas mover la carga»; en un compuesto axial
 * eso es una instrucción de moler hasta quedarse clavado bajo la barra.
 * Seguridad es el rango 1 de la jerarquía del método.
 *
 * Hoy todas caen en `inicio` por geometría, así que la exclusión es redundante.
 * Está escrita para que la seguridad **no dependa de esa coincidencia**: si
 * mañana alguien recategoriza, el ancla sigue sin aparecer donde no debe.
 */
const AXIALES: ReadonlySet<Categoria> = new Set<Categoria>([
  'SENTADILLA',
  'SENTADILLA UNILATERAL',
  'BISAGRA DE CADERA',
  'EMPUJE VERTICAL',
  'EXTENSIÓN LUMBAR',
])

/** El ancla de «parciales en reserva», en la redacción canónica del método. */
export const ANCLA_PARCIALES =
  'LA SERIE ACABA CUANDO NO PUEDAS MOVER LA CARGA, NO CUANDO PIERDAS EL RANGO'

/**
 * Marcas de que la prescripción ya declara una técnica o un recorrido pautado.
 *
 * Se busca en la frase y en el cue, que es donde viven hoy —no hay campo—.
 * `parcial` cubre los dos sentidos opuestos que tiene esa palabra en el
 * vocabulario del método, y a propósito: en los dos el ancla sobra.
 */
const MARCAS_DE_TECNICA =
  /myo[- ]?reps?|rest[- ]?pause|restpause|parcial|drop *set|series? descendente|isometr|iso *hold|escalera de exposici/i

/**
 * Si el ejercicio ya trae técnica o recorrido declarados por el coach.
 *
 * Existe para que el ancla no contradiga la prescripción. «Parciales» significa
 * dos cosas opuestas aquí —sobrecarga al final, o recorrido reducido como
 * regresión— y el ancla estorba en ambas, pero por motivos distintos:
 *
 * - Con parciales de SOBRECARGA, el coach ya dice que se pase del fallo técnico;
 *   el ancla repite peor lo que la frase dice mejor.
 * - Con recorrido REDUCIDO —una escalera de exposición, «tira solo hasta la
 *   mitad»— el ancla diría lo contrario que la prescripción, y en un ejercicio
 *   programado a ROM corto para reexposición eso toca seguridad, que es el
 *   rango 1 de la jerarquía.
 */
export function tieneTecnicaDeclarada(cues: string, prescripcion: string): boolean {
  return MARCAS_DE_TECNICA.test(`${cues} ${prescripcion}`)
}

/** Si esta categoría necesita el ancla: pico distinto de `inicio` y no axial. */
export function necesitaAncla(categoria: string): boolean {
  const canonica = categoriaCanonica(categoria)
  if (!canonica || AXIALES.has(canonica)) return false
  const pico = PICO_DE_EXIGENCIA[canonica]
  return pico === 'medio' || pico === 'final'
}

/**
 * El cue que ve el asesorado, con el ancla puesta donde toca.
 *
 * **Se compone, no se guarda.** Guardar el ancla en el campo `cues` la
 * convertiría en una «nota técnica nueva» a ojos del contador de
 * estandarización, y reiniciaría la racha de toda una familia de ejercicios a
 * la vez, en silencio. Y sería almacenar un dato derivado, que es como
 * `rirObjetivo` acabó diciendo 2 mientras el texto decía «(RIR 1)».
 */
export function cuesConAncla(categoria: string, cues: string, prescripcion = ''): string {
  if (!necesitaAncla(categoria)) return cues
  // Ante la duda, NO inyectar. Un ancla que falta deja las cosas como están; una
  // que sobra contradice al coach delante del asesorado.
  if (tieneTecnicaDeclarada(cues, prescripcion)) return cues
  const limpio = cues.trim()
  if (!limpio) return ANCLA_PARCIALES
  const sinPuntoFinal = limpio.replace(/[;.]\s*$/, '')
  return `${sinPuntoFinal}; ${ANCLA_PARCIALES}`
}
