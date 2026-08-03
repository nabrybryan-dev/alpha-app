import { Link } from 'react-router-dom'
import { STICKERS_TOTALES, type StickerAlbum } from '../../data/contenido/albumAlfa'

/**
 * Marco metálico: el degradado va en el contenedor y el interior oscuro se
 * apoya encima con 4 px de padding, que es lo que deja ver el "metal".
 */
function Sticker({ sticker }: { sticker: StickerAlbum }) {
  return (
    <Link
      to="/logros"
      className="press block min-w-0 rounded-2xl p-1 shadow-md"
      style={{ backgroundImage: 'var(--metal-grad)' }}
    >
      <span className="block overflow-hidden rounded-[13px] bg-ink-800">
        <span className="relative block h-[122px] bg-ink-700">
          <img
            src={sticker.foto}
            alt={sticker.nombre}
            loading="lazy"
            className="h-full w-full object-cover"
            style={{ objectPosition: sticker.fotoPos ?? 'center' }}
          />
          <span className="cifras absolute left-2 top-2 rounded-tag bg-accion px-1.5 py-0.5 text-[10.5px] font-bold text-white">
            {sticker.numero}
          </span>
          {/* El velo al 60% desaparecía sobre cielos y pieles claras: la
              categoría solo se leía en las fotos oscuras. Con 78% y desenfoque
              la píldora se sostiene sola, sea cual sea la foto que toque. */}
          <span className="absolute right-2 top-2 rounded-full border border-white/25 bg-ink-900/[0.78] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-sm">
            {sticker.categoria}
          </span>
        </span>
        <span className="block px-3 pb-3 pt-2.5">
          <span className="block font-display text-sm leading-tight text-silver-100">
            {sticker.nombre}
          </span>
          <span className="cifras mt-1.5 block text-[10.5px] font-bold text-accion">
            {sticker.detalle}
          </span>
          <span className="mt-1.5 block text-[11.5px] leading-relaxed text-silver-400">
            {sticker.frase}
          </span>
        </span>
      </span>
    </Link>
  )
}

/** Rejilla 2×2 de fichas coleccionables. Cada una abre su historia en Logros. */
export function AlbumAlfa({ stickers }: { stickers: readonly StickerAlbum[] }) {
  if (stickers.length === 0) return null

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-2.5">
        <h2 className="font-display text-[17px] text-texto">Álbum Alfa</h2>
        <span className="cifras text-[11px] font-bold text-tenue">
          {String(stickers.length).padStart(2, '0')} / {STICKERS_TOTALES}
        </span>
      </div>
      <p className="mb-3 text-[12.5px] leading-relaxed text-tenue">
        Historias reales de asesorados que ya recorrieron la ruta. Colecciónalas: cada mesociclo se
        libera una nueva.
      </p>
      <div className="grid grid-cols-2 gap-[11px]">
        {stickers.map((s) => (
          <Sticker key={s.id} sticker={s} />
        ))}
      </div>
    </section>
  )
}
