import { useCallback, useId, useState } from 'react'
import { FalloDeLectura } from '../../../components/ui/FalloDeLectura'
import { useLectura } from '../../../components/ui/useLectura'
import { comentarHallazgo, esTablaAusente0103, hallazgosDeMercadeo, TEXTO_PENDIENTE_0103 } from '../../../data/consola/mercadeoHallazgos'
import {
  MAX_COMENTARIO,
  NOMBRE_AUTOR,
  NOMBRE_ESTADO_HALLAZGO_M,
  NOMBRE_TIPO_HALLAZGO,
  agruparPorTipo,
  comentariosSinRespuesta,
  faltaParaComentar,
  type HallazgoMercadeo,
} from '../../../domain/hallazgosMercadeo'
import { Cargando, CLASE_BOTON_CHICO, CLASE_ETIQUETA } from '../../plan/comun'
import { TarjetaPlegable } from './TarjetaPlegable'

/**
 * Investigación del agente de mercadeo con la que Manuela INTERACTÚA (pedido de Bryan, 29-sep;
 * migración 0103). Los hallazgos salen agrupados de lo macro a lo micro (tendencias, estructura,
 * loops, hooks, ganchos visuales). Al tocar uno se ve su fuente, su estado y el hilo: Manuela o
 * Bryan comentan; el agente responde y lo fortalece (esa respuesta la escribe el servidor, no
 * esta pantalla). Sin la tabla: «Pendiente de activar». Sin hallazgos: vacío confirmado, con
 * quién los trae. Un fallo de lectura se dice como fallo, con «Reintentar».
 */

const CLASE_CAMPO = 'min-h-[44px] w-full rounded-xl border border-linea bg-bg px-3 text-sm text-texto placeholder:text-tenue'

const fechaCorta = (iso: string) => iso.slice(0, 10)

function FormularioComentario({ hallazgo, onListo }: { hallazgo: HallazgoMercadeo; onListo: () => void }) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async () => {
    const falta = faltaParaComentar(texto)
    if (falta) {
      setError(falta)
      return
    }
    setEnviando(true)
    setError(null)
    const r = await comentarHallazgo(hallazgo.id, texto.trim())
    setEnviando(false)
    if (!r.ok) {
      // Lo escrito se conserva: no hay que volver a redactarlo.
      setError(r.error)
      return
    }
    setTexto('')
    onListo()
  }

  return (
    <form
      aria-label={`Comentar ${hallazgo.codigo}`}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void enviar()
      }}
    >
      <label htmlFor={id} className="flex flex-col gap-1 text-xs text-tenue">
        Tu comentario para el agente
        <textarea id={id} rows={3} maxLength={MAX_COMENTARIO} value={texto} onChange={(e) => setTexto(e.target.value)} className={`${CLASE_CAMPO} py-2`} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-rojo">
          No se envió: {error}
        </p>
      )}
      <div>
        <button type="submit" disabled={enviando} className={`${CLASE_BOTON_CHICO} border-texto`}>
          {enviando ? 'Enviando…' : 'Comentar'}
        </button>
      </div>
    </form>
  )
}

function FilaHallazgo({ h, onCambio }: { h: HallazgoMercadeo; onCambio: () => void }) {
  const [abierta, setAbierta] = useState(false)
  const idCuerpo = useId()
  const pendientes = comentariosSinRespuesta(h).length
  return (
    <li className="rounded-md border border-linea bg-surface-2">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        onClick={() => setAbierta((a) => !a)}
        className="press flex min-h-[48px] w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold text-texto">{h.titulo}</span>
          <span className="text-[11.5px] text-tenue">
            {h.codigo} · {NOMBRE_ESTADO_HALLAZGO_M[h.estado]}
            {pendientes > 0 ? ` · ${pendientes} sin respuesta` : ''}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-tenue">{abierta ? '▾' : '▸'}</span>
      </button>
      {abierta && (
        <div id={idCuerpo} className="flex flex-col gap-3 border-t border-linea px-3 py-2.5 text-[13px]">
          <p className="text-texto">{h.resumen}</p>
          <p className="text-[12.5px] text-tenue">
            <span className={CLASE_ETIQUETA}>Fuente</span>{' '}
            {h.fuenteNombre ?? 'FALTA: el agente no dijo de dónde salió.'}
            {h.fuenteFecha ? ` · ${fechaCorta(h.fuenteFecha)}` : ''}
            {h.fuenteUrl && (
              <>
                {' · '}
                <a href={h.fuenteUrl} target="_blank" rel="noreferrer noopener" className="underline">
                  Ver el original
                </a>
              </>
            )}
          </p>
          <div className="flex flex-col gap-2">
            <h5 className={CLASE_ETIQUETA}>Conversación con el agente</h5>
            {h.comentarios.length === 0 ? (
              <p className="text-[12.5px] text-tenue">Todavía nadie lo comentó. Tu comentario le llega al agente de mercadeo.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {h.comentarios.map((c) => (
                  <li
                    key={c.id}
                    className={`flex flex-col gap-0.5 rounded-md border p-2 ${c.autor === 'agente' ? 'border-linea bg-surface-1' : 'border-texto/30'}`}
                  >
                    <span className="text-[11.5px] font-bold text-tenue">
                      {NOMBRE_AUTOR[c.autor]} · {fechaCorta(c.creadoEn)}
                    </span>
                    <span className="text-[13px] text-texto">{c.texto}</span>
                  </li>
                ))}
              </ul>
            )}
            {pendientes > 0 && (
              <p className="text-[12px] text-tenue">El agente todavía no contestó {pendientes === 1 ? 'un comentario' : `${pendientes} comentarios`}.</p>
            )}
          </div>
          {h.estado === 'descartado' ? (
            <p className="text-[12.5px] text-tenue">Este hallazgo se descartó: ya no admite comentarios.</p>
          ) : (
            <FormularioComentario hallazgo={h} onListo={onCambio} />
          )}
        </div>
      )}
    </li>
  )
}

/** `puede`: quien mira tiene `responder_mercadeo` o es el coach; sin eso no se hace ni una consulta. */
export function InvestigacionInteractiva({ puede }: { puede: boolean }) {
  const leer = useCallback(() => hallazgosDeMercadeo(), [])
  const { lectura, reintentar } = useLectura(leer)
  // Al comentar se vuelve a leer: se conserva lo ya leído para que las filas abiertas no se cierren.
  const [ultimo, setUltimo] = useState<HallazgoMercadeo[] | null>(null)
  if (lectura?.ok && lectura.datos !== ultimo) setUltimo(lectura.datos)
  const datos = lectura?.ok ? lectura.datos : ultimo

  if (!puede) {
    return (
      <p className="text-sm text-tenue">
        La investigación se abre con el permiso de responder mercadeo, y todavía no lo tienes. Pídeselo al coach.
      </p>
    )
  }
  if (datos === null && lectura === null) return <Cargando texto="Cargando la investigación…" />
  if (datos === null && lectura !== null && !lectura.ok) {
    if (esTablaAusente0103(lectura.error)) {
      return <p className="text-sm font-bold text-tenue">{TEXTO_PENDIENTE_0103}</p>
    }
    return <FalloDeLectura texto={`No se pudo leer la investigación (${lectura.error}).`} onReintentar={reintentar} />
  }
  if (datos === null) return <Cargando texto="Cargando la investigación…" />
  if (datos.length === 0) {
    return (
      <p className="rounded-tarjeta border border-dashed border-linea p-3 text-sm text-tenue">
        FALTA: todavía el agente de mercadeo no ha cargado hallazgos. Los carga Bryan con el OK de revisión, y aquí aparecen para que los comentes.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-tenue">
        Cada hallazgo se puede comentar: el agente lee tu comentario, responde y fortalece el hallazgo. De lo general a lo concreto.
      </p>
      {agruparPorTipo(datos).map(({ tipo, hallazgos }) => (
        <TarjetaPlegable
          key={tipo}
          nombre={NOMBRE_TIPO_HALLAZGO[tipo]}
          frase={hallazgos.length === 0 ? 'FALTA: sin hallazgos de este tipo todavía.' : `${hallazgos.length} ${hallazgos.length === 1 ? 'hallazgo' : 'hallazgos'}`}
        >
          {hallazgos.length === 0 ? (
            <p className="text-sm text-tenue">El agente todavía no trajo hallazgos de este tipo.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {hallazgos.map((h) => (
                <FilaHallazgo key={h.id} h={h} onCambio={reintentar} />
              ))}
            </ul>
          )}
        </TarjetaPlegable>
      ))}
    </div>
  )
}
