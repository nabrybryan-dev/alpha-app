import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

interface ComunProps {
  children: ReactNode
  /** Ocupa todo el ancho (la acción principal de una tarjeta). */
  bloque?: boolean
  /** Botón redondo de 56 px, para un solo icono. */
  redondo?: boolean
  className?: string
}

type ComoEnlace = ComunProps & Omit<LinkProps, 'className' | 'children'> & { to: LinkProps['to'] }
type ComoBoton = ComunProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { to?: undefined }

export type Boton3DProps = ComoEnlace | ComoBoton

/**
 * El botón con cuerpo de la maqueta «Diseño final 3» (`.btn3d`): rojo, con cinco cantos y
 * una inclinación de 8° que se aplana y se hunde al pulsar, con el muelle de microinteracción.
 * Es la acción PRINCIPAL de una pantalla o de una tarjeta; la secundaria es `.tecla-2`.
 *
 * Con `to` es un enlace de la app (`<Link>`); sin él, un `<button>`. Los colores y los cantos
 * son tokens de `tokens.css` (`--btn-*`, `--canto-1..5`); con `prefers-reduced-motion` el botón
 * queda plano y quieto: al pulsar cambia, pero no se hunde con animación.
 */
export function Boton3D(props: Boton3DProps) {
  const { bloque = false, redondo = false, className = '', children } = props
  const clases = ['btn-3d', bloque ? 'btn-3d-bloque' : '', redondo ? 'btn-3d-redondo' : '', className]
    .filter(Boolean)
    .join(' ')

  if (props.to !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { bloque: _b, redondo: _r, className: _c, children: _h, ...resto } = props
    return (
      <Link {...resto} className={clases}>
        {children}
      </Link>
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bloque: _b, redondo: _r, className: _c, children: _h, to: _t, type, ...resto } = props
  return (
    <button {...resto} type={type ?? 'button'} className={clases}>
      {children}
    </button>
  )
}
