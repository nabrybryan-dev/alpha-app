// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).

/**
 * El limpiador de la charla con modelo externo (DeepSeek). PURO: sin red, sin base, sin pantalla.
 *
 * Qué quita de la frase ANTES de que salga del servidor, y con qué lo cambia:
 *   correos (también dictados: «x arroba y punto com») → [CORREO] · teléfonos y números largos → [TELEFONO] · peso,
 *   edad y medidas (en cifras o en letras) → [PESO] [EDAD] [MEDIDA] · cédula con puntos → [DOCUMENTO] · @usuario →
 *   [USUARIO] · dirección (calle, carrera, cra, cll, avenida + número) → [DIRECCION] · nombres → [NOMBRE].
 *
 * NOMBRES (H1 del informe del custodio, 11-nov): se tapan por cuatro caminos, de más a propósito (falla seguro):
 *  a) toda palabra con mayúscula inicial que NO abre frase (ni va tras «Dr.»); y dos o más seguidas, aunque abran
 *     frase (nombre y apellido). Las siglas de hasta 4 letras en mayúsculas (RIR, RM, PMID, DOMS) no se tocan.
 *     Compromiso aceptado: también sale el apellido de un autor («Schoenfeld») o un lugar.
 *  b) «soy X», «me llamo x», «mi esposa/hijo/coach/médico… x» sin exigir mayúscula.
 *  c) la lista `NOMBRES_COMUNES` (con tilde o sin ella, con mayúscula o sin ella) y los que pase quien llama.
 *
 * LÍMITES, y no se disimulan:
 *  - Un nombre en minúscula FUERA de esos patrones («entreno con zulema») no se puede garantizar. Tampoco un nombre
 *    suelto que ABRA la frase («Zacarías pregunta…») ni un correo dictado con el usuario en varias palabras.
 *    Lo único estructural es no mandar texto libre; esto solo baja el riesgo.
 *  - Las cifras se quitan de más a propósito («40 kilos» de una carga también sale): ante la duda, se tapa.
 *  - Quita lo que reconoce; no certifica que la frase quede sin datos personales.
 */
export type TipoQuitado = 'correo' | 'telefono' | 'peso' | 'edad' | 'medida' | 'nombre' | 'usuario' | 'documento' | 'direccion'

export interface ResultadoLimpieza {
  texto: string
  /** Cuántas cosas de cada tipo se tapó. Solo conteos: nunca lo que había. */
  quitado: Record<TipoQuitado, number>
  /** Los tipos que se tapó, para el registro del envío. */
  tipos: TipoQuitado[]
}

/** Nombres de pila frecuentes en español. Es una red mínima, no una garantía (ver arriba). */
export const NOMBRES_COMUNES: readonly string[] = [
  'Alejandra', 'Alejandro', 'Andrea', 'Andres', 'Angela', 'Camila', 'Camilo', 'Carlos', 'Carolina', 'Catalina',
  'Claudia', 'Daniel', 'Daniela', 'David', 'Diana', 'Diego', 'Eduardo', 'Esteban', 'Fernando', 'Gabriel',
  'Gabriela', 'Juan', 'Juana', 'Julian', 'Juliana', 'Julio', 'Laura', 'Lina', 'Lorena', 'Luis', 'Luisa',
  'Manuela', 'Marcela', 'Maria', 'Mariana', 'Mateo', 'Miguel', 'Monica', 'Natalia', 'Nicolas', 'Paola', 'Pablo',
  'Pedro', 'Rafael', 'Ricardo', 'Roberto', 'Santiago', 'Sara', 'Sebastian', 'Sergio', 'Sofia', 'Tatiana',
  'Valentina', 'Valentin', 'Valeria', 'Vanessa', 'Victor', 'Karin', 'Karly', 'Bryan', 'Jorge', 'Jose', 'Ana',
]

const normalizar = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const NUM = String.raw`\d+(?:[.,]\d+)?`
const PAL = String.raw`(?:cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veinti(?:un|uno|dos|tr[eé]s|cuatro|cinco|s[eé]is|siete|ocho|nueve)|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|doscientas|trescientos|cuatrocientos|quinientos|mil)`
/** Número dicho en letras: «treinta y cuatro», «ochenta», «un». */
const NUMLETRAS = String.raw`${PAL}(?:\s+(?:y\s+)?${PAL})*`
const REGLAS: { tipo: TipoQuitado; marca: string; patron: RegExp }[] = [
  { tipo: 'correo', marca: '[CORREO]', patron: /[\p{L}\p{N}._%+-]+\s?@\s?[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu },
  // correo dictado: «zule arroba gmail punto com»
  { tipo: 'correo', marca: '[CORREO]', patron: /(?:[\p{L}\p{N}._-]+\s+)?(?<![\p{L}])arroba\s+[\p{L}\p{N}._-]+(?:\s+punto\s+\p{L}+)*/giu },
  { tipo: 'usuario', marca: '[USUARIO]', patron: /(?<![\p{L}\p{N}])@[\p{L}\p{N}._]{2,}/gu },
  // cédula con puntos y cédula/documento dicho con la palabra
  { tipo: 'documento', marca: '[DOCUMENTO]', patron: /(?<!\d)\d{1,3}(?:\.\d{3}){2,}(?!\d)|(?<![\p{L}])(?:c[eé]dula|documento|nit)(?:\s+de\s+ciudadan[ií]a)?\s*(?:es\s+|n[uú]mero\s+|no\.?\s*|#\s*|:\s*)?\d[\d.\s-]*\d/giu },
  {
    tipo: 'direccion',
    marca: '[DIRECCION]',
    patron: /(?<![\p{L}])(?:calle|carrera|cra|cr|kra|cll|cl|avenida|av|diagonal|transversal)\.?\s*\d+\p{L}?(?:\s*(?:#|no\.?|n[uú]mero)\s*\d+\p{L}?(?:\s*-\s*\d+)?)?(?:\s+(?:sur|norte|este|oeste))?/giu,
  },
  {
    tipo: 'telefono',
    marca: '[TELEFONO]',
    patron: /\+\d[\d\s().-]{7,}\d|(?<!\d)(?:57[\s-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)|(?<!\d)\d{3}[\s.-]\d{3}[\s.-]\d{4}(?!\d)|(?<!\d)\d{7,}(?!\d)/gu,
  },
  {
    tipo: 'peso',
    marca: '[PESO]',
    patron: new RegExp(
      String.raw`(?:peso|pesando|pesaba|pese)\s+(?:de\s+|unos\s+|como\s+|casi\s+|ahora\s+)?${NUM}(?:\s*(?:kg|kilos?|kilogramos?|libras?|lbs?))?|(?<![\p{L}\p{N}])${NUM}\s*(?:kg|kilos?|kilogramos?|libras?|lbs?)(?![\p{L}])`,
      'giu',
    ),
  },
  {
    tipo: 'edad',
    marca: '[EDAD]',
    patron: new RegExp(String.raw`(?:tengo\s+)?(?<![\p{N}])\d{1,3}\s+a[ñn]os(?![\p{L}])|(?:mi\s+)?edad\s+(?:es\s+|de\s+)?\d{1,3}`, 'giu'),
  },
  {
    tipo: 'edad',
    marca: '[EDAD]',
    patron: new RegExp(String.raw`(?:tengo\s+)?(?<![\p{L}])${NUMLETRAS}\s+a[ñn]os(?![\p{L}])`, 'giu'),
  },
  {
    tipo: 'peso',
    marca: '[PESO]',
    patron: new RegExp(
      String.raw`(?<![\p{L}])(?:peso|pesando|pesaba|pese)\s+(?:de\s+|unos\s+|como\s+|casi\s+)?${NUMLETRAS}(?:\s+(?:kilos?|kg|kilogramos?|libras?))?|(?<![\p{L}])${NUMLETRAS}\s+(?:kilos?|kg|kilogramos?|libras?)(?![\p{L}])`,
      'giu',
    ),
  },
  {
    tipo: 'medida',
    marca: '[MEDIDA]',
    patron: new RegExp(
      String.raw`(?<![\p{L}])(?:mido|miden?)\s+${NUMLETRAS}(?:\s+(?:metros?|cm|centimetros?|centímetros?))?(?:\s+${NUMLETRAS})?|(?<![\p{L}])${NUMLETRAS}\s+(?:centimetros?|centímetros?|metros?|cm)(?![\p{L}])`,
      'giu',
    ),
  },
  {
    tipo: 'medida',
    marca: '[MEDIDA]',
    patron: new RegExp(
      String.raw`(?:mido|miden?)\s+${NUM}(?:\s*(?:cm|m|mts?))?|(?:cintura|cadera|pecho|brazo|muslo|abdomen|cuello|pantorrilla)\s+(?:de\s+|mide\s+|en\s+)?${NUM}(?:\s*(?:cm|centimetros?))?|(?<![\p{L}\p{N}])${NUM}\s*(?:cm|centimetros?|centímetros?|mts?|metros?)(?![\p{L}])|${NUM}\s*%\s*(?:de\s+)?grasa`,
      'giu',
    ),
  },
]

/** «me llamo ana», «mi nombre es Ana María»: el nombre que la propia persona se pone, con o sin mayúscula. */
const SE_PRESENTA = /(?<![\p{L}])(me llamo|mi nombre es|ll[aá]mame|soy conocid[oa] como)(\s+)(\p{L}+(?:\s+\p{Lu}\p{L}+)?)/giu

/** Palabras que NO se toman por nombre tras «soy» o tras «mi esposa…»: artículos, verbos y condiciones comunes. */
const FUNCIONALES =
  'de|del|que|y|e|o|u|tambien|también|tiene|tienen|es|esta|está|no|se|me|le|lo|quiere|hace|va|hizo|dice|dijo|come|entrena|ya|siempre|nunca|mas|más|muy|un|una|uno|el|la|los|las|con|para|por|en|a|al|su|mi|fue|era|pesa|sufre|trabaja|vive|ha|han|puede|debe|sigue|estudia|toma|usa|piensa|cree|sabe|pregunta|tampoco|si|sí|como|cuando|donde|pero|porque|solo|sólo'
const NO_NOMBRE_SOY =
  FUNCIONALES +
  '|poco|algo|nuevo|nueva|principiante|intermedio|intermedia|avanzado|avanzada|novato|novata|experto|experta|mujer|hombre|vegetariano|vegetariana|vegano|vegana|sedentario|sedentaria|atleta|deportista|estudiante|madre|padre|mayor|joven|delgado|delgada|flaco|flaca|alto|alta|bajo|baja|zurdo|zurda|diestro|diestra|persona|tan|bastante|constante|disciplinado|disciplinada|medio|media|mal|bien|capaz|consciente|fuerte|lento|lenta|runner|corredor|corredora|gordo|gorda|obeso|obesa'
const PARENTESCO =
  'esposa|esposo|pareja|novia|novio|hijo|hija|mam[aá]|pap[aá]|madre|padre|hermano|hermana|jefe|jefa|coach|entrenador|entrenadora|m[eé]dico|m[eé]dica|doctor|doctora|amigo|amiga|prima|primo|t[ií]o|t[ií]a|abuela|abuelo|nutricionista|fisioterapeuta|psic[oó]loga|psic[oó]logo|compa[ñn]ero|compa[ñn]era|vecino|vecina|socio|socia'
/** «soy zulema» (sin mayúscula) → se tapa la palabra siguiente salvo que sea una condición o una palabra funcional. */
const SOY = new RegExp(String.raw`(?<![\p{L}])soy\s+(?!(?:${NO_NOMBRE_SOY})(?![\p{L}]))(\p{L}+)`, 'giu')
/** «mi esposa ofelia», «mi entrenador wenceslao»: la palabra tras el parentesco, salvo palabras funcionales. */
const DE_MI = new RegExp(String.raw`(?<![\p{L}])(?:mi|nuestro|nuestra|su|tu)\s+(?:${PARENTESCO})\s+(?!(?:${FUNCIONALES})(?![\p{L}]))(\p{L}+)`, 'giu')

/** Dónde empieza una frase: al inicio, o tras . ! ? : ; salto de línea, con comillas o signos de apertura en medio. */
function abreFrase(texto: string, indice: number): boolean {
  const antes = texto.slice(0, indice).replace(/[\s¿¡"'«([]+$/u, '')
  if (antes === '') return true
  if (/(?<![\p{L}])\p{Lu}\p{Ll}{0,2}\.$/u.test(antes)) return false // «Dr.», «Sra.»: no cierran frase
  return /[.!?:;…]$/u.test(antes) || /\n\s*$/u.test(texto.slice(0, indice))
}
const esSigla = (p: string): boolean => p.length <= 4 && p === p.toUpperCase()

/** Palabras con mayúscula inicial que parecen nombre propio (a): sueltas si no abren frase; en grupo de dos o más siempre. */
function spansDeMayusculas(texto: string): [number, number][] {
  const cand: { a: number; b: number }[] = []
  for (const m of texto.matchAll(/(?<![\p{L}\p{N}[])\p{Lu}\p{L}+(?![\p{L}\p{N}\]])/gu)) {
    if (!esSigla(m[0])) cand.push({ a: m.index, b: m.index + m[0].length })
  }
  const spans: [number, number][] = []
  for (let i = 0; i < cand.length; ) {
    let j = i
    while (j + 1 < cand.length && /^\s+$/.test(texto.slice(cand[j].b, cand[j + 1].a))) j++
    const solo = j === i
    if (!(solo && abreFrase(texto, cand[i].a))) for (let k = i; k <= j; k++) spans.push([cand[k].a, cand[k].b])
    i = j + 1
  }
  return spans
}

function tapar(texto: string, spans: [number, number][], marca: string): { texto: string; n: number } {
  if (spans.length === 0) return { texto, n: 0 }
  spans.sort((a, b) => a[0] - b[0])
  const fusion: [number, number][] = []
  for (const s of spans) {
    const ult = fusion[fusion.length - 1]
    if (ult && s[0] <= ult[1]) ult[1] = Math.max(ult[1], s[1])
    else fusion.push([s[0], s[1]])
  }
  let salida = ''
  let desde = 0
  for (const [a, b] of fusion) {
    salida += texto.slice(desde, a) + marca
    desde = b
  }
  return { texto: salida + texto.slice(desde), n: fusion.length }
}

/** Quita nombres (por lista, por patrón y por mayúscula inicial; ver la cabecera). Sin importar mayúsculas ni tildes. Si la normalización cambiara el largo, busca sin normalizar. */
function quitarNombres(texto: string, nombres: readonly string[], mayusculas: boolean): { texto: string; n: number } {
  const norm = normalizar(texto)
  const igualLargo = norm.length === texto.length
  const base = igualLargo ? norm : texto
  const spans: [number, number][] = []
  for (const nombre of nombres) {
    const limpio = (igualLargo ? normalizar(nombre) : nombre).trim()
    if (limpio.length < 2) continue
    const re = new RegExp(String.raw`(?<![\p{L}\p{N}])${escapar(limpio)}(?![\p{L}\p{N}])`, igualLargo ? 'gu' : 'giu')
    for (const m of base.matchAll(re)) spans.push([m.index, m.index + m[0].length])
  }
  for (const m of texto.matchAll(SE_PRESENTA)) {
    const inicio = m.index + m[1].length + m[2].length
    spans.push([inicio, inicio + m[3].length])
  }
  for (const re of [SOY, DE_MI]) {
    for (const m of texto.matchAll(re)) spans.push([m.index + m[0].length - m[1].length, m.index + m[0].length])
  }
  if (mayusculas) spans.push(...spansDeMayusculas(texto))
  return tapar(texto, spans, '[NOMBRE]')
}

export interface OpcionesDeLimpieza {
  /**
   * Regla (a) de la cabecera: tapar toda palabra con mayúscula inicial. Por omisión SÍ. La función `praxis-charla` la apaga
   * porque tras este limpiador pasa por `soloVocabulario`, que cierra los nombres de forma estructural (solo salen palabras
   * del vocabulario permitido) y no tapa de más términos de pieza como «Sentadilla» o «Schoenfeld».
   */
  mayusculas?: boolean
}

export function limpiarFrase(frase: string, nombresExtra: readonly string[] = [], opciones: OpcionesDeLimpieza = {}): ResultadoLimpieza {
  const quitado: Record<TipoQuitado, number> = { correo: 0, telefono: 0, peso: 0, edad: 0, medida: 0, nombre: 0, usuario: 0, documento: 0, direccion: 0 }
  let texto = frase
  for (const regla of REGLAS) {
    const spans: [number, number][] = []
    for (const m of texto.matchAll(regla.patron)) spans.push([m.index, m.index + m[0].length])
    const r = tapar(texto, spans, regla.marca)
    texto = r.texto
    quitado[regla.tipo] += r.n
  }
  const r = quitarNombres(texto, [...NOMBRES_COMUNES, ...nombresExtra], opciones.mayusculas !== false)
  texto = r.texto
  quitado.nombre += r.n
  const tipos = (Object.keys(quitado) as TipoQuitado[]).filter((t) => quitado[t] > 0)
  return { texto: texto.replace(/\s+/g, ' ').trim(), quitado, tipos }
}
