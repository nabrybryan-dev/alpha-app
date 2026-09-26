import { useState, type ReactNode } from 'react'
import { ContextoCacheConsola, type CacheConsola } from './datoConsola'

/** Un caché por montaje de la consola: ver `datoConsola.ts`. */
export function ProveedorDatosConsola({ children }: { children: ReactNode }) {
  const [cache] = useState<CacheConsola>(() => new Map())
  return <ContextoCacheConsola.Provider value={cache}>{children}</ContextoCacheConsola.Provider>
}
