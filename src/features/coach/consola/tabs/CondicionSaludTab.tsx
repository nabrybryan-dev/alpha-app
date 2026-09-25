import { Badge } from '../../../../components/ui/Badge'
import { Card } from '../../../../components/ui/Card'
import { db, useDbVersion } from '../../../../data/dbInstance'
import { PendienteDeCadena } from '../PendienteDeCadena'

/**
 * Módulo 5: cardio concurrente (real, sale de los bloques marcados en el
 * microciclo activo), check-ins recientes (reales) y honesto vacío para lo
 * que todavía no existe en esta capa de datos: marcadores
 * cardiorrespiratorios, factores de riesgo y evaluación postural.
 */
export function CondicionSaludTab({ usuarioId }: { usuarioId: string }) {
  useDbVersion()
  const activo = db.microciclos.byUsuario(usuarioId).find((m) => m.estado === 'activo')
  const checkins = [...db.bienestar.byUsuario(usuarioId)].reverse().slice(0, 7)
  const bloquesCardio = (activo?.sesiones ?? []).flatMap((s) => s.bloquesCardio ?? [])

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <p className="kicker">Cardio concurrente · M{activo?.numero ?? '—'}</p>
        {bloquesCardio.length === 0 ? (
          <p className="mt-2 text-sm text-tenue">Sin bloques de cardio prescritos en el microciclo activo.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {bloquesCardio.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span className="text-texto/90">{b.titulo}</span>
                <Badge tono={b.hechoEn ? 'verde' : 'neutro'}>{b.hechoEn ? 'Hecho' : 'Sin marcar'}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="kicker">Check-ins recientes</p>
        {checkins.length === 0 ? (
          <p className="mt-2 text-sm text-tenue">Sin check-ins registrados.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5 text-xs">
            {checkins.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 border-t border-linea pt-1.5 first:border-0 first:pt-0">
                <span className="font-bold text-texto">{c.fecha}</span>
                {c.pesoKg !== undefined && <span className="text-tenue">{c.pesoKg} kg</span>}
                {c.horasSueno !== undefined && <span className="text-tenue">{c.horasSueno}h sueño</span>}
                {c.estres === 'MUCHO' && <Badge tono="rojo">Estrés alto</Badge>}
                {c.cansancio === 'MUCHO' && <Badge tono="ambar">Muy cansada/o</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PendienteDeCadena
        titulo="Marcadores cardiorrespiratorios, factores de riesgo y evaluación postural"
        detalle="No hay hoy tabla de origen para VO2/FC de reposo, el inventario de factores de riesgo ni la evaluación postural (observación ≠ hipótesis ≠ intervención, protocolo todavía sin escribir). Llega cuando la cadena sincronice."
      />
    </div>
  )
}
