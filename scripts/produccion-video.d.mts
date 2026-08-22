// Tipos del constructor puro del paquete de vídeo (`produccion-video.mjs`).
//
// El script es `.mjs` a propósito: lo ejecuta Node directamente (`npm run video`)
// sin pasar por el compilador. Esta declaración existe para que `tsc --strict` y el
// test `src/test/produccion-video.test.ts` lo vean tipado en vez de como `any`
// implícito. Si cambian las firmas del `.mjs`, hay que actualizar este archivo a mano.

export interface Formato {
  ratio: string
  ancho: number
  alto: number
  nombre: string
}

export declare const FORMATOS: Record<string, Formato>

export interface Marca {
  nombre: string
  fondo: string
  superficie: string
  acento: string
  acentoOscuro: string
  texto: string
  tenue: string
  luz: string
  camara: string
}

export declare const MARCA: Marca

/** Un plano ya normalizado: sin huecos, con los opcionales rellenos. */
export interface Plano {
  id: string
  descripcion: string
  segundos: number
  textoEnPantalla: string
  locucion: string
  movimiento: string
  composicion: string
  evitar: string[]
}

export interface Brief {
  titulo: string
  objetivo: string
  formato: string
  slug: string
  marca: Marca
  planos: Plano[]
}

export interface Tramo {
  id: string
  desde: number
  hasta: number
}

/** Título → slug de archivo: sin tildes, sin mayúsculas, sin espacios. */
export function aSlug(texto: string): string

/** Valida el brief y rellena lo opcional. Lanza con el motivo concreto. */
export function normalizarBrief(brief: unknown): Brief

/** Segundos acumulados de cada plano, para el guion y los subtítulos. */
export function repartirTiempos(planos: Plano[]): Tramo[]

export function duracionTotal(planos: Plano[]): number

/** El bloque de estilo que se repite al principio de cada prompt. */
export function construirBloqueDeConsistencia(marca: Marca, formato: string): string

/** Prompt de imagen (keyframe) listo para pegar en Nano Banana. */
export function construirPromptImagen(
  plano: Plano,
  contexto: { marca: Marca; formato: string },
): string

/** Prompt de continuidad a partir del plano anterior; `null` si es el primero. */
export function construirPromptVariante(plano: Plano, anterior: Plano | null): string | null

/** Prompt de animación (Veo / Flow) a partir del keyframe. */
export function construirPromptVideo(plano: Plano): string

export function nombreDeArchivo(slug: string, plano: Plano, extension: string): string

/** Paquete de producción completo en Markdown. */
export function construirPaquete(briefCrudo: unknown, fecha: string): string
