import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Usuario } from '../domain/types'
import { db, useDbVersion } from '../data/dbInstance'
import { abrirSesionLocal, olvidarDatosLocales } from '../data/mockDb'
import { limpiarBorradoresLocales } from '../lib/persistencia'
import { hidratarDesdeNube } from '../data/nube/hidratar'
import { limpiarColasDeSync, pendientesDeSync, procesarCola, recuperarDescartes } from '../data/nube/sync'
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

/**
 * ¿La app se abrió desde el enlace de "olvidé mi contraseña"? Supabase trae un
 * token de recuperación en el hash de la URL.
 *
 * Se responde en el primer render y no dentro del efecto. Además de quitar un
 * `setState` en efecto, se lee el hash ANTES de crear el cliente de Supabase, que
 * es quien lo consume: cuanto antes se mire, más fiable es la detección.
 */
function llegaDeRecuperacion(): boolean {
  return typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
}

function SesionNube({ children }: { children: ReactNode }) {
  const [autenticadoId, setAutenticadoId] = useState<string | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin-sesion' | 'error'>('cargando')
  const [detalleError, setDetalleError] = useState('')
  const [recuperacion, setRecuperacion] = useState(llegaDeRecuperacion)
  const autenticadoRef = useRef<string | null>(null)
  /**
   * QUIÉN está hidratando, no solo "si hay alguien". El candado sin dueño
   * descartaba en seco el `SIGNED_IN` de la persona siguiente mientras seguía
   * en vuelo la descarga de la anterior: en un teléfono compartido, quien
   * acababa de escribir su correo y su contraseña entraba viendo la
   * programación, los check-ins y las medidas de la otra.
   */
  const hidratandoRef = useRef<string | null>(null)
  /**
   * Espejo de `recuperacion` para leerlo desde `alCambiar`, que no ve el estado.
   * Arranca con el MISMO valor que el estado, no en `false`: si el ref llegara
   * tarde, un `SIGNED_IN` podría hidratar la app durante una recuperación de
   * contraseña, que es justo lo que la comprobación evita.
   */
  const recuperacionRef = useRef(recuperacion)
  useDbVersion()

  useEffect(() => {
    const sb = supabase()

    // La llegada desde el enlace de "olvidé mi contraseña" ya se detectó en el
    // primer render (`llegaDeRecuperacion`), para mostrar la pantalla de nueva
    // clave y NO entrar a la app ni hidratar. El evento PASSWORD_RECOVERY de más
    // abajo sigue cubriendo el caso en que el hash ya se hubiera consumido.

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
      // Solo se descarta el aviso repetido de la MISMA persona (Supabase emite
      // SIGNED_IN en cada refoco). El de otra tiene que ganar siempre.
      if (hidratandoRef.current === usuarioId) return
      hidratandoRef.current = usuarioId
      abrirSesionLocal()
      const yaActivo = autenticadoRef.current === usuarioId
      if (!yaActivo) setEstado('cargando')
      try {
        // Recupera envíos que se hubieran descartado (series bloqueadas por el
        // permiso ya corregido) y sube lo pendiente ANTES de hidratar.
        recuperarDescartes(usuarioId)
        await procesarCola()
        // Solo en un REFRESCO en segundo plano se evita hidratar si hay
        // escrituras sin subir (para no pisar series/checkins recién hechos).
        // En el ingreso inicial siempre se hidrata para que se vea la rutina.
        if (yaActivo && pendientesDeSync() > 0) return
        try {
          await hidratarDesdeNube()
        } catch (falloRed: unknown) {
          // Red inestable (típico en el gimnasio): si ya hay datos locales de
          // este usuario, se muestran (aunque sean de hace un rato) en vez de
          // bloquear con pantalla de error. La sincronización se reintenta sola.
          if (!db.usuarios.byId(usuarioId)) throw falloRed
        }
        // Si mientras bajaba entró otra persona (o se cerró sesión), esta
        // descarga ya no manda: dejarla pasar pondría en pantalla a quien
        // acaba de salir.
        if (hidratandoRef.current !== usuarioId) return
        autenticadoRef.current = usuarioId
        setAutenticadoId(usuarioId)
        setEstado('listo')
      } catch (fallo: unknown) {
        if (yaActivo || hidratandoRef.current !== usuarioId) return
        setDetalleError(fallo instanceof Error ? fallo.message : 'Error desconocido')
        setEstado('error')
      } finally {
        // Solo suelta el candado quien lo tiene puesto: si entró otra persona,
        // el candado ya es suyo y esta hidratación vieja no debe abrirlo.
        if (hidratandoRef.current === usuarioId) hidratandoRef.current = null
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
        // Con el id de quien sale: lo que no llegó a subir se aparta sellado a
        // su nombre y vuelve a la cola solo cuando entre esa misma persona.
        limpiarColasDeSync(autenticadoRef.current ?? undefined)
        // Los datos, también los de la copia en memoria; y los borradores de
        // series y cronómetro, que si no aparecen en la pantalla del siguiente.
        olvidarDatosLocales()
        limpiarBorradoresLocales()
        hidratandoRef.current = null
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
      if (hidratandoRef.current !== null) return
      hidratandoRef.current = autenticadoId
      try {
        await hidratarDesdeNube()
      } catch {
        // error transitorio de red: se reintenta en el siguiente ciclo
      } finally {
        if (hidratandoRef.current === autenticadoId) hidratandoRef.current = null
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
