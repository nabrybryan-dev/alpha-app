import { useEffect, useRef, useState } from 'react'
import { leerResultados, reconocedor, TOMA_MAX_MS, type Reconocedor } from '../../../../components/ui/reconocedorDeVoz'

/**
 * EL MICRÓFONO DE LA GUÍA: un toque y habla; otro toque, o que termine de hablar, y se entrega lo dicho.
 *
 * En el gimnasio las manos no están libres, por eso es un toque y no mantener presionado. La app no toca el
 * audio: lo transcribe el navegador (Google en Android, Apple en iPhone) y aquí solo llega texto. Por eso no
 * se pinta sin permiso del salón ni donde el navegador no sabe escuchar.
 */

export interface BotonDeVozProps {
  /** Hace lo pedido y devuelve lo que Praxis contesta en pantalla. */
  alOir: (dicho: string) => string
}

const AVISO_MICROFONO = 'No puedo usar el micrófono. Revisa el permiso del navegador.'
const AVISO_RED = 'No te entendí: el reconocimiento de voz necesita internet.'
const AVISO_SILENCIO = 'No te oí. Toca y vuelve a hablar.'

export function BotonDeVoz({ alOir }: BotonDeVozProps) {
  const [oyendo, setOyendo] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const vivo = useRef<{ rec: Reconocedor; tope: number } | null>(null)
  const ultimo = useRef(alOir)
  useEffect(() => {
    ultimo.current = alOir
  })

  const apagar = (abortar: boolean) => {
    const v = vivo.current
    if (!v) return
    vivo.current = null
    window.clearTimeout(v.tope)
    v.rec.onresult = null
    v.rec.onerror = null
    v.rec.onend = null
    try {
      if (abortar) v.rec.abort()
    } catch {
      // Ya estaba cerrado: no hay nada más que apagar.
    }
  }
  useEffect(() => () => apagar(true), [])

  const Clase = reconocedor()
  if (!Clase) return null

  const escuchar = () => {
    const rec = new Clase()
    rec.lang = 'es-CO'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    let dicho = ''
    let aviso = ''
    const terminar = () => {
      apagar(false)
      setOyendo(false)
      if (dicho) setRespuesta(ultimo.current(dicho))
      else setRespuesta(aviso || AVISO_SILENCIO)
    }
    rec.onresult = (e) => {
      const { final, interino } = leerResultados(e)
      dicho = final || interino
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') aviso = AVISO_MICROFONO
      else if (e.error === 'network') aviso = AVISO_RED
    }
    rec.onend = terminar
    vivo.current = { rec, tope: window.setTimeout(() => rec.stop(), TOMA_MAX_MS) }
    setRespuesta('')
    setOyendo(true)
    try {
      rec.start()
    } catch {
      aviso = AVISO_MICROFONO
      terminar()
    }
  }

  return (
    <div
      data-no-orbita
      className="pointer-events-auto absolute flex flex-row-reverse items-center gap-2"
      style={{ right: 'max(8px, env(safe-area-inset-right, 0px))', top: '42%', transform: 'translateY(-50%)', zIndex: 'var(--z-superpuesto)', maxWidth: 'calc(100% - 16px)' }}
    >
      <button
        type="button"
        aria-pressed={oyendo}
        aria-label={oyendo ? 'Dejar de escuchar' : 'Darle una orden a Praxis con la voz'}
        onClick={() => (oyendo ? vivo.current?.rec.stop() : escuchar())}
        className="press tecla-2 !h-12 !min-h-12 !w-12 shrink-0 !rounded-full !p-0"
        style={{ color: oyendo ? 'var(--oro)' : 'var(--texto)', boxShadow: oyendo ? '0 0 0 2px var(--oro)' : undefined }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto h-[22px] w-[22px] fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
      <p
        role="status"
        className="min-w-0 rounded-xl px-3 py-2 text-[12px] font-semibold text-texto"
        hidden={!oyendo && !respuesta}
        style={{ background: 'rgb(var(--surface-1-rgb) / 0.92)', border: '1px solid rgb(var(--oro-rgb) / 0.55)' }}
      >
        {oyendo ? 'Te escucho…' : respuesta}
      </p>
    </div>
  )
}
