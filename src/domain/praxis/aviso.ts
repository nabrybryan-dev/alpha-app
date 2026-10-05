import type { MarcaDeRiesgo } from './riesgo.ts'

/**
 * El aviso al coach cuando Praxis detecta una señal de riesgo en una persona (Bryan, 3-oct-2026).
 *
 * LO QUE LLEVA Y LO QUE NO. Un aviso es una FILA con cuatro cosas: quién (el id de la persona),
 * cuándo, por dónde llegó (`origen`) y qué TIPO de señal fue (`nivel`). Jamás la frase ni la cita
 * que disparó la marca: la retención de texto de salud mental la está revisando un abogado y, hasta
 * que diga algo, esto no guarda ni una palabra de lo que la persona escribió. El tipo `AvisoNuevo`
 * no tiene dónde ponerla, a propósito.
 *
 * Lo comparten la Edge Function `praxis-registro` (que lo escribe con el JWT de la persona) y la
 * consola del coach (que lo lee y lo rotula); por eso vive en el dominio y no en una de las dos.
 */

/** Por dónde llegó: el registro en lenguaje natural o el cuestionario de ingreso por voz. */
export const ORIGENES_AVISO = ['praxis', 'ingreso'] as const
export type OrigenAviso = (typeof ORIGENES_AVISO)[number]

/** El tipo de señal. Mismos valores que el `check` de la migración 0108. */
export const NIVELES_AVISO = ['vida', 'pareja', 'nino', 'cuidado', 'salud'] as const
export type NivelAviso = (typeof NIVELES_AVISO)[number]

/** Lo único que se guarda al avisar. Sin frase, sin cita, sin texto de ningún tipo. */
export interface AvisoNuevo {
  origen: OrigenAviso
  nivel: NivelAviso
}

/**
 * De la marca de riesgo (la que sale del diccionario o del lector con modelo) al tipo de señal.
 * La Quieta se separa por la línea de ayuda que se ofreció; la pregunta de cuidado y la salud
 * tienen la suya.
 */
export function nivelDeMarca(marca: MarcaDeRiesgo): NivelAviso {
  if (marca.tipo === 'quieta') return marca.linea
  return marca.tipo
}

export function esNivelAviso(x: unknown): x is NivelAviso {
  return typeof x === 'string' && (NIVELES_AVISO as readonly string[]).includes(x)
}

export function esOrigenAviso(x: unknown): x is OrigenAviso {
  return typeof x === 'string' && (ORIGENES_AVISO as readonly string[]).includes(x)
}

/** El tipo de señal en palabras claras, para la consola. */
export const ETIQUETA_NIVEL: Record<NivelAviso, string> = {
  vida: 'Riesgo para su vida',
  pareja: 'Violencia de pareja',
  nino: 'Riesgo para un menor',
  cuidado: 'Frase ambigua, hay que preguntarle',
  salud: 'Señal de salud',
}

/** De dónde vino, en palabras claras. */
export const ETIQUETA_ORIGEN: Record<OrigenAviso, string> = {
  praxis: 'Registro de Praxis',
  ingreso: 'Cuestionario de ingreso',
}

/** «Hoy 14:32» o «2 oct, 14:32»: la hora siempre, y el día solo si no es hoy. */
export function horaDelAviso(iso: string, ahora: number): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return 'hora desconocida'
  const hora = t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  const hoy = new Date(ahora)
  const esHoy = t.getFullYear() === hoy.getFullYear() && t.getMonth() === hoy.getMonth() && t.getDate() === hoy.getDate()
  return esHoy ? `Hoy ${hora}` : `${t.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}, ${hora}`
}
