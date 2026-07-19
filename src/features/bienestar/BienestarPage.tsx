import { useState } from 'react'
import { useSesion } from '../../app/SessionProvider'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Revelar } from '../../components/ui/Revelar'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { XP_POR_ACCION } from '../../domain/gamification'
import type { CheckinDiario } from '../../domain/types'
import { CheckinForm } from './CheckinForm'
import { MedidasCard } from './MedidasCard'
import { activarRecordatorios, permisoActual } from './recordatorio'

function tonoDe(valor?: string): 'verde' | 'ambar' | 'rojo' | 'neutro' {
  if (valor === 'BUENA' || valor === 'POCO') return 'verde'
  if (valor === 'REGULAR') return 'ambar'
  if (valor === 'MALA' || valor === 'MUCHO') return 'rojo'
  return 'neutro'
}

function FilaHistorial({ checkin }: { checkin: CheckinDiario }) {
  return (
    <Card className="!p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-texto">{checkin.fecha}</p>
        <p className="text-xs text-tenue">
          {checkin.pesoKg ? `${checkin.pesoKg} kg` : ''} {checkin.horasSueno ? `· ${checkin.horasSueno} h sueño` : ''}
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {checkin.entreno && <Badge tono="neutro">{checkin.entreno}</Badge>}
        {checkin.estres && <Badge tono={tonoDe(checkin.estres)}>Estrés {checkin.estres}</Badge>}
        {checkin.cansancio && <Badge tono={tonoDe(checkin.cansancio)}>Cansancio {checkin.cansancio}</Badge>}
        {checkin.calidadSueno && <Badge tono={tonoDe(checkin.calidadSueno)}>Sueño {checkin.calidadSueno}</Badge>}
      </div>
      {checkin.comentarios && <p className="mt-1.5 text-xs italic text-tenue">"{checkin.comentarios}"</p>}
    </Card>
  )
}

export default function BienestarPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()
  const [permiso, setPermiso] = useState(permisoActual())

  const checkins = db.bienestar.byUsuario(usuario.id)
  const deHoy = checkins.find((c) => c.fecha === hoy)
  const ultimos = [...checkins].reverse().slice(0, 7)

  return (
    <div className="flex flex-col gap-4">
      <section className="entrada entrada-1">
        <div
          className="tarjeta-foto p-5 pt-24"
          style={{ '--foto': 'url(/fondos/banco-alpha.jpg)', '--foto-pos': 'center 45%' } as React.CSSProperties}
        >
          <p className="kicker">Test durante el día</p>
          <h2 className="mt-1 font-display text-4xl leading-none">Bienestar diario</h2>
          <p className="mt-1.5 text-sm text-white/70">
            2 minutos al día que le dan al coach lo que necesita para ajustar tu plan.
          </p>
        </div>
      </section>

      {permiso === 'default' && (
        <Card className="entrada entrada-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-texto">🔔 Recordatorio de las 6 pm</p>
            <p className="mt-0.5 text-xs text-tenue">
              Si a las 6 pm no has llenado tu check-in, te avisamos con una notificación.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void activarRecordatorios().then((r) => setPermiso(r))
            }}
            className="press shrink-0 rounded-full bg-rojo px-4 py-2 font-display text-xs text-white"
          >
            Activar
          </button>
        </Card>
      )}
      {permiso === 'denied' && (
        <p className="entrada entrada-2 text-center text-[11px] text-tenue">
          Las notificaciones están bloqueadas en tu navegador — actívalas en la configuración del
          sitio para recibir el recordatorio de las 6 pm.
        </p>
      )}

      {deHoy ? (
        <Card destacada className="entrada entrada-2">
          <p className="text-sm font-bold text-verde">Check-in de hoy completado ✓ (+{XP_POR_ACCION.checkin} XP)</p>
          <p className="mt-1 text-sm text-tenue">Vuelve mañana. La constancia es la que programa.</p>
        </Card>
      ) : (
        <Card className="entrada entrada-2">
          <CheckinForm usuarioId={usuario.id} fecha={hoy} onGuardar={(c) => db.bienestar.guardar(c)} />
        </Card>
      )}

      <div className="entrada entrada-3">
        <MedidasCard usuarioId={usuario.id} />
      </div>

      <section className="entrada entrada-4 flex flex-col gap-2">
        <p className="kicker">Últimos 7 días</p>
        {ultimos.map((c, i) => (
          <Revelar key={c.id} retrasoMs={(i % 5) * 50}>
            <FilaHistorial checkin={c} />
          </Revelar>
        ))}
      </section>
    </div>
  )
}
