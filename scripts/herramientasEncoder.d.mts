// Tipos del localizador del repo de herramientas (`herramientasEncoder.mjs`).
//
// El script es `.mjs` a propósito, igual que `codigo-huerfano.mjs`: lo ejecuta Node
// sin pasar por el compilador. Esta declaración existe para que `tsc --strict` y el
// guardián del núcleo (`src/features/entrenar/encoder/nucleo.test.ts`) lo vean
// tipado en vez de como `any` implícito. Si cambia la firma del `.mjs`, hay que
// actualizar este archivo a mano.

/**
 * La ruta de `herramientas/encoder-camara`, o `null` si no está clonado.
 *
 * `ENCODER_HERRAMIENTAS` manda: si está puesta, es el único candidato.
 */
export function buscarHerramientas(entorno?: Record<string, string | undefined>): string | null

/** Qué hacer cuando no aparece, en una frase, para no decirlo de dos maneras. */
export const COMO_ENCONTRARLAS: string
