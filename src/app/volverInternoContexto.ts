import { createContext, useContext } from 'react'

/**
 * EL «‹» DE LA CABECERA TAMBIÉN SIRVE PARA UN ESTADO INTERNO.
 *
 * Hay dos pantallas del asesorado que no son una ruta: el detalle de una comida y
 * la vista Semana del diario. Se abren dentro de `/nutricion` sin cambiar la
 * dirección, así que `rutas.ts` no tiene un padre al que volver y la cabecera no
 * pinta su «‹». Hasta ahora cada una traía su propio botón redondo con «←», y eso
 * es justo lo que el encargo manda quitar: un solo volver, el de la cabecera.
 *
 * Quien abre un estado interno registra aquí cómo cerrarlo; `TopBar` lo usa como
 * destino antes que el padre de la ruta. Sin proveedor (tests sueltos) no hay
 * nada registrado y todo sigue como siempre.
 */
export interface VolverInterno {
  volver: (() => void) | null
  /** Cómo se llama el estado interno al que se vuelve. Lo dice quien lo registra. */
  titulo: string | null
  registrar: (cerrar: (() => void) | null, titulo?: string) => void
}

export const ContextoVolverInterno = createContext<VolverInterno>({
  volver: null,
  titulo: null,
  registrar: () => {},
})

export function useVolverInterno(): VolverInterno {
  return useContext(ContextoVolverInterno)
}
