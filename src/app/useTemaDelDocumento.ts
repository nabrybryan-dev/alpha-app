import { useSyncExternalStore } from 'react'
import { leerTemaDelDocumento, suscribirseAlTema, type Tema } from '../lib/temaDelDocumento'

/**
 * El tema activo como estado de React, para las piezas que tienen que VOLVER A
 * CONSTRUIR algo cuando cambia (la escena 3D, la sala en SVG). No duplica el tema
 * de `ThemeProvider`: lee el mismo `data-theme` y se entera por el observador.
 */
export function useTemaDelDocumento(): Tema {
  return useSyncExternalStore(suscribirseAlTema, leerTemaDelDocumento, () => 'dark')
}
