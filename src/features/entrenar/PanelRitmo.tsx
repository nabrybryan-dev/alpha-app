import { useEffect, useState } from 'react'
import { useDbVersion } from '../../data/dbInstance'
import { calcularRitmo, formatoDuracion, type EstadoRitmo } from '../../domain/ritmoSesion'
import type { Sesion } from '../../domain/types'
import { leerTiempoCrono } from './CronometroSesion'

interface PanelRitmoProps {
  sesion: Sesion
  sesionId: string
}

const ESTADO_UI: Record<EstadoRitmo, { texto: string; clase: string }> = {
  acelerado: { texto: 'Vas acelerado · respira y cuida la técnica', clase: 'text-azul' },
  'en-ritmo': { texto: 'Vas en ritmo · así se hace', clase: 'text-verde' },
  lento: { texto: 'Se hace tarde · enfoca y acorta charlas', clase: 'text-ambar' },
}

const BLOQUE_UI: Record<string, string> = {
  FUERZA: 'Bloque de fuerza',
  ACCESORIO: 'Bloque accesorio',
  DINÁMICO: 'Bloque dinámico / control',
}

export function PanelRitmo({ sesion, sesionId }: PanelRitmoProps) {
  useDbVersion()
  const [realSeg, setRealSeg] = useState(() => leerTiempoCrono(sesionId))

  useEffect(() => {
    const id = window.setInterval(() => setRealSeg(leerTiempoCrono(sesionId)), 1000)
    return () => window.clearInterval(id)
  }, [sesionId])

  const ritmo = calcularRitmo(sesion, realSeg)
  if (ritmo.ejercicioActual === 0) return null // sesión completa: el panel ya no aporta

  const estado = ESTADO_UI[ritmo.estado]
  const bloque = ritmo.bloqueActual ? BLOQUE_UI[ritmo.bloqueActual] : 'Sesión'
  const tick = `${bloque}  ·  Ejercicio ${ritmo.ejercicioActual} de ${ritmo.totalEjercicios}  ·  ~${ritmo.restaEjercicioMin} min para el siguiente  ·  ${estado.texto}  ·  Respeta los descansos: son parte del estímulo  ·  `

  return (
    <div className="glass rounded-panel border border-hairline p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-tenue">Duración estimada</p>
          <p className="cifras font-display text-2xl leading-none text-texto">
            ≈ {formatoDuracion(ritmo.totalSeg)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-tenue">Ahora</p>
          {/* El nombre del bloque hace una entrada vertical cada vez que cambia */}
          <p key={ritmo.bloqueActual ?? 'x'} className="entrada truncate font-display text-base leading-tight text-rojo">
            {bloque}
          </p>
          <p className="truncate text-[11px] text-tenue">
            Ejercicio {ritmo.ejercicioActual}/{ritmo.totalEjercicios} · ~{ritmo.restaEjercicioMin} min
          </p>
        </div>
      </div>

      {/* Ticker desplazante: da esa sensación "viva" mientras el tiempo corre */}
      <div className="mt-2 overflow-hidden border-t border-hairline pt-2">
        <span className={`ticker-pista text-[11px] font-medium ${estado.clase}`}>
          {/* duplicado para que el bucle sea continuo (-50%) */}
          <span>{tick}</span>
          <span aria-hidden="true">{tick}</span>
        </span>
      </div>
    </div>
  )
}
