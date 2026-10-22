import type { Rol } from '../../../domain/praxis/acceso'
import type { DecisionEnrutador } from '../../../domain/praxis/enrutador'
import { enrutarPorReglas } from '../../../domain/praxis/enrutadorReglas'

/**
 * El enrutador en MODO OBSERVACIÓN (decisión de Bryan, 17-oct): corre junto al turno de hoy,
 * anota ruta, área y nivel, y no cambia nada de lo que se ve ni de lo que se guarda.
 * Nunca guarda la frase. Nunca lanza: si falla, el turno sigue como siempre.
 * Cuando haya un selector medido, el enrutador pasa de observar a decidir.
 */
export type RutaObservada = Pick<DecisionEnrutador, 'ruta' | 'area' | 'nivel'>

let rutas: RutaObservada[] = []

export function observarRuta(frase: string, usuarioId: string, rol: Rol | undefined, aclaracionSalud = false): DecisionEnrutador | null {
  if (!rol) return null
  try {
    const d = enrutarPorReglas({ frase, rol, personaId: usuarioId, aclaracionSalud })
    const { ruta, area, nivel } = d
    rutas = [...rutas, { ruta, ...(area ? { area } : {}), ...(nivel ? { nivel } : {}) }].slice(-50)
    return d
  } catch {
    return null
  }
}

export const rutasObservadas = (): readonly RutaObservada[] => rutas
export const olvidarRutas = (): void => { rutas = [] }
