/**
 * DAR LA VUELTA (maqueta 7): el botón gira el sujeto de frente a espalda o al revés. Puro:
 * decide la cara que se ve y el azimut al que ir; el visor hace el viaje con su órbita.
 * Azimut 0 = de frente (`ENCUADRE_DEL_CUERPO`), 180 = de espalda, en grados y sin acotar.
 */
export type CaraDelCuerpo = 'frente' | 'espalda'

const normalizado = (azimut: number): number => ((azimut % 360) + 360) % 360

/** La cara más cercana a la cámara: dentro de 90 grados de 0 es el frente. */
export function caraQueSeVe(azimut: number): CaraDelCuerpo {
  const a = normalizado(azimut)
  return a <= 90 || a >= 270 ? 'frente' : 'espalda'
}

/**
 * El azimut de la cara contraria, el más cercano al actual (medio giro, nunca más de 180
 * grados de viaje). El visor va por el camino corto, así que no hace falta acotar.
 */
export function destinoDeLaVuelta(azimut: number): number {
  const base = azimut - normalizado(azimut)
  const a = normalizado(azimut)
  const cara = [0, 180, 360].filter((c) => (caraQueSeVe(azimut) === 'frente' ? c === 180 : c !== 180))
  const mejor = cara.reduce((m, c) => (Math.abs(c - a) < Math.abs(m - a) ? c : m), cara[0]!)
  return base + mejor
}

/** Lo que lee el lector de pantalla: qué se ve ahora y a dónde lleva el botón. */
export function etiquetaDeLaVuelta(azimut: number): string {
  const ahora = caraQueSeVe(azimut)
  return ahora === 'frente'
    ? 'Dar la vuelta: ahora se ve el frente, pasa a la espalda'
    : 'Dar la vuelta: ahora se ve la espalda, pasa al frente'
}
