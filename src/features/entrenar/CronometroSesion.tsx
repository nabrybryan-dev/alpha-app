import { useEffect, useState } from 'react'
import { borrarClave, escribirJSON, leerJSON } from '../../lib/persistencia'

function formatear(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${dd(h)}:${dd(m)}:${dd(s)}`
}

/**
 * Estado del cronómetro guardado por sesión. Se persiste como marca de tiempo,
 * no como un contador: así el tiempo transcurrido se recalcula al volver aunque
 * la app estuviera en segundo plano (donde los timers se congelan) o cerrada.
 */
interface EstadoCrono {
  acumuladoSeg: number
  desdeEpoch: number | null // ms en que arrancó a correr; null si está en pausa
}

const claveCrono = (sesionId: string) => `alpha-crono-${sesionId}`

function totalSeg(e: EstadoCrono): number {
  const corriendo = e.desdeEpoch ? Math.floor((Date.now() - e.desdeEpoch) / 1000) : 0
  return e.acumuladoSeg + Math.max(0, corriendo)
}

/** Se llama al cerrar la sesión para que el cronómetro no reaparezca luego. */
export function limpiarCronometro(sesionId: string): void {
  borrarClave(claveCrono(sesionId))
}

/** Tiempo transcurrido actual del cronómetro (segundos), leído del almacenamiento. */
export function leerTiempoCrono(sesionId: string): number {
  const e = leerJSON<EstadoCrono>(claveCrono(sesionId), { acumuladoSeg: 0, desdeEpoch: null })
  return totalSeg(e)
}

/**
 * Cronómetro de sesión: display digital gigante, se pausa/reanuda tocándolo.
 * Persiste por sesión (sobrevive salir de la app o cerrarla sin guardar).
 */
export function CronometroSesion({ sesionId }: { sesionId: string }) {
  const clave = claveCrono(sesionId)
  const [estado, setEstado] = useState<EstadoCrono>(() =>
    leerJSON<EstadoCrono>(clave, { acumuladoSeg: 0, desdeEpoch: Date.now() }),
  )
  const [, refrescar] = useState(0)

  useEffect(() => {
    escribirJSON(clave, estado)
  }, [clave, estado])

  // Mientras corre, un tic de 1 s refresca el display (el valor real se recalcula
  // del timestamp). Al volver de segundo plano se refresca de inmediato.
  useEffect(() => {
    if (!estado.desdeEpoch) return
    const id = window.setInterval(() => refrescar((n) => n + 1), 1000)
    const alVolver = () => refrescar((n) => n + 1)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [estado.desdeEpoch])

  const corriendo = estado.desdeEpoch !== null
  const alternar = () =>
    setEstado((e) =>
      e.desdeEpoch
        ? { acumuladoSeg: totalSeg(e), desdeEpoch: null }
        : { acumuladoSeg: e.acumuladoSeg, desdeEpoch: Date.now() },
    )

  return (
    <div className="flex flex-col items-center py-1 text-center">
      <p className="kicker">Cronómetro de sesión</p>
      <button
        type="button"
        onClick={alternar}
        aria-label={corriendo ? 'Pausar cronómetro' : 'Reanudar cronómetro'}
        className={`press cifras mt-1 font-display text-6xl leading-none transition-opacity duration-200 ease-salida ${
          corriendo ? '' : 'opacity-50'
        }`}
        style={corriendo ? { textShadow: '0 0 24px rgba(255, 30, 30, 0.4)' } : undefined}
      >
        {formatear(totalSeg(estado))}
      </button>
      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-tenue">
        {corriendo ? 'Toca para pausar' : 'En pausa · toca para seguir'}
      </p>
    </div>
  )
}
