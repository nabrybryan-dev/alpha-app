/**
 * El código del creador que llega en el enlace (`/interesados?codigo=XXXX`).
 *
 * Regla de `bola-de-nieve/embudo/PASO-A-PASO.md`, paso 2 («mayúsculas, sin espacios»):
 * se QUITAN todos los espacios y se pasa a MAYÚSCULAS. Nada más. Alpha asigna códigos
 * solo con A–Z y 0–9, así que una tilde, una ñ o un guion NO se «arreglan»: el código
 * normalizado no tiene la forma de un código y se descarta.
 *
 * Por qué descartarlo en vez de guardarlo tal cual: la URL la puede escribir cualquiera.
 * Si se guardara lo que venga, el parámetro sería un campo de texto libre por la puerta
 * de atrás, y el formulario no puede tener ninguno (PASO-A-PASO, «Puerta del campo
 * libre»). Solo pasa algo con forma de código; si es válido (existe y está activo) lo
 * decide Bryan contra `piloto_codigos`, que el formulario público no puede leer.
 */

/** A–Z y 0–9, de 1 a 32. El mismo patrón que el CHECK de la migración 0089. */
export const FORMA_DE_CODIGO = /^[A-Z0-9]{1,32}$/

/** Quita todos los espacios (también los del medio) y pasa a mayúsculas. */
export function normalizarCodigo(escrito: string): string {
  return escrito.replace(/\s+/g, '').toUpperCase()
}

/**
 * Lo que se guarda del parámetro `codigo`: el normalizado si tiene forma de código,
 * o `null` si no vino o no la tiene. Nunca devuelve texto arbitrario.
 */
export function codigoDelEnlace(parametro: string | null | undefined): string | null {
  if (parametro == null) return null
  const normalizado = normalizarCodigo(parametro)
  return FORMA_DE_CODIGO.test(normalizado) ? normalizado : null
}

/**
 * El `cliente_id` que Bryan puede poner en el enlace que manda por WhatsApp
 * (`&cliente=cli-12`), para atar la respuesta a la ficha sin pedir nombre ni teléfono.
 * `cli-<n>` (DATOS.md) o `PRUEBA-<n>` en los ensayos. Cualquier otra cosa, `null`.
 */
export const FORMA_DE_CLIENTE_ID = /^(cli-[0-9]{1,9}|PRUEBA-[0-9]{1,9})$/

export function clienteDelEnlace(parametro: string | null | undefined): string | null {
  if (parametro == null) return null
  const limpio = parametro.trim()
  return FORMA_DE_CLIENTE_ID.test(limpio) ? limpio : null
}
