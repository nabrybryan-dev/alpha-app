import { useEffect, useRef, useState, type ReactNode } from 'react'
import { movimientoReducido } from './movimientoReducido'

interface RevelarProps {
  children: ReactNode
  /** Retraso de la transición, para escalonar listas (p. ej. i * 60). */
  retrasoMs?: number
  className?: string
}

/**
 * ¿Hay que mostrar el contenido ya, sin animar nada?
 *
 * Es una pregunta que se responde ANTES del primer render: no depende de nada que
 * pase después. Por eso es el valor inicial del estado y no un efecto —así además
 * quien pidió menos movimiento no ve el parpadeo de "oculto y de golpe visible".
 */
function revelarDeInmediato(): boolean {
  if (!('IntersectionObserver' in window)) return true
  return movimientoReducido()
}

/**
 * Revela su contenido con un fade-up cuando entra al viewport
 * (IntersectionObserver, una sola vez). Sin observador disponible o con
 * prefers-reduced-motion, muestra el contenido de inmediato.
 */
export function Revelar({ children, retrasoMs = 0, className = '' }: RevelarProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(revelarDeInmediato)

  useEffect(() => {
    // Ya visible: no hay nada que observar. Al revelarse, este efecto se limpia.
    if (visible) return
    const el = ref.current
    if (!el) return
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          setVisible(true)
          observador.disconnect()
        }
      },
      { rootMargin: '-32px 0px' },
    )
    observador.observe(el)
    // Red de seguridad: el contenido jamás queda oculto si el observer
    // no dispara (renderer congelado, navegadores degradados).
    const garantia = setTimeout(() => setVisible(true), 2500)
    return () => {
      observador.disconnect()
      clearTimeout(garantia)
    }
  }, [visible])

  return (
    <div
      ref={ref}
      className={`revelar ${visible ? 'revelado' : ''} ${className}`}
      style={retrasoMs > 0 ? { transitionDelay: `${retrasoMs}ms` } : undefined}
    >
      {children}
    </div>
  )
}
