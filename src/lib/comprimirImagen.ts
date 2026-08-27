import { dimensionesDestino } from '../domain/adjuntos'
import type { RespuestaCompresion } from './comprimirImagen.worker'

/**
 * Cuánto se le da al worker antes de rendirse y comprimir aquí.
 *
 * No es un lujo defensivo: sin tope, un worker que se quede colgado deja la
 * promesa sin resolver **para siempre**, y con ella la foto sin subir. Y no
 * habría error que lo delatara — el mensaje se quedaría en «subiendo» sin que
 * nadie sepa por qué.
 */
const TOPE_WORKER_MS = 8_000

/**
 * Encoge la foto sin bloquear la interfaz, si el navegador deja.
 *
 * Devuelve `undefined` —y no lanza— ante cualquier problema: quien llama
 * comprime en el hilo principal, que es lo que se hacía antes de existir esto.
 */
async function comprimirEnWorker(archivo: Blob): Promise<Blob | undefined> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return undefined

  let worker: Worker
  try {
    worker = new Worker(new URL('./comprimirImagen.worker.ts', import.meta.url), {
      type: 'module',
    })
  } catch {
    return undefined
  }

  try {
    return await new Promise<Blob | undefined>((resolver) => {
      const reloj = setTimeout(() => resolver(undefined), TOPE_WORKER_MS)
      const terminar = (valor: Blob | undefined) => {
        clearTimeout(reloj)
        resolver(valor)
      }

      worker.onmessage = (evento: MessageEvent<RespuestaCompresion>) => {
        terminar(evento.data?.ok ? evento.data.blob : undefined)
      }
      worker.onerror = () => terminar(undefined)
      worker.postMessage(archivo)
    })
  } finally {
    // Uno por foto, y se cierra al terminar. Reutilizar uno solo obligaría a
    // correlacionar respuestas cuando se mandan dos fotos seguidas, y arrancar
    // un worker cuesta milisegundos frente a los cientos que ahorra.
    worker.terminate()
  }
}

/** La versión de siempre: encoge aquí mismo, en el hilo principal. */
async function comprimirAqui(archivo: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return archivo

  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(archivo)
    const { ancho, alto } = dimensionesDestino(bitmap.width, bitmap.height)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const contexto = lienzo.getContext('2d')
    if (!contexto) return archivo
    contexto.drawImage(bitmap, 0, 0, ancho, alto)
    const reducida = await new Promise<Blob | null>((resolver) =>
      lienzo.toBlob(resolver, 'image/jpeg', 0.8),
    )
    return reducida ?? archivo
  } catch {
    return archivo
  } finally {
    bitmap?.close()
  }
}

/**
 * Reduce la foto antes de subirla.
 *
 * El video se devuelve intacto: comprimirlo bien exige transcodificar, y las
 * soluciones de navegador son pesadas y frágiles. Su control es el tope de
 * tamaño (`domain/adjuntos.ts`), no la compresión.
 *
 * Tres niveles de vuelta atrás, y ninguno pierde la foto:
 *
 *   1. un Web Worker, para no congelar la interfaz;
 *   2. el hilo principal, si el navegador no tiene worker u `OffscreenCanvas`,
 *      o si el worker falla o tarda demasiado;
 *   3. el archivo original.
 *
 * Ante cualquier fallo devuelve el original. Perder la foto por no poder
 * encogerla sería peor que subirla grande.
 */
export async function comprimirSiEsImagen(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) return archivo

  const enWorker = await comprimirEnWorker(archivo)
  if (enWorker) return enWorker

  return comprimirAqui(archivo)
}
