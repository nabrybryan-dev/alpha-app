import { useState } from 'react'
import { supabase } from '../../data/supabase'
import { AguilaInteractiva } from '../entrenar/AguilaInteractiva'
import { FondoLoop } from '../../components/ui/FondoLoop'
import { LOOP_HERO, POSTER_LOGIN } from './fondoHero'

/**
 * `enlaceVencido`: llegó desde un enlace del correo que ya venció o ya se usó.
 * Abre directo en pedir otro: sin esto volvía al login sin explicar nada, y quien
 * aún no tiene contraseña se quedaba sin salida.
 */
export function LoginPage({ enlaceVencido = false }: { enlaceVencido?: boolean }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState(
    enlaceVencido ? 'Ese enlace ya venció o ya se usó. Escribe tu correo y te enviamos uno nuevo.' : '',
  )
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)
  const [modo, setModo] = useState<'login' | 'recuperar'>(enlaceVencido ? 'recuperar' : 'login')

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
      setError('No pudimos enviar el correo. Inténtalo de nuevo en unos minutos o escríbele a tu coach.')
      return
    }
    // No se revela si el correo existe o no (evita enumerar cuentas).
    setAviso('Si tu correo está registrado, te llegará un enlace para crear tu contraseña. Revisa tu bandeja y la carpeta de spam.')
  }

  const campo =
    'w-full rounded-xl border border-linea bg-surface-2 px-4 py-3 text-texto placeholder:text-tenue focus:border-rojo focus:outline-none'

  return (
    <div className="relative grid min-h-dvh place-items-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
      {/* fixed (no absolute): cubre SIEMPRE el viewport completo, incluso con
          el teclado abierto o al hacer scroll — sin bordes vacíos.

          El fondo pasó de `background-image` a `FondoLoop` para poder llevar el
          loop de 8 s encima del plano fijo. Aquí va con `preload="none"`: en el
          login el vídeo es ambiente, no contenido, y no debe competir con la
          descarga del formulario. */}
      <FondoLoop
        poster={POSTER_LOGIN}
        video={LOOP_HERO}
        preload="none"
        className="fixed inset-0 h-full w-full object-cover object-top"
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
        <h1 className="text-center font-display text-3xl text-white">Alpha Athletics</h1>
        <p className="kicker mt-1.5 text-center">100% personalizado, 0% genérico</p>

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
                ? 'ACCEDIENDO…'
                : 'ENTRAR'
              : cargando
                ? 'Enviando…'
                : 'Enviarme el enlace →'}
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
            {modo === 'login' ? '¿Primera vez o se te olvidó tu contraseña?' : '← Volver a iniciar sesión'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-white/60">
          ¿Primera vez? Usa el correo con el que te inscribiste y crea ahí tu contraseña.
        </p>
      </div>
    </div>
  )
}
