/**
 * Corrección de errores de dictado de UNA letra («albun», «restablese», «ocuulto», «semna»). Lo comparten la
 * gramática de organización (palabras de las órdenes) y el catálogo de piezas (palabras de lo que se nombra).
 *
 * Regla corta a propósito, para no inventar palabras: solo se toca una palabra de 5 letras o más que NO esté en el
 * vocabulario, y solo si hay UNA ÚNICA palabra del vocabulario a una letra de distancia (de más, de menos, cambiada,
 * o dos seguidas intercambiadas), contando también la palabra con sus letras dobles colapsadas («hidrataccion»).
 */

/** ¿Las dos palabras difieren en una sola letra? */
export function aUnaLetra(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const ra = a.slice(i)
  const rb = b.slice(i)
  if (ra.length === rb.length) return ra.slice(1) === rb.slice(1) || (ra.length > 1 && ra[0] === rb[1] && ra[1] === rb[0] && ra.slice(2) === rb.slice(2))
  return ra.length > rb.length ? ra.slice(1) === rb : rb.slice(1) === ra
}

/** Corrige cada palabra de `frase` (ya limpia: sin tildes, en minúsculas, separada por espacios) contra `vocabulario`. */
export function corregirPalabras(frase: string, vocabulario: ReadonlySet<string>): string {
  return frase
    .split(' ')
    .map((w) => {
      if (w.length < 5 || vocabulario.has(w)) return w
      const sola = w.replace(/(.)\1+/g, '$1')
      const candidatas = [...vocabulario].filter((v) => aUnaLetra(w, v) || aUnaLetra(sola, v) || sola === v)
      return candidatas.length === 1 ? candidatas[0]! : w
    })
    .join(' ')
}

/** Palabras que mandan en las órdenes de organizar, para corregir el dictado de los verbos y de las palabras clave. */
export const VOCABULARIO_DE_ORDENES: ReadonlySet<string> = new Set([
  'restablece', 'restablecer', 'reinicia', 'oculta', 'ocultar', 'oculto', 'ocultas', 'ocultos', 'esconde', 'esconder',
  'escondido', 'escondidas', 'escondidos', 'muestra', 'muestrame', 'mostrar', 'ensename', 'colocame', 'colocamos',
  'coloca', 'sube', 'subir', 'baja', 'bajar', 'bajalo', 'bajalos', 'revisa', 'revisame', 'revisemos', 'esencial',
  'quita', 'quitar', 'saber', 'semana', 'progreso', 'adornos', 'defecto', 'fabrica',
])
// A propósito NO entran palabras que cambian de sentido con una letra de género o número («primera» no es «primero»:
// «pon el agua de primera» es traer, no mover), ni las que ya son otra palabra válida («final», «original», «siempre»).
