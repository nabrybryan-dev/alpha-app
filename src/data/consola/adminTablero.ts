import { SECCIONES, ultimoCortePorSeccion, type FilaAdminTablero, type SeccionLeida } from '../../domain/adminTablero'
import { modoNube, supabase } from '../supabase'
import type { Lectura } from './creadores'

/**
 * Lectura de `admin_tablero` (migración 0102): el Área administrativa. SOLO LECTURA: la base no da
 * insert/update/delete a `authenticated`, así que este archivo no ofrece escritura; la carga la
 * hace un importador con `service_role` y el OK de Bryan. Lee quien tiene `ver_administracion`.
 *
 * Se pide el ÚLTIMO corte de cada sección con una consulta por sección (`order corte desc limit 1`)
 * en vez de una lectura general: una sección que lleva semanas sin subirse no puede quedar fuera
 * por un tope de filas. Un fallo en una sola sección hace fallar la lectura entera y se dice; nunca
 * se pinta como «no hay nada».
 *
 * Las columnas salen de aquí y las pruebas las comparan contra el SQL de la migración.
 */
export const TABLA_ADMIN_TABLERO = 'admin_tablero'
export const COLUMNAS_ADMIN_TABLERO = ['id', 'seccion', 'corte', 'datos', 'fuente', 'huella'] as const

const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

/** Las siete secciones con su último corte ya validado. En demo (sin nube), todas «sin corte». Nunca lanza. */
export async function adminTablero(): Promise<Lectura<SeccionLeida[]>> {
  if (!modoNube) return { ok: true, datos: ultimoCortePorSeccion([]) }
  try {
    const respuestas = await Promise.all(
      SECCIONES.map(async (seccion) => {
        const { data, error } = await supabase()
          .from(TABLA_ADMIN_TABLERO)
          .select(COLUMNAS_ADMIN_TABLERO.join(','))
          .eq('seccion', seccion)
          .order('corte', { ascending: false })
          .limit(1)
        return { seccion, data, error }
      }),
    )
    const filas: FilaAdminTablero[] = []
    for (const { seccion, data, error } of respuestas) {
      if (error) return { ok: false, error: `${seccion}: ${error.message || 'la consulta falló'}` }
      if (!Array.isArray(data)) return { ok: false, error: `${seccion}: la respuesta no trajo filas` }
      filas.push(...(data as unknown as FilaAdminTablero[]))
    }
    return { ok: true, datos: ultimoCortePorSeccion(filas) }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}
