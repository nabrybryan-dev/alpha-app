import { ProgressBar } from '../../components/ui/ProgressBar'
import type { TotalDia } from '../../domain/nutricion/dia'
import type { Condicion } from '../../domain/nutricion/techos'
import { techosPasados } from '../../domain/nutricion/techos'

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
  /** Lo que declaró en la encuesta. Baja su límite: ver `limiteDe`. */
  condiciones?: readonly Condicion[]
  /** Los nombres de lo que registró hoy. Callan el aviso de los de frecuencia. */
  nombresDelDia?: readonly string[]
}

const redondear = (valor: number) => (valor >= 100 ? Math.round(valor) : Number(valor.toFixed(1)))

export function PanelMicros({ total, condiciones = [], nombresDelDia = [] }: PanelMicrosProps) {
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

      <AvisoDeTecho total={total} condiciones={condiciones} nombresDelDia={nombresDelDia} />
    </section>
  )
}

const NOMBRE_DEL_NUTRIENTE: Record<string, string> = {
  vitamina_a_er: 'vitamina A',
  zinc_mg: 'zinc',
  calcio_mg: 'calcio',
  vitamina_c_mg: 'vitamina C',
}

/**
 * Se dice cuando el día pasó un máximo, y no se dice nunca más.
 *
 * VA APARTE DE LAS BARRAS a propósito. Arriba, más es mejor: llegar a los 18 mg
 * de hierro es el objetivo. Un techo es lo contrario, y pintarlo como una cuarta
 * barra al 380 % lo leería cualquiera como que va ganando.
 *
 * NO DICE "PELIGRO". El límite es de ingesta diaria sostenida, no de una comida:
 * un hígado el martes no le hace daño a nadie, y asustar con eso es la forma más
 * rápida de que el aviso deje de leerse. Dice cuánto y de qué, que es lo que
 * permite decidir la frecuencia. La restricción por persona -y el caso del
 * embarazo, donde el hígado es contraindicación- la pone la nutricionista.
 *
 * Y EL HÍGADO YA NO SALE POR AQUÍ. Su ración pasa el techo SIEMPRE, así que este
 * aviso le salía cada vez que lo registraba: exactamente la forma de que dejara
 * de leerse que el párrafo de arriba dice evitar. Manuela lo pasó a frecuencia
 * el 2026-08-09 —cada dos semanas— y `techosPasados` lo calla cuando el día lo
 * trae. Ver `nutrientesPorFrecuencia`.
 */
function AvisoDeTecho({
  total,
  condiciones,
  nombresDelDia,
}: {
  total: TotalDia
  condiciones: readonly Condicion[]
  nombresDelDia: readonly string[]
}) {
  const pasados = techosPasados(total, { condiciones, nombresDelDia })
  if (pasados.length === 0) return null

  return (
    <div className="mt-4 rounded-2xl border border-ambar/40 bg-ambar/15 p-3">
      {pasados.map((techo) => (
        <p key={techo.nutriente} className="text-[11px] leading-relaxed text-tenue">
          <b className="text-texto">
            Hoy llevas {techo.parcial && 'al menos '}
            {Math.round(techo.veces * 10) / 10}×
          </b>{' '}
          el máximo diario de {NOMBRE_DEL_NUTRIENTE[techo.nutriente] ?? techo.nutriente}{' '}
          <span className="cifras">
            ({Math.round(techo.valor)} de {techo.limite})
          </span>
          . Un día suelto no pasa nada; si se repite, coméntalo con tu
          nutricionista.
        </p>
      ))}
    </div>
  )
}
