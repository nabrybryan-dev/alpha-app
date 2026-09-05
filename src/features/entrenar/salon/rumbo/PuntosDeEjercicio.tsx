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
 * ## Y SE TOCAN
 *
 * Desde el 2026-09-05 cada punto es un botón que salta a su ejercicio. Antes eran `span`s:
 * decían por dónde ibas y no dejaban ir a ningún sitio, que es la mitad de lo que hace una
 * banda de puntos en cualquier carrusel. Es la vía directa —deslizar de lado avanza de uno
 * en uno; el punto lleva al quinto sin pasar por los otros cuatro—, y la única que existe
 * para quien navega con teclado o con lector de pantalla, porque un barrido ahí no llega.
 *
 * El área que se toca es de 44 px aunque el punto mida uno de alto: es el mínimo con el que
 * un dedo acierta, y se consigue con relleno transparente, sin que la banda crezca ni ocupe
 * más sala. Sin eso serían seis píxeles de diana y no acertaría nadie.
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
  /** Saltar a un ejercicio por su posición. Sin esto los puntos solo informan. */
  alIr?: (indice: number) => void
  /** El ejercicio que el salón está enseñando ahora mismo. */
  ejercicioId?: string
}

export function PuntosDeEjercicio({ sesion, ejercicioId, alIr }: PuntosDeEjercicioProps) {
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
      {ejercicios.map((e, i) => {
        const aqui = e.id === ejercicioId
        const hecho = ejercicioCompleto(e)
        const punto = (
          <span
            data-punto={aqui ? 'aqui' : hecho ? 'hecho' : 'falta'}
            className="block h-1 rounded-full transition-[width,background-color] duration-base ease-salida"
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
        if (!alIr) {
          return (
            <span key={e.id} aria-label={e.nombre}>
              {punto}
            </span>
          )
        }
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => alIr(i)}
            aria-label={e.nombre}
            aria-current={aqui ? 'true' : undefined}
            // La diana de 44 px sin que la banda engorde: el relleno es transparente y
            // el margen negativo se lo devuelve al hueco entre puntos.
            className="press -my-[21px] flex items-center py-[21px]"
          >
            {punto}
          </button>
        )
      })}
    </div>
  )
}
