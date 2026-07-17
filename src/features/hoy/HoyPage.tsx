import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { sesionRegistrada } from '../../domain/cumplimiento'
import { useGamificacion } from '../logros/useGamificacion'

export default function HoyPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()
  const juego = useGamificacion(usuario.id)

  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
  const siguienteSesion = microciclo?.sesiones.find((s) => !sesionRegistrada(s.ejercicios))
  const checkinHoy = db.bienestar.byUsuario(usuario.id).some((c) => c.fecha === hoy)
  const adherenciaHoy = db.nutricion.adherenciasByUsuario(usuario.id).some((a) => a.fecha === hoy)
  const noLeidos = db.mensajes.noLeidosDe(usuario.id, 'u-bryan')
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
      <section>
        <p className="kicker">
          {microciclo ? `Microciclo M${microciclo.numero} · Cadencia ${microciclo.cadenciaDias} días` : 'Sin microciclo activo'}
        </p>
        <h2 className="font-display text-3xl text-texto">Hola, {usuario.nombre.split(' ')[0]}</h2>
      </section>

      <Link to="/logros">
        <Card className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-rojo font-display text-lg text-rojo">
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
            <p className="mt-1 text-[11px] text-tenue">
              {juego.xp} XP{juego.siguiente ? ` · ${juego.siguiente.xpMinimo - juego.xp} XP para ${juego.siguiente.nombre}` : ' · Nivel máximo'}
            </p>
          </div>
        </Card>
      </Link>

      {siguienteSesion && microciclo ? (
        <Card destacada>
          <p className="kicker">Tu siguiente sesión</p>
          <h3 className="mt-1 font-display text-2xl text-texto">{siguienteSesion.nombre}</h3>
          <p className="mt-1 text-sm text-tenue">
            {siguienteSesion.ejercicios.length} ejercicios · descansos de 2-3 min
          </p>
          <Link
            to={`/entrenar/sesion/${siguienteSesion.id}`}
            className="mt-3 block rounded-xl bg-rojo py-3 text-center font-display text-sm text-white active:opacity-90"
          >
            Empezar sesión →
          </Link>
        </Card>
      ) : (
        <Card>
          <p className="text-sm font-bold text-verde">Microciclo completo 💪</p>
          <p className="mt-1 text-sm text-tenue">
            Registraste todas las sesiones. El coach está preparando tu siguiente microciclo.
          </p>
        </Card>
      )}

      {pendientes.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="kicker">Pendientes de hoy</p>
          {pendientes.map((p) => (
            <Link key={p.ruta} to={p.ruta}>
              <Card className="flex items-center justify-between gap-3 !py-3">
                <p className="text-sm text-texto">{p.texto}</p>
                <span className="text-rojo" aria-hidden="true">→</span>
              </Card>
            </Link>
          ))}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Link to="/contenidos">
          <Card className="h-full">
            <span className="text-xl" aria-hidden="true">🎬</span>
            <p className="mt-1 font-display text-sm text-texto">Contenidos</p>
            <p className="text-xs text-tenue">Técnica y educación</p>
          </Card>
        </Link>
        <Link to="/cuestionarios">
          <Card className="h-full">
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
