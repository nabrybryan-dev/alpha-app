import { dimensionesDestino } from '../domain/adjuntos'

/**
 * Reduce la foto antes de subirla.
 *
 * El video se devuelve intacto: comprimirlo bien exige transcodificar, y las
 * soluciones de navegador son pesadas y frágiles. Su control es el tope de
 * tamaño (`domain/adjuntos.ts`), no la compresión.
 *
 * Ante cualquier fallo devuelve el original. Perder la foto por no poder
 * encogerla sería peor que subirla grande.
 */
export async function comprimirSiEsImagen(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) return archivo
  if (typeof createImageBitmap !== 'function') return archivo

  try {
    const bitmap = await createImageBitmap(archivo)
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
  }
}
