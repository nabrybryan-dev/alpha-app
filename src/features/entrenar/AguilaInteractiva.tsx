import { useRef } from 'react'
import { MarcaRaster } from '../../components/ui/MarcaRaster'

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
  const ref = useRef<HTMLSpanElement>(null)

  const girar = () => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate(
      [
        { transform: 'perspective(600px) rotateY(0deg) scale(1)' },
        { transform: 'perspective(600px) rotateY(180deg) scale(0.92)', offset: 0.5 },
        { transform: 'perspective(600px) rotateY(360deg) scale(1)' },
      ],
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
      {/* Antes esto era un JPEG con el fondo negro dentro del archivo, y el
          `rounded-3xl` con borde estaba para disimular el recuadro. Ahora es la
          marca enmascarada: toma el color del texto que la rodea, asi que ya no
          necesita caja ni sombra que la despegue del fondo. */}
      <span
        ref={ref}
        className={`inline-block [backface-visibility:hidden] ${entrada ? 'aguila-entra' : ''} ${className}`}
      >
        <MarcaRaster marca="aguila" className="h-full w-full" />
      </span>
    </button>
  )
}
