import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { rumboDelJoystick, tiroDelDisco, type RumboDelMando } from './rumboDelJoystick'

/**
 * EL MANDO: un disco que se agarra y se tira.
 *
 * ## Va DESNUDO, y esa es la regla entera
 *
 * Sin aro, sin etiquetas, sin cuatro flechitas alrededor diciendo qué hay en cada lado. La
 * zona en la que responde se calcula, no se dibuja.
 *
 * El motivo no es minimalismo: es que **todo lo que cambia se lee en la pared, nunca sobre
 * el mando**. Un mando que rotula sus cuatro salidas obliga a mirarlo para usarlo, y
 * entonces hay dos sitios donde mirar —el mando y la pared— para una sola cosa. Desnudo,
 * la mano lo encuentra y los ojos se quedan donde tienen que estar. Es la misma razón por
 * la que el dial de un coche no lleva escrito lo que hace: lo que hace se ve en otro
 * sitio.
 *
 * Se descubre tirando. Por eso el disco SIGUE AL DEDO: es lo que convierte el primer roce
 * accidental en la enseñanza de que esto se mueve.
 *
 * ## Lo que dibuja es lo único que no cambia
 *
 * Un cronómetro. No dice a qué modo va —eso depende de hacia dónde tires— sino de qué va
 * el mando: del tiempo. Un icono que cambiara con el rumbo sería otra vez información
 * sobre el mando.
 *
 * ## Y por qué el disco se pinta escribiendo en el nodo
 *
 * Un `setState` por cada `pointermove` re-renderiza el salón entero —sujeto incluido—
 * mientras el dedo se mueve. Dónde está el disco no es información que nadie más necesite:
 * es dónde está el dedo. Lo que sí sube a estado es el RUMBO, porque de él depende lo que
 * la pared enseña, y eso sí lo tiene que ver otro.
 */

export interface JoystickProps {
  /** Se llama al soltar, con el rumbo definitivo. El centro también cuenta. */
  onSoltar: (rumbo: RumboDelMando) => void
  /** Se llama mientras se tira, para que la pared pueda acusar hacia dónde va. */
  onApuntar?: (rumbo: RumboDelMando) => void
  /** Si el mando está encendido: lo pinta en el acento cuando la pared no está en reposo. */
  encendido?: boolean
}

export function Joystick({ onSoltar, onApuntar, encendido = false }: JoystickProps) {
  const disco = useRef<HTMLButtonElement>(null)
  const origen = useRef<{ x: number; y: number } | null>(null)
  const rumbo = useRef<RumboDelMando>('centro')
  const [agarrado, setAgarrado] = useState(false)

  const pintar = (x: number, y: number, suave: boolean) => {
    const nodo = disco.current
    if (!nodo) return
    nodo.style.transition = suave
      ? 'transform var(--dur-microinteraccion) var(--muelle-microinteraccion)'
      : 'none'
    nodo.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
  }

  const alBajarDedo = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    origen.current = { x: e.clientX, y: e.clientY }
    rumbo.current = 'centro'
    setAgarrado(true)
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const alMoverDedo = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const o = origen.current
    if (!o) return
    e.stopPropagation()
    const dx = e.clientX - o.x
    const dy = e.clientY - o.y
    const tiro = tiroDelDisco(dx, dy)
    pintar(tiro.x, tiro.y, false)
    const nuevo = rumboDelJoystick(dx, dy)
    if (nuevo !== rumbo.current) {
      rumbo.current = nuevo
      onApuntar?.(nuevo)
    }
  }

  const alSoltarDedo = () => {
    if (!origen.current) return
    origen.current = null
    setAgarrado(false)
    pintar(0, 0, true)
    onSoltar(rumbo.current)
    rumbo.current = 'centro'
  }

  return (
    <button
      ref={disco}
      type="button"
      // EL NOMBRE VA EN LA ETIQUETA, NO EN LA PANTALLA. Quien navega con lector necesita
      // saber qué es esto; quien lo ve, no — lo descubre tirando.
      aria-label="Mando del reloj de la pared: tira a un lado para cambiar lo que cuenta"
      onPointerDown={alBajarDedo}
      onPointerMove={alMoverDedo}
      onPointerUp={alSoltarDedo}
      onPointerCancel={alSoltarDedo}
      className="press pointer-events-auto grid h-[52px] w-[52px] place-items-center rounded-full border transition-[border-color,background,color] duration-base"
      style={{
        borderColor: encendido ? 'rgb(var(--accion-rgb) / 0.7)' : 'rgb(255 255 255 / 0.14)',
        background: encendido ? 'rgb(var(--accion-rgb) / 0.16)' : 'rgb(var(--ink-1000-rgb) / 0.6)',
        color: encendido ? 'var(--accion)' : 'var(--texto)',
        touchAction: 'none',
        cursor: agarrado ? 'grabbing' : 'grab',
      }}
    >
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5M9 2h6" />
      </svg>
    </button>
  )
}
