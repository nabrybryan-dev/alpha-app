import type { RutaAsesorado } from '../../domain/rutaEntrenamiento'
import type { RutaRepo } from '../repos'
import { rutaPorDefecto } from './contenidoRuta'

/**
 * Acceso a la valoración de ruta (nivel, competencias y requisitos).
 *
 * Hoy sirve el contenido de `contenidoRuta.ts` para cualquier asesorado. Cuando
 * exista la tabla en Supabase, este es el único archivo que cambia: la pantalla
 * ya pide `db.ruta.byUsuario(id)` y no sabe de dónde sale.
 */
export function crearRutaRepo(): RutaRepo {
  return {
    byUsuario: (usuarioId: string): RutaAsesorado => rutaPorDefecto(usuarioId),
  }
}
