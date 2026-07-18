import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { useContadorAnimado } from '../../components/ui/useContadorAnimado'
import { db, hoyIso, idCoach, useDbVersion } from '../../data/dbInstance'
import { sesionCompleta } from '../../domain/cumplimiento'
import { useGamificacion } from '../logros/useGamificacion'
import { MapaFatiga } from './MapaFatiga'

export default function HoyPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()
  const juego = useGamificacion(usuario.id)
  const rachaAnimada = useContadorAnimado(juego.rachaBienestar.actual, 700)

  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
  const siguienteSesion = microciclo?.sesiones.find((s) => !sesionCompleta(s))
  const checkinHoy = db.bienestar.byUsuario(usuario.id).some((c) => c.fecha === hoy)
  const adherenciaHoy = db.nutricion.adherenciasByUsuario(usuario.id).some((a) => a.fecha === hoy)
  const noLeidos = db.mensajes.noLeidosDe(usuario.id, idCoach())
  const cuestionariosPendientes = db.cuestionarios
    .asignadosA(usuario.id)
    .filter((q) => !db.cuestionarios.respuestasDe(usuario.id).some((r) => r.cuestionarioId === q.id))

  const pendientes = [
    !checkinHoy && { texto: 'Check-in de bienestar', ruta: '/bienestar' },
    !adherenciaHoy && { texto: 'Marcar nutrición de hoy', ruta: '/nutricion' },
    cuestionariosPendientes.length > 0 && {
      texto: `${cuestionariosPendientes.length} cuestionario${cuestionariosPendientes.length === 1 ? '' : 's'} por responder`,
      ruta: '/cuestionarios',
    },
    noLeidos > 0 && {
      texto: `${noLeidos} mensaje${noLeidos === 1 ? '' : 's'} del coach`,
      ruta: '/chat',
    },
  ].filter((p): p is { texto: string; ruta: string } => Boolean(p))

  return (
    <div className="flex flex-col gap-4">
      <section className="entrada entrada-1 pt-2">
        <p className="kicker">
          {microciclo ? `Microciclo M${microciclo.numero} · Cadencia ${microciclo.cadenciaDias} días` : 'Sin microciclo activo'}
        </p>
        <h2 className="mt-1 font-display text-4xl leading-none text-texto">
          Hola, {usuario.nombre.split(' ')[0]}
        </h2>
      </section>

      <Link to="/logros" className="entrada entrada-2 block">
        <Card className="press flex items-center gap-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-rojo font-display text-2xl text-rojo"
            style={{ boxShadow: 'var(--halo-rojo)' }}
          >
            {Math.round(rachaAnimada)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tenue">
                Día{juego.rachaBienestar.actual === 1 ? '' : 's'} de racha
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-rojo">
                {juego.nivel.nombre}
              </p>
            </div>
            <div className="mt-2.5">
              <ProgressBar pct={juego.pctHaciaSiguiente} etiqueta="Progreso al siguiente nivel" />
            </div>
          </div>
        </Card>
      </Link>

      {siguienteSesion && microciclo ? (
        <div className="entrada entrada-3">
          <div
            className="tarjeta-foto tarjeta-foto-alta p-5"
            style={{ '--foto': 'url(/fondos/atleta-mujer.jpeg)', '--foto-pos': 'center 22%' } as React.CSSProperties}
          >
            <p className="kicker">Tu siguiente sesión</p>
            <h3 className="mt-1.5 font-display text-4xl leading-none">{siguienteSesion.nombre}</h3>
            <p className="mt-1.5 text-sm text-white/70">
              {siguienteSesion.ejercicios.length} ejercicios · descansos de 2-3 min
            </p>
            <Link
              to={`/entrenar/sesion/${siguienteSesion.id}`}
              className="press cta-pulso btn-cristal-rojo mt-4 flex items-center justify-center gap-2.5 rounded-full py-2.5 pl-6 pr-2.5 font-display text-sm"
            >
              <span className="flex-1 text-center">Empezar sesión</span>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-base"
              >
                →
              </span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="entrada entrada-3">
          <Card>
            <p className="text-sm font-bold text-verde">Microciclo completo 💪</p>
            <p className="mt-1 text-sm text-tenue">
              Registraste todas las sesiones. El coach está preparando tu siguiente microciclo.
            </p>
          </Card>
        </div>
      )}

      {microciclo && (
        <section className="entrada entrada-4">
          <p className="kicker mb-2">Fatiga por grupo muscular</p>
          <MapaFatiga microciclo={microciclo} />
        </section>
      )}

      {pendientes.length > 0 && (
        <section className="entrada entrada-5 flex flex-col gap-2">
          <p className="kicker">Pendientes de hoy</p>
          {pendientes.map((p) => (
            <Link key={p.ruta} to={p.ruta}>
              <Card className="press flex items-center justify-between gap-3 !py-3">
                <p className="text-sm text-texto">{p.texto}</p>
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-hairline text-sm text-rojo"
                >
                  →
                </span>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {usuario.rol === 'nutricionista' && (
        <Link to="/equipo-nutricion" className="entrada entrada-5 block">
          <Card destacada className="press flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm text-texto">Nutrición del equipo</p>
              <p className="text-xs text-tenue">Evaluación de adherencia de todos los asesorados</p>
            </div>
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rojo/15 text-base text-rojo">→</span>
          </Card>
        </Link>
      )}

      <section className="entrada entrada-6 grid grid-cols-2 gap-3">
        <Link to="/contenidos">
          <Card className="press h-full">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-rojo"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M10.2 8.8l5 3.2-5 3.2z" />
            </svg>
            <p className="mt-2 font-display text-sm text-texto">Contenidos</p>
            <p className="text-xs text-tenue">Técnica y educación</p>
          </Card>
        </Link>
        <Link to="/cuestionarios">
          <Card className="press h-full">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-rojo"
            >
              <rect x="5" y="4" width="14" height="17" rx="2.5" />
              <path d="M9 4.5V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5v1" />
              <path d="M9 10h6M9 14h6M9 18h3.5" />
            </svg>
            <p className="mt-2 font-display text-sm text-texto">Cuestionarios</p>
            <p className="text-xs text-tenue">
              {cuestionariosPendientes.length > 0
                ? `${cuestionariosPendientes.length} pendiente${cuestionariosPendientes.length === 1 ? '' : 's'}`
                : 'Al día ✓'}
            </p>
          </Card>
        </Link>
      </section>
    </div>
  )
}
