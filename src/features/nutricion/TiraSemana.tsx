import { semanaDe } from '../../domain/nutricion/semana'

/** La tira de siete dias de la cabecera del diario. */

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface TiraSemanaProps {
  /** `YYYY-MM-DD` del día que se está viendo. */
  fecha: string
  /** Fechas que ya tienen algo registrado, para el punto. */
  conRegistro: ReadonlySet<string>
  onElegir: (fecha: string) => void
  /**
   * El día de hoy. Los posteriores no se pueden abrir: mirar el viernes un
   * martes no es viajar en el tiempo, es mirar un hueco que todavía no existe.
   * Por defecto se toma la fecha que se está viendo, para no romper a quien
   * monte la tira suelta.
   */
  hoy?: string
  /** Abre la vista de la semana. Sin esto, la cabecera no pinta el botón. */
  onSemana?: () => void
}

export function TiraSemana({ fecha, conRegistro, onElegir, hoy = fecha, onSemana }: TiraSemanaProps) {
  const dias = semanaDe(fecha)

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <b className="text-sm text-texto">Diario de comidas</b>
        {onSemana && (
          <button
            type="button"
            onClick={onSemana}
            className="press flex min-h-11 items-center rounded-full border border-linea bg-surface-2 px-3 text-xs font-semibold text-texto"
          >
            Semana
          </button>
        )}
      </div>

      <div className="flex gap-1.5" role="group" aria-label="Días de la semana">
        {dias.map((dia, i) => {
          const activo = dia === fecha
          const futuro = dia > hoy
          return (
            <button
              key={dia}
              type="button"
              onClick={() => onElegir(dia)}
              disabled={futuro}
              aria-pressed={activo}
              aria-label={dia}
              className={`relieve flex flex-1 flex-col items-center gap-0.5 rounded-2xl border py-2 transition-colors disabled:opacity-45 ${
                activo
                  ? 'border-accion bg-accion/15 text-texto'
                  : dia === hoy
                    ? 'border-linea bg-surface-1 text-texto'
                    : 'border-linea bg-surface-2 text-tenue'
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wide">{DOW[i]}</span>
              <span className="cifras text-sm font-bold">{Number(dia.slice(8))}</span>
              <span
                aria-hidden="true"
                className={`h-1 w-1 rounded-full ${
                  conRegistro.has(dia) ? 'bg-logrado' : 'bg-transparent'
                }`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
