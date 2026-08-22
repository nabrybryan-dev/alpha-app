import { readFileSync } from 'node:fs'

/**
 * Medidas de un JPEG leídas de sus marcadores SOF, sin dependencias.
 *
 * Se lee del archivo y no de un manifiesto porque el fallo que interesa cazar es
 * justo que el archivo y lo que se declara de él dejen de coincidir.
 */
export function medidasJpeg(ruta: string): { ancho: number; alto: number } {
  const datos = readFileSync(ruta)
  let i = 2 // se salta el SOI (FFD8)
  while (i < datos.length) {
    if (datos[i] !== 0xff) {
      i += 1
      continue
    }
    const marcador = datos[i + 1]
    // SOF0..SOF15, menos los que no llevan medidas (C4 tabla Huffman, C8, CC)
    const esSof =
      marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc
    if (esSof) {
      return { alto: datos.readUInt16BE(i + 5), ancho: datos.readUInt16BE(i + 7) }
    }
    i += 2 + datos.readUInt16BE(i + 2)
  }
  throw new Error(`No se encontró el marcador de medidas en ${ruta}`)
}
