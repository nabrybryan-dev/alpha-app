import { useSesion } from '../../app/SessionProvider'
import { EmptyState } from '../../components/ui/EmptyState'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { resumenMicrociclo } from '../../domain/cumplimiento'
import { cargaPorGrupo } from '../../domain/fatiga'
import { notasDelMicrociclo } from '../../domain/notasDeLaSemana'
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
import { SalonEntrenar } from './salon/SalonEntrenar'

/**
 * La pestaña Entrenar. Este archivo CALCULA; quien pinta es el salón.
 *
 * Antes esto era también la maqueta: doce bloques en una columna con scroll, escritos
 * aquí mismo. Ahora la pantalla es `salon/SalonEntrenar` —el sujeto en el centro, lo
 * corto en las paredes, el registro en el suelo y lo largo en el panel de abajo— y lo
 * que queda en este archivo es exactamente lo que ya hacía: leer del `db`, pasar los
 * datos por el dominio y entregar el resultado. Ni un bloque se perdió por el camino:
 * los doce bajaron al panel inferior, que monta LOS MISMOS componentes de `ruta/`.
 *
 * La sesión sigue siendo el segundo nivel (`/entrenar/sesion/:id`) y su botón atrás
 * vuelve aquí.
 *
 * ## Los tres estados, y dónde vive cada uno
 *
 * - **Sin microciclo activo** — el `EmptyState` de abajo. Es de este archivo porque solo
 *   aquí se sabe: hay que leer los microciclos de la persona para descubrirlo. No es una
 *   urgencia; parte de la cartera está inactiva a propósito.
 * - **Carga** — el `Suspense` con el que el router envuelve esta página, que existe
 *   porque `RutaPage` se monta con `lazy()`. Sigue siendo el mismo, y por eso el salón se
 *   monta DENTRO de este componente y no como una ruta aparte: colgarlo del router por su
 *   cuenta lo habría dejado fuera de esa envoltura.
 * - **Error** — el `ErrorBoundary` de esa misma envoltura del router.
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
  // La sesión que manda hoy, entera: de ella salen el ejercicio de las paredes y el del
  // registro del suelo. Es la misma que ya se buscaba para saber si estaba empezada; lo
  // único nuevo es que ahora se guarda en vez de tirarse.
  const sesionDeHoy = destacada
    ? microciclo.sesiones.find((s) => s.id === destacada.sesionId)
    : undefined
  const sesionCta = destacada
    ? {
        id: destacada.sesionId,
        nombre: destacada.titulo,
        esDeHoy: destacada.esDeHoy,
        empezada: sesionDeHoy?.ejercicios.some((e) => e.series.length > 0) ?? false,
      }
    : undefined

  return (
    <SalonEntrenar
      microciclo={microciclo}
      ruta={ruta}
      recuperacion={recuperacion}
      progresoPct={progresoAlSiguiente(requisitos)}
      estadisticas={estadisticasCalculadas(datos)}
      competencias={competencias}
      requisitos={requisitos}
      semana={semana}
      sesionCta={sesionCta}
      notas={notasDelMicrociclo(microciclo)}
      sesion={sesionDeHoy}
    />
  )
}
