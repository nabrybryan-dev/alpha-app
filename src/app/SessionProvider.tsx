import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Usuario } from '../domain/types'
import { db, useDbVersion } from '../data/dbInstance'
import { hidratarDesdeNube } from '../data/nube/hidratar'
import { limpiarColasDeSync, pendientesDeSync, procesarCola } from '../data/nube/sync'
import { modoNube, supabase } from '../data/supabase'
import { LoginPage } from '../features/auth/LoginPage'
import { NuevaClavePage } from '../features/auth/NuevaClavePage'

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
 * La sesión queda iniciada de forma permanente: como la app está instalada en
 * el teléfono personal del asesorado, Supabase renueva el token solo y solo se
 * sale con el botón "Cerrar sesión". (Decisión de producto de Bryan, 2026-07-20;
 * reemplaza la antigua expiración de 2 h que era solo cosmética y molestaba.)
 */
const Contexto = createContext<SesionContexto | null>(null)

function SesionNube({ children }: { children: ReactNode }) {
  const [autenticadoId, setAutenticadoId] = useState<string | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin-sesion' | 'error'>('cargando')
  const [detalleError, setDetalleError] = useState('')
  const [recuperacion, setRecuperacion] = useState(false)
  const autenticadoRef = useRef<string | null>(null)
  const hidratandoRef = useRef(false)
  const recuperacionRef = useRef(false)
  useDbVersion()

  useEffect(() => {
    const sb = supabase()

    // Si el usuario llega desde el enlace de "olvidé mi contraseña", Supabase
    // trae un token de recuperación en el hash de la URL. Se detecta de una vez
    // para mostrar la pantalla de nueva clave y NO entrar a la app ni hidratar.
    if (window.location.hash.includes('type=recovery')) {
      recuperacionRef.current = true
      setRecuperacion(true)
    }

    /**
     * Supabase emite SIGNED_IN no solo en el login real: también cada vez que
     * la pestaña/app recupera el foco (desbloquear el celular entre series).
     * Si el usuario ya está autenticado, el refresco corre en segundo plano
     * sin desmontar la interfaz — desmontarla reiniciaba el cronómetro y
     * borraba la serie a medio escribir. Solo el primer ingreso bloquea con
     * la pantalla de "Sincronizando…".
     */
    const alCambiar = async (usuarioId: string | undefined) => {
      // Durante la recuperación de contraseña no se entra a la app ni se
      // hidrata: solo se muestra la pantalla para fijar la nueva clave.
      if (recuperacionRef.current) return
      if (!usuarioId) {
        autenticadoRef.current = null
        setAutenticadoId(null)
        setEstado('sin-sesion')
        return
      }
      if (hidratandoRef.current) return
      hidratandoRef.current = true
      const yaActivo = autenticadoRef.current === usuarioId
      if (!yaActivo) setEstado('cargando')
      try {
        // Primero suben las escrituras locales pendientes; hidratar antes de
        // subirlas pisaría series/checkins recién registrados con la copia
        // vieja del servidor.
        await procesarCola()
        if (yaActivo && pendientesDeSync() > 0) return
        await hidratarDesdeNube()
        autenticadoRef.current = usuarioId
        setAutenticadoId(usuarioId)
        setEstado('listo')
      } catch (fallo: unknown) {
        if (yaActivo) return // refresco en segundo plano fallido: se reintenta luego
        setDetalleError(fallo instanceof Error ? fallo.message : 'Error desconocido')
        setEstado('error')
      } finally {
        hidratandoRef.current = false
      }
    }

    void sb.auth.getSession().then(({ data }) => {
      void alCambiar(data.session?.user.id)
    })
    const { data: escucha } = sb.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'PASSWORD_RECOVERY') {
        recuperacionRef.current = true
        setRecuperacion(true)
        return
      }
      if (evento === 'SIGNED_IN') {
        void alCambiar(sesion?.user.id)
      }
      if (evento === 'SIGNED_OUT') {
        localStorage.removeItem('alpha-db-v2')
        limpiarColasDeSync()
        void alCambiar(undefined)
      }
    })
    return () => {
      escucha.subscription.unsubscribe()
    }
  }, [])

  // Refresco en vivo para el staff: al volver a la pestaña o cada 45 s, si no
  // hay escrituras locales pendientes, vuelve a bajar los datos de todos los
  // asesorados. Así el coach y la nutricionista ven las modificaciones de cada
  // usuario en tiempo casi real, sin recargar.
  useEffect(() => {
    if (estado !== 'listo' || !autenticadoId) return
    const rol = db.usuarios.byId(autenticadoId)?.rol
    if (rol !== 'coach' && rol !== 'nutricionista') return

    let activo = true
    const refrescar = async () => {
      if (!activo || document.visibilityState !== 'visible' || pendientesDeSync() > 0) return
      if (hidratandoRef.current) return
      hidratandoRef.current = true
      try {
        await hidratarDesdeNube()
      } catch {
        // error transitorio de red: se reintenta en el siguiente ciclo
      } finally {
        hidratandoRef.current = false
      }
    }
    const alVolver = () => void refrescar()
    document.addEventListener('visibilitychange', alVolver)
    const id = window.setInterval(() => void refrescar(), 45_000)
    return () => {
      activo = false
      document.removeEventListener('visibilitychange', alVolver)
      window.clearInterval(id)
    }
  }, [estado, autenticadoId])

  if (recuperacion) {
    return (
      <NuevaClavePage
        onListo={() => {
          recuperacionRef.current = false
          setRecuperacion(false)
          // limpia el token de recuperación del hash de la URL
          history.replaceState(null, '', window.location.pathname)
        }}
      />
    )
  }

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
    void (async () => {
      await procesarCola() // subir lo pendiente antes de salir
      await supabase().auth.signOut() // SIGNED_OUT limpia db, colas y marca de inicio
    })()
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

/**
 * Guardia de producción: si el build de producción no tiene las variables de
 * Supabase, NUNCA se cae al modo demo (expondría la interfaz con datos de
 * muestra y el selector de usuarios). Mejor fallar fuerte y visible.
 */
function ConfiguracionFaltante() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
      <div>
        <p className="font-display text-xl text-texto">App en mantenimiento</p>
        <p className="mt-2 text-sm text-tenue">
          Falta configuración del servidor. Escríbele al coach: el acceso vuelve en unos minutos.
        </p>
      </div>
    </div>
  )
}

export function SessionProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.PROD && !modoNube) return <ConfiguracionFaltante />
  return modoNube ? <SesionNube>{children}</SesionNube> : <SesionDemo>{children}</SesionDemo>
}

export function useSesion(): SesionContexto {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useSesion requiere SessionProvider')
  return contexto
}
