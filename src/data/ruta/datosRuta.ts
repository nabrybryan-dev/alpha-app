import { db } from '../dbInstance'
import { resumenMicrociclo } from '../../domain/cumplimiento'
import { cargaPorGrupo } from '../../domain/fatiga'
import { porcentajeAdherencia } from '../../domain/nutricion/adherencia'
import { desviacionRirMedia } from '../../domain/readiness'
import { compararFuerza, type DatosRuta } from '../../domain/rutaEntrenamiento'
import type { Microciclo } from '../../domain/types'

/**
 * Reúne lo que hace falta para valorar a una persona con SUS datos.
 *
 * Vive aquí y no en la pantalla porque lo necesitan dos sitios: la Ruta que ve
 * el asesorado, y el panel del coach en el momento de generar el microciclo
 * siguiente —que es cuando se recalcula y se guarda el nivel—. Si cada uno
 * armara su propio objeto, acabarían valorando distinto a la misma persona, que
 * es exactamente el tipo de cruce que ya nos costó una vez con «la sesión de hoy».
 */
export function datosRutaDe(usuarioId: string, microciclo: Microciclo): DatosRuta {
  const microciclos = db.microciclos.byUsuario(usuarioId)
  // El anterior CON series: el 1RM estimado solo se puede comparar contra un
  // microciclo que la persona llegó a registrar.
  const previo = microciclos
    .filter((m) => m.id !== microciclo.id && m.numero < microciclo.numero)
    .sort((a, b) => b.numero - a.numero)[0]

  const resumen = resumenMicrociclo(microciclo)
  const adherencias = db.nutricion.adherenciasByUsuario(usuarioId)
  const perfil = db.perfiles.byUsuario(usuarioId)

  return {
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
}
