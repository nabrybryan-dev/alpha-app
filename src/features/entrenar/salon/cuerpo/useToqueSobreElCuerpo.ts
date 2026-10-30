import { useEffect, useRef, type RefObject } from 'react'
import type { IdDeRegion } from '../../sujeto/regiones'
import {
  esUnToque,
  partesDelAtlas,
  regionBajoElDedo,
  type CamaraParaElToque,
  type ParteDelCuerpo,
} from '../../sujeto/regionBajoElToque'

/**
 * UN TOQUE CORTO SOBRE EL CUERPO ELIGE LA REGIÓN BAJO EL DEDO (Bryan, 30-oct).
 *
 * Se escucha en el documento, en captura, y no en el visor ni en la raíz del salón: ambos
 * están congelados por el trinquete y, además, la raíz recibe los gestos de la cámara. Aquí
 * solo se MIRA: no se detiene ni se cancela nada, así que arrastrar sigue girando el sujeto
 * exactamente igual que antes.
 *
 * Un gesto cuenta como toque si:
 * - empieza y acaba con el mismo dedo, y no hubo un segundo dedo en medio (dos dedos son la
 *   cámara);
 * - se movió menos de `UMBRAL_DE_TOQUE_PX` y duró poco (`esUnToque`);
 * - nació sobre el lienzo y NO sobre un botón, un enlace, un campo o una capa con
 *   `data-no-orbita`: lo tocable manda, el cuerpo es lo que queda debajo.
 *
 * Todo el cálculo ocurre al soltar. Entre toques, esto no hace nada: ni por cuadro ni por
 * movimiento del dedo.
 */

const INTERACTIVO = 'button, a, input, select, textarea, label, summary, [role="button"], [role="dialog"], [data-no-orbita]'

/** El lienzo del salón: el `canvas` del ancestro más cercano que lo contiene. */
function lienzoDe(ancla: HTMLElement | null): { lienzo: HTMLCanvasElement; contenedor: HTMLElement } | null {
  for (let nodo: HTMLElement | null = ancla; nodo; nodo = nodo.parentElement) {
    const lienzo = nodo.querySelector('canvas')
    if (lienzo) return { lienzo, contenedor: nodo }
  }
  return null
}

export function useToqueSobreElCuerpo(
  ancla: RefObject<HTMLElement | null>,
  camara: CamaraParaElToque | undefined,
  activo: boolean,
  alTocar: (region: IdDeRegion) => void,
  /** Los músculos contra los que se lanza el rayo. Solo una prueba lo cambia. */
  obtenerPartes: () => readonly ParteDelCuerpo[] = partesDelAtlas,
): void {
  // Lo que cambia sin tener que volver a escuchar: la cámara (sesenta veces por segundo con
  // la animación) y el manejador.
  const vivo = useRef({ camara, alTocar, obtenerPartes })
  useEffect(() => {
    vivo.current = { camara, alTocar, obtenerPartes }
  })

  useEffect(() => {
    if (!activo) return
    let inicio: { id: number; x: number; y: number; t: number } | null = null
    const dedos = new Set<number>()

    const alBajar = (e: PointerEvent) => {
      dedos.add(e.pointerId)
      const destino = e.target instanceof Element ? e.target : null
      const sitio = lienzoDe(ancla.current)
      if (dedos.size > 1 || !destino || !sitio || !sitio.contenedor.contains(destino) || destino.closest(INTERACTIVO)) {
        inicio = null
        return
      }
      inicio = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }
    }

    const alSoltar = (e: PointerEvent) => {
      dedos.delete(e.pointerId)
      const g = inicio
      inicio = null
      const { camara: cam, alTocar: elegir, obtenerPartes: partes } = vivo.current
      if (!g || g.id !== e.pointerId || !cam) return
      if (!esUnToque(e.clientX - g.x, e.clientY - g.y, e.timeStamp - g.t)) return
      const sitio = lienzoDe(ancla.current)
      if (!sitio) return
      const r = sitio.lienzo.getBoundingClientRect()
      const region = regionBajoElDedo(cam, r, e.clientX, e.clientY, partes())
      // Fuera del cuerpo, o en un músculo sin región: no se inventa nada.
      if (region) elegir(region)
    }

    const alCancelar = (e: PointerEvent) => {
      dedos.delete(e.pointerId)
      inicio = null
    }

    document.addEventListener('pointerdown', alBajar, true)
    document.addEventListener('pointerup', alSoltar, true)
    document.addEventListener('pointercancel', alCancelar, true)
    return () => {
      document.removeEventListener('pointerdown', alBajar, true)
      document.removeEventListener('pointerup', alSoltar, true)
      document.removeEventListener('pointercancel', alCancelar, true)
    }
  }, [activo, ancla])
}
