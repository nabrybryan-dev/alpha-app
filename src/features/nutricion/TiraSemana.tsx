import { semanaDe } from '../../domain/nutricion/semana'

/** La tira de siete dias de la cabecera del diario. */

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface TiraSemanaProps {
  /** `YYYY-MM-DD` del día que se está viendo. */
  fecha: string
  /** Fechas que ya tienen algo registrado, para el punto. */
  conRegistro: ReadonlySet<string>
  onElegir: (fecha: string) => void
}

export function TiraSemana({ fecha, conRegistro, onElegir }: TiraSemanaProps) {
  const dias = semanaDe(fecha)

  return (
    <div className="flex gap-1.5">
      {dias.map((dia, i) => {
        const activo = dia === fecha
        return (
          <button
            key={dia}
            type="button"
            onClick={() => onElegir(dia)}
            aria-pressed={activo}
            aria-label={dia}
            className={`press flex flex-1 flex-col items-center gap-0.5 rounded-2xl border py-2 transition-colors ${
              activo
                ? 'border-accion bg-accion/15 text-texto'
                : 'border-linea bg-surface-2 text-tenue'
            }`}
          >
            <span className="text-[9px] font-bold uppercase tracking-wide">{DOW[i]}</span>
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
  )
}
