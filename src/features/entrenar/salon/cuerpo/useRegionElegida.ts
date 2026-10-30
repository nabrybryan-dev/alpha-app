import { useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { IdDeRegion } from '../../sujeto/regiones'
import type { SeriesPorRegion } from '../../sujeto/tinte'
import type { CamaraDelSalon } from '../paredes/geometriaDeCuadro'
import { useToqueSobreElCuerpo } from './useToqueSobreElCuerpo'

/**
 * LA REGIÓN ELEGIDA EN LA LECTURA, desde sus botones o tocando el músculo sobre el cuerpo 3D.
 * Un toque hace lo mismo que su botón (tocarla otra vez la suelta) y solo con las regiones que
 * tienen series: en una sin series no se inventa una lectura.
 */
export function useRegionElegida(
  ancla: RefObject<HTMLElement | null>,
  camara: CamaraDelSalon | undefined,
  activo: boolean,
  series: SeriesPorRegion,
): [IdDeRegion | null, Dispatch<SetStateAction<IdDeRegion | null>>] {
  const [elegida, setElegida] = useState<IdDeRegion | null>(null)
  // Sin el centro y el campo con que se dibuja (el primer fotograma) no hay cámara que invertir.
  const lente = camara?.centro && camara.campo ? { ...camara, centro: camara.centro, campo: camara.campo } : undefined
  useToqueSobreElCuerpo(ancla, lente, activo, (id) => {
    if ((series[id] ?? 0) > 0) setElegida((e) => (e === id ? null : id))
  })
  return [elegida, setElegida]
}
