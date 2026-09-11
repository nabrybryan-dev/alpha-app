import { useEffect, useRef, useState } from 'react'

import type { EjercicioPrescrito, ItemMarcable } from '../../../../domain/types'
import type { CuadroEnPantalla } from '../camara/dedoEnElCuerpo'
import {
  aspectoDeEstacion,
  cajaTocableDelPoste,
  estacionesDeLaSerie,
  type ClaveDeEstacion,
} from './estacionesDeLaSerie'
import { estacionesDelCardio } from './estacionesDelCardio'
import {
  desviosDeLosCarteles,

  type DesvioDelCartel,
  type Recuadro,
} from './sitioDelCartel'

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
 * Del 2026-09-06 al 11 volvía sola en un ciclo de 5 s que no terminaba, porque Bryan dijo
 * «se reflejan al principio y luego se pierden». Lo que faltaba entonces era dónde
 * encontrarlas después, y eso ya existe: **el muro de enfrente lleva las cuatro cifras
 * grandes y permanentes** desde ese mismo día. Con la prescripción puesta en la pared, un
 * segundo juego de números dando vueltas alrededor del cuerpo es la pared repetida encima
 * de la sala. Medido el 2026-09-11: tapaban el 2,34 % de la pantalla, setenta y cinco veces
 * el ruido de la propia foto (0,03 %, el cronómetro). Decisión de Bryan ese día: **que se
 * retiren y vuelvan al tocar**.
 *
 * Así que la cifra entra, se lee y se va —una vez—, y lo que queda plantado es el poste con
 * su base. **Para volver a verla se toca su poste**, que es el objeto de la sala que sigue
 * ahí: la estación queda FIJA (`data-fija`: sin animación y posada, no en pausa, que la
 * dejaría invisible) y las otras se atenúan; tocarla otra vez la suelta. Es la regla 3 del
 * kit —la interacción se hace tocando el salón, no con mandos puestos encima— y por eso el
 * botón es el poste y no el cartel: un botón donde había un número que ya se fue es una
 * zona sensible invisible en mitad de la sala.
 */

/** A cuántos píxeles del eje del cuerpo se plantan los postes. */
const RADIO = 138

/**
 * POR QUÉ EL CARTEL YA NO PERSIGUE SU SITIO, SE POSA EN ÉL.
 *
 * Hasta el 2026-09-11 el cartel viajaba a su sitio nuevo a razón de 0,18 por fotograma
 * —unos diez fotogramas— para que no diera un salto justo cuando el cuerpo se le metía
 * debajo. El salto se evitaba, pero se pagaba con el CAMINO: mientras viajaba, el cartel
 * CRUZABA por encima de los otros tres. Medido ese día: solapes momentáneos de hasta el
 * 100 % que no estaban en el destino, solo en el trayecto; con la colocación instantánea,
 * cero desde los 1,3 s hasta que la cifra se retira.
 *
 * El cambio es aceptable porque el reparto ya no se recalcula cada fotograma: se sostiene
 * mientras siga siendo válido, así que el salto ocurre pocas veces y solo cuando de verdad
 * había que apartarse. Un parpadeo raro se lee mejor que un número cruzando por encima de
 * otro.
 */

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
 *
 * Y desde el 2026-09-11 decide por LOS CUATRO A LA VEZ (`desviosDeLosCarteles`). Cada uno
 * por su cuenta elegía el mismo costado libre y aterrizaban unos sobre otros: medido en el
 * salón, siempre había al menos una pareja pisándose y a menudo una cifra entera dentro de
 * otra. Por eso se leen los cuatro sitios naturales antes de mover ninguno.
 */
function useEsquivarElCuerpo(
  zona: React.RefObject<HTMLDivElement | null>,
  cuerpo: (() => CuadroEnPantalla | undefined) | undefined,
  marco: { arriba: number; abajo: number; ancho: number } | undefined,
) {
  const aplicado = useRef(new Map<Element, DesvioDelCartel>())
  /** Dónde se decidió que vaya cada cartel. `aplicado` es dónde va llegando. */
  const decidido = useRef(new Map<Element, DesvioDelCartel>())
  // Los tres bordes se desmontan del objeto a propósito: un `marco` recreado en cada render
  // del salón reiniciaría el bucle sesenta veces por segundo aunque los números no cambien.
  const arriba = marco?.arriba
  const abajo = marco?.abajo
  const ancho = marco?.ancho
  useEffect(() => {
    if (!cuerpo || arriba === undefined || abajo === undefined || ancho === undefined) return
    /**
     * EL TABLÓN DEL MURO TAMBIÉN ESTORBA, no solo el cuerpo.
     *
     * `BANDA_DE_SESION` se fijó en 84 px cuando arriba solo estaba «SESIÓN FULL C ·
     * VIERNES». Desde el 2026-09-06 el tablón cuelga ahí debajo con el nombre del
     * ejercicio en trazo y las cuatro cifras grandes, y nadie se lo dijo a los carteles:
     * un cartel que escapaba hacia arriba aterrizaba SOBRE la prescripción de la pared
     * —fotografiado el 2026-09-11, «RIR 2» encima de «SERIES REPETICIONES DESCANSO RIR»—.
     * El criterio 3 del kit prohíbe con las mismas palabras pisar al sujeto y pisar otro
     * texto, así que esto era la otra mitad del mismo incumplimiento.
     *
     * Va como ESTORBO y no como un techo aparte porque es la MISMA regla aplicada a otra
     * cosa: dos reglas que dicen «no pises esto» se separan en cuanto una se ajusta. Se
     * mide del DOM en cada fotograma y no se supone, porque el tablón cambia de alto entre
     * el anuncio —el nombre del ejercicio en dos líneas— y el reposo. Medido a 390 px: de
     * x=91 a x=379 y de y=73 a y=201, así que a esa altura no cabe un cartel de 132 a
     * ninguno de los dos lados y el efecto práctico hoy es que ninguno sube; el día que el
     * tablón encoja, el hueco que deje se podrá usar sin tocar nada.
     */
    const tablonDelMuro = (): Recuadro[] => {
      const nodo = document.querySelector('[data-tablon]')
      if (!nodo) return []
      const r = nodo.getBoundingClientRect()
      return [{ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }]
    }
    let vivo = 0
    const paso = () => {
      vivo = requestAnimationFrame(paso)
      const nodos = zona.current?.querySelectorAll<HTMLElement>('.estacion-cartel')
      if (!nodos?.length) return
      const cuadro = cuerpo()
      const marcoFijo = { arriba, abajo, ancho }
      const estorbos = [...(cuadro ? [cuadro] : []), ...tablonDelMuro()]

      // Los sitios NATURALES de los cuatro: donde caería cada cartel sin desvío ninguno.
      // Se leen todos ANTES de decidir nada, porque el reparto mira a los cuatro a la vez.
      const lista = Array.from(nodos).map((nodo, i) => {
        const estrena = !aplicado.current.has(nodo)
        const ya = aplicado.current.get(nodo) ?? { dx: 0, dy: 0 }
        const r = nodo.getBoundingClientRect()
        return {
          nodo,
          ya,
          estrena,
          clave: nodo.dataset.cartel ?? String(i),
          natural: { x0: r.left - ya.dx, x1: r.right - ya.dx, y0: r.top - ya.dy, y1: r.bottom - ya.dy },
        }
      })
      // EL REPARTO SE MANTIENE HASTA QUE DEJA DE VALER, no se recalcula cada fotograma.
      //
      // Recalcularlo siempre parece lo correcto y no lo es: el cuerpo se mueve en cada
      // fotograma, así que el reparto «óptimo» salta —un cartel que estaba a la izquierda
      // pasa a estar arriba— y, como la persecución tarda diez fotogramas en llegar, el
      // cartel CRUZA por encima de los otros mientras viaja. Medido el 2026-09-11: con
      // recálculo constante aparecían solapes momentáneos de hasta el 87 % que no estaban
      // en el destino, solo en el camino. Así que se decide una vez y se sostiene mientras
      // el sitio siga limpio; si deja de estarlo, se vuelve a repartir entero.
      const sitioCon = (c: (typeof lista)[number], d: DesvioDelCartel) => ({
        x0: c.natural.x0 + d.dx,
        x1: c.natural.x1 + d.dx,
        y0: c.natural.y0 + d.dy,
        y1: c.natural.y1 + d.dy,
      })
      const chocan = (a: Recuadro, b: Recuadro) =>
        a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1
      const valen = (candidatos: DesvioDelCartel[]) => {
        const sitios = lista.map((c, i) => sitioCon(c, candidatos[i]))
        if (sitios.some((r) => estorbos.some((e) => chocan(r, e)))) return false
        return !sitios.some((r, i) => sitios.some((otro, j) => j > i && chocan(r, otro)))
      }

      const enPie = lista.map(({ nodo }) => decidido.current.get(nodo) ?? { dx: 0, dy: 0 })
      const aCasa = lista.map(() => ({ dx: 0, dy: 0 }))
      // Volver a casa en cuanto se pueda: si no, un cartel apartado por una postura que ya
      // pasó se quedaría a un lado para siempre, y su poste dejaría de señalarlo.
      const reparto = valen(aCasa)
        ? new Map(lista.map((c) => [c.clave, { dx: 0, dy: 0 }]))
        : valen(enPie)
          ? new Map(lista.map((c, i) => [c.clave, enPie[i]]))
          : desviosDeLosCarteles(lista, estorbos, marcoFijo)

      const sitios = new Map(
        lista.map((c) => [c.clave, sitioCon(c, reparto.get(c.clave) ?? { dx: 0, dy: 0 })]),
      )

      for (const { nodo, ya, estrena, clave } of lista) {
        const objetivo = reparto.get(clave) ?? { dx: 0, dy: 0 }
        decidido.current.set(nodo, objetivo)
        const { dx, dy } = objetivo
        if (estrena || dx !== ya.dx || dy !== ya.dy) {
          aplicado.current.set(nodo, { dx, dy })
          nodo.style.setProperty('--desvio-x', `${dx.toFixed(1)}px`)
          nodo.style.setProperty('--desvio-y', `${dy.toFixed(1)}px`)
        }
        // SI NO HAY SITIO LIMPIO, ESA CIFRA NO SE ENSEÑA.
        //
        // El reparto encuentra hueco para las cuatro en la mayoría de los ángulos, pero no
        // en todos: medido con `testigo/cifras-que-se-pisan.mjs`, en 2 de las 13 posiciones
        // de cámara el cuerpo y el tablón dejan una sola franja libre y cuatro carteles no
        // caben en una franja. Empujar más es empaquetar; y de todos modos una cifra
        // escrita sobre otra no es información, es tinta.
        //
        // Así que cuando una se queda sin sitio, se calla. **No se pierde nada**: el muro
        // de enfrente lleva las cuatro cifras grandes y permanentes, y su poste sigue
        // plantado para traerla de vuelta con un dedo. Es la misma idea que la retirada a
        // los 3,8 s, aplicada un poco antes.
        const suyo = sitios.get(clave)
        const sinSitio = suyo
          ? [...estorbos, ...[...sitios.entries()].filter(([k]) => k !== clave).map(([, r]) => r)].some(
              (otro) => chocan(suyo, otro),
            )
          : false
        const cifra = nodo.querySelector<HTMLElement>('.estacion-cifra')
        if (cifra) {
          if (sinSitio) cifra.dataset.sinSitio = ''
          else delete cifra.dataset.sinSitio
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
  /**
   * Los bloques del día, cuando lo que hay en el centro es cardio y no un ejercicio.
   *
   * Excluyentes por construcción: con ejercicio manda el ejercicio, como en el resto del
   * salón. Sin él, la prescripción que rodea al cuerpo es la del cardio.
   */
  bloques?: readonly ItemMarcable[]
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

/**
 * CUÁNTO DURA LA LECTURA, en milisegundos.
 *
 * Tres mil ochocientos: los mismos que tarda la cifra en entrar (0,4 s), quedarse quieta
 * (3 s) y volver a irse (0,4 s) por el otro lado. Se escribe aquí además de en el CSS
 * porque un `setTimeout` no lee una hoja de estilos, y porque la retirada tiene que ocurrir
 * también con movimiento reducido, donde no hay animación ninguna que la produzca: quien no
 * quiere movimiento tampoco quiere la prescripción tapándole la sala para siempre.
 */
const LECTURA_MS = 3800

export function EstacionesDelSujeto({
  ejercicio,
  bloques,
  azimut,
  suelo,
  cuerpo,
  marco,
  foco,
  onEnfocar,
}: EstacionesDelSujetoProps) {
  const estaciones = ejercicio ? estacionesDeLaSerie(ejercicio) : estacionesDelCardio(bloques)
  const zonaRef = useRef<HTMLDivElement>(null)
  useEsquivarElCuerpo(zonaRef, cuerpo, marco)

  // YA SE LEYÓ. El componente nace enseñando y a los 3,8 s se retira; quien decide que esto
  // es una estación NUEVA —porque cambió el ejercicio— lo monta con `key`, igual que el
  // tablón del muro, en vez de resetear el estado desde un efecto.
  const [leidas, setLeidas] = useState(false)
  useEffect(() => {
    const reloj = setTimeout(() => setLeidas(true), LECTURA_MS)
    return () => clearTimeout(reloj)
  }, [])

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
        const caja = cajaTocableDelPoste(e.angulo, azimut, RADIO)
        const enfocada = foco === e.clave
        return (
          <div
            key={e.clave}
            data-estacion={e.clave}
            data-enfocada={enfocada ? '' : undefined}
            className="absolute"
            style={{
              left: `calc(50% + ${a.x.toFixed(1)}px)`,
              // EL ALZA SUBE LA ESTACIÓN ENTERA —poste, base y cartel—, no solo el cartel.
              //
              // Hasta el 2026-09-11 solo movía el cartel, y el poste de la espalda se
              // quedaba plantado a la misma altura que el de delante. Mientras el botón fue
              // el cartel eso no se notaba; en cuanto el botón pasó a ser el poste se
              // convirtió en un fallo: los cuatro están en cruz, la cámara los alinea de
              // dos en dos cuatro veces por vuelta, y el de delante se comía el toque del
              // de atrás. Medido con `elementFromPoint` en el centro de cada poste: 6 de
              // las 13 posiciones de cámara con al menos uno inalcanzable.
              //
              // Subirlo entero es además la perspectiva correcta —lo que está más lejos se
              // dibuja más arriba—, y es lo que garantiza la separación que
              // `cajaTocableDelPoste` da por supuesta.
              top: `${(suelo - a.alza).toFixed(1)}px`,
              // Lo de delante, delante. Sin esto, la estación de la espalda se pinta
              // encima de la de enfrente cuando el azimut las cruza.
              zIndex: Math.round(500 + a.frente * 100),
            }}
          >
            {/* EL POSTE Y LA BASE: los dos objetos del suelo, y LO QUE SE TOCA.
                No contrarrestan nada —giran con la sala, que es lo que hace que se lean
                como plantados en ella—. El botón es esto y no el cartel desde el
                2026-09-11: la cifra se retira a los pocos segundos, así que un botón
                colgado de donde estuvo sería una zona sensible invisible en mitad de la
                sala. Lo que sigue ahí es el poste, y el poste es lo que se toca. */}
            <button
              type="button"
              data-poste={e.clave}
              onClick={() => onEnfocar(e.clave)}
              aria-label={`${e.rotulo}: ${e.cifra}`}
              aria-pressed={enfocada}
              className="estacion-poste pointer-events-auto absolute"
              style={{
                // ANCHO DE DEDO, Y ALTO EL PIE DEL POSTE —no el poste entero—.
                //
                // El poste dibujado son dos píxeles; el sitio donde se acierta con el
                // pulgar, no. Pero la zona no puede ser tan alta como el poste: dos
                // estaciones que la cámara alinea quedan separadas en vertical por el alza,
                // y esa separación tiene un mínimo que manda sobre el alto.
                //
                // LOS CUATRO NÚMEROS SALEN DE `cajaTocableDelPoste` Y NO SE ESCRIBEN AQUÍ,
                // porque es esa función la que barre una prueba para comprobar que dos
                // postes no comparten zona en ningún punto de la vuelta. Escritos a mano
                // aquí, la prueba estaría vigilando una cuenta que el salón no usa. Se
                // traducen a coordenadas de la estación, cuyo origen está en `a.x` y a la
                // altura del suelo ya subida por el alza.
                left: `${(caja.x0 - a.x).toFixed(1)}px`,
                bottom: `${(-(caja.y1 + a.alza)).toFixed(1)}px`,
                width: `${(caja.x1 - caja.x0).toFixed(1)}px`,
                height: `${(caja.y1 - caja.y0).toFixed(1)}px`,
                opacity: a.opacidad,
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[14px] left-1/2 w-[2px] -translate-x-1/2"
                style={{
                  height: `${POSTE}px`,
                  background: `linear-gradient(180deg, ${
                    enfocada ? 'var(--accion)' : 'rgb(var(--silver-300-rgb) / 0.55)'
                  }, transparent)`,
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[-26px] left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border"
                style={{
                  borderColor: enfocada
                    ? 'rgb(var(--accion-rgb) / 0.7)'
                    : 'rgb(var(--silver-300-rgb) / 0.3)',
                  background: enfocada
                    ? 'rgb(var(--accion-rgb) / 0.1)'
                    : 'rgb(var(--silver-300-rgb) / 0.04)',
                  transform: 'rotateX(90deg)',
                }}
              />
            </button>

            {/* EL CARTEL. Ya no es un botón: es lo que el poste enseña. La opacidad va AQUÍ
                y no en el contenedor de arriba: sobre un envoltorio con `preserve-3d`
                aplanaría el grupo y el cartel se quedaría de canto al orbitar. */}
            <div
              data-cartel={e.clave}
              className="estacion-cartel pointer-events-none absolute w-[132px] text-center"
              style={{
                left: '-66px',
                bottom: `${POSTE + 4}px`,
                opacity: foco && !enfocada ? a.opacidad * 0.45 : a.opacidad,
                // `--desvio-x` y `--desvio-y` los escribe el bucle de `useEsquivarElCuerpo`
                // directamente en el nodo: es lo que aparta el cartel del sujeto sin
                // repintar React. Van ANTES del `scale`, para que cuenten en píxeles de
                // pantalla y no en píxeles encogidos por la distancia.
                // El alza ya la trae la estación entera (arriba): repetirla aquí la subiría
                // dos veces y despegaría el cartel de su propio poste.
                transform: `translate(var(--desvio-x, 0px), var(--desvio-y, 0px)) scale(${a.escala.toFixed(3)})`,
                transformOrigin: '50% 100%',
              }}
            >
              <span
                className="estacion-cifra"
                data-anima
                data-fija={enfocada ? '' : undefined}
                data-retirada={leidas && !enfocada ? '' : undefined}
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
