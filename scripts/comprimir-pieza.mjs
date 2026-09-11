/**
 * Deja al lado de una `.pieza` su copia en brotli, que es la que pide el salón.
 *
 * Medido el 2026-09-06 contra la vista previa: Vercel ya comprimía la pieza al vuelo,
 * pero con prisa —915 KB de los 1.502—. Comprimida aquí sin prisa son 548, y el navegador
 * la abre él solo porque `vercel.json` le pone `Content-Encoding: br`.
 *
 *   node scripts/comprimir-pieza.mjs public/piezas/sala-gimnasio.pieza
 *
 * Lo corre el exportador de Blender al terminar. Si se olvida, el guardián de
 * `piezas3d.test.ts` lo dice: un `.br` desfasado abriría la sala ANTERIOR sin fallar nada.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { brotliCompressSync, constants } from 'node:zlib'

const ruta = process.argv[2]
if (!ruta) {
  console.error('uso: node scripts/comprimir-pieza.mjs <ruta a la .pieza>')
  process.exit(1)
}

const crudo = readFileSync(ruta)
const apretado = brotliCompressSync(crudo, {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
    [constants.BROTLI_PARAM_SIZE_HINT]: crudo.length,
  },
})
writeFileSync(`${ruta}.br`, apretado)
const porcentaje = ((1 - apretado.length / crudo.length) * 100).toFixed(0)
console.log(`${ruta}.br  ${(apretado.length / 1e6).toFixed(2)} MB  (${porcentaje} % menos que ${(crudo.length / 1e6).toFixed(2)} MB)`)
