import { useState } from 'react'
import { ChipGroup } from '../../components/ui/Chip'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { PREGUNTAS_MAPA_DE_VIDA, type PreguntaMapaDeVida } from '../../domain/mapaDeVida/preguntas'

const OPCIONES_SI_NO = ['Sí', 'No'] as const

interface EncuestaMapaProps {
  /** Lo ya respondido en una vuelta anterior, para retomar sin perderlo. */
  respuestasIniciales?: Record<string, string>
  /** Igual patrón que `CheckinForm`: el componente no habla con la base, quien lo monta decide. */
  onGuardar: (valores: Record<string, string>) => void
}

/**
 * La encuesta del mapa de vida. Pinta `PREGUNTAS_MAPA_DE_VIDA` — cada
 * pregunta trae su propio `mensajeQueDispara` y `horaBase`, pero eso es
 * metadata para quien programe los recados; aquí solo se recoge la respuesta.
 *
 * No se bloquea el envío hasta tener las seis: a diferencia del check-in
 * diario, este es un cuestionario de una vez y sí importa tenerlo completo
 * para que cada respuesta pueda habilitar su recado.
 */
export function EncuestaMapa({ respuestasIniciales, onGuardar }: EncuestaMapaProps) {
  const [valores, setValores] = useState<Record<string, string>>(respuestasIniciales ?? {})
  const [intento, setIntento] = useState(false)

  const responder = (preguntaId: string, valor: string) =>
    setValores((v) => ({ ...v, [preguntaId]: valor }))

  const total = PREGUNTAS_MAPA_DE_VIDA.length
  const respondidas = PREGUNTAS_MAPA_DE_VIDA.filter((p) => valores[p.id]?.trim()).length
  const completa = respondidas === total

  const enviar = () => {
    if (!completa) {
      setIntento(true)
      return
    }
    onGuardar(valores)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-sm font-bold text-texto">Cómo vives</p>
        <p className="mb-3 text-xs leading-snug text-tenue">
          Seis preguntas para poder hablarte cuando te sirve, no a la hora que nos venga bien a
          nosotros.
        </p>
        <ProgressBar pct={(respondidas / total) * 100} etiqueta="Progreso del mapa de vida" />
        <p className="mt-1 text-xs text-tenue">
          {respondidas} de {total} respondidas
        </p>
      </div>

      {PREGUNTAS_MAPA_DE_VIDA.map((pregunta, indice) => (
        <CampoPregunta
          key={pregunta.id}
          indice={indice}
          pregunta={pregunta}
          valor={valores[pregunta.id]}
          onCambiar={(v) => responder(pregunta.id, v)}
        />
      ))}

      {intento && !completa && (
        <p role="alert" className="text-center text-xs font-bold text-rojo">
          Te falta{total - respondidas === 1 ? '' : 'n'} {total - respondidas} pregunta
          {total - respondidas === 1 ? '' : 's'} por responder
        </p>
      )}

      <button
        type="button"
        onClick={enviar}
        className="press mt-1 w-full rounded-boton bg-accion py-3.5 font-display text-base uppercase tracking-wide text-white"
        style={{ boxShadow: 'var(--glow-accion)' }}
      >
        Guardar mapa de vida
      </button>
    </div>
  )
}

function CampoPregunta({
  indice,
  pregunta,
  valor,
  onCambiar,
}: {
  indice: number
  pregunta: PreguntaMapaDeVida
  valor: string | undefined
  onCambiar: (valor: string) => void
}) {
  return (
    <fieldset className="rounded-tarjeta border border-linea bg-surface-1 p-3.5 shadow-sm">
      <legend className="mb-2.5 text-sm font-bold text-texto">
        {indice + 1}. {pregunta.texto}
      </legend>

      {pregunta.tipo === 'si_no' && (
        <div className="flex gap-2">
          {OPCIONES_SI_NO.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onCambiar(op)}
              className={`press flex-1 rounded-full border py-2 text-[11px] font-bold uppercase tracking-wide transition-colors duration-200 ease-salida ${
                valor === op ? 'border-accion bg-accion text-white' : 'border-linea bg-surface-2 text-tenue'
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      )}

      {pregunta.tipo === 'hora' && (
        <input
          type="time"
          aria-label={pregunta.texto}
          value={valor ?? ''}
          onChange={(e) => onCambiar(e.target.value)}
          className="w-full rounded-boton border border-linea bg-surface-1 px-3.5 py-2.5 text-texto shadow-sm focus:border-accion focus:outline-none"
        />
      )}

      {pregunta.tipo === 'opcion_multiple' && pregunta.opciones && (
        <ChipGroup opciones={pregunta.opciones} valor={valor} onCambiar={onCambiar} />
      )}

      {pregunta.tipo === 'escala_1_5' && (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} de 5`}
              aria-pressed={valor === String(n)}
              onClick={() => onCambiar(String(n))}
              className={`press h-11 flex-1 rounded-boton border text-sm font-bold transition-colors ${
                valor === String(n)
                  ? 'border-accion bg-accion text-white'
                  : 'border-linea bg-surface-2 text-tenue'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  )
}
