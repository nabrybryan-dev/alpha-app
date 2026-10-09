import { useEffect, useRef, useState } from 'react'

/**
 * ¿Está el elemento a la vista, y la pestaña visible? La escena WebGL solo pinta mientras sí:
 * una pestaña oculta o una sección fuera de pantalla no gasta ni un fotograma.
 * Sin `IntersectionObserver` (navegadores viejos) se asume que sí.
 */
export function useEnVista<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [enPantalla, setEnPantalla] = useState(true)
  const [pestanaVisible, setPestanaVisible] = useState(() => typeof document === 'undefined' || !document.hidden)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver((entradas) => {
      for (const e of entradas) setEnPantalla(e.isIntersecting)
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  useEffect(() => {
    const alCambiar = () => setPestanaVisible(!document.hidden)
    document.addEventListener('visibilitychange', alCambiar)
    return () => document.removeEventListener('visibilitychange', alCambiar)
  }, [])

  return { ref, enVista: enPantalla && pestanaVisible }
}

/**
 * `true` desde la primera vez que el elemento se acerca a la pantalla (con un margen de
 * 240 px). Sirve para no pedir el trozo de three.js ni crear el contexto WebGL hasta que se
 * va a ver. Sin `IntersectionObserver` vale `true` de inicio.
 */
export function useAlcanzada<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [alcanzada, setAlcanzada] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || alcanzada || typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setAlcanzada(true)
          observador.disconnect()
        }
      },
      { rootMargin: '240px' },
    )
    observador.observe(el)
    return () => observador.disconnect()
  }, [alcanzada])
  return { ref, alcanzada }
}
