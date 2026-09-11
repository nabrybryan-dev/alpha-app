import { medioPublicado } from '../../data/nube/medios'

/**
 * De dónde sale el vídeo de la revisión semanal. **Esta es la costura**, y es
 * el único archivo que cambia el día que exista el cajón privado
 * (`cajon-del-video`): la pantalla no sabe —ni tiene que saber— si el vídeo
 * viene de un enlace firmado, de un archivo suelto o de ningún sitio.
 *
 * El contrato de la pantalla dice que **cambiar el vídeo no puede obligar a
 * tocar ni una línea de `CabeceraSemanal`**, y así se comprueba en
 * `CabeceraSemanal.test.tsx`.
 *
 * Desde el 10-sep hay cajón (migración 0061): pregunta qué está publicado y
 * devuelve su enlace firmado. Mientras no haya nada publicado —hoy— devuelve
 * `null`, y la cabecera dice la verdad en vez de prometer un vídeo que no
 * existe.
 */

/** El hueco de la app donde vive este vídeo. Es la clave de la fila en `medios_app`. */
export const CLAVE_CABECERA = 'cabecera-semanal'

export interface Cabecera {
  /** Dirección del vídeo, ya firmada si el cajón la pide. */
  url: string
  /** Cuándo se grabó, para poder decirlo en pantalla. */
  grabadaEl?: string
}

export async function enlaceDeCabecera(): Promise<Cabecera | null> {
  const medio = await medioPublicado(CLAVE_CABECERA)
  if (!medio) return null
  return { url: medio.url, grabadaEl: medio.grabadoEl }
}
