import { caraQueSeVe, destinoDeLaVuelta, etiquetaDeLaVuelta } from '../camara/vueltaDelCuerpo'
import { Opcion } from './OpcionDeTecla'

/**
 * «DAR LA VUELTA» (maqueta 7): gira el sujeto a la cara contraria a la que se ve. Su nombre
 * accesible dice qué se ve ahora y a dónde lleva. Sin mando (`alDarLaVuelta`) no se pinta.
 */
export function BotonDarLaVuelta({
  azimut = 0,
  alDarLaVuelta,
}: {
  azimut?: number
  alDarLaVuelta?: (azimut: number) => void
}) {
  if (!alDarLaVuelta) return null
  return (
    <Opcion
      radio={false}
      activa={false}
      etiqueta={etiquetaDeLaVuelta(azimut)}
      detalle={caraQueSeVe(azimut) === 'frente' ? 'ves el frente' : 'ves la espalda'}
      onClick={() => alDarLaVuelta(destinoDeLaVuelta(azimut))}
    >
      Dar la vuelta
    </Opcion>
  )
}
