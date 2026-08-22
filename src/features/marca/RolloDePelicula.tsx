import { useEffect, useRef, useState } from 'react'
import { FondoLoop } from '../../components/ui/FondoLoop'
import { DIRECCIONES } from '../../lib/direccionesVisuales'
import { useInclinacionAlPuntero } from '../../lib/inclinacionAlPuntero'

/**
 * Las cinco piezas como un rollo de película que pasa por una ventana.
 *
 * POR QUÉ ASÍ Y NO UNA REJILLA. En esta pantalla las piezas SON el contenido, no
 * decoración: el manual existe para enseñar cómo es la marca. Una rejilla de cinco
 * tarjetas iguales las pondría a competir entre sí y no dejaría mirar ninguna. Un
 * rollo obliga a lo contrario: hay una pieza en la ventana y las demás esperan
 * retraídas a los lados, como fotogramas que aún no han llegado al proyector.
 *
 * CÓMO SE SABE CUÁL ESTÁ EN LA VENTANA. Un `IntersectionObserver` con
 * `rootMargin: '-50% 0px -50% 0px'` reduce la raíz a una línea de un píxel en el
 * centro exacto de la pantalla. Solo intersecta el elemento que la cruza, así que
 * «la centrada» es una medida y no una estimación por scroll.
 *
 * R6 · SOLO SUENA UNA. El mismo observador que decide quién se agranda decide
 * quién reproduce: las otras cuatro quedan pausadas en su póster. Sin esto habría
 * cinco vídeos de 1280x720 descomprimiéndose a la vez en la misma pantalla.
 *
 * R5 · Con movimiento reducido `FondoLoop` no monta el vídeo, así que aquí no hay
 * nada que pausar: se ven los cinco pósters y la ventana sigue marcando cuál se
 * está mirando. Se pierde el bucle, no la composición.
 */
export function RolloDePelicula() {
  // La ficha coleccionable de Logros se inclina siguiendo el dedo; el fotograma
  // que está en la ventana hace lo mismo. Aquí gana algo concreto además de la
  // profundidad: al inclinarlo se ve que es una superficie con grosor dentro del
  // rollo, no una imagen pegada a la página.
  const { ref: ventana, alMover, alSalir } = useInclinacionAlPuntero<HTMLDivElement>({
    maxGrados: 7,
  })
  const [enVentana, setEnVentana] = useState(0)
  const items = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue
          const i = items.current.findIndex((n) => n === entrada.target)
          if (i >= 0) setEnVentana(i)
        }
      },
      // La raíz se estrecha a la línea central del viewport. Ver cabecera.
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    )
    for (const nodo of items.current) if (nodo) observador.observe(nodo)
    return () => observador.disconnect()
  }, [])

  // Play/pause va aparte del observador para que un re-render no lo desincronice.
  useEffect(() => {
    items.current.forEach((nodo, i) => {
      const video = nodo?.querySelector('video')
      if (!video) return
      if (i === enVentana) void video.play().catch(() => {})
      else video.pause()
    })
  }, [enVentana])

  return (
    <div className="mt-3 flex flex-col gap-5">
      {DIRECCIONES.map((d, i) => {
        const activa = i === enVentana
        return (
          <figure
            key={d.id}
            ref={(n) => {
              items.current[i] = n
            }}
            className="m-0"
            style={{
              // Las vecinas se retraen 22 px por lado y bajan a .52: siguen
              // presentes —se ve que el rollo continúa— pero no piden mirada.
              marginInline: activa ? 0 : 22,
              opacity: activa ? 1 : 0.52,
              transition: `margin var(--dur-panel) var(--ease-salida), opacity var(--dur-panel) var(--ease-salida)`,
            }}
          >
            <div className={activa ? '[perspective:900px]' : undefined}>
            <div
              ref={activa ? ventana : undefined}
              onPointerMove={activa ? alMover : undefined}
              onPointerLeave={activa ? alSalir : undefined}
              onPointerCancel={activa ? alSalir : undefined}
              className="relative aspect-video w-full overflow-hidden rounded-tarjeta bg-ink-900 [transform-style:preserve-3d]"
              style={{ transition: 'transform var(--dur-base) var(--ease-salida)' }}
            >
              <FondoLoop
                poster={d.poster}
                video={d.video}
                preload="none"
                prioridad="low"
                anchura={1280}
                altura={720}
                className={`absolute inset-0 h-full w-full object-cover ${d.encaje ?? ''}`}
              />
            </div>
            </div>

            {/* Ficha técnica al pie, en mono: aquí los datos son el contenido. */}
            <figcaption className="mt-2 flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="font-display text-[15px] text-texto">
                  <span className="cifras mr-1.5 text-rojo">{d.id}</span>
                  {d.nombre}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-tenue">{d.frase}</span>
              </span>
              <span className="cifras shrink-0 text-[11px] tabular-nums text-tenue">
                {d.duracionS.toFixed(1)} s
              </span>
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}
