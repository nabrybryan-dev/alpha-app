import type { NivelAlfa } from '../../../domain/rutaEntrenamiento'

/** "NIVEL 03 · RENDIMIENTO" + el distintivo cuadrado con el número. */
export function CabeceraNivel({ nivel }: { nivel: NivelAlfa }) {
  return (
    <header className="entrada entrada-1 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-silver-500">
          Tu ruta de entrenamiento
        </p>
        <h2 className="mt-1.5 font-display text-2xl leading-[1.05] text-silver-100">
          Nivel {nivel.numero} · {nivel.nombre}
        </h2>
      </div>
      <span
        aria-hidden="true"
        className="cifras grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[13px] border border-accion/40 text-[17px] font-bold text-accion"
        style={{ background: 'color-mix(in srgb, var(--accion) 14%, var(--ink-700))' }}
      >
        {nivel.numero}
      </span>
    </header>
  )
}
