// La superficie pública del espejo (`espejo.mts`).
//
// POR QUÉ EXISTE SI EL SCRIPT YA ES TYPESCRIPT. Los otros scripts de esta carpeta
// son `.mjs` y su `.d.mts` es la única fuente de tipos que tienen. Aquí no: el
// espejo es `.mts` y se tipa solo. Este archivo es otra cosa — **el contrato que
// se promete a quien lo llama**, escrito a mano y aparte de la implementación.
//
// Y no es decorativo: `espejo.test.ts` importa los tipos DE AQUÍ y los valores del
// `.mts`. Si la implementación cambia una firma y no se actualiza este archivo,
// el test deja de compilar. Es la misma disciplina que `codigo-huerfano.d.mts`,
// con la diferencia de que allí el `.d.mts` sustituye a los tipos y aquí los vigila.
//
// `scripts/` queda fuera de `tsconfig.app.json` (que solo incluye `src`), así que
// `tsc -b` NO revisa esta carpeta. Quien la vigila es el test.

import type { DiaRuta } from '../../src/domain/rutaEntrenamiento.ts'
import type { Microciclo, Sesion } from '../../src/domain/types.ts'

/** Las cinco cosas que el espejo sabe ver. Cada clave nació de un fallo real. */
export type ClaveDeAviso =
  /** Título sin nada debajo: ni ejercicios ni bloques de cardio. */
  | 'sesion-vacia'
  /** El `||` del generador impreso tal cual, fundiendo los párrafos. */
  | 'barras-literales'
  /** La nota de la semana habla de un microciclo anterior al activo. */
  | 'nota-vieja'
  /** La prescripción promete kilos y `cargaKg` no los trae. */
  | 'carga-sin-kilos'
  /** Hay sesiones que no llegan a ningún día: la persona ve «Descanso». */
  | 'descanso-en-cadencia'

/** Un aviso es un fallo con su sitio, no una impresión. */
export interface Aviso {
  clave: ClaveDeAviso
  /** Día, sesión o ejercicio donde ocurre. */
  donde: string
  /** Qué pasa, en la lengua del coach. */
  detalle: string
}

/** Un día de la rejilla, con lo que la persona encuentra dentro. */
export interface DiaDelEspejo {
  /** Tal cual lo devuelve `armarSemana`: el espejo no lo reinterpreta. */
  dia: DiaRuta
  /** La sesión que cayó en ese día, si cayó alguna. */
  sesion?: Sesion
  ejercicios: number
  bloques: number
}

/** Lo que se ve, ya resuelto: siete días, la nota y los avisos. */
export interface Espejo {
  microciclo: Microciclo
  hoyIso: string
  /** Dónde abre la semana de ESTA persona, según `inicioSemanaDe`. */
  inicio: 'DOMINGO' | 'LUNES'
  /** Siempre siete, en el orden en que se pintan. */
  dias: DiaDelEspejo[]
  nota?: string
  avisos: Aviso[]
}

/** Banderas de la línea de comandos. */
export interface Argumentos {
  microciclo?: string
  hoy?: string
  nota?: string
}

/** Los números de microciclo que cita un texto: «va mejor que en M25» → `[25]`. */
export declare function microciclosCitados(nota: string): number[]

/** Los cinco avisos, calculados sobre la rejilla ya armada por la app. */
export declare function avisosDe(
  micro: Microciclo,
  dias: DiaDelEspejo[],
  nota?: string,
): Aviso[]

/** Arma el espejo: la rejilla de la app más lo que hay dentro de cada día. */
export declare function espejar(micro: Microciclo, hoyIso: string, nota?: string): Espejo

/** El texto que se imprime: la semana, la nota en tarjetas y los avisos. */
export declare function renderizar(espejo: Espejo): string

/** Lee las banderas; lo que no venga queda sin definir. */
export declare function leerArgumentos(argv: readonly string[]): Argumentos

/** Acepta un `Microciclo` pelado o `{ microciclo, nota }`. */
export declare function leerFixture(crudo: string): { microciclo: Microciclo; nota?: string }
