#!/usr/bin/env node
/**
 * QUÉ TROZO DEL MURO SE VE, según lo inclinada que entre la cámara.
 *
 * `sitiosDeLaPared.ts` cuelga cada cuadro a una ALTURA EN METROS, y esa altura se eligió
 * midiendo con la cámara del salón a 6° de elevación —que es la que traen los patrones de
 * pie—. Pero la elevación no es una constante del salón: la pone cada patrón
 * (`patron.camara.elevacion`) y en el catálogo va **de 2° a 56°**, porque un ejercicio
 * tumbado se estudia desde arriba.
 *
 * Esto recorre esa horquilla y dice, para cada elevación, **qué alturas del muro caen
 * dentro del cuadro**. Es el mismo cálculo que hace `proyectarCuadro()`, con las mismas
 * constantes, escrito aparte para poder mirarlo sin abrir el navegador.
 *
 *   node scripts/banda-del-muro.mjs [--ancho=390] [--alto=844]
 */

const ANCHO = Number(process.argv.find((a) => a.startsWith('--ancho='))?.split('=')[1] ?? 390)
const ALTO = Number(process.argv.find((a) => a.startsWith('--alto='))?.split('=')[1] ?? 844)

// Las mismas que la app: `CAMPO_VISUAL` de domain/patrones/escena, `ENCUADRE_SALA` y
// `SALA.radio` de features/entrenar/escena/sala.
const CAMPO_VISUAL = (26 * Math.PI) / 180
const DISTANCIA = 4.6
const CENTRO_Y = 1.2
const RADIO = 7.0 - 0.2

const foco = ALTO / 2 / Math.tan(CAMPO_VISUAL / 2)
const rad = (g) => (g * Math.PI) / 180

/** Y en pantalla de un punto del muro de ENFRENTE a la altura `h`, con la cámara a `el`. */
function py(h, el) {
  const e = rad(el)
  // Distancia horizontal del ojo al muro de enfrente, medida sobre el eje de la mirada.
  const D = DISTANCIA * Math.cos(e) + RADIO
  const dy = h - (CENTRO_Y + DISTANCIA * Math.sin(e))
  const y = D * Math.sin(e) + dy * Math.cos(e)
  const z = D * Math.cos(e) - dy * Math.sin(e)
  return { py: ALTO / 2 - (foco * y) / z, z }
}

/** La altura que cae en una `y` de pantalla. Se despeja: `py` es monótona en `h`. */
function alturaEn(objetivo, el) {
  let bajo = -6
  let alto = 12
  for (let i = 0; i < 60; i++) {
    const medio = (bajo + alto) / 2
    if (py(medio, el).py > objetivo) bajo = medio
    else alto = medio
  }
  return (bajo + alto) / 2
}

console.log(`\n  muro de enfrente a ${RADIO} m · cámara a ${DISTANCIA} m · lienzo ${ANCHO}×${ALTO}`)
console.log('  (banda = alturas del muro que caen DENTRO del cuadro; el suelo es 0 y el techo 4,2)\n')
console.log('   elev   arriba(y=0)   abajo(y=alto)   centro   ¿cabe un cuadro a 2,24 m?')
for (const el of [2, 4, 6, 8, 10, 12, 14, 20, 26, 32, 40, 46, 56]) {
  const arriba = alturaEn(0, el)
  const abajo = alturaEn(ALTO, el)
  const centro = alturaEn(ALTO / 2, el)
  const p = py(2.24, el).py
  const veredicto =
    p < 0 ? `NO: sale en y=${Math.round(p)}` : p > ALTO ? `NO: sale en y=${Math.round(p)}` : `sí, en y=${Math.round(p)}`
  const f = (n) => n.toFixed(2).replace('.', ',').padStart(7)
  console.log(
    `   ${String(el).padStart(3)}°  ${f(arriba)} m    ${f(abajo)} m    ${f(centro)} m   ${veredicto}`,
  )
}
console.log('')
