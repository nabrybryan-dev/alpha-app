import { useSyncExternalStore } from 'react'
import { crearMockDb, suscribirse } from './mockDb'
import { crearDbSincronizada } from './nube/sync'
import type { Db } from './repos'

// Se reexporta desde `lib/fecha` para que `mockDb` pueda usar la MISMA funcion sin
// cerrar el circulo de imports. Las 22 pantallas que lo importan de aqui no cambian.
export { hoyIso } from '../lib/fecha'

export const db: Db = crearDbSincronizada(crearMockDb())

export function idCoach(): string {
  return db.usuarios.list().find((u) => u.rol === 'coach')?.id ?? 'u-bryan'
}

let version = 0
suscribirse(() => {
  version += 1
})

function getVersion(): number {
  return version
}

export function useDbVersion(): number {
  return useSyncExternalStore(suscribirse, getVersion)
}
