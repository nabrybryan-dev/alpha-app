import { useCallback, useState } from 'react'
import { ENCUADRE_DEL_CUERPO } from '../../sujeto/encuadreDelCuerpo'
import type { IdDeRegion } from '../../sujeto/regiones'
import type { VueltaDelCuerpo } from '../camara/useVueltaDelCuerpo'
import { caraQueSeVe } from '../camara/vueltaDelCuerpo'
import { ENFOQUE_DE_REGION } from './zonasDePraxis'

/** `null` = guía cerrada; `'indice'` = la lista de zonas; una región = esa zona abierta. */
export type EstadoDeLaGuia = null | 'indice' | IdDeRegion

/**
 * LO ABIERTO EN LA GUÍA Y LA CÁMARA QUE LE CORRESPONDE. Abrir una zona lleva al visor a su cara y su
 * altura; volver al índice o cerrar devuelve el encuadre entero, por la cara que se estaba viendo.
 * `soltar` cierra sin mover la cámara: es para irse a la vista de movimiento, que trae su propio encuadre.
 */
export function useZonaDePraxis(viajar: (destino: Omit<VueltaDelCuerpo, 'orden'>) => void) {
  const [guia, setGuia] = useState<EstadoDeLaGuia>(null)

  const irA = useCallback(
    (destino: EstadoDeLaGuia, azimutActual: number) => {
      setGuia(destino)
      if (destino === null || destino === 'indice') {
        viajar({
          azimut: caraQueSeVe(azimutActual) === 'frente' ? 0 : 180,
          elevacion: ENCUADRE_DEL_CUERPO.elevacion,
          distancia: ENCUADRE_DEL_CUERPO.distancia,
          centro: [...ENCUADRE_DEL_CUERPO.centro],
        })
        return
      }
      const e = ENFOQUE_DE_REGION[destino]
      viajar({ azimut: e.azimut, elevacion: e.elevacion, distancia: e.distancia, centro: [0, e.alto, 0] })
    },
    [viajar],
  )
  const soltar = useCallback(() => setGuia(null), [])

  return { guia, irA, soltar, zona: guia !== null && guia !== 'indice' ? guia : null }
}
