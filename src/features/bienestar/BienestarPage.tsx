import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { IconoCampana } from '../../components/ui/Icono'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { XP_POR_ACCION } from '../../domain/gamification'
import { CheckDibujado } from '../entrenar/CheckDibujado'
import { visibilidadDelAsesorado } from '../../data/visibilidadDelAsesorado'
import { CheckinForm } from './CheckinForm'
import { filasCheckin } from './filasCheckin'
import { HistorialDeCheckins } from './HistorialDeCheckins'
import { MedidasCard } from './MedidasCard'
import { MensajesVidaBandeja } from './MensajesVidaBandeja'
import { TarjetaVidaCard } from './TarjetaVidaCard'

export default function BienestarPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()
  // Sin soporte de notificaciones también se ofrece «Yo» (que lo explica); con ellas ya permitidas, no hace falta.
  const permiso = typeof Notification === 'undefined' ? 'default' : Notification.permission

  const checkins = db.bienestar.byUsuario(usuario.id)
  const deHoy = checkins.find((c) => c.fecha === hoy)
  // Arranca los steppers cerca del último valor real registrado.
  const pesoInicial = [...checkins].reverse().find((c) => c.pesoKg !== undefined)?.pesoKg
  const pasosInicial = [...checkins].reverse().find((c) => c.pasos !== undefined)?.pasos
  // Una sola respuesta para las cuatro superficies de peso de esta pantalla:
  // el formulario, el resumen de hoy, el historial y la tarjeta de medidas.
  const verPeso = visibilidadDelAsesorado(usuario.id).verComposicion

  return (
    // Sigue el tema de la persona (decisión de Bryan, 28-oct): en oscuro se veía la
    // cabecera oscura sobre un cuerpo hueso, como dos apps pegadas.
    <div className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-4 bg-bg px-4 pb-4 pt-5">
      <header className="entrada entrada-1">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-tenue">Test durante el día</p>
        <h2 className="mt-1 font-display text-3xl leading-none text-texto">Check-in diario</h2>
        <p className="mt-1.5 text-sm text-tenue">
          2 minutos que tu coach lee cada mañana para ajustar tu plan.
        </p>
      </header>

      {/* El recordatorio de las 6 pm sale del servidor y se enciende en «Yo»: aquí solo se avisa a quien no lo tiene. */}
      {permiso !== 'granted' && (
        <Card className="entrada entrada-2 flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-texto">
              <IconoCampana className="h-[17px] w-[17px] shrink-0 text-rojo" />
              Recordatorio de las 6 pm
            </p>
            <p className="mt-0.5 text-xs text-tenue">
              Si a las 6 pm no has llenado tu check-in, te avisamos al teléfono aunque la app esté cerrada. Se enciende en Yo.
            </p>
          </div>
          <Link
            to="/yo"
            className="press inline-flex min-h-11 shrink-0 items-center rounded-full bg-rojo px-4 py-2 font-display text-xs text-white"
          >
            Ir a Yo
          </Link>
        </Card>
      )}

      {deHoy ? (
        <Card destacada className="entrada entrada-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
              <CheckDibujado className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-texto">Registrado — buen hábito</span>
            <span className="cifras ml-auto text-xs font-bold text-accion">+{XP_POR_ACCION.checkin} XP</span>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {filasCheckin(deHoy, verPeso).map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between gap-3 border-b border-linea pb-1.5 last:border-0">
                <span className="text-tenue">{etiqueta}</span>
                <span className="cifras font-bold text-texto">{valor}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="entrada entrada-2">
          <CheckinForm
            usuarioId={usuario.id}
            fecha={hoy}
            pesoInicial={pesoInicial}
            pasosInicial={pasosInicial}
            // La decisión de la nutricionista también gobierna aquí: Bienestar
            // tiene su propio campo de peso y hasta ahora no lo miraba nadie.
            pedirPeso={verPeso}
            onGuardar={(c) => db.bienestar.guardar(c)}
          />
        </Card>
      )}

      <div className="entrada entrada-3 flex flex-col gap-3">
        {/* La cuarta superficie de peso, y la última. `MedidaCorporal.pesoKg`
            pasó a ser opcional para poder llegar hasta aquí: sin báscula pero
            con perímetros, que es justo la métrica que su plan sí le pide. */}
        <MedidasCard usuarioId={usuario.id} verPeso={verPeso} />
        {/* Estilo de vida (fase 2, 0088): mensajes de la cola y la tarjeta semanal.
            Las dos se pintan solas o no se pintan nada — sin bandeja vacía ni
            tarjeta fuera de su semana. */}
        <MensajesVidaBandeja usuarioId={usuario.id} />
        <TarjetaVidaCard usuarioId={usuario.id} />
      </div>

      <div className="entrada entrada-4">
        <HistorialDeCheckins checkins={checkins} verPeso={verPeso} />
      </div>
    </div>
  )
}
