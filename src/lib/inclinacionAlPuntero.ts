import { useRef, type PointerEvent as PointerEventoReact } from 'react'
import { useMovimientoReducido } from '../components/ui/movimientoReducido'

/** Inclinación máxima en grados a cada lado. La de la ficha coleccionable. */
const MAX_GRADOS = 12

interface Opciones {
  maxGrados?: number
  /**
   * Posición normalizada del puntero dentro del elemento, de 0 a 1. La usa la
   * ficha coleccionable para desplazar su brillo holográfico en sentido
   * contrario, como un foil real.
   */
  alMoverse?: (px: number, py: number) => void
}

/**
 * Inclina un elemento en 3D siguiendo al dedo o al cursor.
 *
 * ES EL VOCABULARIO QUE YA TENÍA LA APP, no uno nuevo. Nació dentro de
 * `FichaPanini` —la ficha coleccionable de Logros, con su `perspective: 900px` y
 * su `rotateX/rotateY`— y estaba escrito allí y en ningún sitio más. Al llegar
 * las piezas cinemáticas hacía falta la misma profundidad en otras dos
 * superficies, y copiarlo habría creado un segundo lenguaje que se parece al
 * primero sin serlo. Así que se extrae aquí y lo consumen los tres.
 *
 * Quien lo use pone la `perspective` en el PADRE y `transform-style: preserve-3d`
 * en el elemento inclinado — igual que hace la ficha. Este hook solo escribe el
 * `transform`.
 *
 * Con movimiento reducido no inclina. No es una degradación a medias: el
 * elemento se queda plano y todo lo demás sigue igual.
 */
export function useInclinacionAlPuntero<T extends HTMLElement>({
  maxGrados = MAX_GRADOS,
  alMoverse,
}: Opciones = {}) {
  const ref = useRef<T>(null)
  const movimientoReducido = useMovimientoReducido()

  const alMover = (e: PointerEventoReact<HTMLElement>) => {
    const el = ref.current
    if (!el || movimientoReducido) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.transform = `rotateX(${(-(py - 0.5) * 2 * maxGrados).toFixed(2)}deg) rotateY(${((px - 0.5) * 2 * maxGrados).toFixed(2)}deg)`
    alMoverse?.(px, py)
  }

  const alSalir = () => {
    if (ref.current) ref.current.style.transform = 'rotateX(0deg) rotateY(0deg)'
  }

  return { ref, alMover, alSalir, movimientoReducido }
}
