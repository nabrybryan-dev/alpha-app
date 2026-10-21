import type { Cifra } from './contrato'
import { bandasDeSentadilla, type Incertidumbre } from './bandas'
import { momentosDeSentadilla, type EntradaDeSentadilla } from './dinamica'

/**
 * LA CAPA DE MOMENTOS ARTICULARES de la sentadilla con barra: qué se dibuja y qué se dice.
 *
 * Esto es la lógica (M8, fase 5 reducida); el dibujo vive en `features/entrenar/escena/
 * dibujarMomentos.ts` y solo convierte esta salida a malla. Plano y unidades: las de `dinamica.ts`.
 *
 * Estado -> dibujo (P-12):
 *   · momento `calculado`            -> arco sólido (el valor central)
 *   · banda `estimada` (p5 a p95)    -> arco translúcido (el intervalo)
 *   · `no_afirmable` o valor `null`  -> NADA en la escena, y una línea de texto con el porqué.
 * Un `null` nunca se dibuja como cero. Sin reparto muscular y sin momento pasivo: esos no tienen
 * fuente verificada (tanda A) y esta capa no los nombra.
 *
 * Solo se enciende para la sentadilla con barra y para el sujeto de EJEMPLO. Con un asesorado real
 * la salida es una capa vacía: los umbrales de lectura no están firmados (C-10).
 *
 * `MOMENTO_DE_ESCALA` es una escala de DIBUJO (cuántos N·m llenan el arco entero), no un umbral
 * clínico: no separa «alto» de «bajo», solo fija cuánto mide el arco. Se imprime en el texto para
 * que nadie la lea como otra cosa.
 */

export const ARTICULACIONES_DE_LA_CAPA = ['tobillo', 'rodilla', 'cadera'] as const
export type ArticulacionDeLaCapa = (typeof ARTICULACIONES_DE_LA_CAPA)[number]

/** N·m que llenan el arco entero. Escala de dibujo, no clínica. */
export const MOMENTO_DE_ESCALA = 300

/** El sujeto de ejemplo: ninguna persona real. Los mismos valores que usan las pruebas del dominio. */
export const SUJETO_DE_EJEMPLO: EntradaDeSentadilla = {
  sexo: 'h',
  talla: 1.78,
  masa: 82,
  cargaKg: 100,
  pose: { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, barraT: 0.1, pieZ: 0.05 },
}

/** Incertidumbres de ejemplo (las que usan las pruebas de bandas); las fija quien llama. */
export const INCERTIDUMBRE_DE_EJEMPLO: Incertidumbre = { talla: 0.02, masa: 2, proporciones: 0.05, angulo: 0.03, carga: 2 }

export interface ContextoDeLaCapa {
  categoria: string
  nombre: string
  /** `true` solo para el sujeto de ejemplo. Un asesorado real nunca llega aquí. */
  sujetoDeEjemplo: boolean
}

export interface ElementoDeMomento {
  articulacion: ArticulacionDeLaCapa
  /** Fracción del arco entero (0 a 1) que llena el valor central. Siempre finita. */
  fraccion: number
  /** Fracciones del intervalo p5-p95, o `null` si no hay banda afirmable. */
  banda: { inf: number; sup: number } | null
}

export interface CapaDeMomentos {
  elementos: ElementoDeMomento[]
  /** Una línea por articulación: la cifra o el porqué de que no se dibuje. */
  lineas: string[]
}

const VACIA: CapaDeMomentos = { elementos: [], lineas: [] }

/** Sentadilla con barra: la categoría SENTADILLA y «barra» en el nombre, sin goblet, Smith ni unilateral. */
export function esSentadillaConBarra(categoria: string, nombre: string): boolean {
  const n = nombre.toLowerCase()
  return categoria.toUpperCase() === 'SENTADILLA' && n.includes('barra') && !n.includes('smith') && !n.includes('goblet')
}

const fraccionDe = (nm: number): number => Math.min(1, Math.abs(nm) / MOMENTO_DE_ESCALA)
const redondear = (x: number) => Math.round(x)

function lineaDe(art: ArticulacionDeLaCapa, calculado: Cifra, estimado: Cifra | undefined, bandaOk: boolean): string {
  const nombre = art.charAt(0).toUpperCase() + art.slice(1)
  if (calculado.valor === null || calculado.estado !== 'calculado') {
    return `${nombre}: no se dibuja. ${calculado.motivo ?? 'sin dato afirmable'}`
  }
  const base = `${nombre}: ${redondear(calculado.valor)} N·m (magnitud, estático)`
  if (bandaOk && estimado?.banda) {
    return `${base}, banda estimada ${redondear(estimado.banda.inf)} a ${redondear(estimado.banda.sup)} N·m (${estimado.banda.nivel})`
  }
  return `${base}, sin banda: ${estimado?.motivo ?? 'la banda no se pudo estimar'}`
}

export function capaDeMomentos(
  entrada: EntradaDeSentadilla,
  incertidumbre: Incertidumbre,
  contexto: ContextoDeLaCapa,
  opciones: { muestras?: number; semilla?: number } = {},
): CapaDeMomentos {
  // PUERTA: basta con que falle UNA condición para no dibujar. Con `&&` bastaría con que fallaran las dos.
  if (!contexto.sujetoDeEjemplo || !esSentadillaConBarra(contexto.categoria, contexto.nombre)) return VACIA

  const centrales = momentosDeSentadilla(entrada)
  const bandas = bandasDeSentadilla(entrada, incertidumbre, opciones)
  const elementos: ElementoDeMomento[] = []
  const lineas: string[] = []
  for (const art of ARTICULACIONES_DE_LA_CAPA) {
    const c = centrales[art]
    const b = bandas[art]
    const bandaOk =
      b.estado === 'estimado' &&
      b.banda !== null &&
      Number.isFinite(b.banda.inf) &&
      Number.isFinite(b.banda.sup) &&
      b.banda.inf <= b.banda.sup
    lineas.push(lineaDe(art, c, b, bandaOk))
    if (c.valor === null || c.estado !== 'calculado' || !Number.isFinite(c.valor)) continue
    elementos.push({
      articulacion: art,
      fraccion: fraccionDe(c.valor),
      banda: bandaOk && b.banda ? { inf: fraccionDe(b.banda.inf), sup: fraccionDe(b.banda.sup) } : null,
    })
  }
  lineas.push(`Escala del dibujo: el arco entero son ${MOMENTO_DE_ESCALA} N·m. No es un umbral: solo fija el tamaño.`)
  return { elementos, lineas }
}
