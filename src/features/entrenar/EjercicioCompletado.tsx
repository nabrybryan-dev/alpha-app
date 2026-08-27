import { CheckDibujado } from './CheckDibujado'

export interface ExCompletado {
  nombre: string
  series: number
  siguienteId?: string
  siguienteNombre?: string
}

/**
 * Corte entre ejercicios: confirma lo hecho y anuncia el siguiente.
 *
 * Es a pantalla completa a propósito. Al terminar un ejercicio no hay descanso
 * pautado, y sin un corte visible el asesorado seguía registrando series del
 * ejercicio equivocado.
 */
export function EjercicioCompletado({ ex, onSeguir }: { ex: ExCompletado; onSeguir: () => void }) {
  return (
    <div
      className="scrim-entra fixed inset-0 z-50 flex items-center justify-center px-8 [perspective:900px]"
      style={{ background: 'rgba(8, 9, 10, 0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-label="Ejercicio completado"
    >
      {/* El velo funde con `.scrim-entra` en vez de aparecer de golpe: la capa
          oscura llegaba antes que su contenido. Es lo que ya hace el test post,
          que es su hermano de esta misma pantalla. */}
      <div
        className="corte-entra w-full max-w-sm rounded-bloque border border-ink-400 bg-ink-700 p-7 text-center [transform-style:preserve-3d]"
        style={{ boxShadow: 'var(--inset-top-light)' }}
      >
        <span className="latido mx-auto grid h-[68px] w-[68px] place-items-center rounded-full bg-logrado">
          <CheckDibujado className="h-9 w-9 text-ink-900" />
        </span>
        <h3 className="mt-4 font-display text-2xl text-silver-100">Ejercicio completado</h3>
        <p className="mt-2 text-sm text-silver-400">
          {ex.nombre} — {ex.series} series registradas
        </p>
        {ex.siguienteNombre && (
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-accion">
            A continuación: <span className="text-silver-200">{ex.siguienteNombre}</span>
          </p>
        )}
        <button
          type="button"
          onClick={onSeguir}
          className="press mt-5 w-full rounded-boton bg-accion py-3.5 font-display text-base uppercase tracking-wide text-white"
          style={{ boxShadow: 'var(--glow-accion)' }}
        >
          {ex.siguienteId ? 'Siguiente ejercicio' : 'Seguir'}
        </button>
      </div>
    </div>
  )
}
