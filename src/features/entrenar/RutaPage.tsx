import { useSesion } from '../../app/SessionProvider'
import { EmptyState } from '../../components/ui/EmptyState'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { armarSemana, sesionDestacada } from '../../domain/rutaEntrenamiento'
import { BloqueEnCurso } from './ruta/BloqueEnCurso'
import { CabeceraNivel } from './ruta/CabeceraNivel'
import { CalendarioSemana } from './ruta/CalendarioSemana'
import { CompetenciasEvaluadas } from './ruta/CompetenciasEvaluadas'
import { EscalaAlfa } from './ruta/EscalaAlfa'
import { RequisitosNivel } from './ruta/RequisitosNivel'
import { TarjetaProgresoNivel } from './ruta/TarjetaProgresoNivel'

/**
 * Vista macro de la pestaña Entrenar: dónde está la persona en su ruta de
 * largo plazo. La sesión es el segundo nivel (`/entrenar/sesion/:id`) y su
 * botón atrás vuelve aquí.
 */
export default function RutaPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()

  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
  const ruta = db.ruta.byUsuario(usuario.id)

  if (!microciclo) {
    return (
      <EmptyState
        titulo="Sin microciclo activo"
        detalle="El coach está preparando tu siguiente programación."
      />
    )
  }

  const semana = armarSemana(microciclo, hoy)
  const destacada = sesionDestacada(semana)
  const sesionCta = destacada
    ? {
        id: destacada.sesionId,
        nombre: destacada.titulo,
        esDeHoy: destacada.esDeHoy,
        empezada:
          microciclo.sesiones
            .find((s) => s.id === destacada.sesionId)
            ?.ejercicios.some((e) => e.series.length > 0) ?? false,
      }
    : undefined

  return (
    // Entrenar es superficie oscura siempre, como la sesión: la pantalla se usa
    // en el gimnasio y no debe cambiar de piel con el tema de la app.
    <div className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-3.5 bg-ink-900 px-4 pb-4 pt-3">
      <CabeceraNivel nivel={ruta.nivelActual} />

      <div className="entrada entrada-2">
        <TarjetaProgresoNivel
          pct={ruta.pctAlSiguiente}
          nivelActual={ruta.nivelActual}
          siguienteNivel={ruta.siguienteNivel}
          estadisticas={ruta.estadisticas}
        />
      </div>

      <div className="entrada entrada-3">
        <BloqueEnCurso bloque={ruta.bloque} sesion={sesionCta} />
      </div>

      <div className="entrada entrada-4">
        <CalendarioSemana
          dias={semana}
          titulo={`Semana ${ruta.bloque.semana} · Microciclo ${microciclo.numero}`}
        />
      </div>

      <div className="entrada entrada-5">
        <CompetenciasEvaluadas competencias={ruta.competencias} />
      </div>

      <div className="entrada entrada-6">
        <RequisitosNivel requisitos={ruta.requisitos} siguienteNivel={ruta.siguienteNivel} />
      </div>

      <div className="entrada entrada-6">
        <EscalaAlfa niveles={ruta.escala} />
      </div>
    </div>
  )
}
