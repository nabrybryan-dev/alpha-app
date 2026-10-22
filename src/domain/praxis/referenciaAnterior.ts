import { sinTildes } from './riesgo'

/** Solo referencias completas sin cifras: nunca deduce un destino para escribir. */
export function aclararReferenciaAnterior(frase: string, trato: 'tu' | 'usted' = 'tu'): string | null {
  const n = sinTildes(frase).replace(/[¿?,.!]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(me refiero|me referia) al /, '$1 a el ')
  if (!/^(?:(?:me refiero a |me referia a |queria decir )|(?:(?:esa|ese|esta|este) no ))?(?:la|el) (?:serie |ejercicio )?anterior$/.test(n)) return null
  const pide = trato === 'usted' ? 'Dígame' : 'Dime'
  if (/serie/.test(n)) return `¿Qué número de serie quiere${trato === 'tu' ? 's' : ''} corregir y de qué ejercicio? ${pide} también el dato correcto; todavía no cambié nada.`
  if (/ejercicio/.test(n)) return `¿Cuál es el nombre del ejercicio anterior? ${pide} qué dato corregir y cómo debe quedar; todavía no cambié nada.`
  return `¿${trato === 'tu' ? 'Te refieres' : 'Se refiere'} a la serie anterior o al ejercicio anterior? ${pide} cuál y qué dato corregir; todavía no cambié nada.`
}
