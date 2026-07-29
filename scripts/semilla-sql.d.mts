// Tipos del constructor puro del SQL de semilla (`semilla-sql.mjs`).
//
// El script es `.mjs` a propósito: lo ejecuta Node directamente (`npm run semilla`)
// sin pasar por el compilador. Esta declaración existe para que `tsc --strict` y el
// test `src/test/semilla-sql.test.ts` lo vean tipado en vez de como `any` implícito.
// Si cambian las firmas del `.mjs`, hay que actualizar este archivo a mano.
import type { SeedDb } from '../src/data/seed'

/** Lo que queda del seed tras reducirlo a las cuentas que existen en la nube. */
export type SeedFiltrado = Omit<SeedDb, 'usuarios' | 'hidratacion' | 'ranking'>

/** Literal SQL: comillas simples duplicadas; `null`/`undefined` → `null`. */
export function escaparTexto(valor: unknown): string

/** Etiqueta de dollar-quoting que no aparezca dentro del texto. */
export function elegirEtiqueta(texto: string): string

/** Literal `jsonb` con los ids locales sustituidos por las variables del bloque DO. */
export function literalJsonb(objeto: unknown): string

/** Lanza si el seed filtrado aún referencia usuarios sin cuenta en la nube. */
export function verificarIdsLocales(seed: SeedFiltrado): void

/** Reduce el seed completo al coach y la asesorada de prueba. */
export function filtrarSeed(seed: SeedDb): SeedFiltrado

/** Bloque `DO` completo, listo para pegar en el SQL Editor de Supabase. */
export function construirSemillaSql(
  seedCompleto: SeedDb,
  fechaGeneracion: string,
  correos?: { coach?: string; valentina?: string },
): string
