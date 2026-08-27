import type { MiniEstadistica, NivelAlfa } from '../../../domain/rutaEntrenamiento'

interface Props {
  pct: number
  nivelActual: NivelAlfa
  siguienteNivel?: NivelAlfa
  estadisticas: readonly MiniEstadistica[]
}

function nombreBonito(nombre: string): string {
  return nombre.charAt(0) + nombre.slice(1).toLowerCase()
}

/** Cuánto le falta para el siguiente nivel, con las tres cifras que lo sostienen. */
export function TarjetaProgresoNivel({ pct, nivelActual, siguienteNivel, estadisticas }: Props) {
  const seguro = Math.max(0, Math.min(100, Math.round(pct)))

  return (
    <section className="rounded-[18px] border border-ink-500 bg-ink-700 p-4 shadow-brillo">
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-silver-500">
          {siguienteNivel ? `Progreso al nivel ${siguienteNivel.numero}` : 'Nivel máximo alcanzado'}
        </h3>
        <span className="cifras text-[15px] font-bold text-accion">{seguro}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={seguro}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          siguienteNivel ? `Progreso al nivel ${siguienteNivel.numero}` : 'Progreso de nivel'
        }
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink-500"
        // El halo se ha movido del relleno AL CARRIL. Estaba sobre el elemento que
        // recorre, así que había que volver a rasterizar un anillo de 3 px más una
        // sombra de 24 px en cada fotograma del recorrido; y una sombra sobre algo
        // que escala se deforma con él. En el carril es estable y no se repinta.
        style={{ boxShadow: 'var(--glow-accion)' }}
      >
        {/* `scaleX` y no `width`. Es la barra más grande de la Ruta y comparte
            pantalla con el scrub del lienzo cinemático: animar maquetación aquí
            hacía que las dos cosas se pelearan por el hilo principal. */}
        <span
          className="block h-full w-full origin-left rounded-full bg-accion transition-transform duration-base ease-salida"
          style={{ transform: `scaleX(${seguro / 100})` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-[11.5px] text-silver-400">
        <span>{nombreBonito(nivelActual.nombre)}</span>
        {siguienteNivel && <span>{nombreBonito(siguienteNivel.nombre)}</span>}
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {estadisticas.map((e) => (
          <div key={e.etiqueta} className="rounded-[11px] border border-ink-500 bg-ink-800 px-2.5 py-2.5">
            <p className="cifras text-base font-bold leading-none text-silver-100">{e.valor}</p>
            <p className="mt-1.5 text-[9.5px] font-bold uppercase leading-tight tracking-[0.12em] text-silver-500">
              {e.etiqueta}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
