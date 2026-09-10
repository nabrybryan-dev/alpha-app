import { useEffect, useRef } from 'react'

import type { EjercicioPrescrito } from '../../../../domain/types'
import type { CuadroEnPantalla } from '../camara/dedoEnElCuerpo'
import {
  aspectoDeEstacion,
  estacionesDeLaSerie,
  type ClaveDeEstacion,
} from './estacionesDeLaSerie'
import { desvioDelCartel, type DesvioDelCartel } from './sitioDelCartel'

/**
 * LAS CUATRO ESTACIONES, DIBUJADAS: poste, base y cartel alrededor del sujeto.
 *
 * ## El cartel SIEMPRE mira a cámara
 *
 * Y no es una preferencia: un cartel plantado en el suelo que gire con el mundo queda de
 * canto la mitad de la vuelta, o sea ilegible justo cuando la estación está a un lado. El
 * poste y la base sí giran —son objetos del suelo—; el cartel contrarresta el giro.
 *
 * ## LA OPACIDAD VA EN EL CARTEL, NUNCA EN EL ENVOLTORIO
 *
 * Un `opacity` menor que 1 sobre un contenedor con `preserve-3d` lo APLANA: crea un grupo
 * de composición y los hijos dejan de vivir en el espacio 3D del padre. El cartel deja de
 * poder contrarrestar la rotación y se queda de canto. Es un fallo que no da error, no se
 * ve en el DOM y solo aparece al orbitar — el propio kit lo trae marcado como ya cometido
 * una vez.
 *
 * ## Por qué la cifra se retira sola
 *
 * Porque es lo que mantiene el salón despejado. La prescripción se lee una vez al llegar
 * al ejercicio; después queda el poste con su base, que no tapa nada. Cuatro números
 * permanentes alrededor del cuerpo serían otra vez el dashboard con un muñeco dentro, que
 * es de lo que este salón vino a salir.
 *
 * Y desde el 2026-09-06 VUELVE: ciclo de 5 s —tres quieta, dos fuera— que no termina
 * (Bryan: «se reflejan al principio y luego se pierden»). Al tocar una, esa se queda FIJA
 * (`data-fija`: sin animación y posada, no en pausa, que la dejaría invisible si el ciclo
 * iba por «nada») y las otras tres se atenúan; tocarla otra vez la suelta.
 */

/** A cuántos píxeles del eje del cuerpo se plantan los postes. */
const RADIO = 138

/**
 * Cuánto se acerca el cartel a su sitio nuevo en cada fotograma.
 *
 * Dieciocho centésimas: el cartel llega en unos diez fotogramas —un sexto de segundo— y no
 * de un salto. El salto se nota como un parpadeo justo cuando el cuerpo entra o sale de
 * debajo del cartel, que es el momento en que se está mirando esa zona. Con movimiento
 * reducido no se persigue nada: se posa donde toca en el mismo fotograma.
 */
const PERSECUCION = 0.18

/**
 * EL BUCLE QUE APARTA LOS CARTELES DEL SUJETO.
 *
 * Vive en un `requestAnimationFrame` y escribe una variable CSS en cada cartel. **No toca
 * el estado de React**, y eso no es una optimización: el cuadro del cuerpo cambia en cada
 * fotograma, así que un `setState` aquí sería un repintado de las cuatro estaciones sesenta
 * veces por segundo con el dedo en la pantalla — que es justo lo que el kit prohíbe.
 *
 * El desvío se calcula siempre contra el sitio NATURAL del cartel (el que tendría con
 * `--desvio` a cero), no contra donde está ahora. Calcularlo contra su sitio actual sería
 * un lazo cerrado: el cartel apartado ya no pisa al cuerpo, el desvío pedido pasaría a
 * cero, volvería a pisarlo, y se quedaría oscilando para siempre.
 */
function useEsquivarElCuerpo(
  zona: React.RefObject<HTMLDivElement | null>,
  cuerpo: (() => CuadroEnPantalla | undefined) | undefined,
  marco: { arriba: number; abajo: number; ancho: number } | undefined,
) {
  const aplicado = useRef(new Map<Element, DesvioDelCartel>())
  // Los tres bordes se desmontan del objeto a propósito: un `marco` recreado en cada render
  // del salón reiniciaría el bucle sesenta veces por segundo aunque los números no cambien.
  const arriba = marco?.arriba
  const abajo = marco?.abajo
  const ancho = marco?.ancho
  useEffect(() => {
    if (!cuerpo || arriba === undefined || abajo === undefined || ancho === undefined) return
    const marcoFijo = { arriba, abajo, ancho }
    const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let vivo = 0
    const paso = () => {
      vivo = requestAnimationFrame(paso)
      const nodos = zona.current?.querySelectorAll<HTMLElement>('.estacion-cartel')
      if (!nodos?.length) return
      const cuadro = cuerpo()
      for (const nodo of Array.from(nodos)) {
        const ya = aplicado.current.get(nodo) ?? { dx: 0, dy: 0 }
        const r = nodo.getBoundingClientRect()
        // El sitio natural: donde caería el cartel sin desvío ninguno.
        const natural = {
          x0: r.left - ya.dx,
          x1: r.right - ya.dx,
          y0: r.top - ya.dy,
          y1: r.bottom - ya.dy,
        }
        const objetivo = desvioDelCartel(natural, cuadro, marcoFijo)
        const posar = (eje: 'dx' | 'dy') => {
          if (!suave) return objetivo[eje]
          const paso = ya[eje] + (objetivo[eje] - ya[eje]) * PERSECUCION
          return Math.abs(objetivo[eje] - paso) < 0.5 ? objetivo[eje] : paso
        }
        const dx = posar('dx')
        const dy = posar('dy')
        if (dx !== ya.dx || dy !== ya.dy) {
          aplicado.current.set(nodo, { dx, dy })
          nodo.style.setProperty('--desvio-x', `${dx.toFixed(1)}px`)
          nodo.style.setProperty('--desvio-y', `${dy.toFixed(1)}px`)
        }
      }
    }
    vivo = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(vivo)
  }, [zona, cuerpo, arriba, abajo, ancho])
}

/** Cuánto mide el poste, en píxeles. La base va abajo y el cartel encima. */
const POSTE = 120

export interface EstacionesDelSujetoProps {
  ejercicio: EjercicioPrescrito | undefined
  /** El azimut de la cámara del salón, en grados. Es lo que ata las estaciones a la sala. */
  azimut: number
  /** Dónde está el suelo bajo el sujeto, en píxeles desde arriba del salón. */
  suelo: number
  /**
   * DÓNDE ESTÁ EL CUERPO EN LA PANTALLA, para no dibujarle encima.
   *
   * Llega como función y no como valor porque el cuadro cambia sesenta veces por segundo
   * —lo escribe el visor en un `ref` en cada fotograma— y pasarlo como prop repintaría las
   * cuatro estaciones a cada uno. Se lee desde el bucle de abajo, que escribe en el nodo.
   */
  cuerpo?: () => CuadroEnPantalla | undefined
  /** Dónde puede vivir un cartel: los dos bordes útiles en vertical y el ancho del salón. */
  marco?: { arriba: number; abajo: number; ancho: number }
  /** La estación que el asesorado dejó fija, si dejó alguna. */
  foco?: ClaveDeEstacion
  onEnfocar: (clave: ClaveDeEstacion) => void
}

export function EstacionesDelSujeto({
  ejercicio,
  azimut,
  suelo,
  cuerpo,
  marco,
  foco,
  onEnfocar,
}: EstacionesDelSujetoProps) {
  const estaciones = estacionesDeLaSerie(ejercicio)
  const zonaRef = useRef<HTMLDivElement>(null)
  useEsquivarElCuerpo(zonaRef, cuerpo, marco)
  if (estaciones.length === 0) return null

  return (
    <div
      ref={zonaRef}
      data-hueco="estaciones"
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 'var(--z-contenido)' }}
    >
      {estaciones.map((e, i) => {
        const a = aspectoDeEstacion(e.angulo, azimut, RADIO)
        const enfocada = foco === e.clave
        return (
          <div
            key={e.clave}
            data-estacion={e.clave}
            data-enfocada={enfocada ? '' : undefined}
            className="absolute"
            style={{
              left: `calc(50% + ${a.x.toFixed(1)}px)`,
              top: `${suelo}px`,
              // Lo de delante, delante. Sin esto, la estación de la espalda se pinta
              // encima de la de enfrente cuando el azimut las cruza.
              zIndex: Math.round(500 + a.frente * 100),
            }}
          >
            {/* EL POSTE Y LA BASE: los dos objetos del suelo. No contrarrestan nada —giran
                con la sala, que es lo que hace que se lean como plantados en ella. */}
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-[-1px] w-[2px]"
              style={{
                height: `${POSTE}px`,
                background: `linear-gradient(180deg, ${
                  enfocada ? 'var(--accion)' : 'rgb(var(--silver-300-rgb) / 0.55)'
                }, transparent)`,
                opacity: a.opacidad,
              }}
            />
            <span
              aria-hidden="true"
              className="absolute left-[-40px] top-[-20px] h-20 w-20 rounded-full border"
              style={{
                borderColor: enfocada
                  ? 'rgb(var(--accion-rgb) / 0.7)'
                  : 'rgb(var(--silver-300-rgb) / 0.3)',
                background: enfocada
                  ? 'rgb(var(--accion-rgb) / 0.1)'
                  : 'rgb(var(--silver-300-rgb) / 0.04)',
                transform: 'rotateX(90deg)',
                opacity: a.opacidad,
              }}
            />

            {/* EL CARTEL. La opacidad va AQUÍ y no en el contenedor de arriba: sobre un
                envoltorio con `preserve-3d` aplanaría el grupo y el cartel se quedaría de
                canto al orbitar. */}
            <button
              type="button"
              onClick={() => onEnfocar(e.clave)}
              className="estacion-cartel pointer-events-auto absolute w-[132px] text-center"
              style={{
                left: '-66px',
                bottom: `${POSTE + 4}px`,
                opacity: foco && !enfocada ? a.opacidad * 0.45 : a.opacidad,
                // `--desvio-x` y `--desvio-y` los escribe el bucle de `useEsquivarElCuerpo`
                // directamente en el nodo: es lo que aparta el cartel del sujeto sin
                // repintar React. Van ANTES del `scale`, para que cuenten en píxeles de
                // pantalla y no en píxeles encogidos por la distancia.
                transform: `translate(var(--desvio-x, 0px), calc(${(-a.alza).toFixed(0)}px + var(--desvio-y, 0px))) scale(${a.escala.toFixed(3)})`,
                transformOrigin: '50% 100%',
              }}
            >
              <span
                className="estacion-cifra"
                data-anima
                data-fija={enfocada ? '' : undefined}
                style={{ animationDelay: `${80 + i * 100}ms` }}
              >
                <span
                  className="muro-rotulo block text-[10.5px]"
                  style={{ color: enfocada ? 'var(--accion)' : 'var(--gris-marca)' }}
                >
                  {e.rotulo}
                </span>
                <span
                  className="estacion-numero mt-1 block"
                  style={{ color: enfocada ? 'var(--accion)' : 'var(--texto)' }}
                >
                  {e.cifra}
                </span>
                <span className="mt-1.5 block text-[11.5px] leading-tight text-tenue">{e.pie}</span>
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
