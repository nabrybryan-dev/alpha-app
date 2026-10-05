/**
 * Rutas que se abren SIN sesión. Hoy solo una: el espacio de los interesados que llegan
 * por un creador (migración 0089). `App.tsx` las monta por fuera de `SessionProvider`,
 * porque quien llega aún no tiene cuenta y el proveedor de sesión le enseñaría el login.
 *
 * Va en su propio archivo y no en `App.tsx` para que el componente no comparta módulo
 * con una función (regla `react-refresh/only-export-components`).
 */
export const RUTA_INTERESADOS = '/interesados'

export function esRutaPublica(pathname: string): boolean {
  return pathname === RUTA_INTERESADOS || pathname.startsWith(`${RUTA_INTERESADOS}/`)
}
