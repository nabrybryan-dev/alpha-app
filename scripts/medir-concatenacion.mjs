/**
 * ¿CUÁNTO CUESTA CONCATENAR LAS MALLAS, Y CUÁNTO COSTARÍA NO HACERLO ASÍ?
 *
 * `motor.ts:subir()` junta todas las mallas en un solo búfer de tres pasos:
 *   1. `pos.push(...m.posicion)` — un `number[]` que crece,
 *   2. `new Float32Array(datos)` — una copia entera, desempaquetando doubles,
 *   3. `bufferData` — la subida de verdad.
 *
 * El paso 3 es el único que toca la GPU. Los pasos 1 y 2 son CPU pura, y el
 * informe del presupuesto ya decía que `subir()` se lleva el 83 % del fotograma.
 * Esto mide cuál de los tres es, y qué pasa si se reserva el `Float32Array` de
 * una vez y se escribe con `.set()` — que es el mismo resultado sin los pasos
 * 1 y 2.
 *
 * No toca la GPU: mide justo la parte que no la necesita, y por eso corre en
 * Node y da un número repetible.
 */

// Un reparto realista: la malla ronda los 20.000 vértices repartidos en muchas
// piezas pequeñas (la sala, el mobiliario, los implementos, el sujeto).
const PIEZAS = 220
const VERTS_POR_PIEZA = 91 // 220 x 91 ~ 20.000

function mallasDePrueba() {
  const mallas = []
  for (let p = 0; p < PIEZAS; p++) {
    const n = VERTS_POR_PIEZA
    const posicion = new Array(n * 3)
    for (let i = 0; i < n * 3; i++) posicion[i] = Math.sin(p * 7.1 + i * 0.37)
    mallas.push({ posicion, vertices: n })
  }
  return mallas
}

/** Como está hoy: spread hacia un `number[]`, y una copia al final. */
function comoEstaHoy(mallas) {
  const pos = []
  for (const m of mallas) pos.push(...m.posicion)
  return new Float32Array(pos)
}

/** Reservando de una vez y escribiendo en su sitio. Mismo resultado. */
function reservandoAntes(mallas) {
  let total = 0
  for (const m of mallas) total += m.posicion.length
  const pos = new Float32Array(total)
  let off = 0
  for (const m of mallas) {
    pos.set(m.posicion, off)
    off += m.posicion.length
  }
  return pos
}

function medir(nombre, fn, mallas, vueltas) {
  fn(mallas); fn(mallas) // calentar
  const t0 = performance.now()
  for (let i = 0; i < vueltas; i++) fn(mallas)
  const ms = (performance.now() - t0) / vueltas
  console.log(`  ${nombre.padEnd(22)} ${ms.toFixed(3)} ms`)
  return ms
}

const mallas = mallasDePrueba()
const verts = mallas.reduce((a, m) => a + m.vertices, 0)
console.log(`\n${PIEZAS} piezas, ${verts} vertices, solo el atributo de posicion.`)
console.log('(el motor sube CINCO atributos asi, mas los indices)\n')

const VUELTAS = 200
const hoy = medir('como esta hoy', comoEstaHoy, mallas, VUELTAS)
const nuevo = medir('reservando antes', reservandoAntes, mallas, VUELTAS)

// Y que de verdad devuelvan lo mismo, porque si no la medida no vale nada.
const a = comoEstaHoy(mallas), b = reservandoAntes(mallas)
let iguales = a.length === b.length
for (let i = 0; iguales && i < a.length; i++) if (a[i] !== b[i]) iguales = false
console.log(`\n  identicas: ${iguales ? 'SI' : 'NO -- la medida NO vale'}`)
console.log(`  factor:    ${(hoy / nuevo).toFixed(1)}x`)
console.log(`  por los 5 atributos, ahorro estimado: ${((hoy - nuevo) * 5).toFixed(2)} ms/fotograma\n`)
