import { useEffect, useRef, useState } from 'react'

function formatear(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${dd(h)}:${dd(m)}:${dd(s)}`
}

/**
 * Cronómetro de sesión estilo Stitch: display digital gigante y centrado,
 * sin caja. Se pausa y reanuda tocando el propio display. Vive solo en la
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
    <div className="flex flex-col items-center py-1 text-center">
      <p className="kicker">Cronómetro de sesión</p>
      <button
        type="button"
        onClick={() => setCorriendo((v) => !v)}
        aria-label={corriendo ? 'Pausar cronómetro' : 'Reanudar cronómetro'}
        className={`press cifras mt-1 font-display text-6xl leading-none transition-opacity duration-200 ease-salida ${
          corriendo ? '' : 'opacity-50'
        }`}
        style={corriendo ? { textShadow: '0 0 24px rgba(255, 30, 30, 0.4)' } : undefined}
      >
        {formatear(segundos)}
      </button>
      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-tenue">
        {corriendo ? 'Toca para pausar' : 'En pausa · toca para seguir'}
      </p>
    </div>
  )
}
