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
      // `scrim-entra`: el velo aparecía DE GOLPE mientras la tarjeta de dentro
      // entraba en 480 ms, así que se veía el corte —la capa oscura llegaba antes
      // que su contenido—. Su hermano de la misma pantalla, el del test post, ya se
      // fundía con esta misma clase. Son 320 ms con `--ease-salida` y trae su propia
      // rama de movimiento reducido.
      className="scrim-entra fixed inset-0 flex items-center justify-center px-8"
      // Sin `backdropFilter`. Era superficie fija, así que la regla del blur lo
      // permitía, pero faltaba la otra mitad: este overlay no bloquea el scroll del
      // documento de debajo, y en cuanto el fondo se mueve hay que recalcular el
      // desenfoque de TODO el viewport por fotograma. El corte es a pantalla completa
      // a propósito —existe para que nadie siga registrando series del ejercicio
      // equivocado—, o sea que no necesita que se vea el fondo: el velo sube a opaco.
      style={{ background: 'var(--ink-900)', zIndex: 'var(--z-scrim)' }}
      role="dialog"
      aria-label="Ejercicio completado"
    >
      <div
        className="entrada w-full max-w-sm rounded-bloque border border-ink-400 bg-ink-700 p-7 text-center"
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
