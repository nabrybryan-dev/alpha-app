/**
 * LA HUELLA DE UNA REPETICIÓN: lo que la barra hizo, reducido a lo que se puede guardar.
 *
 * ## Qué guarda y por qué tan poco
 *
 * El encoder produce la trayectoria entera de la barra a la frecuencia de la cámara —
 * cientos de muestras por serie— y eso no cabe en una serie registrada que viaja a la
 * base con el microciclo. Lo que hace falta para VER una repetición sobre el sujeto son
 * dos cosas: cuánto duró y dónde estaba la barra a lo largo de ella. Veinticuatro
 * muestras a intervalos iguales bastan para que el fantasma se mueva sin tirones, y un
 * fantasma es lo único que esto alimenta.
 *
 * ## Por qué la ÚLTIMA repetición
 *
 * Porque es la que dice cómo se terminó: la que más se frenó, la que más cuesta, la que
 * decide si la carga sube o se queda. La primera es la que se compara en velocidad; la
 * última es la que se enseña.
 *
 * ## Por qué entra la excéntrica anterior
 *
 * El encoder segmenta por concéntricas —de abajo a arriba—, pero una repetición que se ve
 * es bajar Y subir. Sin la bajada, el fantasma aparecería abajo de golpe y subiría: media
 * repetición. Cuando el análisis trae `excSeg` para esa repetición, la ventana empieza ese
 * tiempo antes; si no lo trae —la primera de la serie— se queda con la concéntrica sola,
 * que es lo que hay.
 *
 * ## Normalizada, no en metros
 *
 * La barra se normaliza entre su mínimo y su máximo DENTRO de la ventana. No se usan
 * metros porque la escala del encoder no se sostiene —cero de 61 vídeos daban escala
 * fiable el 3-sep— y una huella en metros equivocados sería una huella falsa con aspecto
 * de precisa. En fase de 0 a 1, la escala se cancela igual que en el %PV.
 */

export interface HuellaDeRepeticion {
  /** Cuánto duró la repetición, en segundos. Manda el reloj de la persona, no el del patrón. */
  duracionSeg: number
  /**
   * La fase de la barra, de 0 (abajo) a 1 (arriba), a intervalos iguales a lo largo de la
   * repetición. La primera muestra es el instante 0 y la última el instante `duracionSeg`.
   * Con menos de dos muestras no hay trayectoria.
   */
  fase: number[]
  /**
   * LO ARTICULAR: los ángulos que la persona hizo, canal a canal, en las MISMAS muestras
   * que `fase`. Las claves son los canales anatómicos de `Pose` (`rodillaFlex`,
   * `caderaFlex`, `toraxFlex`, `lumbarFlex`, `hombroFlex`, `codoFlex`), en grados y sin
   * sufijo de lado: la pista es sagital y un lado vale por los dos.
   *
   * Ausente en la huella que sale del encoder de barra —que solo ve la barra— y presente
   * en la que sale de una pista de pose (`huellaArticular.ts`). Con esto el fantasma no
   * repite la técnica ideal a otro ritmo: dobla la rodilla lo que se dobló y se inclina
   * lo que se inclinó.
   */
  articular?: Record<string, number[]>
}

/** Lo que hace falta del análisis: la trayectoria y dónde empieza y acaba cada repetición. */
export interface TrayectoriaMedida {
  t: number[]
  s: number[]
}

export interface RepeticionMedida {
  iInicio: number
  iFin: number
  /** Segundos de excéntrica previos. Ausente en la primera repetición. */
  excSeg?: number
}

/** Cuántas muestras lleva una huella. Bastan para 60 Hz interpolando; caben en una fila. */
export const MUESTRAS_DE_HUELLA = 24

/**
 * La huella de la última repetición de una serie medida, o `undefined` si no da para una.
 *
 * `undefined` y no una huella vacía: quien pinte comprueba si hay huella, y una huella
 * vacía obligaría a comprobar además si la huella vale. Una sola pregunta.
 */
export function huellaDeSerieMedida(
  trayectoria: TrayectoriaMedida,
  reps: readonly RepeticionMedida[],
  muestras = MUESTRAS_DE_HUELLA,
): HuellaDeRepeticion | undefined {
  const ultima = reps[reps.length - 1]
  if (!ultima) return undefined
  const { t, s } = trayectoria
  if (t.length !== s.length || t.length < 2) return undefined
  const iFin = Math.min(ultima.iFin, t.length - 1)
  const iInicio = Math.max(0, Math.min(ultima.iInicio, iFin))
  if (!(iFin > iInicio)) return undefined

  // La ventana en tiempo: desde la excéntrica previa, si la hubo, hasta el final.
  const tFin = t[iFin]
  const tInicio = ultima.excSeg !== undefined && ultima.excSeg > 0 ? t[iInicio] - ultima.excSeg : t[iInicio]
  const duracionSeg = tFin - tInicio
  if (!(duracionSeg > 0)) return undefined

  // Mínimo y máximo DENTRO de la ventana, para normalizar.
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < t.length; i++) {
    if (t[i] < tInicio || t[i] > tFin) continue
    if (s[i] < lo) lo = s[i]
    if (s[i] > hi) hi = s[i]
  }
  if (!(hi > lo)) return undefined

  const fase: number[] = []
  const n = Math.max(2, Math.round(muestras))
  for (let k = 0; k < n; k++) {
    const tk = tInicio + (duracionSeg * k) / (n - 1)
    fase.push((enTiempo(t, s, tk) - lo) / (hi - lo))
  }
  return { duracionSeg, fase }
}

/** Interpola `s` en el instante `tk`, acotando en los extremos. */
function enTiempo(t: number[], s: number[], tk: number): number {
  if (tk <= t[0]) return s[0]
  const ultimo = t.length - 1
  if (tk >= t[ultimo]) return s[ultimo]
  // Búsqueda lineal: las trayectorias son de cientos de muestras y esto corre una vez por
  // huella, no por fotograma.
  let i = 0
  while (i < ultimo && t[i + 1] < tk) i++
  const a = t[i]
  const b = t[i + 1]
  const k = b > a ? (tk - a) / (b - a) : 0
  return s[i] + (s[i + 1] - s[i]) * k
}
