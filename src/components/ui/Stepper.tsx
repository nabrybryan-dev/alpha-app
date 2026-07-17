interface StepperProps {
  etiqueta: string
  valor: number
  paso: number
  minimo?: number
  maximo?: number
  sufijo?: string
  onCambiar: (valor: number) => void
}

export function Stepper({ etiqueta, valor, paso, minimo = 0, maximo = 999, sufijo = '', onCambiar }: StepperProps) {
  const redondear = (n: number) => Math.round(n * 100) / 100
  const bajar = () => onCambiar(redondear(Math.max(minimo, valor - paso)))
  const subir = () => onCambiar(redondear(Math.min(maximo, valor + paso)))

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] uppercase tracking-wider text-tenue">{etiqueta}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Bajar ${etiqueta}`}
          onClick={bajar}
          className="h-11 w-11 rounded-xl border border-linea bg-surface-2 text-xl font-bold text-texto active:bg-surface-3"
        >
          −
        </button>
        <span className="min-w-14 text-center text-lg font-bold text-texto">
          {valor}
          {sufijo && <span className="ml-0.5 text-xs font-normal text-tenue">{sufijo}</span>}
        </span>
        <button
          type="button"
          aria-label={`Subir ${etiqueta}`}
          onClick={subir}
          className="h-11 w-11 rounded-xl border border-linea bg-surface-2 text-xl font-bold text-texto active:bg-surface-3"
        >
          +
        </button>
      </div>
    </div>
  )
}
