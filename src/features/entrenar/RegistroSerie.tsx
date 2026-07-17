import { useState } from 'react'
import { Stepper } from '../../components/ui/Stepper'
import type { EjercicioPrescrito, SerieRegistrada } from '../../domain/types'

interface RegistroSerieProps {
  ejercicio: EjercicioPrescrito
  orden: number
  onGuardar: (serie: SerieRegistrada) => void
}

function cargaSugerida(ejercicio: EjercicioPrescrito): number {
  const previa = ejercicio.series[ejercicio.series.length - 1]?.cargaKg
  if (previa !== undefined) return previa
  const dePrescripcion = Number.parseFloat(ejercicio.prescripcion.replace(',', '.'))
  return Number.isFinite(dePrescripcion) ? dePrescripcion : 20
}

export function RegistroSerie({ ejercicio, orden, onGuardar }: RegistroSerieProps) {
  const [cargaKg, setCargaKg] = useState(() => cargaSugerida(ejercicio))
  const [reps, setReps] = useState(ejercicio.repsDiana)
  const [rir, setRir] = useState(ejercicio.rirObjetivo)

  return (
    <div className="rounded-xl border border-hairline bg-surface-2/60 p-3">
      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-tenue">
        Serie {orden} de {ejercicio.sets}
      </p>
      <div className="flex items-start justify-between gap-1">
        <Stepper etiqueta="Carga" valor={cargaKg} paso={2.5} sufijo="kg" onCambiar={setCargaKg} />
        <Stepper etiqueta="Reps" valor={reps} paso={1} minimo={1} maximo={50} onCambiar={setReps} />
        <Stepper etiqueta="RIR" valor={rir} paso={1} minimo={0} maximo={5} onCambiar={setRir} />
      </div>
      <button
        type="button"
        onClick={() => onGuardar({ orden, cargaKg, reps, rir })}
        className="press btn-cristal-rojo mt-3 w-full rounded-full py-2.5 font-display text-sm"
      >
        Guardar serie {orden} ✓
      </button>
    </div>
  )
}
