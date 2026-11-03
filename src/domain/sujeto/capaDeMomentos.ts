import type { Cifra, Banda } from './contrato'
import { bandasDeSentadilla, type Incertidumbre } from './bandas'
import { momentosDeSentadilla, type EntradaDeSentadilla } from './dinamica'
import { momentosPasivosDeLaPose } from './pasivo'

/**
 * LA CAPA DE MOMENTOS ARTICULARES de la sentadilla con barra: qué se dibuja y qué se dice.
 *
 * Esto es la lógica (M8, fase 5 reducida); el dibujo vive en `features/entrenar/escena/
 * dibujarMomentos.ts` y solo convierte esta salida a malla. Plano y unidades: las de `dinamica.ts`.
 *
 * Estado -> dibujo (P-12). Aquí NADA es `calculado`: las masas y centros de masa salen de la tabla
 * poblacional de de Leva, así que todo momento es `estimado` (convenciones.ts) y se dibuja
 * translúcido; el arco sólido queda reservado a lo `calculado` u `observado`, que esta capa no
 * produce.
 *   · momento `estimado` con banda p5-p95    -> arco del valor (translúcido) + arco de la banda
 *   · momento `estimado` sin banda afirmable -> solo el arco del valor, y el texto lo dice
 *   · `no_afirmable` o valor `null`          -> NADA en la escena, y una línea de texto con el porqué
 * Un `null` nunca se dibuja como cero. Sin reparto muscular: no tiene brazos internos verificados.
 *
 * EL PASIVO (Silder 2007) SE DICE, NO SE DIBUJA. Para la pose del ejemplo cae fuera del dominio
 * ensayado (cadera 126°) y es `no_afirmable`; dentro del dominio su banda p5-p95 es más ancha que el
 * propio valor (dispersión entre sujetos de un modelo exponencial) y aplastaría la escala del arco.
 * Por P-12 no se dibuja lo que no se puede leer: una línea de texto dice cuál de los dos casos es.
 *
 * Solo se enciende para la sentadilla con barra y para el sujeto de EJEMPLO. Con un asesorado real
 * la salida es una capa vacía: los umbrales de lectura no están firmados (C-10).
 *
 * LA ESCALA DEL ARCO (C-1 de la revisión de Opus): el arco entero son tantos N·m como haga falta
 * para que NINGÚN valor ni banda se salga —el múltiplo de 100 que contiene al mayor—. Con una
 * escala fija de 300 N·m la cadera del sujeto de ejemplo (unos 500) saturaba y su banda no se
 * dibujaba. Es una escala de DIBUJO, no un umbral clínico: no separa «alto» de «bajo». Va impresa
 * en el texto.
 */

export const ARTICULACIONES_DE_LA_CAPA = ['tobillo', 'rodilla', 'cadera'] as const
export type ArticulacionDeLaCapa = (typeof ARTICULACIONES_DE_LA_CAPA)[number]

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
  /** Estado de la cifra que se dibuja: decide si el arco es sólido o translúcido. */
  estado: 'calculado' | 'estimado'
  /** Fracción del arco entero (0 a 1) que llena el valor. Siempre finita y dentro de [0, 1]. */
  fraccion: number
  /** Fracciones del intervalo p5-p95, o `null` si no hay banda afirmable. */
  banda: { inf: number; sup: number } | null
}

export interface CapaDeMomentos {
  elementos: ElementoDeMomento[]
  /** Una línea por articulación y las notas finales: la cifra o el porqué de que no se dibuje. */
  lineas: string[]
  /** N·m que llenan el arco entero; 0 si no hay nada que dibujar. */
  escala: number
  /**
   * La pose del cálculo (ángulos respecto de la vertical, rad): los arcos solo tienen sentido cuando
   * el sujeto animado pasa por ella (C-3). `null` si no hay nada que dibujar.
   */
  poseDelCalculo: { tibia: number; muslo: number } | null
}

const VACIA: CapaDeMomentos = { elementos: [], lineas: [], escala: 0, poseDelCalculo: null }

/** Sentadilla con barra: la categoría SENTADILLA y «barra» en el nombre, sin goblet, Smith ni unilateral. */
export function esSentadillaConBarra(categoria: string, nombre: string): boolean {
  const n = nombre.toLowerCase()
  return (
    categoria.toUpperCase() === 'SENTADILLA' &&
    n.includes('barra') &&
    !n.includes('smith') &&
    !n.includes('goblet') &&
    !n.includes('unilateral')
  )
}

/** El múltiplo de 100 N·m que contiene a `mayor`; nunca menos de 100. */
export function escalaDelArco(mayor: number): number {
  return Math.max(100, 100 * Math.ceil(mayor / 100))
}

const redondear = (x: number) => Math.round(x)
const grados = (rad: number) => Math.round((rad * 180) / Math.PI)
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Una banda se puede dibujar si es finita, está ordenada, contiene al valor y NO cruza el cero (C-6). */
export function bandaDibujable(b: Cifra): b is Cifra & { banda: Banda; valor: number } {
  return (
    b.estado === 'estimado' &&
    b.valor !== null &&
    b.banda !== null &&
    Number.isFinite(b.banda.inf) &&
    Number.isFinite(b.banda.sup) &&
    b.banda.inf <= b.banda.sup &&
    b.banda.inf >= 0 === b.banda.sup >= 0 &&
    b.banda.inf <= b.valor &&
    b.valor <= b.banda.sup
  )
}

/** La línea de texto del momento pasivo: el porqué de que no se dibuje, o su cifra con la advertencia. */
function lineaDePasivo(art: ArticulacionDeLaCapa, c: Cifra): string {
  if (c.valor === null || c.banda === null) return `Pasivo de ${art}: no se dibuja. ${c.motivo ?? 'sin dato afirmable'}`
  const ancha = c.banda.sup - c.banda.inf > Math.abs(c.valor)
  return (
    `Pasivo de ${art}: ${redondear(c.valor)} N·m, estimado (Silder 2007, total de las dos piernas), banda ${redondear(c.banda.inf)} a ${redondear(c.banda.sup)} N·m. ` +
    (ancha ? 'No se dibuja: la banda es más ancha que el valor.' : 'No se dibuja: esta capa aún no tiene arco de pasivo.')
  )
}

function lineaDe(art: ArticulacionDeLaCapa, valor: Cifra, bandas: Cifra, conBanda: boolean): string {
  const nombre = mayuscula(art)
  if (valor.valor === null || (valor.estado !== 'estimado' && valor.estado !== 'calculado')) {
    return `${nombre}: no se dibuja. ${valor.motivo ?? 'sin dato afirmable'}`
  }
  const base = `${nombre}: ${redondear(valor.valor)} N·m, estimado (magnitud, estático, total de las dos piernas)`
  if (conBanda && bandas.banda) {
    return `${base}, banda ${redondear(bandas.banda.inf)} a ${redondear(bandas.banda.sup)} N·m (${bandas.banda.nivel})`
  }
  const porQue =
    bandas.estado === 'no_afirmable'
      ? (bandas.motivo ?? 'la banda no se pudo estimar')
      : 'la banda cruza el cero o no contiene al valor'
  return `${base}, sin banda: ${porQue}`
}

interface Previo {
  articulacion: ArticulacionDeLaCapa
  valor: number
  estado: 'calculado' | 'estimado'
  banda: { inf: number; sup: number } | null
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
  const conBandas = bandasDeSentadilla(entrada, incertidumbre, opciones)
  const lineas: string[] = []
  const previos: Previo[] = []
  for (const art of ARTICULACIONES_DE_LA_CAPA) {
    const c = centrales[art]
    const b = conBandas[art]
    const ok = bandaDibujable(b)
    lineas.push(lineaDe(art, c, b, ok))
    if (c.valor === null || !Number.isFinite(c.valor) || (c.estado !== 'estimado' && c.estado !== 'calculado')) continue
    previos.push({
      articulacion: art,
      valor: c.valor,
      estado: c.estado,
      banda: ok ? { inf: b.banda.inf, sup: b.banda.sup } : null,
    })
  }
  const pasivos = momentosPasivosDeLaPose(entrada.pose ? { tibia: entrada.pose.tibia, muslo: entrada.pose.muslo, tronco: entrada.pose.tronco } : null)
  for (const art of ARTICULACIONES_DE_LA_CAPA) lineas.push(lineaDePasivo(art, pasivos[art]))
  if (previos.length === 0) return { ...VACIA, lineas }

  // La escala sale del mayor valor o borde de banda, en valor absoluto: nada se satura.
  const mayor = Math.max(
    ...previos.flatMap((p) => [Math.abs(p.valor), ...(p.banda ? [Math.abs(p.banda.inf), Math.abs(p.banda.sup)] : [])]),
  )
  const escala = escalaDelArco(mayor)
  const fraccion = (nm: number) => Math.abs(nm) / escala
  const elementos: ElementoDeMomento[] = previos.map((p) => ({
    articulacion: p.articulacion,
    estado: p.estado,
    fraccion: fraccion(p.valor),
    // Con el momento negativo el valor absoluto invierte el orden de los extremos: se reordena.
    banda: p.banda
      ? {
          inf: Math.min(fraccion(p.banda.inf), fraccion(p.banda.sup)),
          sup: Math.max(fraccion(p.banda.inf), fraccion(p.banda.sup)),
        }
      : null,
  }))
  const pose = entrada.pose
  const poseDelCalculo = pose ? { tibia: pose.tibia, muslo: pose.muslo } : null
  lineas.push(`Escala del dibujo: el arco entero son ${escala} N·m. No es un umbral: solo fija el tamaño.`)
  if (poseDelCalculo) {
    lineas.push(
      `Calculado con la pose fija de ejemplo (tibia ${grados(poseDelCalculo.tibia)}°, muslo ${grados(poseDelCalculo.muslo)}° de la vertical): ` +
        'los arcos solo se ven cuando la animación pasa por ella.',
    )
  }
  return { elementos, lineas, escala, poseDelCalculo }
}
