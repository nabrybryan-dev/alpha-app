import type { Contenido } from '../../domain/types'
import { idDeYoutube } from '../../lib/youtube'

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
      {/* El enlace va SIEMPRE que haya vídeo, no solo cuando no se pudo leer el
          id. Si el dueño del vídeo tiene el embebido desactivado, el iframe pinta
          «no disponible» y sin este enlace el asesorado se quedaba sin salida. */}
      {contenido.tipo === 'video' && contenido.url && (
        <a href={contenido.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-azul">
          {videoId ? 'Ver en YouTube →' : 'Abrir video →'}
        </a>
      )}
    </div>
  )
}
