/**
 * Qué archivo se puede mandar por el chat y a qué tamaño se reduce.
 *
 * Los topes son distintos por una razón concreta: una imagen se puede comprimir
 * en el navegador con `canvas`, así que da igual lo que pese al elegirla. Un
 * video no —comprimirlo bien exige transcodificar— así que su tope es el que
 * viaja de verdad por la red del asesorado.
 */

export type TipoAdjunto = 'imagen' | 'video'

export type ResultadoValidacion =
  | { ok: true; tipo: TipoAdjunto }
  | { ok: false; motivo: string }

/** Lado mayor al que se reduce una imagen antes de subirla. */
export const LADO_MAXIMO = 1600

const TOPE_VIDEO_MB = 25
const TOPE_IMAGEN_MB = 50

const MB = 1_000_000

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

export function validarAdjunto(archivo: { type: string; size: number }): ResultadoValidacion {
  if (archivo.size === 0) return { ok: false, motivo: 'El archivo está vacío.' }

  if (archivo.type.startsWith('image/')) {
    if (archivo.size > TOPE_IMAGEN_MB * MB) {
      return { ok: false, motivo: `La imagen pesa más de ${TOPE_IMAGEN_MB} MB.` }
    }
    return { ok: true, tipo: 'imagen' }
  }

  if (archivo.type.startsWith('video/')) {
    if (archivo.size > TOPE_VIDEO_MB * MB) {
      return {
        ok: false,
        motivo: `El video pesa más de ${TOPE_VIDEO_MB} MB. Graba uno más corto: con 10 o 15 segundos tu coach ve la técnica.`,
      }
    }
    return { ok: true, tipo: 'video' }
  }

  return { ok: false, motivo: 'Solo puedes mandar fotos o videos.' }
}

export function dimensionesDestino(ancho: number, alto: number): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto)
  if (mayor <= LADO_MAXIMO) return { ancho, alto }
  const factor = LADO_MAXIMO / mayor
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor) }
}

export function extensionDe(mime: string): string {
  return EXTENSIONES[mime] ?? 'bin'
}
