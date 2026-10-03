import { useMemo, useState, type FormEvent } from 'react'
import type { MedidasAntropometricas } from '../../../domain/types'
import {
  MEDIDAS_DE_PALANCAS,
  perfilInicial,
} from './perfil'

interface EncuestaPalancasProps {
  perfil?: MedidasAntropometricas | null
  abierta?: boolean
  onGuardar: (perfil: MedidasAntropometricas) => void
  onCerrar?: () => void
}

export function EncuestaPalancas({
  perfil,
  abierta = true,
  onGuardar,
  onCerrar,
}: EncuestaPalancasProps) {
  const semilla = useMemo(() => perfilInicial(perfil), [perfil])
  const [valores, setValores] = useState<MedidasAntropometricas>(semilla)
  const [error, setError] = useState<string | null>(null)

  if (!abierta) return null

  const guardar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const fuera = MEDIDAS_DE_PALANCAS.find(
      ({ clave, minimo, maximo }) =>
        !Number.isFinite(valores[clave]) || valores[clave] < minimo || valores[clave] > maximo,
    )
    if (fuera) {
      setError(`Revisa ${fuera.nombre}: debe estar entre ${fuera.minimo} y ${fuera.maximo} cm.`)
      return
    }
    setError(null)
    onGuardar(valores)
  }

  return (
    <div
      className="absolute inset-0 z-30 overflow-y-auto bg-ink-1000/95 px-4 py-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-encuesta-palancas"
    >
      <form onSubmit={guardar} className="mx-auto flex min-h-full w-full max-w-md flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker text-accion">Tu sujeto · 8 medidas</p>
            <h3 id="titulo-encuesta-palancas" className="mt-1 font-display text-2xl text-white">
              Individualiza tus palancas
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-silver-300">
              Escríbelas en centímetros. El salón conserva el patrón y adapta las proporciones.
            </p>
          </div>
          {perfil && onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar encuesta de medidas"
              className="press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-xl text-white"
            >
              ×
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {MEDIDAS_DE_PALANCAS.map((medida, indice) => (
            <label
              key={medida.clave}
              className="rounded-xl border border-white/10 bg-white/[0.045] p-3 focus-within:border-accion/70"
            >
              <span className="flex items-center gap-2">
                <span className="cifras text-[10px] font-bold text-accion">{String(indice + 1).padStart(2, '0')}</span>
                <span className="text-xs font-bold text-white">{medida.nombre}</span>
              </span>
              <span className="mt-0.5 block text-[10px] text-silver-400">{medida.ayuda}</span>
              <span className="mt-2 flex items-baseline gap-1">
                <input
                  name={medida.clave}
                  type="number"
                  inputMode="decimal"
                  min={medida.minimo}
                  max={medida.maximo}
                  step="0.1"
                  required
                  value={valores[medida.clave]}
                  onChange={(evento) =>
                    setValores((actual) => ({
                      ...actual,
                      [medida.clave]: Number(evento.target.value),
                    }))
                  }
                  className="cifras min-w-0 flex-1 border-0 border-b border-white/15 bg-transparent py-1 text-xl font-bold text-white outline-none"
                />
                <span className="text-[10px] font-bold uppercase text-silver-400">cm</span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-rojo/40 bg-rojo/10 px-3 py-2 text-xs text-white">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="press mt-5 w-full rounded-boton bg-accion py-3.5 font-display text-sm uppercase tracking-wide text-white"
          style={{ boxShadow: 'var(--glow-accion)' }}
        >
          Crear mi sujeto
        </button>
      </form>
    </div>
  )
}
