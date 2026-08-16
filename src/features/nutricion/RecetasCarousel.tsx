import { useState } from 'react'
import type { Receta } from '../../data/recetas'
import { RecetaSheet } from './RecetaSheet'

/**
 * «Recetas que sí encajan»: virales de Instagram que el asesorado ya conoce y
 * que le tientan. En vez de prohibírselas, la app le dice la porción exacta que
 * sí entra en su plan de hoy. El coach hace de traductor.
 *
 * TODO: filtrar por objetivo y alergias del asesorado. Fase 1 sirve el mismo
 * feed a todos, en el orden del archivo.
 */

const COLOR_CATEGORIA: Record<Receta['categoria'], string> = {
  Postre: 'text-oro',
  Desayuno: 'text-ambar',
  Snack: 'text-accion',
  Almuerzo: 'text-azul',
  Cena: 'text-logrado',
}

export interface RecetasCarouselProps {
  recetas: Receta[]
  /** kcal restantes del día. Sin dato, la hoja omite esa línea. */
  kcalRestantes?: number
  onAgregar?: (receta: Receta) => void
}

export function RecetasCarousel({ recetas, kcalRestantes, onAgregar }: RecetasCarouselProps) {
  const [abierta, setAbierta] = useState<Receta | null>(null)

  // Sin recetas la sección entera no existe: ni estado vacío, ni hueco.
  if (recetas.length === 0) return null

  return (
    <section className="mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-texto">Recetas que sí encajan</h2>
        <span className="cifras shrink-0 text-[10.5px] text-tenue">{recetas.length} nuevas</span>
      </div>
      <p className="mt-0.5 text-[12.5px] leading-snug text-tenue">
        Virales de Instagram, revisadas por tu coach. Toca una y te decimos la porción exacta.
      </p>

      {/* Sangrado a los bordes para que las tarjetas se asomen fuera del padding. */}
      <div
        className="mt-2.5 flex gap-[11px] overflow-x-auto"
        style={{ margin: '10px -18px 0', padding: '0 18px', scrollSnapType: 'x proximity' }}
      >
        {recetas.map((receta) => (
          <TarjetaReceta key={receta.id} receta={receta} onAbrir={() => setAbierta(receta)} />
        ))}
      </div>

      {abierta && (
        <RecetaSheet
          receta={abierta}
          kcalRestantes={kcalRestantes}
          onCerrar={() => setAbierta(null)}
          onAgregar={
            onAgregar &&
            ((receta) => {
              onAgregar(receta)
              setAbierta(null)
            })
          }
        />
      )}
    </section>
  )
}

function TarjetaReceta({ receta, onAbrir }: { receta: Receta; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      style={{ scrollSnapAlign: 'start' }}
      className="press w-[132px] shrink-0 overflow-hidden rounded-[15px] border border-linea bg-surface-2 text-left transition-transform duration-200 hover:-translate-y-0.5"
    >
      <span className="relative block h-[176px] w-full">
        <img src={receta.media.thumbnail} alt="" className="h-full w-full object-cover" />
        {/* Protección de tinta: el texto se lee sobre cualquier imagen. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(8,9,10,.88))' }}
        />
        <span className="cifras absolute right-1.5 top-1.5 rounded-full bg-ink-900/80 px-1.5 py-0.5 text-[9.5px] font-bold text-silver-100">
          {receta.ajuste.kcal} kcal
        </span>
        <span
          className={`absolute left-1.5 top-1.5 rounded-full bg-ink-900/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${COLOR_CATEGORIA[receta.categoria]}`}
        >
          {receta.categoria}
        </span>
        <span className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink-900/70 text-silver-100">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3 w-3">
            <path d="m8 5 11 7-11 7Z" />
          </svg>
        </span>
      </span>
      <span className="block px-2 pb-2 pt-1.5">
        <span className="cifras block text-[9px] font-bold tracking-[0.06em] text-accion">{receta.handle}</span>
        <span className="mt-0.5 line-clamp-2 block text-[11.5px] font-bold leading-tight text-texto [text-wrap:pretty]">
          {receta.nombre}
        </span>
      </span>
    </button>
  )
}
