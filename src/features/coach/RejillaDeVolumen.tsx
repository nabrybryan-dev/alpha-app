/**
 * La rejilla de volumen por grupo a lo largo del bloque: lo que la hoja
 * `PANEL ENTRENAMIENTO` del Excel hacía y la app no, y por lo que la
 * planificación de bloque se seguía mirando en un archivo congelado.
 *
 * Se lee de izquierda a derecha como el paso del bloque. La intensidad del
 * fondo codifica la magnitud —una rampa de un solo color, no un semáforo—:
 * el volumen no es bueno ni malo, es una posición en el landmark. El semáforo
 * verde/ámbar/rojo está reservado a la fatiga (`MapaFatiga`), que sí juzga.
 */
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatearSeries } from '../../domain/fatiga'
import { nivelDeSeries } from '../../domain/nivelDeVolumen'
import type { NivelVolumen } from '../../domain/types'
import type { Microciclo } from '../../domain/types'
import { volumenDeBloque } from '../../domain/volumenDeBloque'

/** Rampa secuencial sobre el acento: a más series, más presencia. */
const INTENSIDAD: Record<NivelVolumen, number> = {
  'Muy Bajo': 10,
  Bajo: 22,
  Normal: 38,
  Alto: 58,
  'Muy Alto': 82,
}

function fondoDe(series: number): string | undefined {
  if (series === 0) return undefined
  return `color-mix(in oklab, var(--rojo) ${INTENSIDAD[nivelDeSeries(series)]}%, transparent)`
}

export function RejillaDeVolumen({ microciclos }: { microciclos: readonly Microciclo[] }) {
  const { numeros, filas } = volumenDeBloque(microciclos)

  if (filas.length === 0) {
    return (
      <EmptyState
        titulo="Sin volumen que mostrar"
        detalle="Este asesorado todavía no tiene microciclos con ejercicios que sumen volumen."
      />
    )
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="kicker">Volumen por grupo · bloque</p>
        <p className="mt-1 text-xs text-tenue">
          Series pautadas por microciclo. El trabajo directo vale 1 y el indirecto 0,5.
        </p>
      </div>

      {/* La tabla scrollea dentro de su caja: con 24 microciclos la página no
          puede desbordarse en horizontal. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">
            Series pautadas por grupo muscular en cada microciclo del bloque
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface-1 py-1 pr-2 text-left font-semibold text-tenue"
              >
                Grupo
              </th>
              {numeros.map((n) => (
                <th
                  key={n}
                  scope="col"
                  className="cifras min-w-[34px] px-1 py-1 text-center font-semibold text-tenue"
                >
                  {`M${n}`}
                </th>
              ))}
              <th scope="col" className="cifras px-2 py-1 text-right font-semibold text-tenue">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.grupo} className="border-t border-linea">
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-surface-1 py-1 pr-2 text-left font-semibold text-texto"
                >
                  {fila.grupo}
                </th>
                {fila.porMicrociclo.map((series, i) => (
                  <td
                    key={numeros[i]}
                    style={{ backgroundColor: fondoDe(series) }}
                    title={`${fila.grupo} · M${numeros[i]} · ${formatearSeries(series)} series`}
                    className={`cifras px-1 py-1 text-center ${
                      series === 0 ? 'text-tenue/50' : 'text-texto'
                    }`}
                  >
                    {series === 0 ? '·' : formatearSeries(series)}
                  </td>
                ))}
                <td className="cifras px-2 py-1 text-right font-bold text-texto">
                  {formatearSeries(fila.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
