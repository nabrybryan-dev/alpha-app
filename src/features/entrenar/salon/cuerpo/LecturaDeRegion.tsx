import { useState } from 'react'
import { REGIONES, type IdDeRegion } from '../../sujeto/regiones'
import { cuentaDeRegion } from './cuentaDeRegion'
import type { SeriesPorRegion } from '../../sujeto/tinte'
import type { RangoDeLectura } from './PortadaDelCuerpo'

/**
 * TOCAR UNA REGIÓN PARA LEER SU CUENTA (maqueta 7: «un toque elige región y la lectura dice
 * su cuenta»). Solo MUESTRA lo que `seriesPorRegion` ya cuenta; no cambia cómo se cuentan.
 *
 * Cada región con series es un botón con nombre accesible propio. Tocarla dice, en una línea
 * `role="status"`, «Dorsal · 2 series hoy» (o «esta semana»); tocarla otra vez la suelta. La
 * elegida sigue al rango: al pasar de Hoy a Semana la cifra cambia sin tocar de nuevo.
 */
export function LecturaDeRegion({ series, rango }: { series: SeriesPorRegion; rango: RangoDeLectura }) {
  const [elegida, setElegida] = useState<IdDeRegion | null>(null)
  const conSeries = REGIONES.filter((r) => (series[r.id] ?? 0) > 0)
  return (
    <div className="pointer-events-none flex max-w-full flex-col items-center">
      {conSeries.length > 0 && (
        <div className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-1.5 pt-1">
          {conSeries.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-label={r.nombre}
              aria-pressed={elegida === r.id}
              onClick={() => setElegida((e) => (e === r.id ? null : r.id))}
              className="press tecla-2 !min-h-[32px] !px-2.5 !py-0.5 !text-[12px]"
              style={{
                color: elegida === r.id ? 'var(--texto)' : 'var(--tenue)',
                boxShadow: elegida === r.id ? 'inset 0 0 0 1.5px var(--texto)' : undefined,
              }}
            >
              {r.nombre}
            </button>
          ))}
        </div>
      )}
      <p role="status" className="min-h-[1.25rem] text-[13px]" style={{ color: 'var(--texto)', fontWeight: 800 }}>
        {elegida && conSeries.some((r) => r.id === elegida) ? cuentaDeRegion(elegida, series, rango) : ''}
      </p>
    </div>
  )
}
