import { useEffect } from 'react'
import { useDisenoFinal } from './organizacionViva'

/**
 * La piel de «Alpha · Rediseño» (maqueta 7, validada por Bryan el 13-nov-2026) en toda la app, solo para las cuentas
 * con el diseño final (`CUENTAS_CON_DISENO_FINAL`). Marca la raíz con `data-piel="maqueta"`; los estilos que cambian
 * (radio, relleno sólido, sombra) viven en `tokens.css`, bloque «PIEL DE LA MAQUETA 7», y solo aplican con la marca.
 * Para cualquier otra cuenta la raíz no lleva marca y la app se ve exactamente como antes.
 */
export function usePielDeLaMaqueta(): void {
  const encendida = useDisenoFinal()
  useEffect(() => {
    const raiz = document.documentElement
    if (!encendida) {
      delete raiz.dataset.piel
      return
    }
    raiz.dataset.piel = 'maqueta'
    return () => {
      delete raiz.dataset.piel
    }
  }, [encendida])
}
