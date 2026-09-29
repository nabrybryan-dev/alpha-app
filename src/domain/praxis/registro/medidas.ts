/**
 * Medidas caseras → gramos, con la FUENTE de cada fila.
 *
 * El modelo nunca convierte: cita «taza y media» y este archivo dice cuánto es.
 * Cada fila declara de dónde sale la cifra y si está `verificada`. Lo que no
 * tiene fila (plato, pedazo, presa, «un chorrito») NO se convierte: devuelve
 * `sin_equivalencia` y el resolutor pregunta o deja el gramo vacío y editable.
 * Un número inventado es peor que un hueco.
 *
 * Fuentes:
 *  - GABAS 2020 (ICBF-FAO), tablas 26–45, y Res. 810 de 2021 art. 13: valores
 *    sueltos citados, no la tabla completa (GABAS prohíbe su reproducción total
 *    sin autorización del ICBF). La atribución va en la ayuda de la tarjeta.
 *  - USDA para la taza de arroz (240 mL). En Colombia la taza puede ser de
 *    200 mL, así que va `verificado: false` con margen ±25 %.
 *  - `porciones.py`: porción habitual validada por el coach el 2026-08-07.
 *  - `unidades.ts`: aceite y sal (R3).
 *
 * Las cifras "derivado" salen de una fracción del reconocimiento (1/6 de 80 g, 1/4
 * de pechuga...) y se marcan como tales.
 */
import { normalizarTexto } from './numeros.ts'
import type { Confianza, Pregunta } from './tipos.ts'

/** Vaso de agua por defecto: 200 mL (Res. 810). Decisión D-R5 del diseño, editable en la tarjeta. */
export const VASO_ML = 200

export type MedidaCanonica =
  | 'cucharada'
  | 'cucharadita'
  | 'taza'
  | 'vaso'
  | 'pocillo'
  | 'pocillo chocolatero'
  | 'tajada'
  | 'trozo'
  | 'unidad'
  | 'cucharon'
  | 'pizca'
  | 'plato'
  | 'pedazo'
  | 'presa'
  | 'porcion'
  | 'botella'
  | 'libra'

export interface MedidaCasera {
  /** Nombre corto para las opciones de la pregunta. */
  etiqueta: string
  /** AND de OR: cada grupo debe tener al menos una palabra en el alimento dicho. */
  claves: string[][]
  medida: MedidaCanonica
  /** Gramos (o mL, si `liquido`) de UNA medida. */
  gramos: number
  fuente: string
  verificado: boolean
  /** Fracción de error esperada (0,25 = ±25 %). */
  margen: number
  estado?: 'cocido' | 'crudo' | 'seco'
  liquido?: boolean
  nota?: string
}

const F = (
  etiqueta: string,
  claves: string[][],
  medida: MedidaCanonica,
  gramos: number,
  fuente: string,
  verificado: boolean,
  margen: number,
  extra: Partial<MedidaCasera> = {},
): MedidaCasera => ({ etiqueta, claves, medida, gramos, fuente, verificado, margen, ...extra })

export const MEDIDAS_CASERAS: readonly MedidaCasera[] = [
  // Cereales y tubérculos
  F('Arroz (cucharada)', [['arroz']], 'cucharada', 80 / 6, 'GABAS T26 (6 cdas soperas colmadas = 80 g)', true, 0.15, { estado: 'cocido' }),
  F('Arroz (taza)', [['arroz']], 'taza', 158, 'USDA (taza de 240 mL)', false, 0.25, { estado: 'cocido', nota: 'En Colombia la taza puede ser de 200 mL (unos 134 g)' }),
  F('Arroz integral (pocillo)', [['arroz'], ['integral']], 'pocillo', 121.5, 'GABAS derivado (2/3 de pocillo = 81 g)', false, 0.3, { estado: 'cocido', nota: 'El volumen del pocillo no está definido en GABAS ni en la Res. 810' }),
  F('Pasta (pocillo chocolatero)', [['pasta', 'espagueti', 'espaguetis', 'macarron', 'macarrones']], 'pocillo chocolatero', 96, 'GABAS derivado (2/3 de pocillo chocolatero = 64 g)', false, 0.3, { estado: 'cocido' }),
  F('Avena (cucharada)', [['avena']], 'cucharada', 6, 'GABAS (4 cdas colmadas = 24 g)', true, 0.2, { estado: 'seco' }),
  F('Arepa delgada', [['arepa', 'arepita'], ['delgada', 'delgadita', 'delgadas', 'delgaditas']], 'unidad', 56, 'GABAS (unidad pequeña)', true, 0.15),
  F('Arepa grande', [['arepa'], ['grande', 'redonda', 'gruesa']], 'unidad', 52, 'GABAS (unidad grande)', true, 0.15, { nota: 'La porción habitual del coach es 98 g: no se decide en silencio' }),
  F('Pan blanco (tajada)', [['pan'], ['blanco', 'tajada', 'molde']], 'tajada', 22, 'GABAS (tajada delgada)', true, 0.15),
  F('Pan integral (tajada)', [['pan'], ['integral']], 'tajada', 32, 'GABAS (tajada mediana)', true, 0.15),
  F('Pan de yuca', [['pan'], ['yuca']], 'unidad', 10, 'GABAS (2 unidades = 20 g)', true, 0.2),
  F('Pan de queso', [['pan'], ['queso']], 'unidad', 28, 'GABAS (unidad pequeña)', true, 0.2),
  F('Almojábana', [['almojabana', 'almojabanas']], 'unidad', 31, 'GABAS (unidad grande)', true, 0.2),
  F('Papa criolla', [['papa', 'papas', 'papita', 'papitas'], ['criolla', 'criollas']], 'unidad', 36, 'GABAS T28 (3 unidades medianas = 108 g)', true, 0.2, { estado: 'cocido' }),
  F('Papa', [['papa', 'papas']], 'unidad', 83, 'GABAS T28 (unidad mediana)', true, 0.2, { estado: 'cocido' }),
  F('Plátano verde', [['platano', 'platanos'], ['verde', 'verdes']], 'unidad', 156, 'GABAS T29 (1/2 unidad mediana = 78 g)', true, 0.2),
  F('Plátano maduro', [['platano', 'platanos'], ['maduro', 'maduros', 'harton']], 'unidad', 264, 'GABAS T29 (1/4 unidad mediana = 66 g)', true, 0.2),
  F('Yuca', [['yuca']], 'trozo', 62, 'GABAS T27 (trozo mediano, CRUDO)', false, 0.3, { estado: 'crudo', nota: 'El peso es crudo; el rendimiento crudo-cocido no está verificado' }),
  // Frutas
  F('Mandarina', [['mandarina', 'mandarinas']], 'unidad', 105, 'GABAS T30 (unidad mediana)', true, 0.2),
  F('Naranja', [['naranja', 'naranjas']], 'unidad', 147, 'GABAS T30 (unidad pequeña)', false, 0.25, { nota: 'Tamaño no dicho: se tomó pequeña' }),
  F('Guayaba', [['guayaba', 'guayabas']], 'unidad', 100, 'GABAS T30 (unidad grande)', false, 0.25, { nota: 'Tamaño no dicho' }),
  F('Papaya (trozo)', [['papaya']], 'trozo', 128, 'GABAS T30 (trozo mediano)', true, 0.2),
  F('Piña (tajada)', [['pina']], 'tajada', 115, 'GABAS T30 (tajada delgada)', true, 0.2),
  F('Mango', [['mango']], 'unidad', 112, 'GABAS T30 (unidad pequeña)', false, 0.3, { nota: 'Tamaño no dicho; un mango grande pesa más' }),
  F('Aguacate', [['aguacate']], 'unidad', 240, 'GABAS T41-43 (1/8 de unidad = 30 g)', true, 0.25),
  // Lácteos, huevo y proteínas
  F('Leche (vaso)', [['leche']], 'vaso', 200, 'GABAS T32 (vaso mediano)', true, 0.15),
  F('Jugo (vaso)', [['jugo']], 'vaso', 200, 'GABAS T30 (vaso mediano)', true, 0.15, { nota: 'No incluye ni asume azúcar añadida' }),
  F('Yogur (vaso)', [['yogur', 'yogurt', 'kumis']], 'vaso', 150, 'GABAS T33 (vaso pequeño)', false, 0.3, { nota: 'Dijo vaso sin tamaño: se tomó pequeño' }),
  F('Queso campesino (tajada)', [['queso'], ['campesino']], 'tajada', 20, 'GABAS T33 (tajada pequeña delgada)', true, 0.2),
  F('Huevo', [['huevo', 'huevos']], 'unidad', 50, 'GABAS T38 / Res. 810 (1 huevo ≈ 50 g)', true, 0.1),
  F('Pechuga de pollo', [['pechuga']], 'unidad', 240, 'GABAS T36-37 derivado (1/4 de pechuga mediana = 60 g, crudo)', false, 0.3, { estado: 'crudo' }),
  F('Muslo de pollo', [['muslo']], 'unidad', 60, 'GABAS T36-37 (sin hueso ni piel, crudo)', false, 0.35, { estado: 'crudo' }),
  F('Fríjol guisado (cucharón)', [['frijol', 'frijoles']], 'cucharon', 120, 'GABAS T39 derivado (1/2 cucharón = 60 g)', false, 0.3, { nota: 'El volumen del cucharón no está verificado' }),
  F('Lenteja guisada (cucharón)', [['lenteja', 'lentejas']], 'cucharon', 120, 'GABAS T39 (1/2 cucharón = 60 g)', false, 0.3, { nota: 'El volumen del cucharón no está verificado' }),
  // Grasas, azúcares, condimentos
  F('Mantequilla (cucharadita)', [['mantequilla']], 'cucharadita', 6, 'GABAS (cucharadita dulcera rasa)', false, 0.3, { nota: 'Dijo cucharadita; la fuente es dulcera rasa' }),
  F('Azúcar (cucharada)', [['azucar']], 'cucharada', 11.5, 'GABAS T44 (2 cdas soperas colmadas = 23 g)', true, 0.15),
  F('Miel (cucharada)', [['miel']], 'cucharada', 21, 'GABAS T44', true, 0.15),
  F('Panela (trozo)', [['panela']], 'trozo', 29, 'GABAS T44 (trozo pequeño)', true, 0.2),
  F('Aceite (cucharada)', [['aceite']], 'cucharada', 14, 'unidades.ts (1 cda = 14 g)', true, 0.1),
  F('Aceite (cucharadita)', [['aceite']], 'cucharadita', 5, 'unidades.ts (1 cdta = 5 g)', true, 0.1),
  F('Sal (pizca)', [['sal']], 'pizca', 0.4, 'unidades.ts (1 pizca = 0,4 g)', true, 0.5),
  // Líquidos (mL)
  F('Agua (vaso)', [['agua']], 'vaso', VASO_ML, 'Res. 810/2021 art. 13 (vaso de 200 o 240 mL)', true, 0.2, { liquido: true }),
  F('Agua (taza)', [['agua']], 'taza', VASO_ML, 'Res. 810/2021 art. 13 (taza de 200 o 240 mL)', true, 0.2, { liquido: true }),
]

/**
 * Porción habitual de `porciones.py`, validada por el coach el 2026-08-07. Sirve
 * SOLO cuando la persona dice «un plato de X» o «un banano» sin más, y siempre
 * con confianza baja.
 */
export const PORCION_HABITUAL: readonly { claves: string[]; gramos: number; fuente: string }[] = [
  { claves: ['arroz'], gramos: 150, fuente: 'porciones.py (validada por el coach 2026-08-07)' },
  { claves: ['carne asada', 'carne'], gramos: 150, fuente: 'porciones.py (validada por el coach 2026-08-07)' },
  { claves: ['banano'], gramos: 118, fuente: 'porciones.py (validada por el coach 2026-08-07)' },
]

const SINONIMOS_MEDIDA: [RegExp, MedidaCanonica][] = [
  [/\bpocillo chocolatero\b/, 'pocillo chocolatero'],
  [/\bcucharadit/, 'cucharadita'],
  [/\b(cucharad|cda|cdas)/, 'cucharada'],
  [/\bcucharon/, 'cucharon'],
  [/\btaza/, 'taza'],
  [/\bvaso/, 'vaso'],
  [/\bpocillo/, 'pocillo'],
  [/\btajad/, 'tajada'],
  [/\btroz/, 'trozo'],
  [/\bpizca/, 'pizca'],
  [/\bplato/, 'plato'],
  [/\bpedaz/, 'pedazo'],
  [/\bpresa/, 'presa'],
  [/\bporcion/, 'porcion'],
  [/\bbotella/, 'botella'],
  [/\blibra/, 'libra'],
  [/\b(unidad|unidades|pieza|piezas)\b/, 'unidad'],
]

/** «cucharadas» → `cucharada`; `null` y «unidad» → `unidad`; lo desconocido → `null`. */
export function medidaCanonica(cita: string | null | undefined): MedidaCanonica | null {
  if (!cita || !cita.trim()) return 'unidad'
  const n = normalizarTexto(cita)
  for (const [re, m] of SINONIMOS_MEDIDA) if (re.test(n)) return m
  return null
}

function palabras(alimento: string): string[] {
  return normalizarTexto(alimento).split(' ').filter(Boolean)
}

function claveCumple(grupo: string[], toks: string[]): boolean {
  return grupo.some((k) => toks.some((t) => t === k || (t.length >= 4 && k.startsWith(t)) || (k.length >= 4 && t.startsWith(k))))
}

export type ResolucionMedida =
  | { tipo: 'gramos'; gramos: number; fila: MedidaCasera; confianza: Confianza; eq: string }
  | { tipo: 'ambigua'; pregunta: Pregunta }
  | { tipo: 'sin_equivalencia'; motivo: string }

/**
 * Cantidad × medida de un alimento → gramos.
 *
 *  1. Filas cuya medida coincide y cuyas claves TODAS se cumplen: gana la que
 *     tiene más claves (`papa criolla` sobre `papa`).
 *  2. Si ninguna se cumple del todo pero varias comparten la primera clave
 *     (`arepa` sola, `pan` solo), es ambigua: una pregunta con las variantes.
 *  3. Si el alimento no tiene fila para esa medida: sin equivalencia.
 */
export function gramosDeMedida(alimento: string, medida: MedidaCanonica | null, cantidad: number): ResolucionMedida {
  if (medida === null) return { tipo: 'sin_equivalencia', motivo: 'medida desconocida' }
  const toks = palabras(alimento)
  const delAlimento = MEDIDAS_CASERAS.filter((f) => claveCumple(f.claves[0], toks))
  const conMedida = delAlimento.filter((f) => f.medida === medida)
  const completas = conMedida.filter((f) => f.claves.every((g) => claveCumple(g, toks)))
  if (completas.length > 0) {
    const fila = [...completas].sort((a, b) => b.claves.length - a.claves.length)[0]
    const gramos = Math.round(cantidad * fila.gramos * 10) / 10
    const q = String(cantidad).replace('.', ',')
    return {
      tipo: 'gramos',
      gramos,
      fila,
      confianza: fila.verificado ? 'media' : 'baja',
      eq: `${q} × ${Math.round(fila.gramos * 10) / 10} ${fila.liquido ? 'mL' : 'g'} (${fila.fuente})`,
    }
  }
  if (conMedida.length > 1) {
    const opciones = [...new Set(conMedida.map((f) => f.etiqueta))].slice(0, 3)
    return {
      tipo: 'ambigua',
      pregunta: { texto: `¿Cuál era: ${opciones.join(', ')}?`, opciones, campo_bloqueante: 'alimento' },
    }
  }
  if (delAlimento.length > 1 && medida === 'unidad') {
    const opciones = [...new Set(delAlimento.map((f) => f.etiqueta))].slice(0, 3)
    return {
      tipo: 'ambigua',
      pregunta: { texto: `¿Cuál era: ${opciones.join(', ')}?`, opciones, campo_bloqueante: 'alimento' },
    }
  }
  return { tipo: 'sin_equivalencia', motivo: `sin equivalencia verificada para ${medida} de ${alimento}` }
}

/** Porción habitual de un alimento, o `null`. */
export function porcionHabitual(alimento: string): { gramos: number; fuente: string } | null {
  const toks = palabras(alimento)
  for (const p of PORCION_HABITUAL) {
    if (p.claves.some((c) => c.split(' ').every((w) => toks.includes(w)))) return { gramos: p.gramos, fuente: p.fuente }
  }
  return null
}
