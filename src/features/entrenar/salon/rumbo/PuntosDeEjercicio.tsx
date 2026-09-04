import { ejercicioCompleto } from '../../../../domain/cumplimiento'
import type { Sesion } from '../../../../domain/types'

/**
 * POR DÓNDE VAS: un punto por ejercicio, y nada más.
 *
 * ## Qué sustituye
 *
 * El cuadro «a continuación», que colgaba del muro de detrás y listaba con letra los
 * ejercicios que faltaban. Decía lo mismo que dicen cuatro puntos de cuatro píxeles y
 * ocupaba un muro entero para decirlo.
 *
 * Y decía algo MÁS de lo que hace falta durante la serie. Cuántos ejercicios quedan es
 * orientación —¿estoy por la mitad?—, no información que se opere: quien quiera los
 * nombres los tiene enteros en el panel de abajo, a un dedo. La forma tiene que
 * corresponder con eso: una banda de puntos se lee de reojo y no se lee si no la miras.
 *
 * ## Tres estados y no dos
 *
 * El punto ancho es dónde estás. Los llenos son los que ya están hechos, los apagados los
 * que faltan. Con solo dos —hecho y no hecho— el punto de «aquí estoy» se confundiría con
 * el siguiente pendiente, que es justo la pregunta que esto contesta.
 *
 * ## Sin una letra
 *
 * El nombre de cada ejercicio va en `aria-label`, que es un atributo y no un nodo de
 * texto. Es lo que permite cumplir la regla dura de la vista inicial —ningún texto por
 * encima del lienzo fuera de los huecos declarados— sin dejar a quien navega con lector
 * sin saber por dónde va.
 */

export interface PuntosDeEjercicioProps {
  sesion: Sesion | undefined
  /** El ejercicio que el salón está enseñando ahora mismo. */
  ejercicioId?: string
}

export function PuntosDeEjercicio({ sesion, ejercicioId }: PuntosDeEjercicioProps) {
  const ejercicios = sesion?.ejercicios ?? []
  // Con uno solo no hay recorrido que enseñar: un punto suelto no orienta, decora.
  if (ejercicios.length < 2) return null

  return (
    <div
      data-puntos="ejercicios"
      role="group"
      aria-label="Por dónde vas en la sesión"
      className="flex items-center justify-center gap-1.5"
    >
      {ejercicios.map((e) => {
        const aqui = e.id === ejercicioId
        const hecho = ejercicioCompleto(e)
        return (
          <span
            key={e.id}
            data-punto={aqui ? 'aqui' : hecho ? 'hecho' : 'falta'}
            aria-label={e.nombre}
            className="h-1 rounded-full transition-[width,background-color] duration-base ease-salida"
            style={{
              width: aqui ? '18px' : '6px',
              background: aqui
                ? 'var(--accion)'
                : hecho
                  ? 'rgb(var(--silver-300-rgb) / 0.55)'
                  : 'var(--linea-fuerte, #4a4a4d)',
            }}
          />
        )
      })}
    </div>
  )
}
