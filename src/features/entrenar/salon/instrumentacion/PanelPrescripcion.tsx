export interface PanelPrescripcionProps {
  tecnica: string
  series: string | number
  repeticiones: string | number
  velocidadUltima: string
  descanso: string
}

/** Vista deliberadamente pura: presenta la prescripción recibida sin reescribirla. */
export function PanelPrescripcion({
  tecnica,
  series,
  repeticiones,
  velocidadUltima,
  descanso,
}: PanelPrescripcionProps) {
  return (
    <dl data-instrumentacion="prescripcion" className="grid grid-cols-2 gap-1.5">
      <Dato rotulo="Técnica" valor={tecnica} />
      <Dato rotulo="Series" valor={String(series)} />
      <Dato rotulo="Repeticiones" valor={String(repeticiones)} />
      <Dato rotulo="Velocidad última" valor={velocidadUltima} />
      <Dato rotulo="Descanso" valor={descanso} />
    </dl>
  )
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/50 px-2 py-1.5 shadow-lg">
      <dt className="text-[7px] font-bold uppercase tracking-[0.16em] text-silver-400">{rotulo}</dt>
      <dd className="cifras mt-0.5 truncate text-[10px] font-bold text-white">{valor}</dd>
    </div>
  )
}
