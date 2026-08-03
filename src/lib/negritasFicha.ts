/**
 * Las fichas del Centro de Respuestas marcan en **negrita** la frase que el
 * asesorado se lleva. Es decisión de redacción, no adorno.
 *
 * Solo se reconocen los pares de asteriscos: ni HTML ni ningún otro marcador,
 * así que el contenido de una ficha no puede inyectar nada.
 */
const PARES = /(\*\*[^*\n]+\*\*)/g

/** Un tramo es negrita si va envuelto en asteriscos y tiene algo dentro. */
export function esNegrita(tramo: string): boolean {
  return tramo.length > 4 && tramo.startsWith('**') && tramo.endsWith('**')
}

/** Parte el texto en tramos alternando normal y negrita, para pintarlo. */
export function tramosDeNegrita(texto: string): string[] {
  return texto.split(PARES)
}

/** Quita el interior de los asteriscos. */
export function sinAsteriscos(tramo: string): string {
  return esNegrita(tramo) ? tramo.slice(2, -2) : tramo
}

/**
 * Texto plano, para donde no cabe la negrita: una vista previa de una línea
 * truncada no gana nada resaltando, y en cambio los asteriscos crudos se ven
 * como un error. Le pasaba a la barra del coach en Hoy, que es lo primero que
 * carga la app.
 */
export function comoTextoPlano(texto: string): string {
  return tramosDeNegrita(texto).map(sinAsteriscos).join('')
}
