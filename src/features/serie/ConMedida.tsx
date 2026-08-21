import { proporcionTempo, type SerieConMedida } from '../../domain/serieMedida'
import { BarrasVelocidad } from './BarrasVelocidad'

const coma = (x: number, n: number) => x.toFixed(n).replace('.', ',')

/** La serie que sí se midió. */
export function ConMedida({ serie }: { serie: SerieConMedida }) {
  const tempo = serie.tempo
  const proporcion = tempo ? proporcionTempo(tempo) : null

  return (
    <div className="flex flex-col gap-3.5">
      <header className="entrada entrada-1 rounded-2xl border border-hairline bg-surface-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl leading-tight text-silver-100">
              {serie.ejercicio}
              {serie.lado && (
                <span className="text-silver-400"> · brazo {serie.lado}</span>
              )}
            </h2>
            <p className="mt-0.5 text-sm text-silver-400">
              {serie.reps} repeticion{serie.reps === 1 ? '' : 'es'}
            </p>
          </div>
          <p className="flex shrink-0 items-center gap-1.5 rounded-full border border-verde/35 bg-verde/15 px-2.5 py-1 text-[12px] font-semibold text-verde">
            <span aria-hidden className="size-1.5 rounded-full bg-verde" />
            Medida fiable
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3">
          <Cifra rotulo="V. media" valor={coma(serie.velocidadMediaMs, 2)} unidad="m/s" />
          <Cifra rotulo="Recorrido" valor={String(serie.recorridoCm)} unidad="cm" />
          <Cifra
            rotulo="Tronco"
            valor={serie.troncoGrados === null ? '—' : `${serie.troncoGrados}°`}
            unidad={serie.troncoDispersion === null ? '' : `±${serie.troncoDispersion}`}
          />
        </dl>
      </header>

      <div className="entrada entrada-2">
        <BarrasVelocidad
          velocidades={serie.velocidades}
          perdidaPct={serie.perdidaPct}
          umbralPct={serie.umbralPct}
        />
      </div>

      {tempo && (
        <section className="entrada entrada-3 rounded-2xl border border-hairline bg-surface-2 p-4">
          <header className="flex items-baseline justify-between">
            <h3 className="font-display text-sm uppercase tracking-[0.14em] text-silver-300">
              Tempo
            </h3>
            <p className="text-[12px] text-silver-500">Media de {serie.reps} reps</p>
          </header>

          <dl className="mt-3 grid grid-cols-3 gap-3">
            <Cifra rotulo="Bajada" valor={coma(tempo.bajadaS, 1)} unidad="s" />
            <Cifra rotulo="Pausa" valor={coma(tempo.pausaS, 1)} unidad="s" />
            <Cifra rotulo="Tirón" valor={coma(tempo.tironS, 1)} unidad="s" />
          </dl>

          {proporcion && (
            <p className="mt-3 text-[13px] leading-snug text-silver-400">
              <b className="text-silver-100">{proporcion.frase}</b>
            </p>
          )}
        </section>
      )}

      <button
        type="button"
        className="entrada entrada-4 w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm font-semibold text-silver-100 transition-colors hover:bg-surface-3"
      >
        Ver el vídeo con el trazado
      </button>
    </div>
  )
}

function Cifra({ rotulo, valor, unidad }: { rotulo: string; valor: string; unidad: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-silver-500">{rotulo}</dt>
      <dd className="mt-0.5 font-display text-2xl leading-none text-silver-100">
        {valor}
        {unidad && (
          <span className="ml-1 font-body text-[12px] font-normal text-silver-400">{unidad}</span>
        )}
      </dd>
    </div>
  )
}
