import { DE_LEVA, SEGMENTOS, SEGMENTOS_PARES, sumaDeFracciones, type ParametrosDeSegmento, type Segmento, type Sexo } from './deleva'

/**
 * EL SUJETO (M3): masas y largos por segmento, escalados a la talla y la masa del asesorado.
 *
 * Plano: no trabaja en ningún plano, es un conjunto de números. Unidades SI (kg, m).
 *
 * Qué entra: `{ sexo, talla, masa }`, que Alpha ya tiene (perfil y prescripción). Del vídeo no
 * entra nada: la escala métrica sale de la talla, que es el bloqueo que tuvo el encoder.
 *
 * Dos supuestos, ambos declarados y ambos sustento de la banda de la fase 3:
 *  1. Las proporciones son las de la muestra de Zatsiorsky (de Leva 1996), poblacionales. La
 *     regla de Bryan de que una calibración no vale para otra persona se respeta así: aquí no se
 *     calibra, se estima, y la estimación lleva banda.
 *  2. Los largos escalan en proporción a la estatura (misma forma, distinto tamaño).
 *
 * Sin talla o sin masa válidas NO se inventa un valor por defecto: se devuelve `null` y el
 * llamador tiene que decir «no se puede afirmar». Un cero o un 70 kg «típico» destruirían el dato.
 */

export interface EntradaDelSujeto {
  sexo: Sexo
  /** Estatura en metros. */
  talla: number | null | undefined
  /** Masa corporal en kilogramos (sin la carga). */
  masa: number | null | undefined
}

export interface SegmentoDelSujeto extends ParametrosDeSegmento {
  /** Masa del segmento en kg, UNO solo (los pares se cuentan aparte). */
  masaKg: number
  /** Largo del segmento en metros, ya escalado a la talla. */
  largoM: number
}

export interface Sujeto {
  sexo: Sexo
  talla: number
  masa: number
  segmentos: Readonly<Record<Segmento, SegmentoDelSujeto>>
  /** Suma de las fracciones de la tabla: 1,0000 en varones, 0,9999 en mujeres (redondeo del artículo). */
  sumaDeFracciones: number
}

/** Un valor físico válido: finito y estrictamente positivo. Cero no es una talla ni una masa. */
const valido = (x: number | null | undefined): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x > 0

/**
 * Límites de cordura, NO clínicos: solo rechazan un metro escrito en centímetros o al revés.
 * Los eligió quien escribió este módulo (estado `supuesto` en `PROCEDENCIAS.tsv`).
 */
export const LIMITES_DE_CORDURA = { tallaMin: 0.9, tallaMax: 2.5, masaMin: 20, masaMax: 300 } as const

/** `null` si falta algo o no es una cifra física plausible. Nunca un valor por defecto. */
export function construirSujeto(e: EntradaDelSujeto): Sujeto | null {
  if (!valido(e.talla) || !valido(e.masa)) return null
  if (e.talla < LIMITES_DE_CORDURA.tallaMin || e.talla > LIMITES_DE_CORDURA.tallaMax) return null
  if (e.masa < LIMITES_DE_CORDURA.masaMin || e.masa > LIMITES_DE_CORDURA.masaMax) return null
  const tabla = DE_LEVA[e.sexo]
  if (!tabla) return null
  const escala = e.talla / tabla.estaturaDeReferencia
  const segmentos = {} as Record<Segmento, SegmentoDelSujeto>
  for (const s of SEGMENTOS) {
    const p = tabla.segmentos[s]
    segmentos[s] = { ...p, masaKg: p.masa * e.masa, largoM: p.largo * escala }
  }
  return { sexo: e.sexo, talla: e.talla, masa: e.masa, segmentos, sumaDeFracciones: sumaDeFracciones(e.sexo) }
}

/** Masa total de los segmentos del cuerpo entero (pares x2), en kg. */
export function masaDeLosSegmentos(s: Sujeto): number {
  return SEGMENTOS.reduce(
    (suma, n) => suma + s.segmentos[n].masaKg * (SEGMENTOS_PARES.includes(n) ? 2 : 1),
    0,
  )
}
