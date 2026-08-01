/**
 * El barrido de la cartera entera: a quién le toca microciclo nuevo, a quién se le
 * activó solo y a quién hay que mirar antes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ DECIDIÓ BRYAN Y CÓMO SE TRADUCE AQUÍ
 * ────────────────────────────────────────────────────────────────────────────
 * «Automático, pero si hay poca información o la propuesta puede estar mal, me lo
 * dejas a mí; y dame un resumen de qué se hace con cada asesorado.»
 *
 * Eso son tres piezas, y aquí están las tres separadas a propósito:
 *
 *   · `revisarCartera`     — MIRA y no toca nada. Dice qué pasaría.
 *   · `activarAutomaticas` — ESCRIBE, y solo sobre las filas que `revisarCartera`
 *                            marcó como automáticas.
 *   · `conclusion`         — la frase que lee Bryan por cada asesorado.
 *
 * Están separadas porque la que decide no debe ser la que escribe: así se puede
 * probar la decisión sin tocar la base, y así la pantalla puede enseñar el resumen
 * ANTES de que nada cambie si algún día se quiere volver a la activación manual.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NO HAY SERVIDOR QUE DISPARE ESTO
 * ────────────────────────────────────────────────────────────────────────────
 * «Automático» aquí significa **al abrir el panel de coach**, no un proceso que
 * corre de madrugada. La app no tiene backend propio que ejecute tareas: hay una
 * PWA y Supabase. Así que el microciclo de alguien puede vencer un martes y
 * activarse el jueves, cuando Bryan entra.
 *
 * Que se active tarde no rompe nada —el asesorado sigue viendo su microciclo
 * anterior, que es lo correcto— pero conviene saberlo: la fecha de activación no
 * es la fecha de vencimiento, y `fechaFin` en el resumen es la segunda.
 */
import { hoyIso } from '../../data/dbInstance'
import type { Db } from '../../data/repos'
import { evaluarCierre, type EstadoCierre } from '../../domain/activacion'
import { sesionCompleta } from '../../domain/cumplimiento'
import type { Usuario } from '../../domain/types'
import { microcicloPropuesto, proponerMicrociclo, type PropuestaMicrociclo } from './propuestaMicrociclo'

export type EstadoActivacion =
  /** Vencido y fiable: se activa sin que nadie mire. */
  | 'automatica'
  /** Vencido pero con señales dudosas: espera a que Bryan lo revise. */
  | 'revisar'
  /** Aún no vence: sigue entrenándolo. */
  | 'en-curso'
  /** No tiene microciclo activo: no hay nada que ondular. */
  | 'sin-microciclo'

export interface FilaCartera {
  usuario: Usuario
  estado: EstadoActivacion
  /** El microciclo que se cierra. Ausente en `sin-microciclo`. */
  numeroActual?: number
  cierre?: EstadoCierre
  /** La propuesta calculada. Solo cuando el microciclo vence. */
  propuesta?: PropuestaMicrociclo
}

/**
 * Qué haría la app con cada asesorado, sin hacerlo todavía.
 *
 * La propuesta se calcula solo para los vencidos. Calcularla para todos sería
 * trabajo tirado —la mayoría está a mitad de su microciclo— y encima daría un
 * `revision.motivos` lleno de «3 sesiones sin registrar» que no significa nada
 * cuando aún le quedan días para registrarlas.
 */
export function revisarCartera(db: Db, hoy: string = hoyIso()): FilaCartera[] {
  return db.usuarios.entrenan().map((usuario): FilaCartera => {
    const activo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
    if (!activo) return { usuario, estado: 'sin-microciclo' }

    const pendientes = activo.sesiones.filter((s) => !sesionCompleta(s)).length
    const cierre = evaluarCierre(activo, hoy, pendientes)
    if (!cierre.vencido) {
      return { usuario, estado: 'en-curso', numeroActual: activo.numero, cierre }
    }

    const propuesta = proponerMicrociclo(activo)
    return {
      usuario,
      estado: propuesta.revision.auto ? 'automatica' : 'revisar',
      numeroActual: activo.numero,
      cierre,
      propuesta,
    }
  })
}

/**
 * Activa las que salieron automáticas y devuelve a quiénes les cambió el
 * microciclo. Las de `revisar` no se tocan: son justo las que Bryan pidió ver.
 *
 * Genera la propuesta y la activa en dos llamadas seguidas, no en una. Podrían
 * fusionarse, pero entonces `guardarPropuesta` dejaría de ser el único sitio por
 * el que entra una propuesta, y con él se perdería la garantía de que toda
 * propuesta nace en estado `propuesto`. La ventana entre las dos no es peligrosa:
 * si se corta en medio, queda una propuesta guardada sin activar —exactamente el
 * estado que tendría si Bryan la hubiera generado a mano y no le hubiera dado a
 * activar—.
 */
export function activarAutomaticas(
  db: Db,
  filas: readonly FilaCartera[],
  hoy: string = hoyIso(),
): FilaCartera[] {
  const automaticas = filas.filter((f) => f.estado === 'automatica')

  for (const fila of automaticas) {
    const activo = db.microciclos.byUsuario(fila.usuario.id).find((m) => m.estado === 'activo')
    // Releído de la base a propósito: entre el barrido y este momento pudo entrar
    // una hidratación. Si ya no hay activo, o ya no es el que se evaluó, se salta:
    // activar una propuesta calculada sobre un microciclo que ya no está sería
    // prescribirle a alguien sobre datos viejos.
    if (!activo || activo.numero !== fila.numeroActual) continue

    const propuesta = microcicloPropuesto(activo, { hoy })
    db.microciclos.guardarPropuesta(propuesta)
    db.microciclos.activarPropuesta(propuesta.id)
  }

  return automaticas
}

/**
 * Barre, activa y **recuerda la foto de antes de activar**, una vez por día.
 *
 * El memo no es una optimización, es lo que hace que el resumen diga la verdad, y
 * lo destapó la pantalla, no un test. Con el barrido dentro del inicializador de
 * `useState`, StrictMode lo corría dos veces: la primera activaba el microciclo de
 * un asesorado y la segunda —que ya veía el microciclo NUEVO— pisaba la foto. En
 * pantalla, alguien a quien se le acababa de activar el M9 aparecía bajo «te
 * esperan a ti» pidiendo un M10 sobre un microciclo recién creado y vacío.
 *
 * Guardado por fecha, la segunda pasada devuelve la misma foto que la primera. Y
 * como el barrido es una operación de calendario —«¿a quién le toca hoy?»— una vez
 * al día es además su cadencia natural: navegar entre pantallas del panel no lo
 * repite.
 *
 * Es estado de módulo, que en este repo pide justificación (la cola de sync ya nos
 * costó un incidente). Aquí es un memo de solo lectura hacia fuera, no una cola: no
 * acumula, se reemplaza entero, y `reiniciarBarrido` lo vacía para los tests.
 */
let memoBarrido: { fecha: string; filas: FilaCartera[] } | undefined

export function barrerYActivar(db: Db, hoy: string = hoyIso()): FilaCartera[] {
  if (memoBarrido?.fecha === hoy) return memoBarrido.filas
  const filas = revisarCartera(db, hoy)
  activarAutomaticas(db, filas, hoy)
  memoBarrido = { fecha: hoy, filas }
  return filas
}

/** Vacía el memo. Para los tests, y por si algún día hay que forzar un rebarrido. */
export function reiniciarBarrido(): void {
  memoBarrido = undefined
}

/**
 * La frase de una línea que resume qué se hace con ese asesorado.
 *
 * Dice el reparto (cuántos ejercicios suben, sostienen y bajan) en vez de un
 * «listo»: el reparto es lo que deja ver de un vistazo si la semana tiene sentido.
 * Doce ejercicios subiendo a la vez, o todos bajando, se cazan aquí sin abrir la
 * propuesta.
 */
export function conclusion(fila: FilaCartera): string {
  if (fila.estado === 'sin-microciclo') return 'Sin microciclo activo.'

  if (fila.estado === 'en-curso') {
    const quedan = fila.cierre?.sesionesPendientes ?? 0
    const hasta = fila.cierre ? ` Vence el ${fila.cierre.fechaFin}.` : ''
    return quedan === 0
      ? `M${fila.numeroActual} en curso.${hasta}`
      : `M${fila.numeroActual} en curso, ${quedan} ${quedan === 1 ? 'sesión' : 'sesiones'} por registrar.${hasta}`
  }

  const p = fila.propuesta
  if (!p) return `M${fila.numeroActual} vencido.`

  const { suben, sostienen, bajan } = p.reparto
  const reparto = `${suben} suben · ${sostienen} sostienen · ${bajan} bajan`
  const prs = p.prs === undefined ? '' : ` PRS ${p.prs}.`
  const cabeza = `M${p.numero}: ${reparto}.${prs}`

  if (fila.estado === 'automatica') {
    const aviso = avisoSesiones(fila.cierre)
    return `${cabeza} Activado${aviso}.`
  }
  return `${cabeza} Esperando revisión: ${p.revision.motivos.join('; ')}.`
}

/**
 * El «cerrar avisando» que pidió Bryan: si el microciclo venció por calendario con
 * sesiones a medias, se cierra igual, pero la frase lo dice. Sin esto, un asesorado
 * que se enfermó y registró dos de cinco sesiones pasaría de microciclo sin que
 * nada lo delatara, y su propuesta —calculada sobre dos sesiones— parecería tan
 * sólida como la de quien las hizo todas.
 */
function avisoSesiones(cierre: EstadoCierre | undefined): string {
  const quedan = cierre?.sesionesPendientes ?? 0
  if (quedan === 0) return ''
  return ` (se cerró con ${quedan} ${quedan === 1 ? 'sesión' : 'sesiones'} sin registrar)`
}
