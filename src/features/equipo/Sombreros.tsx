import {
  NOMBRE_SOMBRERO,
  SOMBREROS,
  type FiltroSombrero,
} from '../../domain/equipo/sombreros'
import { ponerFiltro, useFiltroSombrero } from './filtroSombreros'

/**
 * Los chips «Todo · Entreno · Nutrición · Administración» (maqueta 7): el mismo trabajo de
 * los tres sombreros, visto junto o de a uno. El rojo NO se usa aquí: nada de esto pide
 * atención por sí mismo; lo que pide atención es una fila concreta.
 *
 * La cifra es la de pendientes REALES que la pantalla sepa contar. Cuando una pantalla no
 * tiene un dato honesto que poner, no pasa `cuenta` y los chips salen sin número: mejor sin
 * cifra que con una inventada.
 */
export function Sombreros({ cuenta }: { cuenta?: Record<FiltroSombrero, number> }) {
  const filtro = useFiltroSombrero()
  return (
    <div
      role="group"
      aria-label="Ver por sombrero"
      className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]"
    >
      {SOMBREROS.map((s) => {
        const puesto = filtro === s
        const nombre = NOMBRE_SOMBRERO[s]
        const n = cuenta?.[s]
        return (
          <button
            key={s}
            type="button"
            aria-pressed={puesto}
            aria-label={n === undefined ? nombre : `${nombre}, ${n} pendientes`}
            onClick={() => ponerFiltro(s)}
            className={`press flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold ${
              puesto
                ? 'border-texto bg-surface-3 text-texto'
                : 'border-linea bg-surface-1 text-tenue'
            }`}
          >
            <span>{nombre}</span>
            {n !== undefined && (
              <>
                {' '}
                <span className="cifras text-[11px] tabular-nums" aria-hidden="true">
                  {n}
                </span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
