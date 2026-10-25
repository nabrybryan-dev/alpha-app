import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import type { CheckinDiario } from '../../domain/types'
import { tramoDeDolor } from '../../domain/senales/dolor'

/**
 * El historial de check-ins, con una sola casa de pintura.
 *
 * Vivía dentro de `BienestarPage`. Al mudarse el historial a Progreso (paso 7 del
 * rediseño), la alternativa era copiar estas filas en la pantalla nueva y dejar dos
 * versiones del mismo dato —que es exactamente cómo se separan dos pantallas—. Se extrajo
 * aquí y las dos la usan.
 */

function tonoDe(valor?: string): 'verde' | 'ambar' | 'rojo' | 'neutro' {
  if (valor === 'BUENA' || valor === 'POCO') return 'verde'
  if (valor === 'REGULAR') return 'ambar'
  if (valor === 'MALA' || valor === 'MUCHO') return 'rojo'
  return 'neutro'
}

export function FilaDeCheckin({ checkin, verPeso }: { checkin: CheckinDiario; verPeso: boolean }) {
  return (
    <Card className="!p-3" data-checkin>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-texto">{checkin.fecha}</p>
        <p className="text-xs text-tenue">
          {verPeso && checkin.pesoKg ? `${checkin.pesoKg} kg` : ''}{' '}
          {checkin.horasSueno ? `· ${checkin.horasSueno} h sueño` : ''}
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {checkin.entreno && <Badge tono="neutro">{checkin.entreno}</Badge>}
        {checkin.estres && <Badge tono={tonoDe(checkin.estres)}>Estrés {checkin.estres}</Badge>}
        {checkin.cansancio && <Badge tono={tonoDe(checkin.cansancio)}>Cansancio {checkin.cansancio}</Badge>}
        {checkin.calidadSueno && <Badge tono={tonoDe(checkin.calidadSueno)}>Sueño {checkin.calidadSueno}</Badge>}
        {checkin.dolor !== undefined && checkin.dolor > 0 && (
          // El dolor siempre en rojo: la misma regla de la casa que el check-in y el salón.
          <Badge tono={tramoDeDolor(checkin.dolor).etiqueta === 'leve' ? 'ambar' : 'rojo'}>
            Dolor {checkin.dolor}
            {checkin.dolorDonde ? ` · ${checkin.dolorDonde}` : ''}
          </Badge>
        )}
      </div>
      {checkin.comentarios && <p className="mt-1.5 text-xs italic text-tenue">"{checkin.comentarios}"</p>}
    </Card>
  )
}

export function HistorialDeCheckins({
  checkins,
  verPeso,
  limite = 7,
}: {
  checkins: CheckinDiario[]
  verPeso: boolean
  limite?: number
}) {
  const ultimos = [...checkins].reverse().slice(0, limite)
  if (ultimos.length === 0) return null
  return (
    <section aria-label="Tus últimos check-ins" className="flex flex-col gap-2">
      <p className="kicker">Tus últimos check-ins</p>
      {ultimos.map((c) => (
        <FilaDeCheckin key={c.id} checkin={c} verPeso={verPeso} />
      ))}
    </section>
  )
}
