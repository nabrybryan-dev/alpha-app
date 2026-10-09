import type { MagnitudPautado } from '../../../domain/pautadoVsHecho'
import { NOMBRE_MAGNITUD } from './magnitudes'

interface Props {
  magnitud: MagnitudPautado
  onCambiar: (m: MagnitudPautado) => void
}

/** «Series / Volumen»: nunca las dos magnitudes en una misma escala. */
export function ConmutadorMagnitud({ magnitud, onCambiar }: Props) {
  return (
    <div role="group" aria-label="Qué mirar" className="flex rounded-boton border border-linea p-0.5">
      {(['series', 'volumen'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={magnitud === m}
          onClick={() => onCambiar(m)}
          className={`h-11 min-w-[88px] rounded-[8px] px-3 text-sm font-bold ${
            magnitud === m ? 'bg-rojo text-white' : 'text-tenue'
          }`}
        >
          {NOMBRE_MAGNITUD[m].corto}
        </button>
      ))}
    </div>
  )
}
