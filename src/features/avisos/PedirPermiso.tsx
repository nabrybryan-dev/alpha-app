import { useState } from 'react'
import { guardarDecisionDeAviso } from '../../data/nube/avisos'
import { pedirPermisoDelNavegador, soportaAvisos, suscribirse } from './suscripcion'

/** Dónde se recuerda que a esta persona ya se le preguntó, en ESTE aparato. */
const CLAVE_VISTO = 'alpha-aviso-preguntado'

/** La clave pública del servidor de empuje. Vacía mientras no exista. */
const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

interface PedirPermisoProps {
  usuarioId: string
}

/**
 * La pantalla que explica para qué son los avisos, ANTES de que el navegador
 * pregunte.
 *
 * **El permiso del navegador es de una sola bala**: en varios móviles, si la
 * persona dice que no, ya no se puede volver a preguntar nunca. Así que el
 * aviso del navegador solo se le enseña a quien ya dijo que sí aquí. Eso sube
 * la aceptación y además parte el embudo en dos trozos que se pueden medir por
 * separado: cuántos lo vieron y cuántos dijeron que sí.
 *
 * No se le vuelve a preguntar a quien ya contestó, diga lo que diga: insistir
 * es la forma más rápida de que alguien silencie la app.
 */
export function PedirPermiso({ usuarioId }: PedirPermisoProps) {
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_VISTO) === 'si'
    } catch {
      return false
    }
  })
  const [mensaje, setMensaje] = useState('')

  if (oculto || !soportaAvisos()) return null

  const recordarQueYaSePregunto = () => {
    try {
      localStorage.setItem(CLAVE_VISTO, 'si')
    } catch {
      // Un navegador que no deja guardar preferencias no puede bloquear esto.
    }
  }

  const ahoraNo = () => {
    recordarQueYaSePregunto()
    void guardarDecisionDeAviso({ usuarioId, dijoSi: false })
    setOculto(true)
  }

  const queSi = async () => {
    recordarQueYaSePregunto()
    const permiso = await pedirPermisoDelNavegador()
    // La decisión se guarda SIEMPRE, aunque la suscripción no salga: son dos
    // cosas distintas y confundirlas es perder la mitad del embudo.
    const suscripcion = permiso === 'concedido' ? await suscribirse(CLAVE_PUBLICA) : null
    void guardarDecisionDeAviso({ usuarioId, dijoSi: permiso === 'concedido', suscripcion })

    if (permiso === 'concedido') {
      setMensaje('Listo. Te avisaremos solo de lo tuyo.')
      setTimeout(() => setOculto(true), 2500)
      return
    }
    setMensaje('Sin problema. Puedes activarlo cuando quieras desde los ajustes de tu teléfono.')
    setTimeout(() => setOculto(true), 3500)
  }

  return (
    <section
      aria-label="Avisos en el teléfono"
      className="relieve rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm"
    >
      <p className="font-display text-sm text-texto">¿Te avisamos en el teléfono?</p>
      <p className="mt-1 text-xs leading-relaxed text-tenue">
        Un toque el día de tu sesión, el recordatorio del check-in y tu revisión de la semana
        cuando esté lista. Nada de publicidad, y puedes quitarlo cuando quieras.
      </p>

      {mensaje ? (
        <p className="mt-2.5 text-xs font-semibold text-accion" role="status">
          {mensaje}
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void queSi()}
            className="press rounded-boton bg-accion px-3.5 py-2 text-xs font-bold text-white"
          >
            Sí, avísame
          </button>
          <button
            type="button"
            onClick={ahoraNo}
            className="press rounded-boton border border-linea px-3.5 py-2 text-xs font-bold text-tenue"
          >
            Ahora no
          </button>
        </div>
      )}
    </section>
  )
}
