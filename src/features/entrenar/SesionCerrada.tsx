import { Link } from 'react-router-dom'
import { XP_POR_ACCION } from '../../domain/gamification'
import type { Sesion } from '../../domain/types'
import { AguilaInteractiva } from './AguilaInteractiva'
import { reflexionSesion } from './reflexionSesion'

/**
 * Pantalla de cierre, justo después de guardar el test post-sesión. Es lo último
 * que ve el asesorado del entreno, así que cierra el bucle: XP ganado, una
 * reflexión según cómo se sintió, y la promesa de que sus datos alimentan la
 * próxima decisión del coach.
 */
export function SesionCerrada({ sesion }: { sesion: Sesion }) {
  const reflexion = sesion.testPost
    ? reflexionSesion(sesion.testPost.rpeSesion, sesion.testPost.prsEntrada)
    : undefined

  return (
    <div
      data-theme="dark"
      className="entrada -mx-4 -mt-4 flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 py-10 text-center"
    >
      <AguilaInteractiva entrada className="h-24 w-24" />
      <h2 className="font-display text-3xl text-texto">Sesión {sesion.nombre} registrada</h2>
      <p className="cifras text-lg font-bold text-logrado">+{XP_POR_ACCION.sesion} XP</p>
      {reflexion && (
        <p className="entrada entrada-3 max-w-xs font-display text-lg leading-snug text-texto">{reflexion}</p>
      )}
      <p className="max-w-xs text-sm text-tenue">
        Tus datos ya quedaron guardados para la próxima decisión de programación del coach.
      </p>
      <Link to="/" className="press mt-2 rounded-full bg-rojo px-8 py-3 font-display text-sm text-white">
        Volver a Hoy →
      </Link>
    </div>
  )
}
