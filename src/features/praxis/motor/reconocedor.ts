/**
 * El reconocimiento de voz DEL NAVEGADOR (Google en Android/Chrome, Apple en iPhone), sin nada de la escena.
 *
 * Vive aparte de `hablar.ts` para que lo use también la prueba del ingreso (`ingreso/`) sin arrastrar el
 * motor entero de Praxis. La app NO toca el audio: ni getUserMedia ni MediaRecorder; solo recibe texto.
 */

/** Mantener ≥ 250 ms abre el reconocedor; un toque corto no graba nada. */
export const UMBRAL_MS = 250
/** Un minuto como máximo por toma. */
export const TOMA_MAX_MS = 60_000
/** Tras soltar, se espera lo final del reconocedor como mucho este tiempo. */
export const ESPERA_FINAL_MS = 2500

export interface Alternativa { transcript: string }
export interface ResultadoVoz { readonly isFinal: boolean; readonly length: number; readonly [i: number]: Alternativa }
export interface EventoVoz { resultIndex: number; results: ArrayLike<ResultadoVoz> }
export interface Reconocedor {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number
  onresult: ((e: EventoVoz) => void) | null; onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}
export type ConstructorReconocedor = new () => Reconocedor

/** El reconocedor del navegador, si lo hay. */
export function reconocedor(): ConstructorReconocedor | null {
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/** Junta lo que va entendiendo el reconocedor: lo final y lo provisional, sin espacios de más. */
export function leerResultados(e: EventoVoz): { final: string; interino: string } {
  const finales: string[] = [], interinos: string[] = []
  for (let i = 0; i < e.results.length; i++) {
    const r = e.results[i], tx = (r && r[0] && r[0].transcript) || ''
    if (r.isFinal) finales.push(tx); else interinos.push(tx)
  }
  return { final: finales.join(' ').replace(/\s+/g, ' ').trim(), interino: interinos.join(' ').replace(/\s+/g, ' ').trim() }
}
