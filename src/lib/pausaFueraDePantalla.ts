import { useEffect, useRef } from 'react'

/**
 * Pausa los vídeos de un contenedor cuando sale de la pantalla, y los reanuda al
 * volver.
 *
 * POR QUÉ EXISTE. Con las piezas cinemáticas repartidas por la app, una pantalla
 * puede llegar a tener varias a la vez —el manual de marca tiene cinco—. Un
 * `<video autoplay loop>` sigue decodificando aunque nadie lo vea: son fotogramas
 * de 1280x720 descomprimiéndose fuera de cuadro, y en un móvil de gama media eso
 * se nota en el scroll y en la batería. La regla del proyecto es explícita: un
 * solo vídeo reproduciéndose a la vez.
 *
 * NO TOCA `prefers-reduced-motion`. De eso ya se ocupa `FondoLoop`, que
 * directamente no monta el elemento de vídeo. Si no hay vídeo, esto no hace nada.
 *
 * El umbral es 0.25 y no 0: por debajo de un cuarto visible la pieza no se está
 * leyendo, se está asomando.
 */
export function usePausaFueraDePantalla<T extends HTMLElement>() {
  const contenedor = useRef<T>(null)

  useEffect(() => {
    const nodo = contenedor.current
    if (!nodo || typeof IntersectionObserver === 'undefined') return

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          // `Array.from` y no `for…of` directo sobre el NodeList: con el target
          // que compila este repo, `NodeListOf` no declara `[Symbol.iterator]`.
          for (const video of Array.from(entrada.target.querySelectorAll('video'))) {
            if (entrada.isIntersecting) {
              // `play()` devuelve una promesa que rechaza si el navegador lo
              // bloquea. Se ignora a propósito: el póster sigue ahí y no hay nada
              // que reportar a quien usa la app.
              void video.play().catch(() => {})
            } else {
              video.pause()
            }
          }
        }
      },
      { threshold: 0.25 },
    )

    observador.observe(nodo)
    return () => observador.disconnect()
  }, [])

  return contenedor
}
