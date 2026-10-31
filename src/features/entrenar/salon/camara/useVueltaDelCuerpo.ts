import { useCallback, useState } from 'react'

/**
 * La orden de mover la cámara del cuerpo: `orden` crece en cada toque para que repetir el mismo
 * destino cuente. Solo el azimut es «Dar la vuelta»; con lo demás, la guía se acerca a una zona.
 */
export interface VueltaDelCuerpo {
  orden: number
  azimut: number
  elevacion?: number
  distancia?: number
  centro?: [number, number, number]
}

/** El visor reacciona a `vuelta`; el botón llama a `darLaVuelta` y la guía a `viajar`. */
export function useVueltaDelCuerpo() {
  const [vuelta, setVuelta] = useState<VueltaDelCuerpo>()
  const viajar = useCallback(
    (destino: Omit<VueltaDelCuerpo, 'orden'>) => setVuelta((v) => ({ ...destino, orden: (v?.orden ?? 0) + 1 })),
    [],
  )
  const darLaVuelta = useCallback((azimut: number) => viajar({ azimut }), [viajar])
  return { vuelta, darLaVuelta, viajar }
}
