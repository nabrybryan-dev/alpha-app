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
          {hilo.map((mensaje) => {
            const mio = mensaje.deId === yoId
            return (
              <div
                key={mensaje.id}
                className={`entrada max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  mio
                    ? 'self-end rounded-br-sm border-l-2 border-rojo bg-rojo/10 text-texto'
                    : 'glass self-start rounded-bl-sm text-texto'
                }`}
              >
                <p>{mensaje.texto}</p>
                <p className={`mt-1 text-[10px] ${mio ? 'text-texto/60' : 'text-tenue'}`}>
                  {horaDe(mensaje.fechaIso)}
                </p>
              </div>
            )
          })}
          <div ref={finRef} />
        </div>
      </div>

      {adjunto && (
        <p className="mb-1 rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-tenue">
          📎 {adjunto} (adjunto simulado en etapa 1)
          <button type="button" className="ml-2 font-bold text-rojo" onClick={() => setAdjunto('')}>
            quitar
          </button>
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-hairline pt-2">
        <input ref={inputArchivo} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setAdjunto(e.target.files?.[0]?.name ?? '')} />
        <button
          type="button"
          aria-label="Adjuntar foto o video"
          onClick={() => inputArchivo.current?.click()}
          className="press glass grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg"
        >
          📎
        </button>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={1}
          placeholder="Transmitir mensaje…"
          className="glass max-h-28 min-h-11 flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm text-texto transition-colors duration-200 ease-salida placeholder:text-[11px] placeholder:font-bold placeholder:uppercase placeholder:tracking-[0.18em] placeholder:text-tenue focus:border-rojo focus:outline-none"
        />
        <button
          type="button"
          onClick={enviar}
          aria-label="Enviar mensaje"
          className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rojo text-lg text-white"
        >
          ➤
        </button>
      </div>
    </div>
  )
}
