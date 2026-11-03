import { createContext, useContext } from 'react'

/**
 * Lo que la app SABE de su propia historia: la dirección de la pantalla anterior si es de la app, o `null`
 * si no la hay (se entró por un enlace o un aviso, o ya se volvió una vez con `replace`). La cuenta la lleva
 * `HistoriaInterna`; la clave de la dirección de react-router no sirve para esto, porque tras un `replace`
 * deja de ser «default» y el «‹» acabaría sacando a la persona de la app con `navigate(-1)`.
 *
 * Sin proveedor (una cabecera montada suelta en una prueba) no hay historia conocida: el «‹» va al padre.
 */
export interface HistoriaDeLaApp {
  anterior: string | null
}

export const ContextoDeHistoria = createContext<HistoriaDeLaApp>({ anterior: null })

export function useHistoriaInterna(): HistoriaDeLaApp {
  return useContext(ContextoDeHistoria)
}
