import { useEffect, useState } from 'react'

interface StepperProps {
  etiqueta: string
  valor: number
  paso: number
  minimo?: number
  maximo?: number
  sufijo?: string
  /** Permite decimales al escribir (p. ej. cargas 42.5). */
  decimal?: boolean
  onCambiar: (valor: number) => void
}

export function Stepper({
  etiqueta,
  valor,
  paso,
  minimo = 0,
  maximo = 999,
  sufijo = '',
  decimal = false,
  onCambiar,
}: StepperProps) {
  const redondear = (n: number) => Math.round(n * 100) / 100
  const acotar = (n: number) => redondear(Math.min(maximo, Math.max(minimo, n)))
  const bajar = () => onCambiar(acotar(valor - paso))
  const subir = () => onCambiar(acotar(valor + paso))

  // El texto se edita libremente (permite "", "42.", "42.5") y solo se confirma
  // un número válido; al salir del campo se normaliza al valor acotado.
  const [texto, setTexto] = useState(String(valor))
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    if (!editando) setTexto(String(valor))
  }, [valor, editando])

  const alEscribir = (bruto: string) => {
    const limpio = bruto.replace(',', '.')
    if (limpio === '' || limpio === '.' || /^\d*\.?\d*$/.test(limpio)) {
      setTexto(limpio)
      const n = Number.parseFloat(limpio)
      if (Number.isFinite(n)) onCambiar(acotar(decimal ? n : Math.round(n)))
    }
  }

  const alSalir = () => {
    setEditando(false)
    const n = Number.parseFloat(texto.replace(',', '.'))
    onCambiar(acotar(Number.isFinite(n) ? (decimal ? n : Math.round(n)) : valor))
  }

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <span className="text-[11px] uppercase tracking-wider text-tenue">{etiqueta}</span>
      <div className="flex w-full items-center justify-center gap-1.5">
        <button
          type="button"
          aria-label={`Bajar ${etiqueta}`}
          onClick={bajar}
          className="h-10 w-10 shrink-0 rounded-xl border border-linea bg-surface-2 text-xl font-bold text-texto active:bg-surface-3"
        >
          −
        </button>
        <div className="flex min-w-0 flex-1 items-baseline justify-center">
          <input
            aria-label={`${etiqueta}${sufijo ? ` en ${sufijo}` : ''}`}
            type="text"
            inputMode={decimal ? 'decimal' : 'numeric'}
            value={editando ? texto : String(valor)}
            onFocus={(e) => {
              setEditando(true)
              e.currentTarget.select()
            }}
            onChange={(e) => alEscribir(e.target.value)}
            onBlur={alSalir}
            className="w-full min-w-0 bg-transparent text-center text-lg font-bold tabular-nums text-texto focus:outline-none"
          />
          {sufijo && <span className="-ml-1 shrink-0 text-xs font-normal text-tenue">{sufijo}</span>}
        </div>
        <button
          type="button"
          aria-label={`Subir ${etiqueta}`}
          onClick={subir}
          className="h-10 w-10 shrink-0 rounded-xl border border-linea bg-surface-2 text-xl font-bold text-texto active:bg-surface-3"
        >
          +
        </button>
      </div>
    </div>
  )
}
