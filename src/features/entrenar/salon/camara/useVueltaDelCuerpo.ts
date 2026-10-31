import { useCallback, useState } from 'react'

/** La orden de dar la vuelta: `orden` crece en cada toque para que repetir el mismo destino cuente. */
export interface VueltaDelCuerpo {
  orden: number
  azimut: number
}

/** Estado de «Dar la vuelta». El visor reacciona a `vuelta`; el botón llama a `darLaVuelta`. */
export function useVueltaDelCuerpo() {
  const [vuelta, setVuelta] = useState<VueltaDelCuerpo>()
  const darLaVuelta = useCallback((azimut: number) => setVuelta((v) => ({ orden: (v?.orden ?? 0) + 1, azimut })), [])
  return { vuelta, darLaVuelta }
}
