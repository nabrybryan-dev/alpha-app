import { useEffect, useState } from 'react'
import { relojMmSs, segundosRestantes } from '../../domain/planOrganizador'
import { Barra } from './comun'

/**
 * Bloque con temporizador (25 o 50 min). El tiempo sale de la hora de inicio guardada, no de un
 * contador que se pueda congelar: una pestaña oculta retrasa el intervalo, no el reloj.
 */
export function Temporizador({ inicioMs, minutos }: { inicioMs: number; minutos: number }) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    const alVolver = () => setAhora(Date.now())
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])
  const restante = segundosRestantes(inicioMs, minutos, ahora)
  const total = minutos * 60
  const terminado = restante === 0
  return (
    <div className="flex flex-col gap-2" role="timer" aria-label={`Bloque de ${minutos} minutos`}>
      <p className={`cifras text-5xl font-bold ${terminado ? 'text-verde' : 'text-texto'}`} aria-live="off">
        {relojMmSs(restante)}
      </p>
      <Barra pct={Math.round(((total - restante) / total) * 100)} etiqueta="Avance del bloque" tono={terminado ? 'verde' : 'rojo'} />
      <p className="text-xs text-tenue">
        {terminado ? 'Bloque terminado: marca la tarea si ya está, o sigue un rato más.' : `Bloque de ${minutos} min. Solo esto, nada más.`}
      </p>
    </div>
  )
}
