/**
 * El día de HOY según el reloj del dispositivo, en `AAAA-MM-DD`.
 *
 * **Local, nunca UTC, y no es un detalle.** `new Date().toISOString()` da la
 * fecha en Greenwich: en Bogotá (UTC−5) una sesión de las ocho de la tarde
 * saldría fechada al día siguiente. El check-in diario ya se guarda con este
 * mismo criterio, y por eso las dos fechas se pueden comparar carácter a
 * carácter — que es justo para lo que existen.
 *
 * Vive aquí y no en `dbInstance` porque también lo necesita `mockDb`, y
 * `dbInstance` importa a `mockDb`: dejarlo allí haría un círculo. `dbInstance`
 * lo reexporta para no tocar las 22 pantallas que ya lo importaban de él.
 */
export function hoyIso(fecha: Date = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}
