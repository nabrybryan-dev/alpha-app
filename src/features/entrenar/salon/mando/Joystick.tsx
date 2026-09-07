import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ESPERA_DEL_RECORRIDO,
  faseDelRecorrido,
  rumboDelJoystick,
  tiroDelDisco,
  type RumboDelMando,
} from './rumboDelJoystick'

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
 * ## Tirar y aguantar son dos cosas
 *
 * Un tirón corto cambia lo que cuenta la pared. AGUANTAR el disco
 * (`ESPERA_DEL_RECORRIDO`) se queda con el tiempo de la REPETICIÓN: la demostración se
 * para y el dedo la recorre de lado, como una línea de tiempo. Al soltar, sigue por donde
 * la dejaron y el reloj de la pared no se ha enterado de nada.
 *
 * Esto no rompe la regla de arriba, la cumple: lo que cambia se lee **en el sujeto**, que
 * se para y se mueve con el dedo. El mando sigue sin decir nada, y por eso el gesto se
 * descubre igual que el otro —tirando, aguantando— y no leyendo un rótulo.
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
  /**
   * AGUANTAR EL DISCO PARA A LA DEMOSTRACIÓN, y entonces el dedo la recorre.
   *
   * Los tres van juntos o no va ninguno: `onTomarElTiempo` avisa de que el mando se quedó
   * con la repetición —a los `ESPERA_DEL_RECORRIDO` de aguantar sin salir de la zona
   * muerta—, `onRecorrer` da la fase mientras el dedo se mueve, y `onSoltarElTiempo`
   * devuelve la demostración a su marcha al levantar el dedo.
   *
   * Mientras esto dura NO se emite rumbo: el reloj de la pared se queda como estaba, que
   * es la regla —el tiempo de la repetición y el del descanso son dos tiempos distintos y
   * un gesto no puede mover los dos.
   *
   * `onTomarElTiempo` devuelve la fase en la que estaba la demostración, para que el
   * recorrido empiece donde el sujeto está y no dé un salto al primer píxel de dedo.
   */
  onTomarElTiempo?: () => number | void
  onRecorrer?: (fase: number) => void
  onSoltarElTiempo?: () => void
}

export function Joystick({
  onSoltar,
  onApuntar,
  encendido = false,
  onTomarElTiempo,
  onRecorrer,
  onSoltarElTiempo,
}: JoystickProps) {
  const disco = useRef<HTMLButtonElement>(null)
  const origen = useRef<{ x: number; y: number } | null>(null)
  const rumbo = useRef<RumboDelMando>('centro')
  const [agarrado, setAgarrado] = useState(false)
  /** El temporizador de la espera y si el mando ya se quedó con el tiempo. */
  const espera = useRef(0)
  const recorriendo = useRef(false)
  const faseAlAgarrar = useRef(0)

  // El temporizador se limpia al desmontar: un salón que se cierra a mitad de una espera
  // no puede dejar un `setTimeout` vivo que pause una demostración que ya no existe.
  useEffect(() => () => window.clearTimeout(espera.current), [])

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
    recorriendo.current = false
    faseAlAgarrar.current = 0
    setAgarrado(true)
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    // AGUANTAR SE QUEDA CON LA REPETICIÓN. Solo si el dedo sigue en el centro cuando
    // vence: quien ya está tirando hacia un lado está pidiendo otra cosa.
    if (!onTomarElTiempo) return
    window.clearTimeout(espera.current)
    espera.current = window.setTimeout(() => {
      if (!origen.current || rumbo.current !== 'centro') return
      recorriendo.current = true
      const fase = onTomarElTiempo()
      faseAlAgarrar.current = typeof fase === 'number' ? fase : 0
    }, ESPERA_DEL_RECORRIDO)
  }

  const alMoverDedo = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const o = origen.current
    if (!o) return
    e.stopPropagation()
    const dx = e.clientX - o.x
    const dy = e.clientY - o.y
    const tiro = tiroDelDisco(dx, dy)
    pintar(tiro.x, tiro.y, false)
    // CON EL TIEMPO EN LA MANO, el dedo recorre y no apunta: no hay rumbo que dar y la
    // pared no se entera de nada. Lo que cambia se ve en el sujeto, que va con el dedo.
    if (recorriendo.current) {
      onRecorrer?.(faseDelRecorrido(dx, faseAlAgarrar.current))
      return
    }
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
    window.clearTimeout(espera.current)
    if (recorriendo.current) {
      // Se devuelve la demostración a su marcha y NO se emite rumbo: este gesto no toca
      // el reloj de la pared.
      recorriendo.current = false
      onSoltarElTiempo?.()
      rumbo.current = 'centro'
      return
    }
    onSoltar(rumbo.current)
    rumbo.current = 'centro'
  }

  return (
    <button data-no-orbita
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
