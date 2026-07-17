import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { cargaPorGrupo, type NivelFatiga } from '../../domain/fatiga'
import type { Microciclo } from '../../domain/types'

const COLOR: Record<NivelFatiga, string> = {
  fresco: 'var(--verde)',
  'en-trabajo': 'var(--ambar)',
  cargado: 'var(--rojo)',
}

const LEYENDA: { nivel: NivelFatiga; etiqueta: string }[] = [
  { nivel: 'fresco', etiqueta: 'Fresco' },
  { nivel: 'en-trabajo', etiqueta: 'En trabajo' },
  { nivel: 'cargado', etiqueta: 'Cargado' },
]

/**
 * Mapa de fatiga por grupo muscular (diseño Stitch "Dashboard Pro"): sitúa
 * cada grupo según el volumen ya ejecutado en el microciclo activo.
 */
export function MapaFatiga({ microciclo }: { microciclo: Microciclo }) {
  const carga = cargaPorGrupo(microciclo)
  const [dibujado, setDibujado] = useState(false)

  useEffect(() => {
    const marco = requestAnimationFrame(() => setDibujado(true))
    return () => cancelAnimationFrame(marco)
  }, [])

  if (carga.length === 0) return null

  return (
    <Card aria-label="Fatiga por grupo muscular">
      <div className="flex flex-col gap-3">
        {carga.map((c) => (
          <div key={c.grupo} className="flex items-center gap-3">
            <p className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-[0.15em] text-texto">
              {c.grupo}
            </p>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full"
                style={{
                  width: dibujado ? `${Math.max(c.pct, 3)}%` : '0%',
                  background: COLOR[c.nivel],
                  transition: 'width 800ms cubic-bezier(0.23, 1, 0.32, 1)',
                }}
              />
            </div>
            <p className="cifras w-9 shrink-0 text-right text-[10px] text-tenue">
              {c.seriesHechas}/{c.seriesPautadas}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-4">
        {LEYENDA.map((l) => (
          <p key={l.nivel} className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-tenue">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: COLOR[l.nivel] }}
            />
            {l.etiqueta}
          </p>
        ))}
      </div>
    </Card>
  )
}
