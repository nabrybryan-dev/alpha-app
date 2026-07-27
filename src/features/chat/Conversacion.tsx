import { useEffect, useRef, useState } from 'react'
import { db, idCoach, useDbVersion } from '../../data/dbInstance'
import { sesionDeFunciones } from '../../data/supabase'
import { pedirRespuestaAlpha } from './asistente'

interface ConversacionProps {
  yoId: string
  otroId: string
}

function horaDe(fechaIso: string): string {
  const fecha = new Date(fechaIso)
  return `${fecha.getDate()}/${fecha.getMonth() + 1} ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`
}

export function Conversacion({ yoId, otroId }: ConversacionProps) {
  useDbVersion()
  const [texto, setTexto] = useState('')
  const [adjunto, setAdjunto] = useState('')
  const [esperandoAlpha, setEsperandoAlpha] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)
  const montadoRef = useRef(true)

  const hilo = db.mensajes.hilo(yoId, otroId)

  // Alpha solo contesta cuando el asesorado le escribe a SU coach. Esta misma
  // pantalla la usa el coach desde su bandeja: si quien escribe es staff, no se
  // llama a nada.
  const respondeAlpha = db.usuarios.byId(yoId)?.rol === 'asesorado' && otroId === idCoach()

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  useEffect(() => {
    db.mensajes.marcarLeidos(yoId, otroId)
  }, [yoId, otroId, hilo.length])

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [hilo.length, esperandoAlpha])

  /**
   * Pide la respuesta del Centro de Respuestas y la mete en el hilo.
   *
   * Nunca lanza ni avisa de un fallo: cuando llega aquí el mensaje del
   * asesorado ya salió hacia el coach, así que si Alpha no contesta lo correcto
   * es que no pase nada visible y el chat siga como siempre.
   */
  const consultarAlpha = async (mensaje: string) => {
    setEsperandoAlpha(true)
    try {
      const respuesta = await pedirRespuestaAlpha(mensaje, await sesionDeFunciones())
      if (respuesta) {
        db.mensajes.enviar({ deId: otroId, paraId: yoId, texto: respuesta, origen: 'alpha' })
      }
    } finally {
      if (montadoRef.current) setEsperandoAlpha(false)
    }
  }

  const enviar = () => {
    const limpio = texto.trim()
    if (!limpio && !adjunto) return
    // El mensaje del asesorado se envía SIEMPRE primero. La respuesta de Alpha
    // es un extra que llega después y no condiciona el envío.
    db.mensajes.enviar({
      deId: yoId,
      paraId: otroId,
      texto: limpio || `📎 ${adjunto}`,
      adjuntoUrl: adjunto || undefined,
    })
    setTexto('')
    setAdjunto('')
    if (limpio && respondeAlpha) void consultarAlpha(limpio)
  }

  return (
    <div className="flex h-[calc(100dvh-14rem)] flex-col">
      <div className="flex-1 overflow-y-auto pb-2">
        <div className="flex flex-col gap-2">
          {hilo.length > 0 && (
            <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-tenue">
              Conversación con tu coach
            </p>
          )}
          {hilo.map((mensaje) => {
            const mio = mensaje.deId === yoId
            // La respuesta automática se alinea por quien la firma (para no
            // romper los lados del hilo) pero NUNCA lleva el tratamiento de
            // persona: ni el acento rojo del propio, ni la superficie elevada
            // del coach. Va rotulada y en plano. El asesorado tiene que saber
            // de un vistazo si le habló una máquina o su coach, y el coach
            // tiene que ver cuál de esos mensajes no los escribió él.
            const deAlpha = mensaje.origen === 'alpha'
            const forma = mio
              ? 'self-end rounded-2xl rounded-br-md'
              : 'self-start rounded-2xl rounded-bl-md'
            const piel = deAlpha
              ? 'border border-linea bg-bg text-texto'
              : mio
                ? 'bg-accion text-white'
                : 'border border-linea bg-surface-1 text-texto shadow-sm'
            return (
              <div
                key={mensaje.id}
                className={`entrada max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed ${forma} ${piel}`}
              >
                {deAlpha && (
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-tenue">
                    Alpha · respuesta automática
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{mensaje.texto}</p>
                <p
                  className={`cifras mt-1 text-[10px] ${mio && !deAlpha ? 'text-white/70' : 'text-tenue'}`}
                >
                  {horaDe(mensaje.fechaIso)}
                </p>
              </div>
            )
          })}
          {esperandoAlpha && (
            <p className="animate-pulse self-start px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-tenue">
              Alpha está leyendo…
            </p>
          )}
          <div ref={finRef} />
        </div>
      </div>

      {adjunto && (
        <p className="mb-1 flex items-center gap-2 rounded-boton border border-linea bg-surface-1 px-3 py-1.5 text-xs text-tenue">
          <span className="truncate">📎 {adjunto} (adjunto simulado en etapa 1)</span>
          <button type="button" className="ml-auto font-bold text-accion" onClick={() => setAdjunto('')}>
            quitar
          </button>
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-linea pt-2.5">
        <input ref={inputArchivo} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setAdjunto(e.target.files?.[0]?.name ?? '')} />
        <button
          type="button"
          aria-label="Adjuntar foto o video"
          onClick={() => inputArchivo.current?.click()}
          className="press grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-linea bg-surface-1 text-tenue"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
            <path d="M5 12h14 M12 5v14" />
          </svg>
        </button>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              enviar()
            }
          }}
          rows={1}
          placeholder="Escribe un mensaje…"
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-linea bg-surface-1 px-4 py-2.5 text-sm text-texto shadow-sm transition-colors duration-200 ease-salida placeholder:text-tenue focus:border-accion focus:outline-none"
        />
        <button
          type="button"
          onClick={enviar}
          aria-label="Enviar mensaje"
          className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accion text-white"
          style={{ boxShadow: 'var(--glow-accion)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="m5 12 7-7 7 7 M12 19V5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
