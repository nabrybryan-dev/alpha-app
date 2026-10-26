import { useEffect, useRef } from 'react'
import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'

/**
 * LA SEMANA, DESPLEGADA DEBAJO DEL DÍA.
 *
 * Sustituye al tambor (Bryan, 25-oct: «que los días de la semana se desplieguen y se
 * conecten todos»). El tambor enseñaba tres días a la vez, escorzados, y dos de ellos
 * quedaban debajo de la ranura sin poder tocarse. Aquí están los siete a la vez, cada uno
 * con su sesión y su estado, y todos se tocan.
 *
 * Lo que se conserva del tambor: elegir un día NO empieza esa sesión, cambia qué sala se
 * ve; se abre en el día que está en pantalla; y se cierra al elegir, al tocar fuera o con
 * Escape. Sigue siendo el hueco `semana` y lleva `data-no-orbita`, para que el dedo que la
 * toca no gire la sala que hay detrás.
 */

export interface DesplegableDeLaSemanaProps {
  semana: readonly DiaRuta[]
  /** El día que está en pantalla ahora: se marca. */
  diaActual: number
  onElegir: (indice: number) => void
  onCerrar: () => void
}

/** El estado de un día en una palabra, mirado desde hoy. */
function estadoDelDia(dia: DiaRuta, hoyIso: string | undefined): string {
  if (dia.estado === 'completada') return 'Hecha'
  if (dia.estado === 'descanso') return 'Descanso'
  if (dia.esHoy) return 'Toca hoy'
  // Una programada de un día que ya pasó no está pendiente: se quedó sin hacer.
  if (hoyIso && dia.fechaIso < hoyIso) return 'Sin hacer'
  return 'Pendiente'
}

const COLOR_DEL_ESTADO: Record<string, string> = {
  Hecha: 'text-texto',
  'Toca hoy': 'text-accion',
  Pendiente: 'text-silver-300',
  'Sin hacer': 'text-tenue',
  Descanso: 'text-tenue',
}

export function DesplegableDeLaSemana({ semana, diaActual, onElegir, onCerrar }: DesplegableDeLaSemanaProps) {
  const actual = useRef<HTMLButtonElement>(null)
  const hoyIso = semana.find((d) => d.esHoy)?.fechaIso

  // El foco entra en el día que se ve, y Escape cierra: la lista es una capa, no otra
  // pantalla, y tiene que poder dejarse como se abrió.
  useEffect(() => {
    // Al cerrarse, el foco vuelve a quien la abrió (el botón del día), no se pierde en el body.
    const quienAbrio = document.activeElement as HTMLElement | null
    actual.current?.focus({ preventScroll: true })
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPulsar)
    return () => {
      document.removeEventListener('keydown', alPulsar)
      quienAbrio?.focus?.({ preventScroll: true })
    }
  }, [onCerrar])

  return (
    <div data-no-orbita data-hueco="semana" className="absolute inset-0">
      <div
        data-testid="fondo-de-la-semana"
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'rgb(var(--ink-1000-rgb) / 0.62)' }}
        onClick={onCerrar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tu semana"
        className="desplegar-semana absolute right-3 overflow-hidden rounded-[18px] border border-ink-500 bg-ink-800"
        style={{
          top: 'calc(46px + 2.6rem)',
          width: 'min(340px, calc(100% - 24px))',
          boxShadow: '0 18px 40px -12px rgb(0 0 0 / 0.7)',
        }}
      >
        <p className="px-4 pb-1.5 pt-3 text-xs text-tenue">Toca un día para ver su sesión</p>
        <ul className="divide-y divide-ink-500/60">
          {semana.map((d, i) => {
            const estado = estadoDelDia(d, hoyIso)
            const enPantalla = i === diaActual
            return (
              <li key={d.fechaIso}>
                <button
                  ref={enPantalla ? actual : undefined}
                  type="button"
                  aria-current={enPantalla ? 'true' : undefined}
                  aria-label={`${d.dia.toLowerCase()} ${d.numero}: ${d.titulo}, ${estado.toLowerCase()}${d.esHoy ? ', hoy' : ''}`}
                  onClick={() => onElegir(i)}
                  className="press flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accion"
                  style={{ background: enPantalla ? 'rgb(var(--accion-rgb) / 0.12)' : undefined }}
                >
                  <span className="flex w-[52px] shrink-0 flex-col leading-none">
                    <span className={`font-mono text-xs uppercase tracking-[0.12em] ${d.esHoy ? 'text-accion' : 'text-tenue'}`}>
                      {d.abreviatura}
                    </span>
                    <span className="cifras mt-1 text-[15px] font-bold text-texto">{d.numero}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate font-display text-[14px] font-black uppercase tracking-[0.02em] text-texto">
                      {d.titulo}
                    </span>
                    {d.esHoy && <span className="mt-0.5 text-[11px] text-accion">Hoy</span>}
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${COLOR_DEL_ESTADO[estado]}`}>{estado}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
