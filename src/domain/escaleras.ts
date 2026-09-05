import { coeficiente1rm, rangoReps, redondearCarga } from './ondulacion'
import { esAlFallo } from './objetivoDeIntensidad'
import type { EjercicioPrescrito, EscenariosDelDia } from './types'

/**
 * Las dos escaleras preautorizadas de un ejercicio — §8 punto 1 del supuesto del
 * 2026-08-25, y lo único que le falta al bucle del día para poder proponer algo.
 *
 * ## La idea, y por qué no lleva ni un número inventado
 *
 * El bucle no decide cuánto subir: **elige entre dos caminos que el coach
 * autorizó por adelantado**. Eso deja una pregunta abierta —¿de dónde salen esos
 * caminos?— y la respuesta fácil sería un porcentaje a ojo. Aquí no:
 *
 * **El techo del verde es el extremo duro del RANGO QUE EL COACH YA ESCRIBIÓ.**
 * Si la prescripción dice «8-10 reps @ RIR 2» con diana en 10, hacer 8 al mismo
 * RIR es más carga **y sigue estando dentro de lo prescrito**. Esa carga es el
 * techo. Pasar de ahí sería salirse de la prescripción, que es exactamente lo que
 * un techo existe para impedir.
 *
 * **El escalón es un solo peldaño de ese mismo rango**: la carga que corresponde
 * a UNA repetición menos, redondeada al disco real. Ni un porcentaje, ni una
 * regla del 10 % (que además tiene un ECA en contra — ver el informe de reingreso
 * del 4-sep): la aritmética de la tabla de coeficientes que ya escribe las
 * prescripciones de esta casa.
 *
 * Consecuencia que conviene ver: un ejercicio cuya diana YA está en el extremo
 * duro del rango **no tiene escalera verde**, y eso es correcto. No queda margen
 * autorizado; lo que toca ahí es que el coach reescriba el rango, no que el bucle
 * se lo salte.
 *
 * ## El rojo no se deriva: se hereda
 *
 * `sueloRir` es la regla de seguridad del ejercicio (I-13) y **no se calcula
 * aquí**. Viene del dictamen (`seguridad_ficha.suelo_rir`). Si no hay suelo
 * escrito, **no hay escalera roja**: aflojar sin saber hasta dónde es justo el
 * cheque en blanco que el techo evita en el otro lado.
 *
 * ## Lo que sigue siendo decisión de Bryan
 *
 * `deltaRir` (uno o dos escalones) y `quitarUltimaSerie` son política, no
 * aritmética: entran por parámetro y este módulo no elige por él.
 */

export interface OpcionesDeEscalera {
  /**
   * Cuántos escalones de RIR suelta el día malo. Decisión del coach.
   * El módulo no tiene un defecto con opinión: si no se pasa, no hay rojo.
   */
  deltaRir?: number
  /** Si el día malo recorta además la última serie. Decisión del coach. */
  quitarUltimaSerie?: boolean
  /** El suelo de RIR del ejercicio, del dictamen. Sin él no hay escalera roja. */
  sueloRir?: number
  /** Incremento real del gimnasio. 2,5 kg = discos de 1,25 a cada lado. */
  incrementoKg?: number
}

/** Por qué un ejercicio se queda sin una escalera, cuando se queda. */
export interface EscalerasDerivadas {
  escenarios?: EscenariosDelDia
  /** Vacío cuando salen las dos. Con motivo cuando falta alguna. */
  faltan: string[]
}

/**
 * La carga que corresponde a unas reps dentro del MISMO esfuerzo relativo.
 *
 * Sale de la tabla de coeficientes %1RM que ya usa `ondularEjercicio`: si el
 * ejercicio está pautado a `repsDiana` con carga `cargaKg`, la carga para otras
 * reps al mismo RIR es la proporción entre sus dos coeficientes. No hace falta
 * estimar el 1RM ni tenerlo: se cancela en la división.
 */
function cargaAOtrasReps(
  cargaKg: number,
  repsDesde: number,
  repsHasta: number,
  rir: number,
): number {
  const desde = coeficiente1rm(repsDesde, rir)
  if (desde === 0) return cargaKg
  return (cargaKg * coeficiente1rm(repsHasta, rir)) / desde
}

export function derivarEscaleras(
  ejercicio: EjercicioPrescrito,
  opciones: OpcionesDeEscalera = {},
): EscalerasDerivadas {
  const { deltaRir, quitarUltimaSerie, sueloRir, incrementoKg = 2.5 } = opciones
  const faltan: string[] = []

  // ── El verde ───────────────────────────────────────────────────────────────
  const rango = rangoReps(ejercicio.rango ?? '')
  const carga = ejercicio.cargaKg
  const objetivo = ejercicio.rirObjetivo
  let verde: EscenariosDelDia['verde'] | undefined

  if (typeof carga !== 'number' || carga <= 0) {
    faltan.push('verde: el ejercicio no tiene carga pautada en kg, así que no hay escalón que subir')
  } else if (!rango) {
    faltan.push(`verde: el rango "${ejercicio.rango}" no se puede leer, y el techo sale del rango`)
  } else if (esAlFallo(objetivo)) {
    // Al fallo el coeficiente no informa: no hay reserva que convertir en carga.
    faltan.push('verde: el objetivo es FALLO, y el techo se calcula con el RIR pautado')
  } else if (ejercicio.repsDiana <= rango.min) {
    faltan.push(
      `verde: la diana (${ejercicio.repsDiana}) ya está en el extremo duro del rango ` +
        `(${rango.min}-${rango.max}): no queda margen autorizado, y eso lo reescribe el coach`,
    )
  } else {
    const techoCargaKg = redondearCarga(
      cargaAOtrasReps(carga, ejercicio.repsDiana, rango.min, objetivo),
      incrementoKg,
    )
    const unPeldano = redondearCarga(
      cargaAOtrasReps(carga, ejercicio.repsDiana, ejercicio.repsDiana - 1, objetivo),
      incrementoKg,
    )
    const deltaCargaKg = Math.round((unPeldano - carga) * 100) / 100
    if (deltaCargaKg <= 0 || techoCargaKg <= carga) {
      // Pasa con cargas pequeñas: un peldaño del rango pesa menos que el disco
      // más chico del gimnasio, así que redondeado no sube nada.
      faltan.push(
        `verde: un peldaño del rango no llega al incremento del gimnasio (${incrementoKg} kg) ` +
          `sobre ${carga} kg: el escalón redondeado sale en cero`,
      )
    } else {
      verde = { deltaCargaKg, techoCargaKg }
    }
  }

  // ── El rojo ────────────────────────────────────────────────────────────────
  let rojo: EscenariosDelDia['rojo'] | undefined
  if (typeof sueloRir !== 'number') {
    faltan.push('rojo: el ejercicio no trae suelo de RIR (I-13), y sin suelo aflojar es un cheque en blanco')
  } else if (typeof deltaRir !== 'number' || deltaRir <= 0) {
    faltan.push('rojo: cuántos escalones de RIR se sueltan es decisión del coach, no aritmética')
  } else {
    rojo = { deltaRir, sueloRir, quitarUltimaSerie }
  }

  if (!verde || !rojo) return { faltan }
  return { escenarios: { verde, rojo }, faltan }
}
