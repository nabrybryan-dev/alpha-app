import { db } from '../../../data/dbInstance'
import { resumenMicrociclo } from '../../../domain/cumplimiento'
import { cargaPorGrupo } from '../../../domain/fatiga'
import { porcentajeAdherencia } from '../../../domain/nutricion/adherencia'
import { desviacionRirMedia } from '../../../domain/readiness'
import { requisitosParaPeldano } from '../../../domain/nivelesAlfa'
import {
  armarSemana,
  compararFuerza,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  sesionDestacada,
  valoracionesACompetencias,
  type Competencia,
  type DatosRuta,
  type DiaRuta,
  type MiniEstadistica,
  type RequisitoNivel,
} from '../../../domain/rutaEntrenamiento'
import type { Microciclo, Sesion } from '../../../domain/types'

/**
 * LOS CÁLCULOS DE LA RUTA, EN UN SITIO, PARA LAS DOS PANTALLAS QUE LOS USAN.
 *
 * Esto vivía dentro de `RutaPage`, y estaba bien mientras la Ruta era la única que
 * preguntaba. Desde el 29-ago no lo es: las competencias evaluadas y la Escala Alfa se
 * mudaron a **Progreso** —decisión de Bryan—, y Progreso necesita las mismas competencias
 * calculadas de la misma manera.
 *
 * Copiarlas allí habría sido el fallo clásico de este repo: dos sitios calculando lo
 * mismo, iguales el primer día y distintos el día que alguien ajuste uno. Y no se notaría,
 * porque las dos pantallas seguirían enseñando números creíbles — solo que distintos.
 *
 * Aquí no hay ninguna regla nueva. Todo lo que se decide sale de `src/domain`, que es donde
 * vive la verdad: `competenciasCalculadas`, `requisitosParaPeldano`, `progresoAlSiguiente`,
 * `armarSemana`, `sesionDestacada`. Este archivo solo reúne los datos que esas funciones
 * piden y les pasa los del usuario que toca. Es pegamento, y por eso vive en la capa de
 * interfaz y no en el dominio.
 */

export interface CalculosDeLaRuta {
  /** El paquete de entrada del dominio, ya armado con los datos de esta persona. */
  datos: DatosRuta
  /** Los requisitos del peldaño AL QUE VA, no una lista igual para todos. */
  requisitos: readonly RequisitoNivel[]
  /** Las calculadas del registro más las que valoró el coach. */
  competencias: readonly Competencia[]
  estadisticas: readonly MiniEstadistica[]
  progresoPct: number
  semana: readonly DiaRuta[]
  /** La sesión que manda hoy, entera. */
  sesionDeHoy: Sesion | undefined
  /** Lo que el botón grande propone, cuando hay algo que proponer. */
  sesionCta?: { id: string; nombre: string; empezada: boolean; esDeHoy: boolean }
}

export function calculosDeLaRuta(
  usuarioId: string,
  microciclo: Microciclo,
  hoy: string,
): CalculosDeLaRuta {
  const microciclos = db.microciclos.byUsuario(usuarioId)
  // Nivel, competencias y requisitos se valoran con SUS datos, no con cifras iguales para
  // todos. Lo único compartido es el criterio de cada nivel.
  const resumen = resumenMicrociclo(microciclo)
  // El anterior con series: el 1RM estimado solo se puede comparar contra un microciclo
  // que la persona llegó a registrar.
  const previo = microciclos
    .filter((m) => m.id !== microciclo.id && m.numero < microciclo.numero)
    .sort((a, b) => b.numero - a.numero)[0]
  const adherencias = db.nutricion.adherenciasByUsuario(usuarioId)
  const perfil = db.perfiles.byUsuario(usuarioId)

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

  const peldanoActual = perfil?.peldanoAlfa ?? 1
  const requisitos = requisitosParaPeldano(peldanoActual + 1, datos)
  const competencias = [
    ...competenciasCalculadas(datos),
    ...valoracionesACompetencias(perfil?.valoraciones),
  ]

  const semana = armarSemana(microciclo, hoy)
  const destacada = sesionDestacada(semana)
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

  return {
    datos,
    requisitos,
    competencias,
    estadisticas: estadisticasCalculadas(datos),
    progresoPct: progresoAlSiguiente(requisitos),
    semana,
    sesionDeHoy,
    sesionCta,
  }
}
