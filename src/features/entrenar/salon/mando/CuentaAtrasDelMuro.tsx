import { useEffect, useRef } from 'react'
import {
  comoReloj,
  rotuloDelModo,
  segundosDelReloj,
  type AnclasDelReloj,
  type ModoDelReloj,
} from './relojDelMuro'

/**
 * LA CUENTA ATRÁS, EN LA PARED.
 *
 * ## El texto se escribe en el nodo, no por estado
 *
 * Cuatro veces por segundo. Por estado, eso son cuatro re-renders por segundo de TODO el
 * salón —el sujeto, las cuatro estaciones, los cuadros de pared— para cambiar dos dígitos.
 * Es la misma razón por la que la cámara y el cajón escriben en el nodo mientras el dedo
 * se mueve, y aquí pesa más todavía porque no depende de que nadie esté tocando nada:
 * corre todo el descanso.
 *
 * A 250 ms y no a 1000: contra un instante guardado, un reloj que solo mira cada segundo
 * enseña el cambio con hasta un segundo de retraso, y en una cuenta atrás corta eso se ve.
 *
 * ## Y por qué el aviso lo lanza este componente
 *
 * Porque es el único que sabe cuándo se cruzó el cero. Quien monta esto tiene el modo y el
 * ancla, pero no está mirando el reloj: si tuviera que calcular él el final, habría dos
 * cuentas del mismo tiempo y la del aviso podría dispararse antes o después de que la
 * pared llegue a `0:00`.
 */

export interface CuentaAtrasDelMuroProps {
  modo: ModoDelReloj
  anclas: AnclasDelReloj
  /** Se llama UNA vez, al cruzar el cero. */
  alTerminar: () => void
}

export function CuentaAtrasDelMuro({ modo, anclas, alTerminar }: CuentaAtrasDelMuroProps) {
  const cifra = useRef<HTMLSpanElement>(null)
  const terminado = useRef(false)
  // El aviso se llama desde un intervalo, así que la función tiene que estar fresca sin
  // reiniciar el reloj en cada render de quien lo monta. La asignación va DENTRO de un
  // efecto y no suelta en el cuerpo: escribir un ref durante el render es error de
  // `react-hooks/refs`, y con motivo — un render puede descartarse y la escritura no.
  const alTerminarRef = useRef(alTerminar)
  useEffect(() => {
    alTerminarRef.current = alTerminar
  }, [alTerminar])

  useEffect(() => {
    terminado.current = false
    const tic = () => {
      const restante = segundosDelReloj(modo, anclas, Date.now())
      if (cifra.current) cifra.current.textContent = comoReloj(restante)
      if (restante <= 0 && !terminado.current) {
        terminado.current = true
        alTerminarRef.current()
      }
    }
    tic()
    const id = window.setInterval(tic, 250)
    return () => window.clearInterval(id)
  }, [modo, anclas])

  return (
    <div className="text-right">
      <p className="muro-rotulo text-[0.5em] text-accion">{rotuloDelModo(modo)}</p>
      {/* `tabular-nums` no es cosmético: sin él la cifra cambia de ancho al pasar de «1:09»
          a «1:10» y el reloj baila de lado cada segundo. Un marcador no baila. */}
      <span
        ref={cifra}
        // El lector de pantalla no debe leer una cuenta atrás cuatro veces por segundo: se
        // anuncia el modo, y la cifra se calla. Quien la necesita puede consultarla.
        aria-hidden="true"
        className="muro-reloj muro-reloj-vivo mt-[0.1em] block text-[1.45em]"
      />
      <span className="muro-filete-reloj" aria-hidden="true" />
    </div>
  )
}
