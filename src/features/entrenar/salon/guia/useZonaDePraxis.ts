import { useCallback, useState } from 'react'
import { ENCUADRE_DEL_CUERPO } from '../../sujeto/encuadreDelCuerpo'
import type { IdDeRegion } from '../../sujeto/regiones'
import type { VueltaDelCuerpo } from '../camara/useVueltaDelCuerpo'
import { caraQueSeVe } from '../camara/vueltaDelCuerpo'
import { ENFOQUE_DE_REGION } from './zonasDePraxis'

/** Un paso de lo que Praxis cuenta, con la zona que enciende mientras tanto. */
export interface PasoAbierto {
  paso: number
  zona: IdDeRegion | null
}

/** `null` = cerrada; `'indice'` = la lista de zonas; una región = esa zona; un paso = lo que cuenta Praxis. */
export type EstadoDeLaGuia = null | 'indice' | IdDeRegion | PasoAbierto

function zonaDe(destino: EstadoDeLaGuia): IdDeRegion | null {
  if (destino === null || destino === 'indice') return null
  return typeof destino === 'object' ? destino.zona : destino
}

/**
 * LO ABIERTO EN LA GUÍA Y LA CÁMARA QUE LE CORRESPONDE. Con una zona, el visor va a su cara y su altura;
 * sin ella, vuelve el encuadre entero por la cara que se estaba viendo.
 * `soltar` cierra sin mover la cámara: es para irse a la vista de movimiento, que trae su propio encuadre.
 */
export function useZonaDePraxis(viajar: (destino: Omit<VueltaDelCuerpo, 'orden'>) => void) {
  const [guia, setGuia] = useState<EstadoDeLaGuia>(null)

  const irA = useCallback(
    (destino: EstadoDeLaGuia, azimutActual: number) => {
      setGuia(destino)
      const zona = zonaDe(destino)
      if (!zona) {
        viajar({
          azimut: caraQueSeVe(azimutActual) === 'frente' ? 0 : 180,
          elevacion: ENCUADRE_DEL_CUERPO.elevacion,
          distancia: ENCUADRE_DEL_CUERPO.distancia,
          centro: [...ENCUADRE_DEL_CUERPO.centro],
        })
        return
      }
      const e = ENFOQUE_DE_REGION[zona]
      viajar({ azimut: e.azimut, elevacion: e.elevacion, distancia: e.distancia, centro: [0, e.alto, 0] })
    },
    [viajar],
  )
  const soltar = useCallback(() => setGuia(null), [])

  return { guia, irA, soltar, zona: zonaDe(guia) }
}
