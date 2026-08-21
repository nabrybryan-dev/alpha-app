import { readFileSync } from 'node:fs'

/**
 * Medidas de un WebP leídas de su cabecera, sin dependencias — hermano de
 * `medidasJpeg`, y por la misma razón: el fallo que interesa cazar es que el
 * archivo y lo que se declara de él dejen de coincidir.
 *
 * Cubre los tres sabores. `VP8 ` (con lápida) es el lossy, y es el que producen
 * los fotogramas de la secuencia.
 */
export function medidasWebp(ruta: string): { ancho: number; alto: number } {
  const datos = readFileSync(ruta)
  if (datos.toString('ascii', 0, 4) !== 'RIFF' || datos.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${ruta} no es un WebP`)
  }

  const chunk = datos.toString('ascii', 12, 16)

  if (chunk === 'VP8 ') {
    // Tras la etiqueta de fotograma (3 bytes) va el código de inicio 9d 01 2a, y
    // detrás las dos medidas en 14 bits cada una.
    const codigo = datos.readUIntLE(23, 3)
    if (codigo !== 0x2a019d) throw new Error(`Código de inicio inesperado en ${ruta}`)
    return {
      ancho: datos.readUInt16LE(26) & 0x3fff,
      alto: datos.readUInt16LE(28) & 0x3fff,
    }
  }

  if (chunk === 'VP8L') {
    // 14 bits de ancho y 14 de alto, empaquetados tras la firma 0x2f.
    const bits = datos.readUInt32LE(21)
    return { ancho: (bits & 0x3fff) + 1, alto: ((bits >> 14) & 0x3fff) + 1 }
  }

  if (chunk === 'VP8X') {
    // Menos uno, porque el formato guarda «anchura - 1» en 24 bits.
    return { ancho: datos.readUIntLE(24, 3) + 1, alto: datos.readUIntLE(27, 3) + 1 }
  }

  throw new Error(`Trozo WebP desconocido (${chunk}) en ${ruta}`)
}
