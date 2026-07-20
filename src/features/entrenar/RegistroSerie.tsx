import { useEffect, useState } from 'react'
import { Stepper } from '../../components/ui/Stepper'
import { etiquetaDeSerie } from '../../domain/calendario'
import type { EjercicioPrescrito, SerieRegistrada } from '../../domain/types'
import { borrarClave, escribirJSON, leerJSON } from '../../lib/persistencia'

interface RegistroSerieProps {
  ejercicio: EjercicioPrescrito
  orden: number
  /** Identifica el borrador de esta serie en curso (microciclo + ejercicio + orden). */
  borradorId: string
  onGuardar: (serie: SerieRegistrada) => void
}

interface Borrador {
  cargaKg: number
  reps: number
  rir: number
}

function cargaSugerida(ejercicio: EjercicioPrescrito): number {
  const previa = ejercicio.series[ejercicio.series.length - 1]?.cargaKg
  if (previa !== undefined) return previa
  const dePrescripcion = Number.parseFloat(ejercicio.prescripcion.replace(',', '.'))
  return Number.isFinite(dePrescripcion) ? dePrescripcion : 20
}

export function RegistroSerie({ ejercicio, orden, borradorId, onGuardar }: RegistroSerieProps) {
  const clave = `alpha-serie-${borradorId}`
  const [borrador, setBorrador] = useState<Borrador>(() =>
    leerJSON<Borrador>(clave, {
      cargaKg: cargaSugerida(ejercicio),
      reps: ejercicio.repsDiana,
      rir: ejercicio.rirObjetivo,
    }),
  )

  // Cada cambio se guarda solo (como una hoja de Excel): si el asesorado se sale
  // a cambiar la música o cierra la app, la serie a medio llenar sigue ahí.
  useEffect(() => {
    escribirJSON(clave, borrador)
  }, [clave, borrador])

  const cambiar = (parche: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...parche }))

  const guardar = () => {
    onGuardar({ orden, cargaKg: borrador.cargaKg, reps: borrador.reps, rir: borrador.rir })
    borrarClave(clave) // ya quedó en la base; el borrador deja de hacer falta
  }

  const etiqueta = etiquetaDeSerie(ejercicio, orden)

  return (
    <div className="rounded-xl border border-hairline bg-surface-2/60 p-3">
      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-tenue">
        Serie {orden} de {ejercicio.sets}
        {etiqueta && (
          <span className="ml-2 rounded-full bg-rojo/15 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-rojo">
            {etiqueta}
          </span>
        )}
      </p>

      {/* Carga a lo ancho (dato principal); Reps y RIR debajo en dos columnas.
          Así nada se sale de la pantalla en móvil y la jerarquía queda clara. */}
      <Stepper etiqueta="Carga" valor={borrador.cargaKg} paso={2.5} sufijo="kg" onCambiar={(v) => cambiar({ cargaKg: v })} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stepper etiqueta="Reps" valor={borrador.reps} paso={1} minimo={1} maximo={50} onCambiar={(v) => cambiar({ reps: v })} />
        <Stepper etiqueta="RIR" valor={borrador.rir} paso={1} minimo={0} maximo={5} onCambiar={(v) => cambiar({ rir: v })} />
      </div>

      <button
        type="button"
        onClick={guardar}
        className="press btn-cristal-rojo mt-3 w-full rounded-full py-2.5 font-display text-sm"
      >
        Guardar serie {orden} ✓
      </button>
    </div>
  )
}
