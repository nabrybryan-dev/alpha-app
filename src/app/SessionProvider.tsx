import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Usuario } from '../domain/types'
import { db, useDbVersion } from '../data/dbInstance'
import { hidratarDesdeNube } from '../data/nube/hidratar'
import { modoNube, supabase } from '../data/supabase'
import { LoginPage } from '../features/auth/LoginPage'

interface SesionContexto {
  usuario: Usuario
  esNube: boolean
  cambiarUsuario: (id: string) => void
  cerrarSesion: () => void
}

const usuarioDemoPorDefecto = (): Usuario => {
  const guardado = localStorage.getItem('alpha-usuario')
  const usuario = guardado ? db.usuarios.byId(guardado) : undefined
  return usuario ?? db.usuarios.byId('u-valentina') ?? db.usuarios.list()[0]
}

/**
 * Política de seguridad acordada con el coach: la sesión dura máximo 2 horas
 * (lo que dura un entreno). Pasado ese tiempo se cierra sola y hay que volver
 * a entrar con correo y contraseña.
 */
const MAX_SESION_MS = 2 * 60 * 60 * 1000
const CLAVE_INICIO_SESION = 'alpha-sesion-inicio'

function sesionVencida(): boolean {
  const inicio = Number(localStorage.getItem(CLAVE_INICIO_SESION) ?? 0)
  return !inicio || Date.now() - inicio > MAX_SESION_MS
}

const Contexto = createContext<SesionContexto | null>(null)

function SesionNube({ children }: { children: ReactNode }) {
  const [autenticadoId, setAutenticadoId] = useState<string | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin-sesion' | 'error'>('cargando')
  const [detalleError, setDetalleError] = useState('')
  useDbVersion()

  useEffect(() => {
    const sb = supabase()

    const alCambiar = async (usuarioId: string | undefined) => {
      if (!usuarioId) {
        setAutenticadoId(null)
        setEstado('sin-sesion')
        return
      }
      setEstado('cargando')
      try {
        await hidratarDesdeNube()
        setAutenticadoId(usuarioId)
        setEstado('listo')
      } catch (fallo: unknown) {
        setDetalleError(fallo instanceof Error ? fallo.message : 'Error desconocido')
        setEstado('error')
      }
    }

    void sb.auth.getSession().then(({ data }) => {
      if (data.session && sesionVencida()) {
        void sb.auth.signOut()
        return
      }
      void alCambiar(data.session?.user.id)
    })
    const { data: escucha } = sb.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'SIGNED_IN') {
        if (!localStorage.getItem(CLAVE_INICIO_SESION)) {
          localStorage.setItem(CLAVE_INICIO_SESION, String(Date.now()))
        }
        void alCambiar(sesion?.user.id)
      }
      if (evento === 'SIGNED_OUT') {
        localStorage.removeItem(CLAVE_INICIO_SESION)
        localStorage.removeItem('alpha-db-v2')
        void alCambiar(undefined)
      }
    })
    const temporizador = window.setInterval(() => {
      if (localStorage.getItem(CLAVE_INICIO_SESION) && sesionVencida()) {
        void sb.auth.signOut()
      }
    }, 60_000)
    return () => {
      escucha.subscription.unsubscribe()
      window.clearInterval(temporizador)
    }
  }, [])

  if (estado === 'cargando') {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <p className="kicker animate-pulse">Sincronizando…</p>
      </div>
    )
  }

  if (estado === 'sin-sesion') return <LoginPage />

  if (estado === 'error') {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div>
          <p className="font-display text-xl text-texto">No se pudieron cargar tus datos</p>
          <p className="mt-2 text-sm text-tenue">{detalleError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-rojo px-6 py-3 font-display text-sm text-white"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const usuario = autenticadoId ? db.usuarios.byId(autenticadoId) : undefined
  if (!usuario) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <p className="text-sm text-tenue">
          Tu cuenta existe pero no tiene perfil en la app. Escríbele al coach.
        </p>
      </div>
    )
  }

  const cerrarSesion = () => {
    void supabase().auth.signOut()
    localStorage.removeItem('alpha-db-v2')
  }

  return (
    <Contexto.Provider value={{ usuario, esNube: true, cambiarUsuario: () => {}, cerrarSesion }}>
      {children}
    </Contexto.Provider>
  )
}

function SesionDemo({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario>(usuarioDemoPorDefecto)

  const cambiarUsuario = (id: string) => {
    const nuevo = db.usuarios.byId(id)
    if (!nuevo) return
    localStorage.setItem('alpha-usuario', id)
    setUsuario(nuevo)
  }

  return (
    <Contexto.Provider value={{ usuario, esNube: false, cambiarUsuario, cerrarSesion: () => {} }}>
      {children}
    </Contexto.Provider>
  )
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return modoNube ? <SesionNube>{children}</SesionNube> : <SesionDemo>{children}</SesionDemo>
}

export function useSesion(): SesionContexto {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useSesion requiere SessionProvider')
  return contexto
}
