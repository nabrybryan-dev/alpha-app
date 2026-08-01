import { ProgressBar } from '../../components/ui/ProgressBar'
import type { TotalDia } from '../../domain/nutricion/dia'

/**
 * Los tres micronutrientes que el panel del día vigila.
 *
 * No son tres cualesquiera. El hierro es el déficit real y medido de esta
 * cartera -sobre todo en mujeres-; la vitamina C entra con él porque multiplica
 * su absorción cuando se comen juntos, que es el consejo que de verdad mueve la
 * aguja; y el potasio porque la dieta colombiana lo tiene fácil y casi nadie lo
 * mira.
 *
 * Las metas son referencias generales de ingesta diaria en adultos, no una
 * prescripción individual: quien ajusta esto por persona es la nutricionista.
 */
const MICROS = [
  { clave: 'hierro_mg', etiqueta: 'Hierro', meta: 18, unidad: 'mg' },
  { clave: 'vitamina_c_mg', etiqueta: 'Vitamina C', meta: 75, unidad: 'mg' },
  { clave: 'potasio_mg', etiqueta: 'Potasio', meta: 3400, unidad: 'mg' },
] as const

interface PanelMicrosProps {
  total: TotalDia
}

const redondear = (valor: number) => (valor >= 100 ? Math.round(valor) : Number(valor.toFixed(1)))

export function PanelMicros({ total }: PanelMicrosProps) {
  return (
    <section className="rounded-3xl border border-linea bg-surface-1 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-sm text-texto">Micronutrientes clave</h3>
        <span className="text-[10px] uppercase tracking-wide text-tenue">TCAC · USDA</span>
      </div>

      <div className="flex flex-col gap-3">
        {MICROS.map((micro) => {
          const valor = redondear(total.porDia[micro.clave] ?? 0)
          // Parcial = a algún alimento del día le falta ESE dato. La barra
          // entonces marca un suelo, no un total, y decirlo importa: alguien
          // podría creer que le falta hierro cuando lo que falta es la medición.
          const parcial = total.parciales.has(micro.clave)
          return (
            <div key={micro.clave}>
              <div className="mb-1 flex items-baseline justify-between text-[11px]">
                <span className="text-tenue">{micro.etiqueta}</span>
                <span className="cifras text-tenue">
                  <b className="text-texto">
                    {parcial && '≥ '}
                    {valor}
                  </b>{' '}
                  / {micro.meta} {micro.unidad}
                </span>
              </div>
              <ProgressBar pct={Math.min(100, (valor / micro.meta) * 100)} />
            </div>
          )
        })}
      </div>
    </section>
  )
}
