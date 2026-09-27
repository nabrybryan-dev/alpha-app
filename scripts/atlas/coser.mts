/**
 * COSER: la función que comparten `convertir-atlas.mts` (BodyParts3D) y
 * `convertir-zanatomy.mts` (Z-Anatomy). Se sacó aquí sin cambiar una línea de su cuerpo
 * para que los dos conversores cosan igual antes de recortar.
 */

/**
 * Une los vértices que ocupan exactamente el mismo sitio y promedia sus normales.
 *
 * La clave es la posición en texto: son las mismas coordenadas de origen, sin operar, así
 * que la igualdad es exacta y no hace falta tolerancia. Promediar las normales además
 * suaviza la superficie, que es lo que se quiere de un músculo.
 */
export function coser(pos: Float32Array, normalI16: ArrayLike<number>, indice: Uint32Array, vertices: number) {
  const mapa = new Map<string, number>()
  const nuevo = new Uint32Array(vertices)
  const p: number[] = []
  const n: number[] = []
  for (let i = 0; i < vertices; i++) {
    const clave = `${pos[i * 3]},${pos[i * 3 + 1]},${pos[i * 3 + 2]}`
    let j = mapa.get(clave)
    if (j === undefined) {
      j = p.length / 3
      mapa.set(clave, j)
      p.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
      n.push(0, 0, 0)
    }
    nuevo[i] = j
    for (let a = 0; a < 3; a++) n[j * 3 + a] += normalI16[i * 3 + a]
  }
  const normal = new Float32Array(n.length)
  for (let i = 0; i < n.length; i += 3) {
    const largo = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    for (let a = 0; a < 3; a++) normal[i + a] = n[i + a] / largo
  }
  return { pos: new Float32Array(p), normal, indice: Uint32Array.from(indice, (i) => nuevo[i]) }
}
