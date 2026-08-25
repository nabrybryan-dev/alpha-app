import type { EjercicioPrescrito } from './types'

/**
 * ¿Está asentada la técnica de este ejercicio para esta persona?
 *
 * El método dice **primero se estandariza, después se sobrecarga**: no se progresa
 * sobre una técnica que todavía varía de una semana a otra, porque entonces la
 * subida de carga no es información, es ruido.
 *
 * Se DERIVA y el coach solo VETA. Marcarlo a mano serían unas 500 marcas (~20
 * asesorados × ~25 ejercicios), y de 96 sesiones activas solo 33 traían el campo
 * `dia`: lo que depende de marcar uno por uno, no se marca.
 *
 * Diseño → `Cerebro Alpha/docs/superpowers/specs/2026-08-25-atributos-por-ejercicio.md` §4
 */

/** Microciclos limpios seguidos que hacen falta. */
export const RACHA_PARA_ESTANDARIZAR = 3

/** Desviación de RIR que todavía se considera técnica estable. */
export const BANDA_RIR = 1

export type OrigenEstandarizado = 'derivado' | 'veto_coach'

export interface EstadoEstandarizado {
  estado: 'si' | 'no'
  origen: OrigenEstandarizado
  microciclosOk: number
  motivo?: string
}

/** El estado de partida de un ejercicio que nadie ha visto todavía. */
export const SIN_ESTANDARIZAR: EstadoEstandarizado = {
  estado: 'no',
  origen: 'derivado',
  microciclosOk: 0,
}

/**
 * Normaliza un cue para compararlo entre microciclos.
 *
 * El cue viaja **copiado** del microciclo anterior, así que la inmensa mayoría de
 * las veces es idéntico y eso no dice nada. Lo que interesa es que el coach lo
 * haya CAMBIADO: significa que vio algo en el vídeo y corrigió.
 *
 * Un espacio de más o una mayúscula no pueden reiniciar tres semanas de conteo.
 */
function normalizarCue(cue: string): string {
  return cue
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s;.,]+|[\s;.,]+$/g, '')
}

/** Si el coach reescribió el cue técnico entre un microciclo y el siguiente. */
export function hayNotaTecnicaNueva(cueAnterior: string, cueActual: string): boolean {
  return normalizarCue(cueAnterior) !== normalizarCue(cueActual)
}

/**
 * La mayor desviación |real − objetivo| de las series registradas, o `undefined`
 * si ninguna trae RIR.
 *
 * **Ausente no es cero.** Una plancha isométrica no tiene repeticiones en
 * reserva; contarla como 0 sería decir que se llegó al fallo. Las series sin RIR
 * se saltan, y si no queda ninguna el ejercicio no informa.
 *
 * Se toma el MÁXIMO y no el promedio: una serie que se fue de banda es una serie
 * que se fue de banda, y promediarla contra dos buenas la esconde.
 */
export function desviacionDeRir(ejercicio: EjercicioPrescrito): number | undefined {
  const objetivo = ejercicio.rirObjetivo
  if (typeof objetivo !== 'number') return undefined

  let peor: number | undefined
  for (const serie of ejercicio.series ?? []) {
    if (typeof serie.rir !== 'number') continue
    const d = Math.abs(serie.rir - objetivo)
    if (peor === undefined || d > peor) peor = d
  }
  return peor
}

/**
 * El estado tras vivir un microciclo más.
 *
 * `anterior` es lo que había; `previo` y `actual` son el mismo ejercicio en el
 * microciclo de referencia y en el que acaba de ejecutarse.
 *
 * Un ejercicio **nuevo** —sin `previo`— arranca la racha en cero: no está
 * estandarizado, y así se queda sin que nadie tenga que acordarse.
 */
export function siguienteEstado(
  anterior: EstadoEstandarizado,
  previo: EjercicioPrescrito | undefined,
  actual: EjercicioPrescrito,
): EstadoEstandarizado {
  // El veto del coach congela. Es la regla del método, no una preferencia.
  if (anterior.origen === 'veto_coach') return anterior

  const romper = (motivo: string): EstadoEstandarizado => ({
    estado: 'no',
    origen: 'derivado',
    microciclosOk: 0,
    motivo,
  })

  if (!previo) return romper('ejercicio nuevo')
  if (hayNotaTecnicaNueva(previo.cues ?? '', actual.cues ?? '')) {
    return romper('nota tecnica nueva')
  }

  const desviacion = desviacionDeRir(actual)
  // Sin RIR registrado no hay prueba de que la técnica aguante, pero tampoco de
  // que falle. No se suma y no se rompe: la racha se queda quieta.
  if (desviacion === undefined) {
    return { ...anterior, motivo: 'sin RIR registrado' }
  }
  if (desviacion > BANDA_RIR) return romper('rir fuera de banda')

  const microciclosOk = anterior.microciclosOk + 1
  return {
    estado: microciclosOk >= RACHA_PARA_ESTANDARIZAR ? 'si' : 'no',
    origen: 'derivado',
    microciclosOk,
  }
}

/** Si el planificador puede subir carga en este ejercicio. */
export function puedeSobrecargar(estado: EstadoEstandarizado): boolean {
  return estado.estado === 'si'
}
