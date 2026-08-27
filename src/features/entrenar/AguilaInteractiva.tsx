import { useRef } from 'react'
import { movimientoReducido } from '../../components/ui/movimientoReducido'
import logoAguila from '../../assets/brand/logo-aguila.png'

interface AguilaInteractivaProps {
  /** Clase para el tamaño/estilo del logo (h-24 w-24, etc.). */
  className?: string
  /** Aplica la entrada animada (útil en la pantalla de sesión completada). */
  entrada?: boolean
}

/**
 * El águila de Alpha, tocable: al tocarla da una vuelta 3D con física. Usa la
 * Web Animations API (acelerada por GPU, reiniciable), así el giro se puede
 * volver a disparar tocando de nuevo sin esperar a que termine.
 */
export function AguilaInteractiva({ className = '', entrada = false }: AguilaInteractivaProps) {
  const ref = useRef<HTMLImageElement>(null)

  const girar = () => {
    const el = ref.current
    if (!el) return
    // Con movimiento reducido esto hacía `return` a secas, y el resultado era un
    // botón que al tocarlo no hacía ABSOLUTAMENTE NADA: el `.press` que lo envuelve
    // también queda anulado por la preferencia, así que no quedaba ni una señal, y
    // el elemento sigue anunciándose como botón. Eso no es «menos movimiento», es
    // cero, que es justo lo que STANDARDS prohíbe.
    // Ahora el toque sigue acusando recibo con un parpadeo de opacidad —lo que esa
    // misma sección manda conservar— y desaparecen el giro y la escala, que es lo
    // que manda quitar. Se pierde la vuelta, no la respuesta.
    if (movimientoReducido()) {
      el.animate([{ opacity: 0.6 }, { opacity: 1 }], {
        // 160 ms es `--dur-toque`; va escrito literal porque la Web Animations API
        // no resuelve `var()`.
        duration: 160,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
      })
      return
    }
    el.animate(
      [
        { transform: 'perspective(600px) rotateY(0deg) scale(1)' },
        { transform: 'perspective(600px) rotateY(180deg) scale(0.92)', offset: 0.5 },
        { transform: 'perspective(600px) rotateY(360deg) scale(1)' },
      ],
      // La curva es `--ease-rebote` (tokens.css), escrita literal por lo mismo: la
      // WAAPI no resuelve `var()`. Es la única con rebote del sistema y este es el
      // sitio donde el rebote está justificado.
      { duration: 720, easing: 'cubic-bezier(0.34, 1.2, 0.4, 1)' },
    )
  }

  return (
    <button
      type="button"
      onClick={girar}
      aria-label="Águila Alpha"
      className="press inline-block [perspective:600px]"
    >
      <img
        ref={ref}
        src={logoAguila}
        alt=""
        aria-hidden="true"
        className={`rounded-3xl border border-hairline bg-ink-900 object-contain p-2 shadow-xl [backface-visibility:hidden] ${
          entrada ? 'aguila-entra' : ''
        } ${className}`}
      />
    </button>
  )
}
