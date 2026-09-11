export interface Muelle {
  masa: number
  rigidez: number
  amortiguacion: number
}

export interface TokenDeMuelle {
  nombre: string
  /** Cuánto tarda en asentarse, en milisegundos. */
  ms: number
  /** La curva ya escrita como CSS: `linear(0, …, 1)`. */
  curva: string
  muelle: Muelle
}

export declare const MUELLES: Record<string, Muelle>
export declare function tokens(): TokenDeMuelle[]
