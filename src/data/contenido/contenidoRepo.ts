import type { ContenidoAlfaRepo } from '../repos'
import { stickersDelAlbum } from './albumAlfa'
import { NOTICIAS_RADAR } from './radarAlfa'

/**
 * Contenido editorial de la app (Álbum Alfa y Radar Alfa).
 *
 * Es lo mismo para todos: no depende del asesorado ni de sus datos. Cuando el
 * equipo lo mueva a una tabla de Supabase o a un CMS, se cambia solo este
 * archivo; las pantallas piden `db.contenidoAlfa.*` y no saben de dónde sale.
 */
export function crearContenidoRepo(): ContenidoAlfaRepo {
  return {
    album: () => stickersDelAlbum(),
    radar: () => NOTICIAS_RADAR,
  }
}
