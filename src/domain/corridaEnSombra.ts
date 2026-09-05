import {
  aplicarEscenario,
  escenarioDelDia,
  reglaDelMartes,
  type Escenario,
  type EscenarioDelDia,
  type SenalesDelDia,
} from './bucleDelDia'
import type { CheckinDiario, EjercicioPrescrito, Microciclo, Sesion } from './types'

/**
 * La corrida en sombra del bucle del día — §7.1 del supuesto del 2026-08-25.
 *
 * ## Qué es y por qué se hace REPRODUCIENDO, no esperando
 *
 * Lo pactado con el coach es que el bucle **calcule sin enseñar** un microciclo
 * entero y que después se compare si sus ajustes habrían reducido la
 * discrepancia o la habrían perseguido. Tal como está escrito parece obligar a
 * esperar una semana con gente entrenando.
 *
 * No hace falta, y la diferencia son días: **todo lo que el cruce necesita ya
 * está guardado**. `rendimientoDelDia` lee la prescripción y las series; el
 * contexto sale del check-in de ese día o del PRS del test posterior, que va en
 * la propia sesión. Así que la sombra se puede reproducir sobre la historia y
 * dar el número HOY, sobre 254 sesiones en vez de sobre una semana.
 *
 * Y se reproduce **con el mismo módulo que decidiría en vivo** (`bucleDelDia`),
 * no con una copia. Una segunda implementación de la regla en otro sitio es el
 * fallo que esta casa lleva pagando desde la migración 0037: dos copias de una
 * regla divergen y la sombra dejaría de medir lo que se va a enchufar.
 *
 * ## Los dos hemisferios, y solo uno se puede contestar hoy
 *
 * 1. **¿Se dispara el cruce, y sobre quién?** Contestable ya. Si casi nunca
 *    salta, el mecanismo no tiene tracción y la conversación se acaba ahí.
 * 2. **¿El ajuste habría reducido la discrepancia?** NO contestable hoy:
 *    `aplicarEscenario` exige `ejercicio.escenarios` —las dos escaleras
 *    preautorizadas— y en producción hay **0 de 3.106 ejercicios** con ellas.
 *    Es el punto 1 del §8, pendiente de la aprobación de Bryan.
 *
 * Por eso el informe cuenta `sin_camino_escrito` **como una fila propia y
 * visible**: esconderlo dentro de «ninguno» haría que un mecanismo bloqueado
 * pareciera un mecanismo que decide no actuar, que es lo contrario.
 *
 * ## Cómo se emparejan el día y el check-in
 *
 * Por `Sesion.fecha` cuando la hay; si no, por la primera marca de preparación,
 * que hasta el 2026-09-04 era el único rastro fechado que dejaba el asesorado.
 * Y si tampoco la hay, el contexto puede salir igualmente del `prsEntrada` del
 * test posterior, que **no necesita fecha**: va dentro de la sesión.
 */

export interface SesionEnSombra {
  microciclo: number
  sesion: string
  /** El día que se le pudo atribuir, o `undefined` si no hubo forma. */
  fecha?: string
  /** De dónde salió esa fecha. `sin_fecha` no invalida la sesión: el PRS no la necesita. */
  origenDeLaFecha: 'campo' | 'marca' | 'sin_fecha'
  huboCheckin: boolean
  huboPrs: boolean
  ejercicios: EjercicioEnSombra[]
  /** Sesiones restantes de la semana que habrían arrancado en rojo (regla del martes). */
  propagaA: string[]
}

export interface EjercicioEnSombra {
  id: string
  nombre: string
  categoria: string
  decision: EscenarioDelDia
  /** `true` cuando el cruce pidió actuar y no había escaleras escritas. */
  sinCaminoEscrito: boolean
}

export interface InformeDeSombra {
  sesionesMiradas: number
  sesionesCruzables: number
  ejerciciosMirados: number
  /** Cuántos ejercicios cayeron en cada casilla del cruce. */
  porEscenario: Record<Escenario, number>
  /** De los `verde` + `rojo`, cuántos se quedaron sin poder proponer nada. */
  sinCaminoEscrito: number
  /** Por qué no se pudo cruzar, cuando no se pudo. */
  noCruzables: { sinSeries: number; sinContexto: number }
  /** Cuántas veces la regla del martes habría alcanzado a una sesión posterior. */
  propagaciones: number
  sesiones: SesionEnSombra[]
}

const VACIO: Record<Escenario, number> = { verde: 0, rojo: 0, ninguno: 0 }

/** El día que se le puede atribuir a una sesión, y de dónde sale. */
export function fechaDeLaSesion(sesion: Sesion): {
  fecha?: string
  origen: SesionEnSombra['origenDeLaFecha']
} {
  if (sesion.fecha) return { fecha: sesion.fecha, origen: 'campo' }
  const marcas = (sesion.preparacion ?? [])
    .map((p) => p.hechoEn)
    .filter((h): h is string => Boolean(h))
    .sort()
  // La PRIMERA marca, no la última: es el momento en que la persona empezó.
  if (marcas.length > 0) return { fecha: marcas[0].slice(0, 10), origen: 'marca' }
  return { origen: 'sin_fecha' }
}

/** Los grupos que toca una sesión, para el solapamiento de la regla del martes. */
function gruposDe(sesion: Sesion): string[] {
  return [...new Set(sesion.ejercicios.map((e) => e.categoria).filter(Boolean))]
}

function senalesDe(sesion: Sesion, checkin?: CheckinDiario): SenalesDelDia {
  return {
    checkin: checkin && {
      horasSueno: checkin.horasSueno,
      calidadSueno: checkin.calidadSueno,
      estres: checkin.estres,
      cansancio: checkin.cansancio,
      motivacion: checkin.motivacion,
    },
    prsEntrada: sesion.testPost?.prsEntrada,
  }
}

/**
 * Reproduce la sombra de UNA sesión.
 *
 * `restantes` son las sesiones que vienen después en el mismo microciclo, en
 * orden: la regla del martes solo mira hacia delante, nunca hacia atrás.
 */
export function sombraDeSesion(
  sesion: Sesion,
  numeroDeMicrociclo: number,
  checkins: readonly CheckinDiario[],
  restantes: readonly Sesion[],
): SesionEnSombra {
  const { fecha, origen } = fechaDeLaSesion(sesion)
  const checkin = fecha ? checkins.find((c) => c.fecha === fecha) : undefined
  const senales = senalesDe(sesion, checkin)

  const ejercicios: EjercicioEnSombra[] = sesion.ejercicios.map((e: EjercicioPrescrito) => {
    const decision = escenarioDelDia(e, senales)
    const ajuste = aplicarEscenario(e, decision)
    return {
      id: e.id,
      nombre: e.nombre,
      categoria: e.categoria,
      decision,
      // El cruce pidió actuar y `aplicarEscenario` no propuso nada de nada: es
      // el caso de «sin escaleras escritas», y hay que poder contarlo aparte.
      sinCaminoEscrito:
        decision.escenario !== 'ninguno' &&
        ajuste.cargaKg === undefined &&
        ajuste.sets === undefined &&
        ajuste.rirObjetivo === undefined,
    }
  })

  // La propagación la dispara el PRIMER rojo de la sesión: la fatiga es del día,
  // no de un ejercicio suelto.
  const primerRojo = ejercicios.find((x) => x.decision.escenario === 'rojo')
  const propagaA = primerRojo
    ? reglaDelMartes(
        primerRojo.decision,
        gruposDe(sesion),
        restantes.map((s) => ({ nombre: s.nombre, grupos: gruposDe(s) })),
      )
    : []

  return {
    microciclo: numeroDeMicrociclo,
    sesion: sesion.nombre,
    fecha,
    origenDeLaFecha: origen,
    huboCheckin: Boolean(checkin),
    huboPrs: typeof sesion.testPost?.prsEntrada === 'number',
    ejercicios,
    propagaA,
  }
}

/**
 * La corrida completa sobre los microciclos de UNA persona.
 *
 * Los microciclos entran en el orden que sea; se ordenan por `numero`, que es lo
 * que define la secuencia real de su bloque.
 */
export function corridaEnSombra(
  microciclos: readonly Microciclo[],
  checkins: readonly CheckinDiario[],
): InformeDeSombra {
  const sesiones: SesionEnSombra[] = []

  for (const m of [...microciclos].sort((a, b) => a.numero - b.numero)) {
    const enOrden = [...(m.sesiones ?? [])].sort((a, b) => a.orden - b.orden)
    enOrden.forEach((s, i) => {
      sesiones.push(sombraDeSesion(s, m.numero, checkins, enOrden.slice(i + 1)))
    })
  }

  const porEscenario = { ...VACIO }
  let ejerciciosMirados = 0
  let sinCaminoEscrito = 0
  const noCruzables = { sinSeries: 0, sinContexto: 0 }

  for (const s of sesiones) {
    for (const e of s.ejercicios) {
      ejerciciosMirados += 1
      porEscenario[e.decision.escenario] += 1
      if (e.sinCaminoEscrito) sinCaminoEscrito += 1
      if (e.decision.rendimiento === 'sin_registro') noCruzables.sinSeries += 1
      else if (e.decision.contexto === 'sin_datos') noCruzables.sinContexto += 1
    }
  }

  return {
    sesionesMiradas: sesiones.length,
    // Una sesión es cruzable cuando ALGUNO de sus ejercicios llegó al cruce con
    // las dos mitades. Se cuenta por sesión porque el contexto es del día.
    sesionesCruzables: sesiones.filter((s) =>
      s.ejercicios.some(
        (e) => e.decision.rendimiento !== 'sin_registro' && e.decision.contexto !== 'sin_datos',
      ),
    ).length,
    ejerciciosMirados,
    porEscenario,
    sinCaminoEscrito,
    noCruzables,
    propagaciones: sesiones.reduce((n, s) => n + s.propagaA.length, 0),
    sesiones,
  }
}
