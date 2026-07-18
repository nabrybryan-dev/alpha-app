import { useEffect, useRef, useState, type ReactNode } from 'react'

interface RevelarProps {
  children: ReactNode
  /** Retraso de la transición, para escalonar listas (p. ej. i * 60). */
  retrasoMs?: number
  className?: string
}

/**
 * Revela su contenido con un fade-up cuando entra al viewport
 * (IntersectionObserver, una sola vez). Sin observador disponible o con
 * prefers-reduced-motion, muestra el contenido de inmediato.
 */
export function Revelar({ children, retrasoMs = 0, className = '' }: RevelarProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sinSoporte = !('IntersectionObserver' in window)
    const reducido =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (sinSoporte || reducido) {
      setVisible(true)
      return
    }
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
  }, [])

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
