import { useState } from 'react'
import { supabase } from '../../data/supabase'
import logoAguila from '../../assets/brand/logo-aguila.png'

/**
 * Primera pantalla del enlace para crear contraseña. Las vistas previas de los chats abren los
 * enlaces antes que la persona, así que el código de un solo uso se gasta al tocar el botón,
 * nunca al cargar. Al gastarlo, Supabase emite PASSWORD_RECOVERY y sigue `NuevaClavePage`.
 */
export function PuertaCrearClave({
  token,
  onListo,
  onVencido,
}: {
  token: string
  onListo: () => void
  onVencido: () => void
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const continuar = async () => {
    setError('')
    setCargando(true)
    try {
      const { error: fallo } = await supabase().auth.verifyOtp({ token_hash: token, type: 'recovery' })
      if (!fallo) {
        onListo()
        return
      }
      if (fallo.code === 'otp_expired') {
        onVencido()
        return
      }
    } catch {
      // Sin red: el código sigue sin gastarse, así que se puede reintentar.
    }
    setCargando(false)
    setError('No pudimos conectarnos. Revisa tu internet e inténtalo de nuevo.')
  }

  return (
    <div className="grid min-h-dvh place-items-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="entrada w-full max-w-sm text-center">
        <img
          src={logoAguila}
          alt="Alpha Athletics"
          className="mx-auto mb-5 h-28 w-28 rounded-3xl border border-hairline bg-ink-900 object-contain p-2"
        />
        <p className="kicker">Bienvenida a Alpha</p>
        <h1 className="mt-1 font-display text-3xl text-white">Crea tu contraseña</h1>
        <p className="mt-3 text-sm text-white/70">Toca el botón para elegir la contraseña con la que vas a entrar.</p>
        {error && <p className="mt-3 text-sm font-bold text-rojo">{error}</p>}
        <button
          type="button"
          disabled={cargando}
          onClick={() => void continuar()}
          className="press btn-cristal-rojo mt-5 w-full rounded-full py-3.5 font-display text-sm disabled:opacity-50"
          style={{ color: '#fff' }}
        >
          {cargando ? 'Abriendo…' : 'Crear mi contraseña →'}
        </button>
      </div>
    </div>
  )
}
