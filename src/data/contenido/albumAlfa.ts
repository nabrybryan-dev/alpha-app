import { ASESORADOS_DESTACADOS } from './asesoradosDestacados'

/**
 * Álbum Alfa: las fichas coleccionables que se ven en Hoy en rejilla 2×2.
 *
 * No hay contenido propio aquí. Son los mismos asesorados destacados que ya
 * salían en Logros, recortados a lo que cabe en una ficha pequeña: foto,
 * nombre, a qué se dedica y su frase. La historia completa se queda en la
 * ficha grande de Logros, que es a donde lleva cada sticker.
 *
 * Reusarlos no es pereza: son personas reales con foto y consentimiento. No se
 * inventan casos de ejemplo para rellenar el álbum.
 */

/** Un sticker por mesociclo del bloque de 24. */
export const STICKERS_TOTALES = 24

export interface StickerAlbum {
  id: string
  /** "01"…: el número que se pinta sobre la foto. */
  numero: string
  /** Categoría de la ficha: "Disciplina", "Recomposición"… */
  categoria: string
  nombre: string
  /** Línea mono bajo el nombre: a qué se dedica. */
  detalle: string
  /** Frase corta de cierre, 1–2 líneas. */
  frase: string
  foto: string
  fotoPos?: string
}

export function stickersDelAlbum(): StickerAlbum[] {
  return ASESORADOS_DESTACADOS.filter((a) => a.foto !== undefined).map((a, i) => ({
    id: a.id,
    numero: String(i + 1).padStart(2, '0'),
    categoria: a.superpoder,
    nombre: a.nombre,
    detalle: a.rol,
    frase: a.frase,
    foto: a.foto as string,
    fotoPos: a.fotoPos,
  }))
}
