/**
 * Qué dice Praxis cuando un turno del ingreso por voz no salió (3-oct-2026, decisión de Bryan): nunca «no te entendí».
 * Repite la pregunta en corto o pide el dato concreto que faltó, según el tipo de bloque. Solo texto: no toca la
 * extracción, lo que se guarda ni el manejo de salud.
 */
export type BloqueParaRepetir = 'preciso' | 'contexto' | 'si_no'

export function pedirDeNuevo(bloque: BloqueParaRepetir, pregunta: string, usted: boolean): string {
  const p = pregunta.trim()
  switch (bloque) {
    case 'preciso':
      return usted ? `Se me enredó algo de mi lado. Dígame solo el dato: ${p}` : `Se me enredó algo de mi lado. Dime solo el dato: ${p}`
    case 'contexto':
      return usted ? `Se me enredó algo de mi lado. Cuénteme en una o dos frases: ${p}` : `Se me enredó algo de mi lado. Cuéntame en una o dos frases: ${p}`
    case 'si_no':
      return usted ? `Se me enredó algo de mi lado. ¿Sí o no? ${p}` : `Se me enredó algo de mi lado. ¿Sí o no? ${p}`
  }
}

/** Para los turnos de la conversación de toques/voz (`motor/turnos.ts`) cuando la respuesta no trajo nada útil. */
export function repetirEnCorto(pregunta: string, usted: boolean): string {
  const p = pregunta.trim()
  return usted ? `Se lo repito en corto: ${p}` : `Te lo repito en corto: ${p}`
}
