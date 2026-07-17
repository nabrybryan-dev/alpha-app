import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { db, hoyIso, idCoach, useDbVersion } from '../../data/dbInstance'
import { sesionCompleta } from '../../domain/cumplimiento'
import { useGamificacion } from '../logros/useGamificacion'

export default function HoyPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()
  const juego = useGamificacion(usuario.id)

  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
  const siguienteSesion = microciclo?.sesiones.find((s) => !sesionCompleta(s))
  const checkinHoy = db.bienestar.byUsuario(usuario.id).some((c) => c.fecha === hoy)
  const adherenciaHoy = db.nutricion.adherenciasByUsuario(usuario.id).some((a) => a.fecha === hoy)
  const noLeidos = db.mensajes.noLeidosDe(usuario.id, idCoach())
  const cuestionariosPendientes = db.cuestionarios
    .asignadosA(usuario.id)
    .filter((q) => !db.cuestionarios.respuestasDe(usuario.id).some((r) => r.cuestionarioId === q.id))

  const pendientes = [
    !checkinHoy && { texto: 'Tu check-in de bienestar de hoy está pendiente', ruta: '/bienestar' },
    !adherenciaHoy && { texto: '¿Cumpliste el plan de nutrición hoy? Márcalo', ruta: '/nutricion' },
    cuestionariosPendientes.length > 0 && {
      texto: `Tienes ${cuestionariosPendientes.length} cuestionario(s) por responder`,
      ruta: '/cuestionarios',
    },
    noLeidos > 0 && { texto: `El coach te escribió: ${noLeidos} mensaje(s) sin leer`, ruta: '/chat' },
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
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-rojo font-display text-xl text-rojo"
            style={{ boxShadow: 'var(--halo-rojo)' }}
          >
            {juego.rachaBienestar.actual}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-texto">
              Racha de {juego.rachaBienestar.actual} día{juego.rachaBienestar.actual === 1 ? '' : 's'} 🔥
              <span className="ml-2 font-normal text-tenue">Nivel {juego.nivel.nombre}</span>
            </p>
            <div className="mt-1.5">
              <ProgressBar pct={juego.pctHaciaSiguiente} etiqueta="Progreso al siguiente nivel" />
            </div>
            <p className="cifras mt-1 text-[11px] text-tenue">
              {juego.xp} XP{juego.siguiente ? ` · ${juego.siguiente.xpMinimo - juego.xp} XP para ${juego.siguiente.nombre}` : ' · Nivel máximo'}
            </p>
          </div>
        </Card>
      </Link>

      {siguienteSesion && microciclo ? (
        <div className="entrada entrada-3">
          <div
            className="tarjeta-foto p-5 pt-16"
            style={{ '--foto': 'url(/fondos/banco-alpha.jpg)' } as React.CSSProperties}
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

      {pendientes.length > 0 && (
        <section className="entrada entrada-4 flex flex-col gap-2">
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

      <section className="entrada entrada-5 grid grid-cols-2 gap-3">
        <Link to="/contenidos">
          <Card className="press h-full">
            <span className="text-xl" aria-hidden="true">🎬</span>
            <p className="mt-1 font-display text-sm text-texto">Contenidos</p>
            <p className="text-xs text-tenue">Técnica y educación</p>
          </Card>
        </Link>
        <Link to="/cuestionarios">
          <Card className="press h-full">
            <span className="text-xl" aria-hidden="true">📋</span>
            <p className="mt-1 font-display text-sm text-texto">Cuestionarios</p>
            <p className="text-xs text-tenue">
              {cuestionariosPendientes.length > 0
                ? `${cuestionariosPendientes.length} pendiente(s)`
                : 'Al día ✓'}
            </p>
          </Card>
        </Link>
      </section>
    </div>
  )
}
