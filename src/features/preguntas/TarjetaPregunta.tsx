import { useState } from 'react'
import { Chip, ChipGroup } from '../../components/ui/Chip'
import type { Cuestionario } from '../../domain/types'

/**
 * «Tu coach te pregunta»: lo que la cadena de agentes dejó abierto y solo esta
 * persona puede cerrar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SIN PENDIENTE NO SE PINTA NADA
 * ────────────────────────────────────────────────────────────────────────────
 * No hay estado de «no tienes preguntas», y es deliberado: una tarjeta vacía
 * diciendo que no hay nada que hacer ocupa el sitio de lo que sí hay que hacer.
 * Quien no tiene pregunta abre la app y ve su entrenamiento, como siempre.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNA CADA VEZ
 * ────────────────────────────────────────────────────────────────────────────
 * `preguntaDelDia` devuelve la primera pendiente y solo esa. Quien abre la app en
 * el gimnasio y se encuentra tres preguntas, cierra la app.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE DICE QUE ES DEL COACH Y NO «DEL SISTEMA»
 * ────────────────────────────────────────────────────────────────────────────
 * Porque lo es: la pregunta la dispara un agente, pero quien necesita la respuesta
 * para decidir su plan es su coach. Decirle que se lo pregunta un proceso
 * automático invita a contestar de cualquier manera, y estas preguntas son las que
 * paran un microciclo.
 */

interface TarjetaPreguntaProps {
  /** La pendiente. Si no hay, este componente no se monta. */
  pregunta: Cuestionario
  onResponder: (valores: Record<string, string>) => void
}

export function TarjetaPregunta({ pregunta, onResponder }: TarjetaPreguntaProps) {
  const [valores, setValores] = useState<Record<string, string>>({})

  // CADA CUESTIONARIO EMPIEZA VACÍO, y hasta hoy no era así.
  //
  // Si el padre reutiliza esta tarjeta para la pregunta siguiente, `valores` conserva lo
  // que se escribió en la anterior. Las preguntas que redacta la cadena numeran sus
  // casillas igual (`p1`, `p2`), así que la nueva aparecía RELLENADA con las respuestas
  // de otra y con el botón ya activo: un toque y se enviaba lo que contestó a otra cosa.
  // HoyPage pasa un `key` para forzar el remontaje, y esto lo garantiza además desde
  // dentro, para que no dependa de que el siguiente sitio que la use se acuerde.
  //
  // Es ajuste de estado DURANTE el render —el patrón que React documenta para «resetear
  // al cambiar una prop»— y no un efecto: `react-hooks/set-state-in-effect` es error en
  // este repo, y con razón.
  const [idPintado, setIdPintado] = useState(pregunta.id)
  if (idPintado !== pregunta.id) {
    setIdPintado(pregunta.id)
    setValores({})
  }
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(false)

  const responder = (preguntaId: string, valor: string) =>
    setValores((v) => ({ ...v, [preguntaId]: valor }))

  const contestadas = pregunta.preguntas.filter((p) => valores[p.id]?.trim()).length
  const completo = contestadas === pregunta.preguntas.length

  const enviar = () => {
    if (!completo) {
      setIntento(true)
      return
    }
    setEnviando(true)
    setError(false)
    try {
      onResponder(valores)
    } catch {
      setError(true)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tenue">
          Tu coach te pregunta
        </p>
        <h2 className="mt-1 font-display text-lg leading-tight text-texto">{pregunta.titulo}</h2>
        {pregunta.descripcion && (
          <p className="mt-1 text-sm text-tenue">{pregunta.descripcion}</p>
        )}
      </header>

      {pregunta.preguntas.map((p) => (
        <fieldset key={p.id}>
          <legend className="mb-2 text-sm font-bold text-texto">{p.enunciado}</legend>

          {p.tipo === 'si_no' && (
            <div className="flex gap-2">
              {['Sí', 'No'].map((opcion) => (
                <Chip
                  key={opcion}
                  etiqueta={opcion}
                  seleccionado={valores[p.id] === opcion}
                  onSeleccionar={() => responder(p.id, opcion)}
                />
              ))}
            </div>
          )}

          {p.tipo === 'opcion_multiple' && p.opciones && (
            <ChipGroup
              opciones={p.opciones}
              valor={valores[p.id]}
              onCambiar={(v) => responder(p.id, v)}
            />
          )}

          {p.tipo === 'escala_1_5' && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip
                  key={n}
                  etiqueta={String(n)}
                  seleccionado={valores[p.id] === String(n)}
                  onSeleccionar={() => responder(p.id, String(n))}
                />
              ))}
            </div>
          )}

          {/* LA RED DE ABAJO, y no es una cortesía: una pregunta que no se puede
              contestar deja el cuestionario imposible de enviar, y como la app solo
              enseña el PRIMER pendiente, esconde todas las siguientes para siempre. La
              cadena redacta estas preguntas sola y el blob entra sin validar, así que un
              `opcion_multiple` sin sus `opciones` es cuestión de tiempo. Con la red, la
              persona puede contestarlo escribiendo. */}
          {(p.tipo === 'texto' || (p.tipo === 'opcion_multiple' && !p.opciones)) && (
            <textarea
              value={valores[p.id] ?? ''}
              onChange={(e) => responder(p.id, e.target.value)}
              rows={3}
              placeholder="Cuéntamelo con tus palabras"
              className="w-full rounded-xl border border-linea bg-surface-2 px-3 py-2.5 text-sm text-texto placeholder:text-tenue focus:border-rojo focus:outline-none"
            />
          )}
        </fieldset>
      ))}

      {error && (
        <p role="alert" className="text-sm font-bold text-rojo">
          No se pudo enviar. Lo que escribiste sigue aquí: inténtalo otra vez.
        </p>
      )}

      {intento && !completo && !error && (
        <p role="alert" className="text-center text-xs font-bold text-rojo">
          Te falta contestar {pregunta.preguntas.length - contestadas}
        </p>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="press rounded-boton bg-accion py-3 font-display text-sm uppercase tracking-wide text-white disabled:opacity-40"
      >
        {enviando ? 'Enviando…' : 'Responder'}
      </button>
    </section>
  )
}
