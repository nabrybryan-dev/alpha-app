import { useState } from 'react'
import type { DiaRuta } from '../../../domain/rutaEntrenamiento'
import type { Sesion } from '../../../domain/types'
import { diaEnPantalla } from './rumbo/diaEnPantalla'

/**
 * La sesión que el salón tiene en pantalla.
 *
 * Sale del MISMO reparto que pinta la semana —`armarSemana`, ya calculado por el dominio— y
 * no de un segundo cruce por nombre de día: dos formas de repartir sesiones en días se
 * separan, y entonces la semana abriría una sesión y el calendario diría otra.
 *
 * Con un día elegido manda ese día, AUNQUE sea de descanso: caer a la sesión por omisión
 * pintaba los ejercicios del lunes bajo «MIÉRCOLES · viendo» (revisión ciega del 25-oct).
 *
 * Día doble (mañana + repaso de noche): `sesionesDelDia` trae las dos y `elegirSesion` cambia
 * entre ellas; la elegida solo vale mientras pertenezca al día en pantalla. Con un día de una
 * sola sesión todo sale igual que antes.
 */
export function useSesionEnPantalla(args: {
  semana: readonly DiaRuta[]
  sesiones: readonly Sesion[]
  /** La que el salón enseña por omisión (la que toca hoy). */
  sesion: Sesion | undefined
  diaElegido: number | null
}) {
  const { semana, sesiones, sesion, diaElegido } = args
  const [alternaId, setAlternaId] = useState<string | null>(null)
  const base =
    diaElegido === null ? sesion : sesiones.find((s) => s.id === semana[diaElegido]?.sesionId)
  const sesionesDelDia = semana[diaEnPantalla(semana, base?.id, diaElegido)]?.sesiones ?? []
  const alterna = alternaId && sesionesDelDia.some((s) => s.sesionId === alternaId) ? alternaId : undefined
  const sesionEnPantalla = (alterna ? sesiones.find((s) => s.id === alterna) : undefined) ?? base
  return { sesionEnPantalla, sesionesDelDia, elegirSesion: setAlternaId }
}
