import { useSyncExternalStore } from 'react'
import { crearMockDb, suscribirse } from './mockDb'
import { crearDbSincronizada } from './nube/sync'
import type { Db } from './repos'

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

export function hoyIso(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
