/**
 * EL BALANCE DE LA PUBLICACIÓN: ¿se publicó lo que tocaba?
 *
 * Hasta el 22-oct `revision-semanal.mjs --paso publicar` terminaba con código 0 aunque no
 * hubiera publicado NADA (16-oct: 0 de 13), y el `.ps1` escribía «LISTO» encima. Un cero que
 * se lee como verde. Esto decide, con números, si la tanda se da por buena.
 *
 * Una tanda está completa cuando cada persona esperada quedó en una de dos situaciones:
 *   · se publicó en esta corrida, o
 *   · ya estaba publicada Y firmada (`ya-aprobado`): repetir la corrida no es un fallo.
 * Cualquier otra cosa —sin audio, rechazada por guion vacío, archivo enorme, formato…— deja la
 * tanda incompleta. En ensayo no se publica nada a propósito y no se exige.
 */

/** Código de salida de una tanda incompleta. Distinto de 0 y de 1 (el 1 es «reventó»). */
export const CODIGO_TANDA_INCOMPLETA = 3

/**
 * @param {object} cuentas
 * @param {number} cuentas.esperados    personas que tenían que salir (sin las omitidas por el agente)
 * @param {number} cuentas.publicados   publicadas en esta corrida
 * @param {number} cuentas.yaAprobados  rechazadas por estar ya firmadas (no es un fallo)
 * @param {number} cuentas.rechazados   rechazadas por cualquier otro motivo
 * @param {number} cuentas.sinAudio     sin archivo de audio en la carpeta
 * @param {boolean} [cuentas.ensayo]
 */
export function balanceDeLaPublicacion({ esperados, publicados, yaAprobados = 0, rechazados = 0, sinAudio = 0, ensayo = false }) {
  if (ensayo) {
    return { completa: true, faltan: 0, codigoDeSalida: 0, linea: 'ENSAYO: no se exige haber publicado.' }
  }
  const resueltas = publicados + yaAprobados
  const faltan = Math.max(0, esperados - resueltas)
  const completa = sinAudio === 0 && rechazados === 0 && faltan === 0
  const linea = completa
    ? `Tanda completa: ${publicados} publicadas${yaAprobados ? ` y ${yaAprobados} que ya estaban firmadas` : ''} de ${esperados} esperadas.`
    : `TANDA INCOMPLETA: se esperaban ${esperados}, se publicaron ${publicados}` +
      `${yaAprobados ? ` (y ${yaAprobados} ya estaban firmadas)` : ''}. ` +
      `Faltan ${faltan}: ${sinAudio} sin audio, ${rechazados} rechazadas.`
  return { completa, faltan, codigoDeSalida: completa ? 0 : CODIGO_TANDA_INCOMPLETA, linea }
}
