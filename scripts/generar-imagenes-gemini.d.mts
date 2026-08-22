// Tipos de las partes puras del generador de borradores (`generar-imagenes-gemini.mjs`).
// El script es `.mjs` porque lo ejecuta Node directamente. Si cambian las firmas del
// `.mjs`, actualizar este archivo a mano.

export interface PromptDeImagen {
  archivo: string
  prompt: string
}

/** Saca del paquete Markdown los prompts de imagen con su archivo de destino. */
export function extraerPromptsDeImagen(markdown: string): PromptDeImagen[]

/** Cuerpo de la petición a `generateContent`. */
export function construirPeticion(prompt: string): {
  contents: { role: string; parts: { text: string }[] }[]
  generationConfig: { responseModalities: string[] }
}

/** Base64 de la primera imagen de la respuesta. Lanza diciendo qué vino si no hay. */
export function extraerImagenBase64(respuesta: unknown): string
