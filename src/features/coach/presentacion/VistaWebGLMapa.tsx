import { lazy, Suspense, type KeyboardEvent, type ReactNode } from 'react'
import { semanaVecina } from '../../../domain/escena3d'
import type { CasillaMapa } from '../../../domain/presentacionAsesorado'
import { ALTURA_ESCENA_PLAN } from './escena3d/alturas'
import { useAlcanzada } from './escena3d/useEnVista'
import { HuecoDeEscena } from './VistaWebGLPautado'

// El trozo con three.js: solo se pide cuando el mapa se acerca a la pantalla.
const Escena3DPlan = lazy(() => import('./escena3d/Escena3DPlan'))

interface Props {
  casillas: readonly CasillaMapa[]
  abierta: number | null
  /** Tocar una semana la abre; volver a tocarla la cierra (lo decide quien contiene). */
  onElegir: (numero: number) => void
  onFallo: () => void
  /** La misma rejilla de casillas de siempre: se ofrece plegada, como lista para quien no usa la escena. */
  rejilla: ReactNode
}

/** El recorrido 3D del plan, con ← → para pasar de semana sin arrastrar y la lista de casillas plegada debajo. */
export function VistaWebGLMapa({ casillas, abierta, onElegir, onFallo, rejilla }: Props) {
  const { ref, alcanzada } = useAlcanzada<HTMLDivElement>()
  const ids = casillas.map((c) => String(c.numero))
  const base = abierta ?? casillas.find((c) => c.situacion === 'actual')?.numero
  const i = base === undefined ? -1 : ids.indexOf(String(base))

  const pasar = (paso: -1 | 1) => {
    const id = semanaVecina(ids, base === undefined ? undefined : String(base), paso)
    if (id !== undefined) onElegir(Number(id))
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-tenue">Toca una parada o usa las flechas. Arrastra de lado para girar.</p>
        <div role="group" aria-label="Moverse por el camino" className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Semana anterior del plan"
            onClick={() => pasar(-1)}
            disabled={i <= 0 && abierta !== null}
            className="h-11 w-11 rounded-boton border border-linea bg-surface-2 text-lg font-bold text-texto disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Semana siguiente del plan"
            onClick={() => pasar(1)}
            disabled={i >= ids.length - 1}
            className="h-11 w-11 rounded-boton border border-linea bg-surface-2 text-lg font-bold text-texto disabled:opacity-40"
          >
            →
          </button>
          {abierta !== null && (
            <button
              type="button"
              onClick={() => onElegir(abierta)}
              className="h-11 rounded-boton border border-linea bg-surface-2 px-3 text-sm font-bold text-texto"
            >
              Ver todo el camino
            </button>
          )}
        </div>
      </div>

      <div ref={ref}>
        {alcanzada ? (
          <Suspense fallback={<HuecoDeEscena claseAltura={ALTURA_ESCENA_PLAN} texto="Preparando el camino…" />}>
            <Escena3DPlan casillas={casillas} abierta={abierta} onElegir={onElegir} alPerderContexto={onFallo} alTeclear={alTeclear} />
          </Suspense>
        ) : (
          <HuecoDeEscena claseAltura={ALTURA_ESCENA_PLAN} texto="El camino se prepara al llegar aquí." />
        )}
      </div>

      <details className="rounded-2xl border border-linea">
        <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-bold text-texto">
          Ver las semanas como lista
        </summary>
        <div className="px-3 pb-3 pt-1">{rejilla}</div>
      </details>
    </div>
  )
}
