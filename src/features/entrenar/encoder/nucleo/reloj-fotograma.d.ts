/* Tipos a mano para `reloj-fotograma.js`, que entra VERBATIM. Ver `ORIGEN.md`.
 *
 * Existe por un fallo que ninguna prueba sintetica podia destapar: en iPhone
 * `mediaTime` ES FINITO Y NUNCA AVANZA, asi que un `Number.isFinite()` lo daba
 * por bueno y toda la tanda salia con la misma hora. El reloj se elige mirando
 * cual SE MUEVE, no cual es finito. */

export interface CandidatoDeReloj {
  nombre: string
  presente: boolean
  avanza: boolean
  enUso: boolean
}

export interface Reloj {
  /** Nombre del reloj en uso, o null mientras decide. */
  readonly nombre: string | null
  readonly decidido: boolean
  /** Que candidatos hay y cuales se han movido. Para enseñarlo en pantalla. */
  diagnostico(): CandidatoDeReloj[]
  /** Segundos. `meta` es el segundo argumento de requestVideoFrameCallback. */
  instante(meta: VideoFrameCallbackMetadata | null, ahora: number): number
}

export function nuevoReloj(opciones?: { minMuestras?: number }): Reloj
