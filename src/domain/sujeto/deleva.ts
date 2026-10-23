/**
 * LA TABLA DE de Leva (1996), transcrita del artículo y no de memoria.
 *
 * de Leva P. «Adjustments to Zatsiorsky-Seluyanov's segment inertia parameters». J Biomech
 * 29(9):1223-1230. DOI 10.1016/0021-9290(95)00178-6. Tabla 4 (p. 1228), leída en el texto
 * completo y mirando la imagen de la página el 20-oct-2026. Muestra de Zatsiorsky et al.:
 * mujeres de 61,9 kg y 1,735 m (la leyenda del artículo imprime «173.5 m», es una errata de
 * unidad), varones de 73,0 kg y 1,741 m.
 *
 * Lo que trae cada segmento, tal como lo publica el artículo:
 *  · `masa`   fracción de la masa corporal (la tabla da porcentajes: aquí 0,1416 y no 14,16).
 *  · `cm`     posición del centro de masas, fracción del largo medida desde el extremo
 *             PROXIMAL (la cabeza y el tronco, desde el craneal; el pie, desde el talón).
 *  · `largo`  largo del segmento en metros, entre los extremos que dice `extremos`.
 *
 * Extremos (artículo): cabeza VERT-MIDG, tronco SUPR-MIDH (la escotadura supraesternal y el
 * punto medio de las dos caderas), brazo SJC-EJC, antebrazo EJC-WJC, mano WJC-MET3, muslo
 * HJC-KJC, tibia KJC-AJC (fila de «extremos alternativos»: el artículo la da con el centro
 * articular del tobillo, que es el eje que usa la cadena), pie HEEL-TTIP.
 *
 * NO se transcriben los radios de giro: la sentadilla estática no usa inercia, y los ejes
 * «sagital», «transverso» y «longitudinal» de la tabla no se han fijado aún con la fuente.
 * Cuando haga falta el término inercial se transcribe aparte, con su propia procedencia.
 *
 * Cada constante tiene su fila en `PROCEDENCIAS.tsv` con el id `deleva96.<sexo>.<seg>.<campo>`
 * y `scripts/comprobar-procedencias-sujeto.mts` compara las dos.
 */

export type Sexo = 'h' | 'm'

export const SEGMENTOS = ['cabeza', 'tronco', 'brazo', 'antebrazo', 'mano', 'muslo', 'tibia', 'pie'] as const
export type Segmento = (typeof SEGMENTOS)[number]

export interface ParametrosDeSegmento {
  masa: number
  cm: number
  largo: number
}

export interface TablaDeLeva {
  /** Estatura media de la muestra, en metros: el largo de la tabla vale para esa estatura. */
  estaturaDeReferencia: number
  segmentos: Readonly<Record<Segmento, ParametrosDeSegmento>>
}

export const DE_LEVA: Readonly<Record<Sexo, TablaDeLeva>> = {
  h: {
    estaturaDeReferencia: 1.741,
    segmentos: {
      cabeza: { masa: 0.0694, cm: 0.5976, largo: 0.2033 },
      tronco: { masa: 0.4346, cm: 0.4486, largo: 0.5319 },
      brazo: { masa: 0.0271, cm: 0.5772, largo: 0.2817 },
      antebrazo: { masa: 0.0162, cm: 0.4574, largo: 0.2689 },
      mano: { masa: 0.0061, cm: 0.79, largo: 0.0862 },
      muslo: { masa: 0.1416, cm: 0.4095, largo: 0.4222 },
      tibia: { masa: 0.0433, cm: 0.4395, largo: 0.4403 },
      pie: { masa: 0.0137, cm: 0.4415, largo: 0.2581 },
    },
  },
  m: {
    estaturaDeReferencia: 1.735,
    segmentos: {
      cabeza: { masa: 0.0668, cm: 0.5894, largo: 0.2002 },
      tronco: { masa: 0.4257, cm: 0.4151, largo: 0.5293 },
      brazo: { masa: 0.0255, cm: 0.5754, largo: 0.2751 },
      antebrazo: { masa: 0.0138, cm: 0.4559, largo: 0.2643 },
      mano: { masa: 0.0056, cm: 0.7474, largo: 0.078 },
      muslo: { masa: 0.1478, cm: 0.3612, largo: 0.3685 },
      tibia: { masa: 0.0481, cm: 0.4352, largo: 0.4386 },
      pie: { masa: 0.0129, cm: 0.4014, largo: 0.2283 },
    },
  },
}

/**
 * Cabeza y tronco con los EXTREMOS ALTERNATIVOS de la Tabla 4 (segunda parte): cabeza VERT-CERV
 * y tronco CERV-MIDH. Con estos dos la cadena es continua —el tronco acaba donde empieza la
 * cabeza, en el cervical—, que es lo que necesita la dinámica; con los de la primera parte
 * (VERT-MIDG y SUPR-MIDH) la cabeza queda colgando del tronco sin tocarlo. La masa total no
 * cambia (6,94 y 43,46 en varones; 6,68 y 42,57 en mujeres), cambian largo y CM.
 */
export const DE_LEVA_CERV: Readonly<Record<Sexo, Readonly<Record<'cabeza' | 'tronco', ParametrosDeSegmento>>>> = {
  h: {
    cabeza: { masa: 0.0694, cm: 0.5002, largo: 0.2429 },
    tronco: { masa: 0.4346, cm: 0.5138, largo: 0.6033 },
  },
  m: {
    cabeza: { masa: 0.0668, cm: 0.4841, largo: 0.2437 },
    tronco: { masa: 0.4257, cm: 0.4964, largo: 0.6148 },
  },
}

/** Los segmentos que van de a dos (derecho e izquierdo). Cabeza y tronco van solos. */
export const SEGMENTOS_PARES: readonly Segmento[] = ['brazo', 'antebrazo', 'mano', 'muslo', 'tibia', 'pie']

/** Suma de las fracciones de masa del cuerpo entero: pares contados dos veces. */
export function sumaDeFracciones(sexo: Sexo): number {
  return SEGMENTOS.reduce(
    (suma, s) => suma + DE_LEVA[sexo].segmentos[s].masa * (SEGMENTOS_PARES.includes(s) ? 2 : 1),
    0,
  )
}

/** Cada constante con su id de procedencia: `deleva96.h.muslo.masa → 0.1416`. */
export function valoresDeLeva(): Record<string, number> {
  const salida: Record<string, number> = {}
  for (const sexo of ['h', 'm'] as const) {
    salida[`deleva96.${sexo}.estatura_ref`] = DE_LEVA[sexo].estaturaDeReferencia
    for (const s of SEGMENTOS) {
      const p = DE_LEVA[sexo].segmentos[s]
      salida[`deleva96.${sexo}.${s}.masa`] = p.masa
      salida[`deleva96.${sexo}.${s}.cm`] = p.cm
      salida[`deleva96.${sexo}.${s}.largo`] = p.largo
    }
  }
  for (const sexo of ['h', 'm'] as const) {
    for (const s of ['cabeza', 'tronco'] as const) {
      const p = DE_LEVA_CERV[sexo][s]
      salida[`deleva96.cerv.${sexo}.${s}.masa`] = p.masa
      salida[`deleva96.cerv.${sexo}.${s}.cm`] = p.cm
      salida[`deleva96.cerv.${sexo}.${s}.largo`] = p.largo
    }
  }
  return salida
}
