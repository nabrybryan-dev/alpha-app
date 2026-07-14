import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Usuario } from '../domain/types'
import { db } from '../data/dbInstance'

interface SesionContexto {
  usuario: Usuario
  cambiarUsuario: (id: string) => void
}

const usuarioPorDefecto = (): Usuario => {
  const guardado = localStorage.getItem('alpha-usuario')
  const usuario = guardado ? db.usuarios.byId(guardado) : undefined
  return usuario ?? db.usuarios.byId('u-valentina') ?? db.usuarios.list()[0]
}

const Contexto = createContext<SesionContexto | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario>(usuarioPorDefecto)

  const cambiarUsuario = (id: string) => {
    const nuevo = db.usuarios.byId(id)
    if (!nuevo) return
    localStorage.setItem('alpha-usuario', id)
    setUsuario(nuevo)
  }

  return <Contexto.Provider value={{ usuario, cambiarUsuario }}>{children}</Contexto.Provider>
}

export function useSesion(): SesionContexto {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useSesion requiere SessionProvider')
  return contexto
}
