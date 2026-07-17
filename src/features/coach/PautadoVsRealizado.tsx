import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { desviacionRir, ejercicioCompleto } from '../../domain/cumplimiento'
import type { Microciclo } from '../../domain/types'

function tonoDesviacion(desviacion: number | undefined): 'verde' | 'ambar' | 'rojo' | 'neutro' {
  if (desviacion === undefined) return 'neutro'
  const absoluta = Math.abs(desviacion)
  if (absoluta <= 0.5) return 'verde'
  if (absoluta <= 1.5) return 'ambar'
  return 'rojo'
}

export function PautadoVsRealizado({ microciclo }: { microciclo: Microciclo }) {
  return (
    <div className="flex flex-col gap-3">
      {microciclo.sesiones.map((sesion) => (
        <Card key={sesion.id}>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display text-base text-texto">{sesion.nombre}</h4>
            {sesion.testPost ? (
              <p className="text-xs text-tenue">
                {sesion.testPost.duracionMin} min · RPE {sesion.testPost.rpeSesion} · PRS{' '}
                {sesion.testPost.prsEntrada}
              </p>
            ) : (
              <Badge>Sin registrar</Badge>
            )}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-tenue">
                  <th className="py-1.5 pr-2 font-bold">Ejercicio</th>
                  <th className="py-1.5 pr-2 font-bold">Pautado</th>
                  <th className="py-1.5 pr-2 font-bold">Realizado</th>
                  <th className="py-1.5 font-bold">Desv. RIR</th>
                </tr>
              </thead>
              <tbody>
                {sesion.ejercicios.map((ejercicio) => {
                  const desviacion = desviacionRir(ejercicio.rirObjetivo, ejercicio.series)
                  const realizado = ejercicio.series
                    .map((s) => `${s.cargaKg}×${s.reps}@${s.rir}`)
                    .join(' · ')
                  return (
                    <tr key={ejercicio.id} className="border-t border-linea align-top">
                      <td className="py-2 pr-2 font-bold text-texto">{ejercicio.nombre}</td>
                      <td className="py-2 pr-2 text-tenue">
                        {ejercicio.sets}×{ejercicio.rango} RIR {ejercicio.rirObjetivo}
                      </td>
                      <td className="py-2 pr-2 text-texto/90">
                        {realizado || <span className="text-tenue">—</span>}
                        {!ejercicioCompleto(ejercicio) && ejercicio.series.length > 0 && (
                          <span className="ml-1 text-ambar">(incompleto)</span>
                        )}
                      </td>
                      <td className="py-2">
                        {desviacion !== undefined ? (
                          <Badge tono={tonoDesviacion(desviacion)}>
                            {desviacion > 0 ? `+${desviacion}` : desviacion}
                          </Badge>
                        ) : (
                          <span className="text-tenue">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}
