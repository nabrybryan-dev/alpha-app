import { ejercicioCompleto } from '../../domain/cumplimiento'
import type { EjercicioPrescrito } from '../../domain/types'

interface NavegadorProps {
  ejercicios: EjercicioPrescrito[]
  /** Índice del ejercicio en pantalla. */
  exIdx: number
  onIr: (idx: number) => void
}

/**
 * Barra segmentada: un tramo por ejercicio (rojo = hecho, plata = en curso,
 * ink = pendiente). Tocar un tramo salta a ese ejercicio.
 *
 * Existe porque la pantalla muestra **un ejercicio a la vez**: sin esta barra el
 * asesorado no sabría cuánto le queda ni podría volver a uno anterior.
 */
export function BarraEjercicios({ ejercicios, exIdx, onIr }: NavegadorProps) {
  return (
    <div className="entrada entrada-4 -mt-2 flex gap-1.5">
      {ejercicios.map((ej, idx) => {
        const hecho = ejercicioCompleto(ej)
        const enCurso = !hecho && ej.series.length > 0
        const actual = idx === exIdx
        return (
          <button
            key={ej.id}
            type="button"
            aria-label={`Ir a ${ej.nombre}`}
            onClick={() => onIr(idx)}
            // La escena va en el BOTON, que es el padre directo del tramo. El boton
            // se queda en el plano —es la zona tocable— y lo que se hunde es el
            // tramo de dentro, que no lo es.
            className="escena-prof press flex-1 py-1.5"
          >
            {/* Lo que falta se HUNDE, lo hecho se queda en el plano: es el mismo
                argumento del carril de una barra —lo pendiente es materia que
                falta— y dice el avance con volumen además de con color, que es lo
                que la marca pide en vez de un semáforo. */}
            <span
              className={`block h-1.5 rounded-full transition-colors duration-toque ease-salida ${
                hecho ? 'bg-accion' : enCurso ? 'bg-logrado' : 'bg-ink-500'
              } ${actual ? 'ring-2 ring-accion/50' : ''}`}
              style={{ transform: `translateZ(var(${hecho ? '--prof-plano' : '--prof-hueco'}))` }}
            />
          </button>
        )
      })}
    </div>
  )
}

/** Ejercicios pendientes que vienen después del actual. Tocar uno salta a él. */
export function ProximosEjercicios({ ejercicios, exIdx, onIr }: NavegadorProps) {
  const proximos = ejercicios
    .map((e, idx) => ({ e, idx }))
    .filter(({ e, idx }) => idx > exIdx && !ejercicioCompleto(e))

  if (proximos.length === 0) return null

  return (
    <div className="entrada">
      <p className="kicker mb-2">A continuación</p>
      <ul className="flex flex-col gap-2">
        {proximos.map(({ e, idx }) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onIr(idx)}
              // La escena en el boton, que es el padre directo del troquel. La
              // TARJETA se queda en el plano y no se hunde con el resto: es la zona
              // tocable, y la escala prohíbe bajar del plano cualquier cosa que se
              // toque —hundir encoge, y encoger una diana la acerca al mínimo—.
              className="escena-prof press flex w-full items-center gap-3 rounded-tarjeta border border-ink-500 bg-ink-800 px-3.5 py-3 text-left"
            >
              {/* El número del ejercicio, troquelado en la tarjeta: es un dato que
                  se lee, no un botón. `--prof-hueco` es literalmente «cifras,
                  troqueles, notas al pie». */}
              <span
                className="cifras grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-600 text-sm font-bold text-silver-400"
                style={{
                  transform: 'translateZ(var(--prof-hueco))',
                  boxShadow: 'var(--sombra-hundido)',
                }}
              >
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-silver-200">{e.nombre}</span>
                <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-silver-500">
                  {e.categoria}
                </span>
              </span>
              <span className="cifras shrink-0 text-xs text-silver-500">
                {e.sets}×{e.rango.replace(/[()]/g, '')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
