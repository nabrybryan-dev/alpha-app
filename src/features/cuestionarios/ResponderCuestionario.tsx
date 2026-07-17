import { useState } from 'react'
import { Chip, ChipGroup } from '../../components/ui/Chip'
import { ProgressBar } from '../../components/ui/ProgressBar'
import type { Cuestionario } from '../../domain/types'

interface ResponderCuestionarioProps {
  cuestionario: Cuestionario
  onEnviar: (valores: Record<string, string>) => void
}

export function ResponderCuestionario({ cuestionario, onEnviar }: ResponderCuestionarioProps) {
  const [valores, setValores] = useState<Record<string, string>>({})

  const responder = (preguntaId: string, valor: string) =>
    setValores((v) => ({ ...v, [preguntaId]: valor }))

  const respondidas = cuestionario.preguntas.filter((p) => valores[p.id]?.trim()).length
  const total = cuestionario.preguntas.length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <ProgressBar pct={(respondidas / total) * 100} etiqueta="Progreso del cuestionario" />
        <p className="mt-1 text-xs text-tenue">
          {respondidas} de {total} respondidas
        </p>
      </div>

      {cuestionario.preguntas.map((pregunta, indice) => (
        <fieldset key={pregunta.id}>
          <legend className="mb-2 text-sm font-bold text-texto">
            {indice + 1}. {pregunta.enunciado}
          </legend>

          {pregunta.tipo === 'si_no' && (
            <div className="flex gap-2">
              {['Sí', 'No'].map((op) => (
                <Chip key={op} etiqueta={op} seleccionado={valores[pregunta.id] === op} onSeleccionar={() => responder(pregunta.id, op)} />
              ))}
            </div>
          )}

          {pregunta.tipo === 'escala_1_5' && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={valores[pregunta.id] === String(n)}
                  onClick={() => responder(pregunta.id, String(n))}
                  className={`grid h-12 w-12 place-items-center rounded-full border text-sm font-black ${
                    valores[pregunta.id] === String(n)
                      ? 'border-rojo bg-rojo/15 text-rojo'
                      : 'border-linea bg-surface-2 text-tenue'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {pregunta.tipo === 'opcion_multiple' && pregunta.opciones && (
            <ChipGroup opciones={pregunta.opciones} valor={valores[pregunta.id]} onCambiar={(v) => responder(pregunta.id, v)} />
          )}

          {pregunta.tipo === 'texto' && (
            <textarea
              value={valores[pregunta.id] ?? ''}
              onChange={(e) => responder(pregunta.id, e.target.value)}
              rows={3}
              placeholder="Escribe tu respuesta…"
              className="w-full rounded-xl border border-linea bg-surface-2 px-3 py-2.5 text-sm text-texto placeholder:text-tenue focus:border-rojo focus:outline-none"
            />
          )}
        </fieldset>
      ))}

      <button
        type="button"
        disabled={respondidas < total}
        onClick={() => onEnviar(valores)}
        className="rounded-xl bg-rojo py-3 font-display text-sm text-white disabled:opacity-40"
      >
        Enviar respuestas ✓
      </button>
    </div>
  )
}
