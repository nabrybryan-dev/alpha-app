import type { Contenido } from '../../domain/types'

function idDeYoutube(url: string): string | undefined {
  const patron = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/
  return patron.exec(url)?.[1]
}

export function VisorContenido({ contenido }: { contenido: Contenido }) {
  const videoId = contenido.tipo === 'video' ? idDeYoutube(contenido.url) : undefined

  return (
    <div className="flex flex-col gap-3">
      {contenido.patronMovimiento && (
        <p className="kicker">{contenido.patronMovimiento}</p>
      )}
      {videoId ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-linea">
          <iframe
            title={contenido.titulo}
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            className="h-full w-full"
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : contenido.tipo === 'imagen' && contenido.url ? (
        <img
          src={contenido.url}
          alt={contenido.titulo}
          className="w-full rounded-xl border border-linea"
          loading="lazy"
        />
      ) : null}
      <p className="text-sm leading-relaxed text-texto">{contenido.descripcion}</p>
      {contenido.url && !videoId && contenido.tipo === 'video' && (
        <a href={contenido.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-azul">
          Abrir video →
        </a>
      )}
    </div>
  )
}
