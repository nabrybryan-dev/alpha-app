import type { Contenido } from '../../domain/types'
import { esVideoDirecto } from '../../lib/videoDirecto'
import { idDeYoutube } from '../../lib/youtube'

export function VisorContenido({ contenido }: { contenido: Contenido }) {
  const videoId = contenido.tipo === 'video' ? idDeYoutube(contenido.url) : undefined
  const directo = contenido.tipo === 'video' && esVideoDirecto(contenido.url)

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
      ) : directo ? (
        // `playsInline` es lo que evita que el iPhone se lleve el vídeo a pantalla
        // completa al tocarlo; `preload="metadata"` trae la duración y el primer
        // fotograma sin descargar los megas hasta que la persona le da al play.
        <video
          src={contenido.url}
          title={contenido.titulo}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-xl border border-linea bg-black"
        />
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
