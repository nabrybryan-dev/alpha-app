import { useState } from 'react'
import { formatoDuracion } from '../../domain/ritmoSesion'
import type { TestPostSesion as TestPost } from '../../domain/types'
import { citaPorIndice, indiceDesdeTexto } from './citasCelebres'
import { leerTiempoCrono } from './CronometroSesion'

const TOPE_SEG = 5 * 3600 // tope contra cronómetros viejos que nunca se cerraron

interface TestPostSesionProps {
  onGuardar: (test: TestPost) => void
  sesionId?: string
  nombreSesion?: string
}

const RPE_OPCIONES = [6, 7, 8, 9, 10]
// La recuperación se pide en 3 niveles pero se guarda numérica (1-10) para que
// el panel del coach y el índice de readiness la sigan leyendo igual.
const RECUP_OPCIONES = [
  { label: 'POCO', valor: 3 },
  { label: 'NORMAL', valor: 6 },
  { label: 'MUCHO', valor: 9 },
] as const

export function TestPostSesion({ onGuardar, sesionId = '', nombreSesion }: TestPostSesionProps) {
  const [rpeSesion, setRpeSesion] = useState<number | undefined>()
  const [prsEntrada, setPrsEntrada] = useState<number | undefined>()

  const segundos = Math.min(sesionId ? leerTiempoCrono(sesionId) : 0, TOPE_SEG)
  const completo = rpeSesion !== undefined && prsEntrada !== undefined
  const cita = citaPorIndice(indiceDesdeTexto(sesionId))

  const finalizar = () => {
    if (rpeSesion === undefined || prsEntrada === undefined) return
    onGuardar({ duracionMin: Math.max(1, Math.round(segundos / 60)), rpeSesion, prsEntrada })
  }

  return (
    <div
      className="scrim-entra fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(8, 9, 10, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-label="Test post entrenamiento"
    >
      <div className="subir-hoja mx-auto max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border-t border-ink-400 bg-ink-800 px-5 pb-8 pt-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-500" aria-hidden="true" />

        <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-accion">
          Test post entrenamiento
        </p>
        <h2 className="mt-1.5 text-center font-display text-xl text-silver-100">
          {nombreSesion ? `${nombreSesion} completada` : 'Sesión completada'}
        </h2>
        <p className="mt-1.5 flex items-baseline justify-center gap-2 text-xs text-silver-500">
          Duración total
          <span className="cifras text-sm font-bold text-silver-100">{formatoDuracion(segundos)}</span>
        </p>

        <figure className="mt-4 rounded-tarjeta border-l-2 border-accion bg-ink-700 py-2.5 pl-3 pr-2">
          <blockquote className="font-display text-sm italic leading-snug text-silver-100">“{cita.texto}”</blockquote>
          <figcaption className="mt-1 text-[10px] font-bold uppercase tracking-wider text-silver-500">— {cita.autor}</figcaption>
        </figure>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-bold text-silver-200">
            ¿Qué tan dura estuvo la sesión? <span className="font-semibold text-silver-500">(RPE)</span>
          </legend>
          <div className="flex gap-2">
            {RPE_OPCIONES.map((n) => {
              const sel = rpeSesion === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRpeSesion(n)}
                  className={`cifras press flex-1 rounded-boton border py-2.5 text-base font-bold transition-colors duration-200 ease-salida ${
                    sel ? 'border-accion bg-accion text-ink-900' : 'border-ink-500 bg-ink-700 text-silver-300'
                  }`}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-bold text-silver-200">¿Qué tan recuperado entraste?</legend>
          <div className="flex gap-2">
            {RECUP_OPCIONES.map((o) => {
              const sel = prsEntrada === o.valor
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setPrsEntrada(o.valor)}
                  className={`press flex-1 rounded-full border py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors duration-200 ease-salida ${
                    sel ? 'border-accion bg-accion text-ink-900' : 'border-ink-500 bg-ink-700 text-silver-300'
                  }`}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <button
          type="button"
          disabled={!completo}
          onClick={finalizar}
          className="press mt-6 w-full rounded-boton bg-accion py-4 font-display text-base uppercase tracking-wide text-ink-900 transition-opacity duration-200 disabled:opacity-40"
          style={completo ? { boxShadow: 'var(--glow-accion)' } : undefined}
        >
          Finalizar sesión
        </button>
      </div>
    </div>
  )
}
