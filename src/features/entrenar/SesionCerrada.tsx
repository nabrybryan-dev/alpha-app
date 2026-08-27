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
      // SIN `.entrada` en la raiz, y esto arregla un fallo de composicion: la
      // reflexion llevaba su propia `entrada-3` ANIDADA aqui dentro, asi que su
      // desplazamiento se sumaba al del padre y entraba desde el doble de lejos
      // que el resto. Entrar todo a la vez tampoco decia nada: es la pantalla de
      // cierre de una sesion, el momento con mas peso de la app, y merece que
      // las piezas lleguen en el orden en que se leen.
      //
      // 60 ms entre piezas, que es la banda del escalonado del sistema. El aguila
      // no se toca: tiene su propia entrada y su propio motivo.
      className="-mx-4 -mt-4 flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 py-10 text-center"
    >
      <AguilaInteractiva entrada className="h-24 w-24" />
      <h2 className="entrada entrada-1 font-display text-3xl text-texto">
        Sesión {sesion.nombre} registrada
      </h2>
      <p className="entrada entrada-2 cifras text-lg font-bold text-logrado">
        +{XP_POR_ACCION.sesion} XP
      </p>
      {/* `entrada-3` y no `entrada-2`: el XP de arriba ya usa el 2. Con los dos
          iguales la cascada se cortaba justo aquí, que es el mismo defecto que
          tenía la Ruta. El paso de 60 ms se mantiene. */}
      {reflexion && (
        <p className="entrada entrada-3 max-w-xs font-display text-lg leading-snug text-texto">{reflexion}</p>
      )}
      <p className="entrada entrada-4 max-w-xs text-sm text-tenue">
        Tus datos ya quedaron guardados para la próxima decisión de programación del coach.
      </p>
      {/* Tocable desde el primer fotograma: `both` solo mueve opacidad y
          desplazamiento, nunca el area de contacto. */}
      <Link
        to="/"
        className="entrada entrada-4 press mt-2 rounded-full bg-rojo px-8 py-3 font-display text-sm text-white"
      >
        Volver a Hoy →
      </Link>
    </div>
  )
}
