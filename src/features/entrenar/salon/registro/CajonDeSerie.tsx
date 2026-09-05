import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { EjercicioPrescrito, SerieRegistrada } from '../../../../domain/types'
import { RegistroSerieSalon } from './RegistroSerieSalon'

/**
 * EL CAJÓN DE LA SERIE: la ficha se ARRASTRA desde el borde izquierdo.
 *
 * ## Por qué un cajón y no un desplegable
 *
 * Los mandos vivían dentro del mando de la pared: se tocaba y crecía hacia abajo. Eso
 * tiene dos costes que solo se ven en el salón. El primero es de sitio —el cuadro está
 * colgado a 1,62 m y crecer lo empuja contra el marcador de siete segmentos—. El segundo
 * es de significado: un panel que brota de un cuadro de pared es una pared que se
 * convierte en formulario, y este salón lleva desde el 2026-09-03 saliendo de eso.
 *
 * Un cajón entra desde FUERA del cuadro. No deforma nada de la sala: la tapa mientras se
 * usa y se va. Y entra por el mismo sitio por el que se saca una ficha de un archivador,
 * que es de donde viene el gesto.
 *
 * ## El gesto es hermano del panel de abajo, a propósito
 *
 * La lectura larga sube desde abajo; la ficha entra desde la izquierda. Los dos son el
 * mismo verbo —tirar de un borde— en dos ejes, así que descubrir uno enseña el otro. Y
 * ninguno compite con los dos que ya estaban cogidos: el horizontal sobre el sujeto orbita
 * y el vertical sobre el sujeto es el eje W. Por eso el asidero es una franja de 24 px
 * pegada al borde y no la pantalla entera: dentro de esa franja el arrastre es del cajón,
 * fuera sigue siendo de la cámara.
 *
 * ## Sigue al dedo, y por qué eso importa
 *
 * Mientras se arrastra no hay transición: el panel está donde está el dedo, con el
 * recorrido acotado. Al soltar decide —abierto si pasó de un tercio— y ahí sí con
 * transición. Un cajón que espera a que sueltes para moverse no se lee como un cajón: se
 * lee como un botón que tarda.
 *
 * ## El fondo llega al borde del CONTENIDO, no a un porcentaje
 *
 * El degradado es opaco hasta los 232 px —el ancho de la caja de contenido— y se desvanece
 * en los 56 px siguientes. Escrito en porcentaje, la parada caía dentro del contenido y
 * los mandos de la derecha quedaban flotando sobre la escena sin respaldo. La franja de
 * desvanecido va FUERA del contenido, que es lo que hace que el cajón tenga canto de papel
 * en vez de un corte recto.
 */

/** Cuántos píxeles de arrastre son el cajón entero. */
const RECORRIDO = 200

/** A partir de qué fracción el cajón se queda abierto al soltar. */
const UMBRAL = 0.35

/** Ancho de la caja de contenido, en píxeles. Es donde tiene que llegar el fondo opaco. */
const CONTENIDO = 232

/** Lo que mide el desvanecido a la derecha del contenido. */
const DESVANECIDO = 56

export interface CajonDeSerieProps {
  microcicloId: string
  ejercicio: EjercicioPrescrito
  abierto: boolean
  onAbrir: () => void
  onCerrar: () => void
  /** Se llama DESPUÉS de escribir la serie, con la que se acaba de guardar. */
  onGuardado?: (serie: SerieRegistrada) => void
}

export function CajonDeSerie({
  microcicloId,
  ejercicio,
  abierto,
  onAbrir,
  onCerrar,
  onGuardado,
}: CajonDeSerieProps) {
  const panel = useRef<HTMLDivElement>(null)
  const gesto = useRef<{ x: number; p: number } | null>(null)
  const [arrastrando, setArrastrando] = useState(false)

  const orden = ejercicio.series.length + 1

  /**
   * PINTAR EL CAJÓN ESCRIBIENDO EN EL NODO, no por estado.
   *
   * Un `setState` por cada `pointermove` re-renderiza el salón entero —sujeto incluido—
   * sesenta veces por segundo mientras el dedo se mueve. El sitio del cajón no es
   * información que nadie más necesite: es dónde está el dedo.
   */
  const pintar = (p: number, suave: boolean) => {
    const nodo = panel.current
    if (!nodo) return
    nodo.style.transition = suave
      ? 'transform var(--dur-transicional) var(--muelle-transicional)'
      : 'none'
    nodo.style.visibility = p > 0.001 ? 'visible' : 'hidden'
    nodo.style.transform = `translateX(${((p - 1) * 100).toFixed(2)}%)`
  }

  // El estado manda sobre el nodo cuando cambia desde fuera —al guardar, al cambiar de
  // ejercicio—. Sin esto, el cajón se quedaría donde lo dejó el último arrastre.
  useEffect(() => {
    pintar(abierto ? 1 : 0, true)
  }, [abierto])

  const alBajarDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    gesto.current = { x: e.clientX, p: abierto ? 1 : 0 }
    setArrastrando(true)
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const alMoverDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesto.current
    if (!g) return
    e.stopPropagation()
    g.p = Math.max(0, Math.min(1, (e.clientX - g.x) / RECORRIDO + (abierto ? 1 : 0)))
    pintar(g.p, false)
  }

  const alSoltarDedo = () => {
    const g = gesto.current
    if (!g) return
    gesto.current = null
    setArrastrando(false)
    const queda = g.p > UMBRAL
    pintar(queda ? 1 : 0, true)
    if (queda && !abierto) onAbrir()
    if (!queda && abierto) onCerrar()
  }

  return (
    <>
      {/* EL ASIDERO. Tres píxeles de tirador dentro de una franja de 24: el tirador dice
          dónde agarrar y la franja es lo que de verdad responde. Se calcula, no se dibuja
          — que es la misma regla del mando de la cámara. */}
      <div
        data-asidero="ficha"
        role="button"
        tabIndex={0}
        aria-label="Abrir la ficha de la serie"
        aria-expanded={abierto}
        onPointerDown={alBajarDedo}
        onPointerMove={alMoverDedo}
        onPointerUp={alSoltarDedo}
        onPointerCancel={alSoltarDedo}
        // Con teclado no hay dedo que arrastrar, así que aquí el gesto es un toque.
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          if (abierto) onCerrar()
          else onAbrir()
        }}
        className="pointer-events-auto absolute bottom-40 left-0 top-32 flex w-6 items-center justify-start"
        style={{ zIndex: 'var(--z-elevado)', touchAction: 'none', cursor: 'e-resize' }}
      >
        <span
          aria-hidden="true"
          className="ml-[5px] h-[74px] w-[3px] rounded-full"
          style={{
            background:
              'linear-gradient(180deg, transparent, rgb(var(--silver-300-rgb) / 0.45), transparent)',
          }}
        />
      </div>

      <div
        ref={panel}
        data-hueco="ficha"
        data-cajon="serie"
        data-arrastrando={arrastrando ? '' : undefined}
        className="pointer-events-auto absolute bottom-0 left-0 top-0 flex flex-col justify-center gap-3.5 py-12 pl-[18px] pr-14"
        style={{
          zIndex: 'var(--z-elevado)',
          width: `${CONTENIDO + DESVANECIDO}px`,
          // El opaco llega al BORDE DEL CONTENIDO. En porcentaje, la parada caía dentro y
          // los mandos de la derecha flotaban sobre la escena sin respaldo detrás.
          background: `linear-gradient(90deg, rgb(var(--ink-1000-rgb) / 0.97) ${CONTENIDO}px, transparent ${CONTENIDO + DESVANECIDO}px)`,
          transform: 'translateX(-100%)',
          visibility: 'hidden',
        }}
      >
        {/* SOLO EL NOMBRE. «Serie N de M» lo dice `RegistroSerieSalon` justo debajo, con
            su etiqueta de serie cuando la hay: escribirlo también aquí era la misma frase
            dos veces en 232 px de ancho — el mismo fallo que se acababa de quitar del
            muro, reaparecido dentro del cajón. */}
        <p className="font-display text-[19px] font-black uppercase leading-tight text-texto">
          {ejercicio.nombre}
        </p>

        {/* LA FICHA ES LA QUE YA EXISTE. No se reescriben los mandos ni los topes: sus
            once pruebas —carga 0-999, reps 1-50, RIR 0-5, el borrador que sobrevive a un
            guardado caído— siguen vigilando lo mismo. Lo que cambia es de dónde sale. */}
        <RegistroSerieSalon
          key={`${ejercicio.id}-${orden}`}
          microcicloId={microcicloId}
          ejercicio={ejercicio}
          onGuardado={onGuardado}
        />

        <button
          type="button"
          onClick={onCerrar}
          className="press min-h-[44px] rounded-boton border border-ink-500 font-mono text-[11px] uppercase tracking-[0.16em] text-gris-marca"
        >
          Cerrar
        </button>
      </div>
    </>
  )
}
