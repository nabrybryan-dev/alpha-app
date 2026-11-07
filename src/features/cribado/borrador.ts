/**
 * El borrador del cribado: lo que la persona lleva contestado y aún no ha enviado.
 *
 * Vive en su propio archivo y no dentro de `CribadoForm` porque HoyPage necesita
 * preguntarle si hay algo empezado —para no retirarle la tarjeta a media pregunta— y
 * exportar una función desde un archivo de componente rompe el refresco en caliente
 * (`react-refresh/only-export-components`, que en este repo es un aviso que no se deja
 * crecer).
 */
import type { DiaSemana } from '../../domain/calendario'
import { leerJSON } from '../../lib/persistencia'
import type { Cribado } from '../../domain/types'

export interface Borrador {
  respuestas: Record<string, 'si' | 'no'>
  detalle: Record<string, string>
  /** Los días que puede entrenar (0065). Un borrador viejo puede no traerlo: `?? []`. */
  dias?: DiaSemana[]
}

export const VACIO: Borrador = { respuestas: {}, detalle: {}, dias: [] }

/** Una clave por persona: en un teléfono compartido, el borrador de una no es el de la otra. */
export const claveBorrador = (usuarioId: string) => `alpha-cribado-${usuarioId}`

/**
 * ¿Esta persona tiene el cribado empezado y sin terminar?
 *
 * Lo pregunta HoyPage para NO desmontarle el formulario a media pregunta. Hasta el
 * 2026-09-10 la tarjeta se pintaba solo mientras `necesitaCribado` fuera cierto, y esa
 * condición se apaga en cuanto llega de arriba la ficha que volcó el coach: quien
 * estuviera contestando las doce preguntas de salud veía **desaparecer el formulario sin
 * una palabra**.
 */
export function hayBorradorDeCribado(usuarioId: string): boolean {
  const b = leerJSON<Borrador>(claveBorrador(usuarioId), VACIO)
  return Object.keys(b.respuestas).length > 0 || (b.dias?.length ?? 0) > 0
}

/** `medicacionCronica` → `medicacion_cronica`: el detalle baja de la base con la clave en columnas. */
const enColumna = (clave: string) => clave.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)

const NUEVE = [
  'diagnostico', 'quienLoLleva', 'tratamientoActivo', 'medicacionCronica',
  'autorizacionSanitaria', 'restriccionesExplicitas', 'sintomasConEsfuerzo',
  'nivelFuncional', 'queLeHanDichoQueNoHaga',
] as const
const PARQ = ['parqEnfermedadCardiaca', 'parqMedicamentoPresion', 'parqHuesosArticulaciones'] as const

/**
 * El borrador inicial a partir del cribado de la encuesta.
 *
 * Solo se marca lo que la encuesta dejó dicho: `presente`/`true` es «sí», `ausente`/`false`
 * es «no». Lo que no consta se queda sin marcar —nunca un «no» por defecto— y la persona
 * lo contesta. El detalle se copia aunque el campo esté sin marcar (texto libre de la
 * encuesta que no decidió el estado): si toca «sí», lo encuentra escrito; si toca «no», el
 * formulario lo descarta igual que siempre.
 */
export function borradorDesdePrevio(previo: Cribado): Borrador {
  const respuestas: Record<string, 'si' | 'no'> = {}
  for (const k of NUEVE) {
    if (previo[k] === 'presente') respuestas[k] = 'si'
    else if (previo[k] === 'ausente') respuestas[k] = 'no'
  }
  for (const k of PARQ) {
    if (previo[k] === true) respuestas[k] = 'si'
    else if (previo[k] === false) respuestas[k] = 'no'
  }
  const detalle: Record<string, string> = {}
  for (const k of [...NUEVE, ...PARQ]) {
    const texto = previo.detalle?.[k] ?? previo.detalle?.[enColumna(k)]
    if (typeof texto === 'string' && texto.trim() && respuestas[k] !== 'no') detalle[k] = texto.trim()
  }
  return { respuestas, detalle, dias: [] }
}
