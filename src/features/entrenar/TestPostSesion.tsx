import { useState } from 'react'
import { Chip } from '../../components/ui/Chip'
import { Stepper } from '../../components/ui/Stepper'
import type { TestPostSesion as TestPost } from '../../domain/types'

interface TestPostSesionProps {
  onGuardar: (test: TestPost) => void
}

const escala = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function TestPostSesion({ onGuardar }: TestPostSesionProps) {
  const [duracionMin, setDuracionMin] = useState(120)
  const [rpeSesion, setRpeSesion] = useState<number | undefined>()
  const [prsEntrada, setPrsEntrada] = useState<number | undefined>()

  const completo = rpeSesion !== undefined && prsEntrada !== undefined

  return (
    <div className="entrada rounded-panel glass glass-destacada p-4">
      <p className="kicker">Test post-entrenamiento</p>
      <p className="mt-1 text-sm text-tenue">Última parte: cuéntale al coach cómo estuvo la sesión.</p>

      <div className="mt-4 flex justify-center">
        <Stepper etiqueta="Duración total" valor={duracionMin} paso={5} minimo={10} maximo={300} sufijo="min" onCambiar={setDuracionMin} />
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-bold text-texto">¿Qué tan dura estuvo la sesión? (1-10)</legend>
        <div className="flex flex-wrap gap-1.5">
          {escala.map((n) => (
            <Chip key={n} etiqueta={String(n)} seleccionado={rpeSesion === n} onSeleccionar={() => setRpeSesion(n)} />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-bold text-texto">¿Qué tan recuperado entraste? (1-10)</legend>
        <div className="flex flex-wrap gap-1.5">
          {escala.map((n) => (
            <Chip key={n} etiqueta={String(n)} seleccionado={prsEntrada === n} onSeleccionar={() => setPrsEntrada(n)} />
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        disabled={!completo}
        onClick={() => {
          if (rpeSesion !== undefined && prsEntrada !== undefined) {
            onGuardar({ duracionMin, rpeSesion, prsEntrada })
          }
        }}
        className={`press btn-cristal-rojo mt-4 w-full rounded-full py-3 font-display text-sm disabled:opacity-40 ${completo ? 'cta-pulso' : ''}`}
      >
        Cerrar sesión de entrenamiento ✓
      </button>
    </div>
  )
}
