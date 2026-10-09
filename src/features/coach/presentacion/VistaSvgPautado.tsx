import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { movimientoReducido } from '../../../components/ui/movimientoReducido'
import {
  ANCHO_MINIMO_CASILLA,
  GIRO_MAXIMO,
  VISTA_3D,
  VISTA_PLANA,
  esVistaPlana,
  limitarGiro,
  type VistaEscena,
} from '../../../domain/escenaGirable'
import type { MagnitudPautado, PautadoVsHechoMicrociclo } from '../../../domain/pautadoVsHecho'
import { ConmutadorMagnitud } from './ConmutadorMagnitud'
import { EscenaPautadoHecho } from './EscenaPautadoHecho'
import { LeyendaPautadoHecho } from './LeyendaPautadoHecho'

interface Props {
  filas: readonly PautadoVsHechoMicrociclo[]
  magnitud: MagnitudPautado
  onMagnitud: (m: MagnitudPautado) => void
  seleccionadoId: string | undefined
  onSeleccionar: (id: string) => void
}

/** Grados que gira cada toque de flecha. */
const PASO_FLECHA = 12
/** Grados de giro por píxel arrastrado. */
const GRADOS_POR_PX = 0.35
const MS_GIRO = 260

/** El ancho de un elemento en píxeles, vivo. Sin medida (pruebas, navegadores viejos) vale 640. */
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setAncho(Math.round(el.clientWidth))
    medir()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])
  return { ref, ancho: ancho > 0 ? ancho : 640 }
}

/**
 * LA ESCENA EN SVG: el respaldo de la escena WebGL (sin WebGL, con menos movimiento pedido o
 * si la 3D falla). Es la escena de siempre —proyección hecha a mano, giro con el dedo o dos
 * botones, vista plana— y por eso también es la que se prueba en jsdom.
 */
export function VistaSvgPautado({ filas, magnitud, onMagnitud, seleccionadoId, onSeleccionar }: Props) {
  const [vista, setVista] = useState<VistaEscena>(VISTA_3D)
  const vistaRef = useRef(vista)
  const marco = useRef(0)
  const { ref: contenedor, ancho } = useAncho<HTMLDivElement>()

  // Cuántos microciclos caben a la vez con sus números legibles; el resto se recorre con «Antes / Después».
  const caben = Math.max(4, Math.min(16, Math.floor((ancho - 72) / ANCHO_MINIMO_CASILLA)))
  const [fin, setFin] = useState<number | null>(null)
  const finReal = Math.min(filas.length, fin ?? filas.length)
  const inicio = Math.max(0, finReal - caben)
  const ventana = useMemo(() => filas.slice(inicio, finReal), [filas, inicio, finReal])

  useEffect(() => {
    vistaRef.current = vista
  }, [vista])
  useEffect(() => () => cancelAnimationFrame(marco.current), [])

  const fijar = useCallback((v: VistaEscena) => {
    vistaRef.current = v
    setVista(v)
  }, [])

  /** Lleva la escena a otra vista con un movimiento corto; con movimiento reducido, de golpe. */
  const irA = useCallback(
    (destino: VistaEscena) => {
      cancelAnimationFrame(marco.current)
      if (movimientoReducido()) {
        fijar(destino)
        return
      }
      const desde = vistaRef.current
      const t0 = performance.now()
      const paso = (ahora: number) => {
        const t = Math.min(1, Math.max(0, (ahora - t0) / MS_GIRO))
        const suave = 1 - Math.pow(1 - t, 3)
        fijar({
          giro: desde.giro + (destino.giro - desde.giro) * suave,
          inclinacion: desde.inclinacion + (destino.inclinacion - desde.inclinacion) * suave,
        })
        if (t < 1) marco.current = requestAnimationFrame(paso)
      }
      marco.current = requestAnimationFrame(paso)
    },
    [fijar],
  )

  const girar = (grados: number) => {
    const actual = vistaRef.current
    irA({ giro: limitarGiro(actual.giro + grados), inclinacion: actual.inclinacion || VISTA_3D.inclinacion })
  }

  const alArrastrar = (inicioVista: VistaEscena, dx: number, terminado: boolean, velocidad: number) => {
    // Arrastrar a la derecha acerca el lado izquierdo: el giro baja.
    const base = inicioVista.giro
    const inclinacion = inicioVista.inclinacion || VISTA_3D.inclinacion
    if (!terminado) {
      cancelAnimationFrame(marco.current)
      fijar({ giro: limitarGiro(base - dx * GRADOS_POR_PX), inclinacion })
      return
    }
    // Inercia corta: lo que el dedo llevaba de velocidad sigue un poco y frena (nunca con movimiento reducido).
    const actual = vistaRef.current
    if (movimientoReducido() || Math.abs(velocidad) < 0.2) return
    irA({ giro: limitarGiro(actual.giro - velocidad * 120 * GRADOS_POR_PX), inclinacion: actual.inclinacion })
  }

  const plana = esVistaPlana(vista)
  const alternarPlana = () => irA(plana ? VISTA_3D : VISTA_PLANA)

  const hayAnteriores = inicio > 0
  const hayPosteriores = finReal < filas.length

  return (
    <div ref={contenedor} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ConmutadorMagnitud magnitud={magnitud} onCambiar={onMagnitud} />

        <div role="group" aria-label="Girar la escena" className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Girar la escena a la izquierda"
            onClick={() => girar(PASO_FLECHA)}
            disabled={vista.giro >= GIRO_MAXIMO}
            className="h-11 w-11 rounded-boton border border-linea bg-surface-2 text-lg font-bold text-texto disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Girar la escena a la derecha"
            onClick={() => girar(-PASO_FLECHA)}
            disabled={vista.giro <= -GIRO_MAXIMO}
            className="h-11 w-11 rounded-boton border border-linea bg-surface-2 text-lg font-bold text-texto disabled:opacity-40"
          >
            →
          </button>
          <button
            type="button"
            onClick={alternarPlana}
            className="h-11 rounded-boton border border-linea bg-surface-2 px-3 text-sm font-bold text-texto"
          >
            {plana ? 'Vista en 3D' : 'Vista plana'}
          </button>
        </div>
      </div>

      <figure className="m-0">
        <EscenaPautadoHecho
          filas={ventana}
          magnitud={magnitud}
          vista={vista}
          ancho={ancho}
          seleccionado={seleccionadoId}
          onSeleccionar={onSeleccionar}
          onArrastre={alArrastrar}
          vistaActual={() => vistaRef.current}
        />
        <LeyendaPautadoHecho pie="Semana · cumplimiento. Arrastra para girar; el eje empieza en cero." />
      </figure>

      {(hayAnteriores || hayPosteriores) && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!hayAnteriores}
            onClick={() => setFin(Math.max(caben, finReal - caben))}
            className="h-11 rounded-boton border border-linea px-4 text-sm font-bold text-texto disabled:opacity-40"
          >
            ‹ Semanas anteriores
          </button>
          <span className="text-xs text-tenue">
            Semanas {ventana[0]?.numero}–{ventana.at(-1)?.numero}
          </span>
          <button
            type="button"
            disabled={!hayPosteriores}
            onClick={() => setFin(Math.min(filas.length, finReal + caben))}
            className="h-11 rounded-boton border border-linea px-4 text-sm font-bold text-texto disabled:opacity-40"
          >
            Siguientes ›
          </button>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {plana ? 'Vista plana' : `Escena girada ${Math.round(vista.giro)} grados`}
      </span>
    </div>
  )
}
