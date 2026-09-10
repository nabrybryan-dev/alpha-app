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
 * Hoy devuelve `null` a propósito: el vídeo todavía no está producido, y una
 * cabecera que promete un vídeo que no existe es peor que una que dice la
 * verdad.
 */
export interface Cabecera {
  /** Dirección del vídeo, ya firmada si el cajón la pide. */
  url: string
  /** Cuándo se grabó, para poder decirlo en pantalla. */
  grabadaEl?: string
}

export async function enlaceDeCabecera(): Promise<Cabecera | null> {
  return null
}
