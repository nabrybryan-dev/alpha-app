/**
 * Dónde está el repo de las herramientas del encoder, si es que está.
 *
 * No hay una ruta fija: la app y las herramientas son dos repos y cada máquina
 * los pone donde quiere. Se prueban las colocaciones conocidas y se admite una
 * variable de entorno para el resto, incluido el CI el día que quiera montarlo.
 *
 * Vive aquí y no dentro del guardián del núcleo porque hay dos que lo
 * necesitan: ese test, que comprueba que la copia vendorizada no ha derivado, y
 * `medir-palancas.mjs`, que cruza al otro repo para medir un vídeo. Dos copias
 * de una búsqueda de rutas es cómo una acaba mirando donde la otra ya no.
 */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))

/** El archivo que prueba que esa carpeta es de verdad la de las herramientas. */
const SENAL = 'analisis.js'

/**
 * La ruta de `herramientas/encoder-camara`, o `null` si no está clonado.
 *
 * Si alguien pone `ENCODER_HERRAMIENTAS`, **manda**: es el único candidato.
 * Buscar por detrás «por si acaso» haría que apuntar a un sitio equivocado se
 * resolviera solo y en silencio, y entonces no habría forma de comprobar que el
 * salto entre repos funciona.
 */
export function buscarHerramientas(entorno = process.env) {
  const declarado = entorno.ENCODER_HERRAMIENTAS
  if (declarado) return existsSync(join(declarado, SENAL)) ? declarado : null

  const raiz = join(aqui, '..')
  const candidatos = [
    // `dev/alpha-app` junto a `dev/cerebro-alpha`, que es como está hoy.
    join(raiz, '..', 'cerebro-alpha', 'herramientas', 'encoder-camara'),
    // La colocación que asume el script de allí: la app DENTRO de cerebro-alpha.
    join(raiz, '..', 'herramientas', 'encoder-camara'),
  ]
  for (const c of candidatos) {
    if (existsSync(join(c, SENAL))) return c
  }
  return null
}

/**
 * Lo que hay que hacer cuando no aparece. Se escribe una vez porque lo dicen
 * dos sitios y con la misma voz: no encontrarlo no es un error del que lee.
 */
export const COMO_ENCONTRARLAS =
  'Clona cerebro-alpha al lado de este repo, o pon ENCODER_HERRAMIENTAS=<ruta a herramientas/encoder-camara>.'
