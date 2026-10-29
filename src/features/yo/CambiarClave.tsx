import { useId, useState } from 'react'
import { modoNube, supabase } from '../../data/supabase'
import { motivoDeClaveInvalida } from './validarClave'

/**
 * Cambiar la clave desde dentro de la app. `NuevaClavePage` es la pantalla completa del enlace de recuperación (fondo
 * propio, cierra la sesión al terminar) y no se puede montar aquí tal cual; esta usa la misma llamada (`updateUser`) y la
 * misma regla de largo, pero la persona ya tiene sesión y se queda donde está.
 */
export function CambiarClave() {
  const id = useId()
  const [clave, setClave] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setError('')
    setListo(false)
    const motivo = motivoDeClaveInvalida(clave, confirmar)
    if (motivo) {
      setError(motivo)
      return
    }
    setGuardando(true)
    try {
      const { error: fallo } = await supabase().auth.updateUser({ password: clave })
      if (fallo) {
        setError(`No se pudo cambiar la contraseña: ${fallo.message}`)
        return
      }
      setClave('')
      setConfirmar('')
      setListo(true)
    } catch {
      setError('No se pudo cambiar la contraseña. Revisa tu conexión y vuelve a intentarlo.')
    } finally {
      setGuardando(false)
    }
  }

  const campo =
    'w-full rounded-xl border border-linea bg-surface-2 px-4 py-3 text-sm text-texto placeholder:text-tenue focus:border-rojo focus:outline-none'

  return (
    <section aria-label="Clave" className="flex flex-col gap-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Cambiar la clave</h3>
      {!modoNube ? (
        <p className="rounded-tarjeta border border-dashed border-linea p-4 text-sm text-tenue">
          La clave se cambia al entrar con tu cuenta; en la versión de prueba no hay clave.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            void guardar()
          }}
        >
          <label htmlFor={`${id}-a`} className="sr-only">
            Nueva contraseña
          </label>
          <input
            id={`${id}-a`}
            type="password"
            autoComplete="new-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Nueva contraseña"
            className={campo}
          />
          <label htmlFor={`${id}-b`} className="sr-only">
            Repite la contraseña
          </label>
          <input
            id={`${id}-b`}
            type="password"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="Repite la contraseña"
            className={campo}
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-rojo">
              {error}
            </p>
          )}
          {listo && (
            <p role="status" className="text-sm font-semibold text-texto">
              Contraseña actualizada.
            </p>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="press min-h-[48px] rounded-boton bg-texto font-display text-[13px] uppercase text-bg disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </section>
  )
}
