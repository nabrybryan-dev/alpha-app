// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).

/**
 * El limpiador de la charla con modelo externo (DeepSeek). PURO: sin red, sin base, sin pantalla.
 *
 * Qué quita de la frase ANTES de que salga del servidor, y con qué lo cambia:
 *   correos → [CORREO] · teléfonos y números largos → [TELEFONO] · peso, edad y medidas → [PESO] [EDAD] [MEDIDA]
 *   · nombres propios conocidos → [NOMBRE].
 *
 * LÍMITES, y no se disimulan:
 *  - Los nombres se quitan por LISTA (los de `NOMBRES_COMUNES`, los que pase quien llama y «me llamo X»). Una lista
 *    no generaliza: un nombre que no esté en ella pasa. Por eso la función pasa también los nombres propios de
 *    la persona y del equipo (`PRAXIS_CHARLA_NOMBRES`) y el custodio decide si esto basta antes de desplegar.
 *  - Las cifras se quitan de más a propósito («40 kilos» de una carga también sale): ante la duda, se tapa.
 *  - Quita lo que reconoce; no certifica que la frase quede sin datos personales.
 */
export type TipoQuitado = 'correo' | 'telefono' | 'peso' | 'edad' | 'medida' | 'nombre'

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
const REGLAS: { tipo: TipoQuitado; marca: string; patron: RegExp }[] = [
  { tipo: 'correo', marca: '[CORREO]', patron: /[\p{L}\p{N}._%+-]+\s?@\s?[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu },
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
    tipo: 'medida',
    marca: '[MEDIDA]',
    patron: new RegExp(
      String.raw`(?:mido|miden?)\s+${NUM}(?:\s*(?:cm|m|mts?))?|(?:cintura|cadera|pecho|brazo|muslo|abdomen|cuello|pantorrilla)\s+(?:de\s+|mide\s+|en\s+)?${NUM}(?:\s*(?:cm|centimetros?))?|(?<![\p{L}\p{N}])${NUM}\s*(?:cm|centimetros?|centímetros?|mts?|metros?)(?![\p{L}])|${NUM}\s*%\s*(?:de\s+)?grasa`,
      'giu',
    ),
  },
]

/** «me llamo Ana María»: el nombre que la propia persona se pone. */
const SE_PRESENTA = /([Mm]e llamo|[Mm]i nombre es|[Ll]l[aá]mame|[Ss]oy conocid[oa] como)(\s+)(\p{Lu}\p{L}+(?:\s+\p{Lu}\p{L}+)?)/gu

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

/** Quita nombres (por lista) sin importar mayúsculas ni tildes. Si la normalización cambiara el largo, busca sin normalizar. */
function quitarNombres(texto: string, nombres: readonly string[]): { texto: string; n: number } {
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
  return tapar(texto, spans, '[NOMBRE]')
}

export function limpiarFrase(frase: string, nombresExtra: readonly string[] = []): ResultadoLimpieza {
  const quitado: Record<TipoQuitado, number> = { correo: 0, telefono: 0, peso: 0, edad: 0, medida: 0, nombre: 0 }
  let texto = frase
  for (const regla of REGLAS) {
    const spans: [number, number][] = []
    for (const m of texto.matchAll(regla.patron)) spans.push([m.index, m.index + m[0].length])
    const r = tapar(texto, spans, regla.marca)
    texto = r.texto
    quitado[regla.tipo] += r.n
  }
  const r = quitarNombres(texto, [...NOMBRES_COMUNES, ...nombresExtra])
  texto = r.texto
  quitado.nombre += r.n
  const tipos = (Object.keys(quitado) as TipoQuitado[]).filter((t) => quitado[t] > 0)
  return { texto: texto.replace(/\s+/g, ' ').trim(), quitado, tipos }
}
