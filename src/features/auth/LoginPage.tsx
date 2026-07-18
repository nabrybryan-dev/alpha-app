import { useState } from 'react'
import { supabase } from '../../data/supabase'
import logoAguila from '../../assets/brand/logo-aguila.jpeg'

export function LoginPage() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const entrar = async () => {
    setError('')
    if (!correo.trim() || !clave) {
      setError('Escribe tu correo y tu contraseña')
      return
    }
    setCargando(true)
    const { error: fallo } = await supabase().auth.signInWithPassword({
      email: correo.trim(),
      password: clave,
    })
    setCargando(false)
    if (fallo) {
      setError(
        fallo.message.includes('Invalid login')
          ? 'Correo o contraseña incorrectos'
          : `No se pudo iniciar sesión: ${fallo.message}`,
      )
    }
  }

  const campo =
    'w-full rounded-xl border border-linea bg-surface-2 px-4 py-3 text-texto placeholder:text-tenue focus:border-rojo focus:outline-none'

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/fondos/atleta-hombre.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 18%',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,10,10,0.45) 0%, rgba(10,10,10,0.72) 55%, rgba(10,10,10,0.94) 100%)',
        }}
      />

      <div className="entrada relative w-full max-w-sm">
        <img
          src={logoAguila}
          alt="Alpha Athletics"
          className="mx-auto mb-5 h-28 w-28 rounded-3xl border border-hairline object-cover"
        />
        <p className="kicker text-center">Science based performance</p>
        <h1 className="mt-1 text-center font-display text-3xl text-white">Alpha Athletics</h1>

        <form
          className="glass glass-blur mt-6 flex flex-col gap-3 rounded-panel p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void entrar()
          }}
        >
          <input
            type="email"
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="tu@correo.com"
            className={campo}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Contraseña"
            className={campo}
          />
          {error && <p className="text-sm font-bold text-rojo">{error}</p>}
          <button
            type="submit"
            disabled={cargando}
            className="press btn-cristal-rojo mt-1 rounded-full py-3.5 font-display text-sm disabled:opacity-50"
            style={{ color: '#fff' }}
          >
            {cargando ? 'Entrando…' : 'Entrar →'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-white/60">
          ¿Sin cuenta? Tu coach te envía la invitación con tus credenciales.
        </p>
      </div>
    </div>
  )
}
