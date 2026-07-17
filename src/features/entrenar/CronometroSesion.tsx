import { useEffect, useRef, useState } from 'react'

function formatear(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${dd(h)}:${dd(m)}:${dd(s)}`
}

/**
 * Cronómetro de sesión estilo "Pro Premium": display digital prominente
 * que arranca al entrar a la sesión y puede pausarse. Vive solo en la
 * página (se reinicia al salir); no persiste en la base de datos.
 */
export function CronometroSesion() {
  const [segundos, setSegundos] = useState(0)
  const [corriendo, setCorriendo] = useState(true)
  const intervalo = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    if (!corriendo) return
    intervalo.current = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(intervalo.current)
  }, [corriendo])

  return (
    <div className="rounded-panel glass glass-destacada flex items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="kicker">Cronómetro de sesión</p>
        <p
          className="cifras mt-1 font-display text-4xl leading-none text-texto"
          style={{ textShadow: '0 0 18px rgba(255, 30, 30, 0.35)' }}
          aria-live="off"
        >
          {formatear(segundos)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setCorriendo((v) => !v)}
        aria-label={corriendo ? 'Pausar cronómetro' : 'Reanudar cronómetro'}
        className="press glass grid h-11 w-11 shrink-0 place-items-center rounded-full text-texto"
      >
        {corriendo ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        )}
      </button>
    </div>
  )
}
