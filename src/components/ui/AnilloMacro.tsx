import { useEffect, useState } from 'react'
import { useContadorAnimado } from './useContadorAnimado'

interface AnilloMacroProps {
  etiqueta: string
  gramos: number
  /** Porcentaje 0-100 que se dibuja en el anillo (p. ej. % de kcal del día). */
  pct: number
  /** Variable CSS de color, p. ej. 'var(--rojo)'. */
  color: string
}

const RADIO = 26
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

/**
 * Anillo de macro estilo "Nutrición Pro": progreso circular SVG que se
 * dibuja al montar, con gramos al centro y etiqueta en mayúsculas debajo.
 */
export function AnilloMacro({ etiqueta, gramos, pct, color }: AnilloMacroProps) {
  const seguro = Math.max(0, Math.min(100, pct))
  const pctAnimado = useContadorAnimado(seguro)
  const gramosAnimados = useContadorAnimado(gramos)
  const [dibujado, setDibujado] = useState(false)

  useEffect(() => {
    const marco = requestAnimationFrame(() => setDibujado(true))
    return () => cancelAnimationFrame(marco)
  }, [])

  const offset = dibujado ? CIRCUNFERENCIA * (1 - seguro / 100) : CIRCUNFERENCIA

  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <div className="relative">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <circle
            cx="36"
            cy="36"
            r={RADIO}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth="5"
          />
          <circle
            cx="36"
            cy="36"
            r={RADIO}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={offset}
            transform="rotate(-90 36 36)"
            style={{
              transition: 'stroke-dashoffset 900ms cubic-bezier(0.23, 1, 0.32, 1)',
              filter: `drop-shadow(0 0 4px color-mix(in srgb, ${color} 55%, transparent))`,
            }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <p className="cifras text-center font-display text-sm leading-none text-texto">
            {Math.round(gramosAnimados)}
            <span className="block text-[9px] font-normal normal-case text-tenue">g</span>
          </p>
        </div>
      </div>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-tenue">{etiqueta}</p>
      <p className="cifras text-[10px] font-bold" style={{ color }}>
        {Math.round(pctAnimado)}%
      </p>
    </div>
  )
}
