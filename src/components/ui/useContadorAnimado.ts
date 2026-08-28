import { useEffect, useRef, useState } from 'react'
import { movimientoReducido } from './movimientoReducido'

const facilidad = (t: number) => 1 - Math.pow(1 - t, 4)

/**
 * Cuenta un número desde su valor mostrado actual hasta `objetivo` con rAF
 * y ease-out. Respeta prefers-reduced-motion (salta directo al valor) y
 * garantiza el valor final aunque el navegador congele los frames.
 * El llamador redondea/formatea el resultado.
 */
export function useContadorAnimado(
  objetivo: number,
  duracionMs = 900,
  /**
   * Arrancar YA en el objetivo en vez de contar desde cero al montar.
   *
   * El comportamiento de siempre —subir desde 0— es el de un marcador: cuenta lo
   * conseguido y la cuenta ES el mensaje. Pero hay cifras que no son un marcador
   * sino el ESTADO DE UN MANDO: los kilos que vas a levantar, las reps, el RIR.
   * Ahí contar desde cero al montar diría algo falso —«empiezas en 0 y subes»—
   * cuando el valor ya venía puesto por la prescripción del coach.
   *
   * Con esto la cifra solo se mueve cuando CAMBIA, que es lo que se quiere de un
   * mando: reacciona a una causa y el resto del tiempo está quieta.
   */
  arrancarEnObjetivo = false,
): number {
  const reducido = movimientoReducido()
  const inicial = reducido || arrancarEnObjetivo ? objetivo : 0
  const [valor, setValor] = useState(() => inicial)
  // Último valor realmente mostrado: punto de partida de la siguiente animación.
  const mostradoRef = useRef(inicial)

  useEffect(() => {
    if (movimientoReducido()) {
      // Sin animación no hay estado que sincronizar: el valor sale directo de
      // `objetivo` al devolverlo, abajo. Aquí solo se apunta el mostrado, que es
      // el punto de partida si el movimiento se reactiva.
      mostradoRef.current = objetivo
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

  // Con movimiento reducido el valor ES el objetivo: se deriva en el render en vez
  // de empujarlo al estado desde el efecto.
  return reducido ? objetivo : valor
}
