import { useEffect, useRef, useState } from 'react'

const facilidad = (t: number) => 1 - Math.pow(1 - t, 4)

function movimientoReducido(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Cuenta un número desde su valor mostrado actual hasta `objetivo` con rAF
 * y ease-out. Respeta prefers-reduced-motion (salta directo al valor) y
 * garantiza el valor final aunque el navegador congele los frames.
 * El llamador redondea/formatea el resultado.
 */
export function useContadorAnimado(objetivo: number, duracionMs = 900): number {
  const [valor, setValor] = useState(() => (movimientoReducido() ? objetivo : 0))
  // Último valor realmente mostrado: punto de partida de la siguiente animación.
  const mostradoRef = useRef(movimientoReducido() ? objetivo : 0)

  useEffect(() => {
    if (movimientoReducido()) {
      mostradoRef.current = objetivo
      setValor(objetivo)
      return
    }
    const desde = mostradoRef.current
    if (desde === objetivo) {
      setValor(objetivo)
      return
    }

    let marco = 0
    // El origen se toma del propio reloj del rAF para no mezclar relojes.
    let inicio: number | undefined
    let terminado = false

    const terminar = () => {
      terminado = true
      cancelAnimationFrame(marco)
      mostradoRef.current = objetivo
      setValor(objetivo)
    }

    const paso = (ahora: number) => {
      if (terminado) return
      if (inicio === undefined) inicio = ahora
      const t = Math.min(1, Math.max(0, (ahora - inicio) / duracionMs))
      const actual = desde + (objetivo - desde) * facilidad(t)
      mostradoRef.current = actual
      setValor(actual)
      if (t < 1) {
        marco = requestAnimationFrame(paso)
      } else {
        terminado = true
        mostradoRef.current = objetivo
      }
    }
    marco = requestAnimationFrame(paso)

    // Red de seguridad: si el navegador congela rAF (pestaña en segundo
    // plano, renderer throttled), el valor final queda garantizado.
    const garantia = setTimeout(terminar, duracionMs + 250)

    return () => {
      terminado = true
      cancelAnimationFrame(marco)
      clearTimeout(garantia)
    }
  }, [objetivo, duracionMs])

  return valor
}
