import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'
import type { Sesion } from '../../../../domain/types'
import { diaEnPantalla } from '../rumbo/diaEnPantalla'

/**
 * LO QUE DICE LA HOJA PLEGADA (maqueta 7): «Torso B · hoy», cuántos ejercicios y el botón
 * para empezar. Función pura: los textos se deciden aquí y el panel solo los pinta.
 *
 * Mirando otro día NO hay botón: esa sesión se ve, no se anota. Solo se ofrece empezar la
 * sesión de `sesionCta` (la que manda hoy) cuando no se eligió otro día.
 */
export interface EntradaDeLaHoja {
  /** La sesión que se ve en pantalla. */
  sesion: Sesion | undefined
  semana: readonly DiaRuta[]
  /** El día elegido en la semana, o `null` si se ve el de siempre. */
  diaElegido: number | null
  sesionCta?: { id: string; nombre: string; empezada: boolean; esDeHoy: boolean }
}

export interface ResumenDeLaHoja {
  titulo: string
  detalle: string
  boton: { texto: string; a: string } | null
}

export function resumenDeLaHoja({ sesion, semana, diaElegido, sesionCta }: EntradaDeLaHoja): ResumenDeLaHoja {
  if (!sesion) return { titulo: 'Sin sesión', detalle: 'No hay sesión para mostrar', boton: null }
  const indice = diaEnPantalla(semana, sesion.id, diaElegido)
  const dia = semana[indice]
  const cola = !dia ? '' : dia.esHoy ? 'hoy' : dia.dia.toLowerCase()
  const titulo = cola ? `${sesion.nombre} · ${cola}` : sesion.nombre

  if (diaElegido !== null) {
    return { titulo, detalle: 'Solo para mirar: aquí no se anota', boton: null }
  }
  const n = sesion.ejercicios?.length ?? 0
  const detalle = `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}`
  if (!sesionCta) return { titulo, detalle, boton: null }
  // Día doble: si la sesión en pantalla es la OTRA del mismo día, el botón es de ella, no de
  // `sesionCta`; abrirla y anotarla es por separado.
  const propia = sesion.id !== sesionCta.id ? dia?.sesiones?.find((s) => s.sesionId === sesion.id) : undefined
  const completada = propia ? propia.completada : dia?.estado === 'completada'
  const empezada = propia ? sesion.ejercicios.some((e) => e.series.length > 0) : sesionCta.empezada
  const texto = completada ? 'Ver resumen' : empezada ? 'Continuar sesión' : 'Empezar sesión'
  return { titulo, detalle, boton: { texto, a: `/entrenar/sesion/${propia ? sesion.id : sesionCta.id}` } }
}
