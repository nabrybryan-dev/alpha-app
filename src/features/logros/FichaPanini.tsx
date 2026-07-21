import { useRef } from 'react'
import type { AsesoradoDestacado } from './asesoradosDestacados'

const MAX_DEG = 12

function reduceMovimiento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Ficha coleccionable estilo Panini: se inclina en 3D siguiendo el dedo/cursor
 * y tiene un brillo holográfico que se desplaza. Solo transform/opacity, y sin
 * inclinación si el usuario pidió menos movimiento.
 */
export function FichaPanini({ ficha }: { ficha: AsesoradoDestacado }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const foilRef = useRef<HTMLDivElement>(null)

  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el || reduceMovimiento()) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.transform = `rotateX(${-(py - 0.5) * 2 * MAX_DEG}deg) rotateY(${(px - 0.5) * 2 * MAX_DEG}deg)`
    // el brillo se mueve en sentido contrario, como un foil real
    if (foilRef.current) {
      foilRef.current.style.backgroundPosition = `${(1 - px) * 100}% ${(1 - py) * 100}%`
    }
  }

  const reset = () => {
    if (cardRef.current) cardRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)'
  }

  return (
    <div className="shrink-0 [perspective:900px]" style={{ width: '15rem' }}>
      <div
        ref={cardRef}
        onPointerMove={mover}
        onPointerLeave={reset}
        onPointerCancel={reset}
        className="ficha-3d relative aspect-[3/4] overflow-hidden rounded-2xl border border-hairline-fuerte bg-surface-2 shadow-xl"
      >
        {ficha.foto ? (
          <img
            src={ficha.foto}
            alt={ficha.nombre}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: ficha.fotoPos ?? 'center' }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-surface-3 text-tenue">
            <span className="text-4xl font-display">{ficha.nombre.slice(0, 1)}</span>
          </div>
        )}

        {/* Brillo holográfico */}
        <div ref={foilRef} className="ficha-foil absolute inset-0" aria-hidden="true" />

        {/* Cabecera: superpoder como "rareza" de la carta */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2.5">
          <span className="rounded-full bg-rojo px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow">
            {ficha.superpoder}
          </span>
          {ficha.aniosEntrenando !== undefined && (
            <span className="cifras rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
              {ficha.aniosEntrenando} años
            </span>
          )}
        </div>

        {/* Pie: nombre, rol, historia y frase sobre degradado */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/70 to-transparent p-3 pt-10 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">{ficha.rol}</p>
          <h3 className="font-display text-xl leading-none">{ficha.nombre}</h3>
          <p className="mt-1.5 text-[11px] leading-snug text-white/85">{ficha.historia}</p>
          <p className="mt-2 border-t border-white/20 pt-1.5 font-display text-xs italic text-white/90">
            “{ficha.frase}”
          </p>
        </div>
      </div>
    </div>
  )
}
