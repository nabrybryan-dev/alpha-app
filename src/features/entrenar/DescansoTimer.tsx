import { useEffect, useRef, useState } from 'react'

interface DescansoTimerProps {
  /** Momento (epoch ms) en que termina el descanso. */
  hasta: number
  /** Duración total del descanso en segundos (para la barra de progreso). */
  totalSeg: number
  onCerrar: () => void
  /** Añade 15 s al descanso en curso. */
  onMas15: () => void
}

/** Segundos restantes contra el timestamp `hasta`, corregidos por el desfase
 *  acumulado durante las pausas (mientras se pausa, el reloj de pared sigue,
 *  así que al reanudar se descuenta ese tiempo del objetivo). */
const restanteSeg = (hasta: number, desfaseMs = 0) =>
  Math.max(0, Math.ceil((hasta + desfaseMs - Date.now()) / 1000))

function mmss(seg: number): string {
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Barra flotante de descanso entre series. Cuenta regresiva pautada por el
 * ejercicio; sobrevive a bloquear el celular (se recalcula del timestamp). Se
 * puede pausar/reanudar (el tiempo en pausa no cuenta) y añadir +15 s. Al llegar
 * a cero, un letrero "¡DALE!" entra deslizando de derecha a izquierda y se va
 * solo. El asesorado también puede saltar el descanso.
 */
export function DescansoTimer({ hasta, totalSeg, onCerrar, onMas15 }: DescansoTimerProps) {
  const [restante, setRestante] = useState(() => restanteSeg(hasta))
  const [enBanner, setEnBanner] = useState(restante <= 0)
  const [saliendo, setSaliendo] = useState(false)
  const [pausado, setPausado] = useState(false)
  const cerrado = useRef(false)
  // Tiempo total acumulado en pausa (ms), y el instante en que empezó la pausa
  // actual. Se usan para compensar el objetivo `hasta` al reanudar.
  const desfaseMs = useRef(0)
  const pausaInicio = useRef(0)

  const cerrarUnaVez = () => {
    if (cerrado.current) return
    cerrado.current = true
    onCerrar()
  }

  const alternarPausa = () => {
    setPausado((p) => {
      if (p) desfaseMs.current += Date.now() - pausaInicio.current // reanuda: suma lo pausado
      else pausaInicio.current = Date.now() // pausa: congela el instante
      return !p
    })
  }

  const urgente = !enBanner && !pausado && restante > 0 && restante <= 5

  // Cuenta regresiva: refresca cada segundo y también al volver de segundo
  // plano. En pausa no corre (el desfase acumulado congela el restante).
  useEffect(() => {
    if (enBanner || pausado) return
    const tick = () => {
      const r = restanteSeg(hasta, desfaseMs.current)
      setRestante(r)
      if (r <= 0) {
        setEnBanner(true)
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(120)
      }
    }
    tick() // sincroniza de inmediato (p. ej. al reanudar)
    const id = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [hasta, enBanner, pausado])

  // El letrero "¡DALE!" se muestra ~2.4 s, sale limpio (240 ms) y se cierra.
  useEffect(() => {
    if (!enBanner) return
    const salida = window.setTimeout(() => setSaliendo(true), 2400)
    const fin = window.setTimeout(cerrarUnaVez, 2640)
    return () => {
      window.clearTimeout(salida)
      window.clearTimeout(fin)
    }
  }, [enBanner])

  const progreso = totalSeg > 0 ? Math.min(1, Math.max(0, restante / totalSeg)) : 0

  return (
    <div role="status" aria-live="polite">
      <div>
        {enBanner ? (
          <button
            type="button"
            onClick={cerrarUnaVez}
            className={`press flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-rojo py-4 shadow-xl ${
              saliendo ? 'letrero-sale' : 'letrero-dale'
            }`}
          >
            <span className="latido font-display text-2xl tracking-wide text-white">¡DALE, VAMOS! 🔥</span>
          </button>
        ) : (
          <div className="glass-blur rounded-bloque border border-ink-500 bg-ink-700/95 px-4 py-3 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-silver-500">
                  Descanso{pausado ? ' · en pausa' : ''}
                </div>
                <div
                  key={restante}
                  className={`cifras text-[34px] font-bold leading-none transition-opacity ${
                    urgente ? 'tic-urgente text-accion' : 'text-accion'
                  } ${pausado ? 'opacity-60' : ''}`}
                >
                  {mmss(restante)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={onMas15}
                  className="press cifras rounded-boton border border-ink-400 bg-ink-600 px-3 py-2.5 text-sm font-bold text-silver-200"
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={alternarPausa}
                  aria-label={pausado ? 'Reanudar descanso' : 'Pausar descanso'}
                  aria-pressed={pausado}
                  className="press grid place-items-center rounded-boton border border-ink-400 bg-ink-600 px-3.5 py-2.5 text-silver-200"
                >
                  {pausado ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path d="M8 5l11 7-11 7z" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M9 5v14M15 5v14" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={cerrarUnaVez}
                  className="press rounded-boton bg-ink-600 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wide text-silver-300"
                >
                  Saltar
                </button>
              </div>
            </div>
            {/* barra de progreso: scaleX (compositor), se vacía con el tiempo */}
            <span className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-ink-500" aria-hidden="true">
              <span
                className="absolute inset-0 origin-left rounded-full bg-accion transition-transform duration-1000 ease-linear"
                style={{ transform: `scaleX(${progreso})` }}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
