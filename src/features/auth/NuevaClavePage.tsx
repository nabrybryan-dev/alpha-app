import { useState } from 'react'
import { supabase } from '../../data/supabase'
import logoAguila from '../../assets/brand/logo-aguila.jpeg'

const CLAVE_MINIMA = 6

/**
 * Pantalla a la que llega la asesorada tras abrir el enlace de "olvidé mi
 * contraseña". Supabase ya dejó una sesión temporal de recuperación, así que
 * updateUser({ password }) fija la nueva clave. Al terminar cierra la sesión
 * para que entre limpio con su contraseña nueva.
 */
export function NuevaClavePage({ onListo }: { onListo: () => void }) {
  const [clave, setClave] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [listo, setListo] = useState(false)

  const guardar = async () => {
    setError('')
    if (clave.length < CLAVE_MINIMA) {
      setError(`La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres`)
      return
    }
    if (clave !== confirmar) {
      setError('Las dos contraseñas no coinciden')
      return
    }
    setCargando(true)
    const { error: fallo } = await supabase().auth.updateUser({ password: clave })
    setCargando(false)
    if (fallo) {
      setError(`No se pudo cambiar la contraseña: ${fallo.message}`)
      return
    }
    setListo(true)
  }

  const volverAlLogin = async () => {
    await supabase().auth.signOut()
    onListo()
  }

  const campo =
    'w-full rounded-xl border border-linea bg-surface-2 px-4 py-3 text-texto placeholder:text-tenue focus:border-rojo focus:outline-none'

  return (
    <div className="relative grid min-h-dvh place-items-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{
          backgroundColor: '#0a0a0a',
          backgroundImage: 'url(/fondos/atleta.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,10,10,0.35) 0%, rgba(10,10,10,0.66) 55%, rgba(10,10,10,0.93) 100%)',
        }}
      />

      <div className="entrada relative w-full max-w-sm">
        <img
          src={logoAguila}
          alt="Alpha Athletics"
          className="mx-auto mb-5 h-28 w-28 rounded-3xl border border-hairline object-cover"
        />
        <p className="kicker text-center">Recuperar acceso</p>
        <h1 className="mt-1 text-center font-display text-3xl text-white">Nueva contraseña</h1>

        {listo ? (
          <div className="glass glass-blur mt-6 flex flex-col gap-3 rounded-panel p-5 text-center">
            <p className="font-display text-lg text-white">¡Contraseña actualizada!</p>
            <p className="text-sm text-white/70">Ya puedes entrar con tu contraseña nueva.</p>
            <button
              type="button"
              onClick={() => void volverAlLogin()}
              className="press btn-cristal-rojo mt-1 rounded-full py-3.5 font-display text-sm"
              style={{ color: '#fff' }}
            >
              Ir a iniciar sesión →
            </button>
          </div>
        ) : (
          <form
            className="glass glass-blur mt-6 flex flex-col gap-3 rounded-panel p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void guardar()
            }}
          >
            <input
              type="password"
              autoComplete="new-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Nueva contraseña"
              className={campo}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Repite la contraseña"
              className={campo}
            />
            {error && <p className="text-sm font-bold text-rojo">{error}</p>}
            <button
              type="submit"
              disabled={cargando}
              className="press btn-cristal-rojo mt-1 rounded-full py-3.5 font-display text-sm disabled:opacity-50"
              style={{ color: '#fff' }}
            >
              {cargando ? 'Guardando…' : 'Guardar contraseña →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
