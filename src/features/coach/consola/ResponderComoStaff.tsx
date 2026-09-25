import { useState } from 'react'
import { responderComoStaff } from '../../../data/consola/responderComoStaff'
import { useCapacidades } from './useCapacidades'

/**
 * «Responder como coach» (encargo, punto 4): llama a `responder_como_staff` con el
 * `cuestionario_id` real — nunca escribe hasta que la persona confirma en un segundo paso,
 * dentro de la misma página (nada de `prompt`/`confirm`). Se usa tanto en la bandeja de
 * preguntas de Agentes como en los cuestionarios pendientes de la ficha del asesorado.
 */

type Paso = 'cerrado' | 'escribiendo' | 'confirmando'

interface ResponderComoStaffProps {
  cuestionarioId: string
  nombrePersona: string
}

export function ResponderComoStaff({ cuestionarioId, nombrePersona }: ResponderComoStaffProps) {
  const { cargando, tiene } = useCapacidades()
  const [paso, setPaso] = useState<Paso>('cerrado')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviada, setEnviada] = useState(false)

  const puede = tiene('responder_por_asesorado')

  if (enviada) {
    return <p className="text-xs font-bold text-verde">Respondida por el equipo.</p>
  }

  const enviar = async () => {
    setEnviando(true)
    setError(null)
    const resultado = await responderComoStaff(cuestionarioId, { texto: texto.trim() })
    setEnviando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setEnviada(true)
  }

  if (paso === 'cerrado') {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto disabled:cursor-not-allowed disabled:opacity-40"
          disabled={cargando || !puede}
          onClick={() => setPaso('escribiendo')}
        >
          Responder como coach
        </button>
        {!cargando && !puede && (
          <span className="text-[11px] text-tenue">— hace falta la capacidad «responder por el asesorado».</span>
        )}
      </div>
    )
  }

  return (
    <div className="mt-1.5 rounded-lg border border-dashed border-linea bg-surface-2 p-2.5">
      {paso === 'escribiendo' && (
        <>
          <label
            className="text-[11px] font-bold uppercase tracking-wide text-tenue"
            htmlFor={`respuesta-staff-${cuestionarioId}`}
          >
            Lo que dijo {nombrePersona} (por WhatsApp, en persona…)
          </label>
          <textarea
            id={`respuesta-staff-${cuestionarioId}`}
            className="mt-1 w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="tecla-3d rounded-lg bg-accion px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              disabled={!texto.trim()}
              onClick={() => setPaso('confirmando')}
            >
              Guardar respuesta
            </button>
            <button
              type="button"
              className="rounded-lg border border-linea px-3 py-1.5 text-xs font-bold text-tenue"
              onClick={() => {
                setPaso('cerrado')
                setTexto('')
              }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
      {paso === 'confirmando' && (
        <>
          <p className="text-sm text-texto/90">
            ¿Confirmas enviar esta respuesta a nombre de <strong>{nombrePersona}</strong>? Va a quedar marcada
            «respondida por el equipo».
          </p>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-1 p-2 text-xs text-tenue">{texto}</p>
          {error && <p className="mt-1 text-xs text-rojo">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="tecla-3d rounded-lg bg-accion px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              disabled={enviando}
              onClick={() => void enviar()}
            >
              {enviando ? 'Enviando…' : 'Confirmar y enviar'}
            </button>
            <button
              type="button"
              className="rounded-lg border border-linea px-3 py-1.5 text-xs font-bold text-tenue"
              disabled={enviando}
              onClick={() => setPaso('escribiendo')}
            >
              Volver a editar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
