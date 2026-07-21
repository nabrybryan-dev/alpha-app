import { useState } from 'react'
import { supabase } from '../../data/supabase'
import { AguilaInteractiva } from '../entrenar/AguilaInteractiva'

export function LoginPage() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)
  const [modo, setModo] = useState<'login' | 'recuperar'>('login')

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

  const enviarRecuperacion = async () => {
    setError('')
    setAviso('')
    if (!correo.trim()) {
      setError('Escribe tu correo para enviarte el enlace')
      return
    }
    setCargando(true)
    const { error: fallo } = await supabase().auth.resetPasswordForEmail(correo.trim(), {
      redirectTo: window.location.origin,
    })
    setCargando(false)
    if (fallo) {
      setError(`No se pudo enviar el correo: ${fallo.message}`)
      return
    }
    // No se revela si el correo existe o no (evita enumerar cuentas).
    setAviso('Si tu correo está registrado, te llegará un enlace para crear una contraseña nueva. Revisa tu bandeja y la carpeta de spam.')
  }

  const campo =
    'w-full rounded-xl border border-linea bg-surface-2 px-4 py-3 text-texto placeholder:text-tenue focus:border-rojo focus:outline-none'

  return (
    <div className="relative grid min-h-dvh place-items-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
      {/* fixed (no absolute): cubre SIEMPRE el viewport completo, incluso con
          el teclado abierto o al hacer scroll — sin bordes vacíos */}
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{
          backgroundImage: 'url(/fondos/atleta.png)',
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
        <div className="mb-5 flex justify-center">
          <AguilaInteractiva entrada className="h-32 w-32" />
        </div>
        <p className="kicker text-center">Science based performance</p>
        <h1 className="mt-1 text-center font-display text-3xl text-white">Alpha Athletics</h1>

        <form
          className="glass glass-blur mt-6 flex flex-col gap-3 rounded-panel p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void (modo === 'login' ? entrar() : enviarRecuperacion())
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
          {modo === 'login' && (
            <input
              type="password"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Contraseña"
              className={campo}
            />
          )}
          {error && <p className="text-sm font-bold text-rojo">{error}</p>}
          {aviso && <p className="text-sm text-white/80">{aviso}</p>}
          <button
            type="submit"
            disabled={cargando}
            className="press btn-cristal-rojo mt-1 rounded-full py-3.5 font-display text-sm disabled:opacity-50"
            style={{ color: '#fff' }}
          >
            {modo === 'login'
              ? cargando
                ? 'Entrando…'
                : 'Entrar →'
              : cargando
                ? 'Enviando…'
                : 'Enviar enlace de recuperación →'}
          </button>

          <button
            type="button"
            onClick={() => {
              setError('')
              setAviso('')
              setModo(modo === 'login' ? 'recuperar' : 'login')
            }}
            className="mt-1 text-center text-xs text-white/70 underline underline-offset-2 hover:text-white"
          >
            {modo === 'login' ? '¿Olvidaste tu contraseña?' : '← Volver a iniciar sesión'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-white/60">
          ¿Sin cuenta? Tu coach te envía la invitación con tus credenciales.
        </p>
      </div>
    </div>
  )
}
