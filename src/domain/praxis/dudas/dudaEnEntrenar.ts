// Rutas sin dependencias de pantalla: este módulo decide, la guía de Entrenar pinta.
import { SALUD_SIN_REGISTRO, pasoTrasProponer, type RespuestaDelRegistrador } from '../conversacion'
import { filtroDeRiesgo, type LineaDeAyuda } from '../riesgo'

/**
 * UNA DUDA ESCRITA EN ENTRENAR, solo para el equipo (decisión de Bryan, 30-oct-2026).
 *
 * El filtro de riesgo corre antes de que la frase salga del teléfono. Después va a `praxis-registro`, que
 * vuelve a filtrar, la lee con el modelo y consulta al portero. Aquí nunca se guarda nada: si la frase
 * resulta ser un registro, se manda a la hoja de series. Lo que no tiene respaldo se dice, no se inventa.
 */

export type ResultadoDeDuda =
  | { tipo: 'respuesta'; texto: string; fichas: string[] }
  | { tipo: 'no_se'; texto: string }
  | { tipo: 'anotar'; texto: string }
  | { tipo: 'salud'; texto: string }
  | { tipo: 'fallo'; texto: string }
  | { tipo: 'cuidado' }
  | { tipo: 'quieta'; linea: LineaDeAyuda }

const PARA_ANOTAR = 'Eso suena a algo para anotar, y aquí solo contesto dudas. Anótalo en la hoja de series.'
const SIN_RESPALDO = 'Eso no lo sé con lo que tengo, y no quiero adivinar.'
const NO_PUDE = 'No pude preguntar. Inténtalo otra vez en un momento.'
const MUCHAS = 'Van muchas preguntas en la última hora. Inténtalo más tarde.'

/** Lo que se decide sin red. `null`: el filtro no marcó nada y la frase puede salir. */
export function dudaAntesDeEnviar(frase: string): ResultadoDeDuda | null {
  const marca = filtroDeRiesgo(frase)
  if (!marca) return null
  if (marca.tipo === 'quieta') return { tipo: 'quieta', linea: marca.linea }
  if (marca.tipo === 'cuidado') return { tipo: 'cuidado' }
  return { tipo: 'salud', texto: SALUD_SIN_REGISTRO.tu }
}

/** Lo que se dice con lo que devolvió la función. La seguridad la sigue decidiendo `pasoTrasProponer`. */
export function dudaTrasResponder(r: RespuestaDelRegistrador): ResultadoDeDuda {
  if (!r.ok) return { tipo: 'fallo', texto: r.motivo === 'limite' ? MUCHAS : NO_PUDE }
  const paso = pasoTrasProponer(r, 'tu')
  switch (paso.paso) {
    case 'quieta':
      return { tipo: 'quieta', linea: paso.linea }
    case 'cuidado':
      return { tipo: 'cuidado' }
    case 'salud':
      return { tipo: 'salud', texto: paso.texto }
    case 'confirmar':
    case 'aclarar':
      return { tipo: 'anotar', texto: PARA_ANOTAR }
    case 'no_se':
      return { tipo: 'no_se', texto: SIN_RESPALDO }
    case 'fallo':
      return { tipo: 'fallo', texto: NO_PUDE }
    case 'charla':
    case 'dicho':
      return r.fichas?.length ? { tipo: 'respuesta', texto: paso.texto, fichas: r.fichas } : { tipo: 'no_se', texto: SIN_RESPALDO }
  }
}
