import { useEffect, useState } from 'react'
import { urlFirmada } from '../../data/nube/adjuntos'
import { modoNube } from '../../data/supabase'

interface AdjuntoMensajeProps {
  path: string | undefined
  tipo: 'imagen' | 'video' | undefined
  estado: 'subiendo' | 'listo' | undefined
}

/**
 * La foto o el video dentro de la burbuja del mensaje.
 *
 * El bucket es privado, así que no hay URL fija que guardar: se firma al pintar
 * y se deja caducar. Una URL pública de Storage sería un enlace permanente a la
 * foto del cuerpo de alguien.
 */
export function AdjuntoMensaje({ path, tipo, estado }: AdjuntoMensajeProps) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (!path || !modoNube || estado === 'subiendo') return
    let vigente = true
    void urlFirmada(path).then((u) => {
      if (vigente) setUrl(u)
    })
    return () => {
      vigente = false
    }
  }, [path, estado])

  if (!path || !tipo) return null

  if (estado === 'subiendo') {
    return (
      <p className="cifras mb-1.5 text-[11px] opacity-80">
        {tipo === 'video' ? 'Video' : 'Foto'} subiendo…
      </p>
    )
  }

  if (!url) return <p className="cifras mb-1.5 text-[11px] opacity-60">Cargando…</p>

  return tipo === 'video' ? (
    <video src={url} controls className="mb-1.5 max-h-72 w-full rounded-tarjeta" />
  ) : (
    <img
      src={url}
      alt="Adjunto del mensaje"
      className="mb-1.5 max-h-72 w-full rounded-tarjeta object-cover"
    />
  )
}
