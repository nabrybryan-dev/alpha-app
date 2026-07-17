import { Card } from '../../components/ui/Card'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'

const VASO_ML = 250

function ultimoPeso(usuarioId: string): number | undefined {
  const medidas = db.perfiles.byUsuario(usuarioId)?.medidas ?? []
  const ordenadas = [...medidas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  return ordenadas[ordenadas.length - 1]?.pesoKg
}

function litros(ml: number): string {
  return (ml / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

/**
 * Registro de agua del día (diseño Stitch "Nutrición Pro"). El objetivo se
 * individualiza a 35 ml/kg con el último peso registrado; 2.5L si no hay peso.
 */
export function Hidratacion({ usuarioId }: { usuarioId: string }) {
  useDbVersion()
  const hoy = hoyIso()
  const ml = db.nutricion.hidratacionDe(usuarioId, hoy)
  const peso = ultimoPeso(usuarioId)
  const objetivoMl = peso ? Math.round((peso * 35) / 100) * 100 : 2500
  const pct = Math.min(100, (ml / objetivoMl) * 100)

  return (
    <Card aria-label="Hidratación del día">
      <div className="flex items-center gap-3.5">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 shrink-0 text-azul"
        >
          <path d="M12 3.2c3.2 4 5.8 7.2 5.8 10.4a5.8 5.8 0 0 1-11.6 0C6.2 10.4 8.8 7.2 12 3.2z" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tenue">
              Hidratación
            </p>
            <p className="cifras text-xs text-tenue">
              <span className="font-display text-base text-texto">{litros(ml)}L</span>
              {` de ${litros(objetivoMl)}L`}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: 'var(--azul)',
                transition: 'width 600ms cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {ml > 0 && (
            <button
              type="button"
              aria-label="Quitar 250 mililitros"
              onClick={() => db.nutricion.registrarHidratacion(usuarioId, hoy, -VASO_ML)}
              className="press grid h-9 w-9 place-items-center rounded-full border border-hairline text-base text-tenue"
            >
              −
            </button>
          )}
          <button
            type="button"
            aria-label="Agregar 250 mililitros"
            onClick={() => db.nutricion.registrarHidratacion(usuarioId, hoy, VASO_ML)}
            className="press grid h-11 w-11 place-items-center rounded-full border border-azul/40 bg-azul/15 text-xl text-azul"
          >
            +
          </button>
        </div>
      </div>
    </Card>
  )
}
