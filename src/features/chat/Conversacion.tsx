import { useEffect, useRef, useState } from 'react'
import { db, useDbVersion } from '../../data/dbInstance'

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
  const finRef = useRef<HTMLDivElement>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  const hilo = db.mensajes.hilo(yoId, otroId)

  useEffect(() => {
    db.mensajes.marcarLeidos(yoId, otroId)
  }, [yoId, otroId, hilo.length])

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [hilo.length])

  const enviar = () => {
    const limpio = texto.trim()
    if (!limpio && !adjunto) return
    db.mensajes.enviar({
      deId: yoId,
      paraId: otroId,
      texto: limpio || `📎 ${adjunto}`,
      adjuntoUrl: adjunto || undefined,
    })
    setTexto('')
    setAdjunto('')
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
            return (
              <div
                key={mensaje.id}
                className={`entrada max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed ${
                  mio
                    ? 'self-end rounded-2xl rounded-br-md bg-accion text-white'
                    : 'self-start rounded-2xl rounded-bl-md border border-linea bg-surface-1 text-texto shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{mensaje.texto}</p>
                <p className={`cifras mt-1 text-[10px] ${mio ? 'text-white/70' : 'text-tenue'}`}>
                  {horaDe(mensaje.fechaIso)}
                </p>
              </div>
            )
          })}
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
