import { useSesion } from '../../app/SessionProvider'
import { EmptyState } from '../../components/ui/EmptyState'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { resumenMicrociclo } from '../../domain/cumplimiento'
import { cargaPorGrupo } from '../../domain/fatiga'
import { porcentajeAdherencia } from '../../domain/nutricion/adherencia'
import { desviacionRirMedia, indiceRecuperacion } from '../../domain/readiness'
import {
  armarSemana,
  compararFuerza,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  sesionDestacada,
  valoracionesACompetencias,
  type DatosRuta,
} from '../../domain/rutaEntrenamiento'
import { requisitosParaPeldano } from '../../domain/nivelesAlfa'
import { BloqueEnCurso } from './ruta/BloqueEnCurso'
import { CabeceraNivel } from './ruta/CabeceraNivel'
import { CalendarioSemana } from './ruta/CalendarioSemana'
import { ComoLlegas } from './ruta/ComoLlegas'
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

  const microciclos = db.microciclos.byUsuario(usuario.id)
  const microciclo = microciclos.find((m) => m.estado === 'activo')
  const ruta = db.ruta.byUsuario(usuario.id)
  const recuperacion = indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)

  if (!microciclo) {
    return (
      <EmptyState
        titulo="Sin microciclo activo"
        detalle="El coach está preparando tu siguiente programación."
      />
    )
  }

  // Nivel, competencias y requisitos se valoran con SUS datos, no con cifras
  // iguales para todos. Lo único compartido es el criterio de cada nivel.
  const resumen = resumenMicrociclo(microciclo)
  // El anterior con series: el 1RM estimado solo se puede comparar contra un
  // microciclo que la persona llegó a registrar.
  const previo = microciclos
    .filter((m) => m.id !== microciclo.id && m.numero < microciclo.numero)
    .sort((a, b) => b.numero - a.numero)[0]
  const adherencias = db.nutricion.adherenciasByUsuario(usuario.id)

  const perfil = db.perfiles.byUsuario(usuario.id)
  const datos: DatosRuta = {
    microcicloNumero: microciclo.numero,
    sesionesRegistradas: resumen.sesionesRegistradas,
    sesionesTotales: resumen.sesionesTotales,
    desviacionRir: desviacionRirMedia(microciclo),
    seriesPorGrupo: cargaPorGrupo(microciclo).map((g) => g.seriesPautadas),
    progresoFuerza: compararFuerza(microciclo, previo),
    adherenciaPct: adherencias.length > 0 ? porcentajeAdherencia(adherencias) : undefined,
    // La técnica es la compuerta humana del ascenso: la app no ve ejecución.
    tecnicaPct: perfil?.valoraciones?.find((v) => v.id === 'tecnica')?.pct,
  }
  // Los requisitos son los del peldaño AL QUE VA, no una lista igual para todos.
  const peldanoActual = perfil?.peldanoAlfa ?? 1
  const requisitos = requisitosParaPeldano(peldanoActual + 1, datos)
  const competencias = [
    ...competenciasCalculadas(datos),
    ...valoracionesACompetencias(perfil?.valoraciones),
  ]

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
          pct={progresoAlSiguiente(requisitos)}
          nivelActual={ruta.nivelActual}
          siguienteNivel={ruta.siguienteNivel}
          estadisticas={estadisticasCalculadas(datos)}
        />
      </div>

      <div className="entrada entrada-3">
        <ComoLlegas recuperacion={recuperacion} />
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
        <CompetenciasEvaluadas competencias={competencias} />
      </div>

      <div className="entrada entrada-6">
        <RequisitosNivel requisitos={requisitos} siguienteNivel={ruta.siguienteNivel} />
      </div>

      <div className="entrada entrada-6">
        <EscalaAlfa niveles={ruta.escala} />
      </div>
    </div>
  )
}
