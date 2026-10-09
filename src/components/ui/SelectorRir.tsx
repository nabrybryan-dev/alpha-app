/**
 * El RIR de una serie: repeticiones que quedaban en reserva, de 0 a 5, y **vacío hasta que
 * la persona lo elige**.
 *
 * Antes era un `Stepper` que arrancaba en el RIR objetivo de la prescripción. Quien no tocaba
 * el mando guardaba el objetivo como si fuera lo que sintió: una asesorada con objetivo RIR 5
 * quedaba con RIR 5 en todas sus series aunque su RPE dijera 8-9, y cada RIR así contamina el
 * promedio que lee la progresión. Un `Stepper` no puede estar vacío —su valor es un número—,
 * así que el RIR pasó a un selector de seis botones donde "no elegido" es un estado más.
 *
 * Tocar el botón ya elegido lo suelta: es la forma de corregir un toque por error sin tener
 * que inventar un valor.
 */
interface SelectorRirProps {
  /** `undefined` = todavía no lo ha elegido (y así se guarda: sin RIR). */
  valor: number | undefined
  onCambiar: (valor: number | undefined) => void
  /** Etiqueta del grupo; la usan los lectores de pantalla y los tests. */
  etiqueta?: string
  maximo?: number
}

export function SelectorRir({ valor, onCambiar, etiqueta = 'RIR', maximo = 5 }: SelectorRirProps) {
  const opciones = Array.from({ length: maximo + 1 }, (_, i) => i)
  return (
    <div role="group" aria-label={etiqueta} className="flex w-full flex-col items-center gap-1">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">
        {etiqueta}
        {valor === undefined && <span className="ml-1.5 font-semibold normal-case tracking-normal">· elige cuántas te quedaban</span>}
      </span>
      <div className="grid w-full grid-cols-6 gap-1">
        {opciones.map((n) => {
          const sel = valor === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={sel}
              aria-label={`${etiqueta} ${n}`}
              onClick={() => onCambiar(sel ? undefined : n)}
              className={`cifras press min-h-[44px] rounded-boton border text-lg font-bold transition-colors duration-toque ease-salida ${
                sel ? 'border-accion bg-accion text-white' : 'border-linea bg-surface-2 text-tenue active:bg-surface-3'
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
