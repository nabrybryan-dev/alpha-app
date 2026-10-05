import { useState } from 'react'
import { useSesionOpcional } from '../../../app/SessionProvider'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { responderPreguntaCoach, type RespuestaCoach } from '../../../data/consola/respuestasCoach'
import { textoDeRespuesta, type PreguntaDeLaCadena } from '../../../domain/consolaCoach/preguntasDeLaCadena'
import { usePuestoCoach } from './usePuestoCoach'

/**
 * «Preguntas de la cadena para ti»: lo que los agentes le dejaron al COACH en `para_el_coach`
 * (encargo de Bryan, 3-oct-2026: una asesorada estuvo dos semanas a mitad de volumen porque la
 * pregunta del ② quedó en una nota gris plegada). Va ARRIBA del tablero de Agentes.
 *
 * Cada tarjeta: la pregunta, la persona, el paso y la fecha. Si el paso declaró opciones, botones
 * A/B/C; si no, un campo de respuesta corta (y siempre se puede escribir). Al guardar, la base anota
 * quién respondió y cuándo (RPC `responder_pregunta_coach`, migración 0110) y la pregunta sale de
 * pendientes: queda en «respondidas». La cadena lee esa respuesta en la siguiente tanda.
 *
 * Responden el coach (o la cuenta personal de Bryan con `puesto_de_coach`) y la nutricionista. Con la
 * migración sin aplicar se ven las preguntas y un aviso; no se rompe nada.
 */

export type EstadoRespuestas =
  | { tipo: 'cargando' }
  | { tipo: 'listo' }
  | { tipo: 'sin_tabla' }
  | { tipo: 'error'; error: string }

interface Props {
  pendientes: PreguntaDeLaCadena[]
  respondidas: RespuestaCoach[]
  estado: EstadoRespuestas
  nombreDe: (usuarioId: string) => string
  /** La respuesta ya guardada: el padre la suma y la pregunta pasa a «respondidas». */
  onRespondida: (r: RespuestaCoach) => void
  onVerPersona?: (usuarioId: string) => void
}

const NOMBRE_PASO: Record<number, string> = { 1: '① Valoración', 2: '② Planificación', 3: '③ Prescripción', 4: '④ Ejecución' }

function fechaCorta(iso: string | null): string {
  if (!iso) return 'sin fecha'
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return 'sin fecha'
  return f.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function PreguntasAlCoach({ pendientes, respondidas, estado, nombreDe, onRespondida, onVerPersona }: Props) {
  const sesion = useSesionOpcional()
  const { esCoach: ocupaPuesto } = usePuestoCoach(sesion?.usuario.rol)
  // Bryan (coach, o su cuenta personal) y Manuela (nutricionista), igual que los avisos de Praxis.
  const puedeResponder = ocupaPuesto || sesion?.usuario.rol === 'nutricionista'
  const [verRespondidas, setVerRespondidas] = useState(false)

  if (estado.tipo === 'cargando' && pendientes.length === 0) return null
  if (pendientes.length === 0 && respondidas.length === 0 && estado.tipo === 'listo') return null

  const sinMigracion = estado.tipo === 'sin_tabla'

  return (
    <Card destacada aria-label="Preguntas de la cadena para el coach">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="kicker">Preguntas de la cadena para ti</p>
          <p className="mt-1 text-sm text-tenue">
            Lo que los agentes te dejaron sin resolver. Tu respuesta la lee la cadena en la siguiente tanda.
          </p>
        </div>
        <span className="cifras text-lg font-bold text-rojo" aria-label={`${pendientes.length} sin responder`}>
          {pendientes.length}
        </span>
      </div>

      {sinMigracion && (
        <p role="status" className="mt-2 rounded-lg border border-dashed border-linea px-3 py-2 text-[12.5px] text-tenue">
          Falta aplicar la migración 0110 para poder responder desde aquí. Las preguntas se ven igual.
        </p>
      )}
      {estado.tipo === 'error' && (
        <p role="alert" className="mt-2 rounded-lg border border-rojo px-3 py-2 text-[12.5px] text-texto">
          No se pudo saber cuáles ya respondiste ({estado.error}). Puede que alguna de abajo ya tenga respuesta.
        </p>
      )}
      {!puedeResponder && !sinMigracion && (
        <p className="mt-2 text-[12.5px] text-tenue">Solo el coach o la nutricionista responden estas preguntas.</p>
      )}

      {pendientes.length === 0 ? (
        <p className="mt-2.5 text-sm text-tenue">No hay preguntas de la cadena sin responder.</p>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-2" aria-label="Preguntas sin responder">
          {pendientes.map((p) => (
            <TarjetaPregunta
              key={p.id}
              pregunta={p}
              persona={nombreDe(p.usuarioId)}
              puedeResponder={puedeResponder && !sinMigracion}
              onRespondida={onRespondida}
              onVerPersona={onVerPersona}
            />
          ))}
        </ul>
      )}

      {respondidas.length > 0 && (
        <div className="mt-2.5 border-t border-linea pt-2">
          <button
            type="button"
            aria-expanded={verRespondidas}
            onClick={() => setVerRespondidas((v) => !v)}
            className="press min-h-[32px] text-[12px] font-bold text-tenue underline underline-offset-2 hover:text-texto"
          >
            {verRespondidas ? 'ocultar respondidas' : `ver respondidas (${respondidas.length})`}
          </button>
          {verRespondidas && (
            <ul className="mt-1.5 flex flex-col gap-1.5" aria-label="Preguntas respondidas">
              {respondidas.map((r) => (
                <li key={r.idPregunta} className="rounded-lg border border-linea bg-surface-2 p-2 text-[12.5px]">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-tenue">
                    {nombreDe(r.usuarioId)} · {NOMBRE_PASO[r.paso] ?? `paso ${r.paso}`}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-tenue">{r.texto}</p>
                  <p className="mt-1 whitespace-pre-wrap text-texto">
                    <span className="font-bold">Respuesta:</span> {r.respuesta}
                  </p>
                  <p className="mt-0.5 text-[11px] text-tenue">
                    {r.quien} · {fechaCorta(r.respondidoEn)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

interface TarjetaProps {
  pregunta: PreguntaDeLaCadena
  persona: string
  puedeResponder: boolean
  onRespondida: (r: RespuestaCoach) => void
  onVerPersona?: (usuarioId: string) => void
}

function TarjetaPregunta({ pregunta, persona, puedeResponder, onRespondida, onVerPersona }: TarjetaProps) {
  const [opcion, setOpcion] = useState<string | null>(null)
  const [libre, setLibre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const respuesta = textoDeRespuesta(opcion, libre)

  const guardar = async () => {
    if (!respuesta) return
    setEnviando(true)
    setError(null)
    const r = await responderPreguntaCoach({
      idPregunta: pregunta.id,
      usuarioId: pregunta.usuarioId,
      paso: pregunta.paso,
      texto: pregunta.texto,
      respuesta,
    })
    setEnviando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    onRespondida({
      idPregunta: pregunta.id,
      usuarioId: pregunta.usuarioId,
      paso: pregunta.paso,
      texto: pregunta.texto,
      respuesta,
      // Quién y cuándo los pone la base; esto es solo lo que se ve hasta la próxima lectura.
      respondidoPor: null,
      quien: 'tú',
      respondidoEn: new Date().toISOString(),
    })
  }

  return (
    <li className="rounded-lg border border-linea bg-surface-2 p-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {onVerPersona ? (
          <button
            type="button"
            className="text-[11px] font-bold uppercase tracking-wide text-texto hover:text-rojo"
            onClick={() => onVerPersona(pregunta.usuarioId)}
          >
            {persona}
          </button>
        ) : (
          <span className="text-[11px] font-bold uppercase tracking-wide text-texto">{persona}</span>
        )}
        <Badge tono="azul">{NOMBRE_PASO[pregunta.paso] ?? `paso ${pregunta.paso}`}</Badge>
        <span className="cifras ml-auto text-[11px] text-tenue">{fechaCorta(pregunta.fecha)}</span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-texto/90">{pregunta.texto}</p>

      {puedeResponder && (
        <div className="mt-2 flex flex-col gap-2">
          {pregunta.opciones && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Opciones de respuesta">
              {pregunta.opciones.map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={opcion === o}
                  disabled={enviando}
                  onClick={() => setOpcion(opcion === o ? null : o)}
                  className={`tecla-3d rounded-lg border px-3 py-1.5 text-left text-xs font-bold ${
                    opcion === o ? 'border-verde/60 bg-verde/20 text-verde' : 'border-linea bg-surface-1 text-texto'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          <label className="flex flex-col gap-1 text-[11px] text-tenue">
            {pregunta.opciones ? 'Otra respuesta, o un matiz (opcional)' : 'Tu respuesta'}
            <textarea
              value={libre}
              onChange={(e) => setLibre(e.target.value)}
              rows={2}
              maxLength={2000}
              disabled={enviando}
              className="rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={enviando || respuesta.length === 0}
              aria-label={`Guardar la respuesta sobre ${persona}`}
              onClick={guardar}
              className="tecla-3d rounded-lg border border-verde/50 bg-verde/15 px-3 py-1.5 text-xs font-bold text-verde disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enviando ? 'Guardando…' : 'Guardar respuesta'}
            </button>
            {error && (
              <span role="alert" className="text-[12px] text-rojo">
                No se guardó: {error}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
