/**
 * El plan de medida de un ejercicio, en JSON, para que lo coma el encoder.
 *
 *     npx vite-node scripts/exportar-plan.mjs -- "BISAGRA DE CADERA" "peso muerto con barra"
 *
 * Existe por una razón de costura, no de comodidad. La tabla de palancas es el
 * dominio de la app y vive en TypeScript; el encoder de cámara es una
 * herramienta aparte que vive en JavaScript en otro repositorio. Que el segundo
 * importe del primero por una ruta relativa entre repositorios es la clase de
 * atajo que funciona en esta máquina y en ninguna otra.
 *
 * Así que se pasan datos, no código: aquí sale el plan y allí se consume. Es la
 * misma frontera que ya existe entre `camara-sintetica.py`, que renderiza, y
 * `tuberia-sintetica.mjs`, que analiza.
 *
 * Lo que va dentro es exactamente lo que el encoder necesita para decidir si
 * puede medir y qué: el eje que manda, contra qué línea, desde dónde hay que
 * mirar, qué marcas hacen falta, y —lo que más importa— **qué no se puede
 * prometer**.
 *
 * Esto imprime el plan para mirarlo o guardarlo. Para medir un vídeo de verdad
 * está `medir-palancas.mjs`, que hace la cadena entera y no deja que nadie
 * tenga que acordarse de pasar el plan correcto.
 */

import { planExportable } from '../src/domain/biomecanica/planExportable.ts'

const [categoria, nombre = ''] = process.argv.slice(2)
if (!categoria) {
  console.error('Uso: npx vite-node scripts/exportar-plan.mjs -- <CATEGORÍA> [nombre del ejercicio]')
  process.exit(2)
}

/* La forma exacta del JSON vive en `planExportable`, no aquí: la comparte con
 * `medir-palancas.mjs`, que le pasa el mismo plan al encoder sin que nadie lo
 * vea. Dos proyecciones que tienen que ser idénticas dejan de serlo el día que
 * alguien toque una. */
const plan = planExportable(categoria, nombre)
if (!plan) {
  console.error(`Sin modelo de palanca para «${categoria}». No hay plan que exportar, y eso es la respuesta.`)
  process.exit(1)
}

console.log(JSON.stringify(plan, null, 2))
