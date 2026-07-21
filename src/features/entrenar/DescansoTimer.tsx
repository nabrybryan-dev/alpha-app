import { useEffect, useRef, useState } from 'react'

interface DescansoTimerProps {
  /** Momento (epoch ms) en que termina el descanso. */
  hasta: number
  /** Duración total del descanso en segundos (para la barra de progreso). */
  totalSeg: number
  onCerrar: () => void
}

const restanteSeg = (hasta: number) => Math.max(0, Math.ceil((hasta - Date.now()) / 1000))

function mmss(seg: number): string {
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Barra flotante de descanso entre series. Cuenta regresiva pautada por el
 * ejercicio; sobrevive a bloquear el celular (se recalcula del timestamp). Al
 * llegar a cero, un letrero "¡DALE!" entra deslizando de derecha a izquierda y
 * se va solo. El asesorado también puede saltar el descanso.
 */
export function DescansoTimer({ hasta, totalSeg, onCerrar }: DescansoTimerProps) {
  const [restante, setRestante] = useState(() => restanteSeg(hasta))
  const [enBanner, setEnBanner] = useState(restante <= 0)
  const [saliendo, setSaliendo] = useState(false)
  const cerrado = useRef(false)

  const cerrarUnaVez = () => {
    if (cerrado.current) return
    cerrado.current = true
    onCerrar()
  }

  const urgente = !enBanner && restante > 0 && restante <= 5

  // Cuenta regresiva: refresca cada segundo y también al volver de segundo plano.
  useEffect(() => {
    if (enBanner) return
    const tick = () => {
      const r = restanteSeg(hasta)
      setRestante(r)
      if (r <= 0) {
        setEnBanner(true)
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(120)
      }
    }
    const id = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [hasta, enBanner])

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
    <div className="fixed inset-x-0 bottom-[4.75rem] z-40 px-4" role="status" aria-live="polite">
      <div className="mx-auto max-w-lg">
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
          <div className="glass glass-blur flex items-center gap-3 overflow-hidden rounded-full border border-hairline py-2.5 pl-5 pr-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-tenue">Descanso</span>
            <span
              key={restante}
              className={`cifras font-display text-2xl leading-none ${urgente ? 'tic-urgente text-rojo' : 'text-texto'}`}
            >
              {mmss(restante)}
            </span>
            {/* barra de progreso: scaleX (compositor), se vacía con el tiempo */}
            <span className="relative mx-1 h-1 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
              <span
                className="absolute inset-0 origin-left rounded-full bg-rojo transition-transform duration-1000 ease-linear"
                style={{ transform: `scaleX(${progreso})` }}
              />
            </span>
            <button
              type="button"
              onClick={cerrarUnaVez}
              className="press shrink-0 rounded-full bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-wide text-texto"
            >
              Saltar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
