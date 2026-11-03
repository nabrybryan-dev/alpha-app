import type { IdDeRegion } from './regiones'
import { PASOS_DE_TRANSICION, TRANSICION_MS } from './pintura'

/**
 * CUÁNDO HAY QUE VOLVER A PINTAR EL CUERPO MIENTRAS UNA REGIÓN PASA DEL ROJO A «TRABAJADO».
 *
 * La vista de cuerpo se pinta a demanda, no en un bucle: si nadie le pide un cuadro, la
 * transición no avanza. Hasta el 26-oct avanzaba solo porque otras cosas re-renderizaban el
 * salón por casualidad, y con movimiento reducido la región se quedaba en rojo (revisión
 * ciega, N1). Esto dice los instantes exactos en que el salón tiene que dar un cuadro.
 *
 * Con movimiento reducido no hay pasos: un solo instante, el arranque, y la región cambia de
 * una vez (ver `horaParaPintar`).
 */
export function instantesDeLaTransicion(
  trabajadasEn: Partial<Record<IdDeRegion, number>>,
  ahora: number,
  reducido: boolean,
): number[] {
  const salida = new Set<number>()
  for (const inicio of Object.values(trabajadasEn)) {
    if (inicio === undefined || inicio + TRANSICION_MS <= ahora) continue
    if (reducido) {
      if (inicio > ahora) salida.add(inicio)
      continue
    }
    for (let k = 0; k <= PASOS_DE_TRANSICION; k++) {
      const t = inicio + (k * TRANSICION_MS) / PASOS_DE_TRANSICION
      if (t > ahora) salida.add(t)
    }
  }
  return [...salida].sort((a, b) => a - b)
}

/**
 * La hora con la que se pinta. Con movimiento reducido se adelanta una transición entera:
 * antes del arranque la región sigue roja, y desde el arranque ya está en su color final.
 */
export function horaParaPintar(reloj: number, reducido: boolean): number {
  return reducido ? reloj + TRANSICION_MS : reloj
}
