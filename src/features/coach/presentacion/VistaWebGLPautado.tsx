import { lazy, Suspense, useState, type KeyboardEvent } from 'react'
import { semanaVecina } from '../../../domain/escena3d'
import type { MagnitudPautado, PautadoVsHechoMicrociclo } from '../../../domain/pautadoVsHecho'
import { ConmutadorMagnitud } from './ConmutadorMagnitud'
import { ALTURA_ESCENA_PAUTADO } from './escena3d/alturas'
import { useAlcanzada } from './escena3d/useEnVista'
import { LeyendaPautadoHecho } from './LeyendaPautadoHecho'

// El trozo con three.js, react-three-fiber y drei: solo se pide cuando la escena se acerca a la pantalla.
const Escena3DPautado = lazy(() => import('./escena3d/Escena3DPautado'))

interface Props {
  filas: readonly PautadoVsHechoMicrociclo[]
  magnitud: MagnitudPautado
  onMagnitud: (m: MagnitudPautado) => void
  seleccionadoId: string | undefined
  onSeleccionar: (id: string) => void
  /** WebGL se perdió o no arrancó: quien contiene cae al respaldo SVG. */
  onFallo: () => void
}

/** El hueco con el alto exacto del lienzo, para que la página no salte cuando la escena llega. */
export function HuecoDeEscena({ claseAltura, texto }: { claseAltura: string; texto: string }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center rounded-2xl border border-linea bg-bg text-xs text-tenue ${claseAltura}`}
    >
      {texto}
    </div>
  )
}

/**
 * LA ESCENA WEBGL, con sus mandos: Series/Volumen, ← → (de semana en semana, sin arrastrar),
 * Vista plana / Vista 3D y «Ver todo» cuando la cámara está acercada a una semana.
 * Todo lo que se pinta con three vive en `escena3d/` y se carga a demanda.
 */
export function VistaWebGLPautado({ filas, magnitud, onMagnitud, seleccionadoId, onSeleccionar, onFallo }: Props) {
  const [enfocado, setEnfocado] = useState(false)
  const [plana, setPlana] = useState(false)
  const { ref, alcanzada } = useAlcanzada<HTMLDivElement>()

  const ids = filas.map((f) => f.id)
  const pasar = (paso: -1 | 1) => {
    const id = semanaVecina(ids, seleccionadoId, paso)
    if (id === undefined) return
    onSeleccionar(id)
    setEnfocado(true)
  }
  const elegir = (id: string) => {
    onSeleccionar(id)
    setEnfocado(true)
  }
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      pasar(-1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      pasar(1)
    }
  }
  const i = seleccionadoId === undefined ? -1 : ids.indexOf(seleccionadoId)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ConmutadorMagnitud magnitud={magnitud} onCambiar={onMagnitud} />
        <div role="group" aria-label="Moverse por la escena" className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => pasar(-1)}
            disabled={i <= 0}
            className="h-11 w-11 rounded-boton border border-linea bg-surface-2 text-lg font-bold text-texto disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Semana siguiente"
            onClick={() => pasar(1)}
            disabled={i < 0 || i >= ids.length - 1}
            className="h-11 w-11 rounded-boton border border-linea bg-surface-2 text-lg font-bold text-texto disabled:opacity-40"
          >
            →
          </button>
          <button
            type="button"
            aria-pressed={plana}
            onClick={() => setPlana(!plana)}
            className="h-11 rounded-boton border border-linea bg-surface-2 px-3 text-sm font-bold text-texto"
          >
            {plana ? 'Vista en 3D' : 'Vista plana'}
          </button>
          {enfocado && !plana && (
            <button
              type="button"
              onClick={() => setEnfocado(false)}
              className="h-11 rounded-boton border border-linea bg-surface-2 px-3 text-sm font-bold text-texto"
            >
              Ver todo
            </button>
          )}
        </div>
      </div>

      <figure className="m-0">
        <div ref={ref}>
          {alcanzada ? (
            <Suspense fallback={<HuecoDeEscena claseAltura={ALTURA_ESCENA_PAUTADO} texto="Preparando la escena…" />}>
              <Escena3DPautado
                filas={filas}
                magnitud={magnitud}
                seleccionadoId={seleccionadoId}
                enfocado={enfocado}
                plana={plana}
                onSeleccionar={elegir}
                alPerderContexto={onFallo}
                alTeclear={alTeclear}
              />
            </Suspense>
          ) : (
            <HuecoDeEscena claseAltura={ALTURA_ESCENA_PAUTADO} texto="La escena se prepara al llegar aquí." />
          )}
        </div>
        <LeyendaPautadoHecho
          cinta
          pie={
            plana
              ? 'Vista plana: sin perspectiva, para leer exacto. El eje empieza en cero.'
              : 'Semana · cumplimiento. Arrastra de lado para girar; el eje empieza en cero.'
          }
        />
      </figure>
      <span className="sr-only" aria-live="polite">
        {plana ? 'Vista plana' : enfocado ? 'Cámara acercada a la semana elegida' : 'Vista general de la escena'}
      </span>
    </div>
  )
}
