import type { Usuario } from '../../domain/types'

/**
 * Cómo se lee `usuarios_app` de la nube. Es el único sitio que lo decide.
 *
 * LA SELECCIÓN ES `*` A PROPÓSITO. `usuarios_app.slug` lo crea la migración 0081 y el
 * orden de despliegue es primero la app, después la migración. En `hidratarDesdeNube` un
 * error en cualquier tabla tumba la descarga entera, y un `select('…,slug')` contra una
 * base sin esa columna es un error: entre el despliegue y la migración nadie podría abrir
 * la app. Con `*` la columna llega cuando existe y no molesta cuando no.
 */
export const TABLA_USUARIOS = 'usuarios_app'
export const SELECCION_USUARIOS = '*'

export interface FilaUsuario {
  id: string
  nombre: string
  rol: 'asesorado' | 'coach' | 'nutricionista'
  avatar_iniciales: string
  /** Migración 0081. Falta mientras no se haya aplicado. */
  slug?: string | null
}

export function usuarioDeFila(fila: FilaUsuario): Usuario {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rol: fila.rol,
    avatarIniciales: fila.avatar_iniciales || fila.nombre.slice(0, 2).toUpperCase(),
    ...(fila.slug ? { slug: fila.slug } : {}),
  }
}
