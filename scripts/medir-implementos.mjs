/**
 * Cuánto cuesta poner los implementos en la escena, pieza a pieza.
 *
 *     npx vite-node scripts/medir-implementos.mjs
 *
 * Construye la escena de varios patrones distintos y cuenta los vértices y los
 * triángulos que añade CADA implemento por separado, contra el coste del sujeto
 * y el del escenario que ya estaban.
 *
 * Se cuenta pieza a pieza y no de golpe porque el total no dice nada útil: lo
 * que hay que saber es si una prensa cuesta como una barra, y con un solo
 * número esa pregunta no tiene respuesta. Además el reparto es la comprobación
 * de que la parte pura decide de verdad: si una sentadilla en barra y una
 * prensa devolvieran lo mismo, se vería aquí antes que en la pantalla.
 */

import { Malla } from '../src/domain/patrones/malla.ts'
import { resolver } from '../src/domain/patrones/esqueleto.ts'
import {
  implementosDeEscena,
  construirPieza,
} from '../src/features/entrenar/escena/implementos.ts'
import { PATRONES } from '../src/domain/patrones/catalogo.ts'
import { esqueletoEnFase } from '../src/domain/patrones/escena.ts'
import { construirHuesos } from '../src/domain/patrones/huesos.ts'
import { construirSala } from '../src/features/entrenar/escena/sala.ts'
import { construirLaboratorio } from '../src/domain/escenario/laboratorio.ts'

/** Los tres casos: peso libre, guiado y cable. Son las tres medidas distintas. */
const CASOS = [
  { categoria: 'SENTADILLA', nombre: 'SENTADILLA TRASERA CON BARRA' },
  { categoria: 'EMPUJE HORIZONTAL', nombre: 'PRESS BANCA CON MANCUERNAS' },
  { categoria: 'SENTADILLA', nombre: 'PRENSA A 45 GRADOS' },
  { categoria: 'TRACCIÓN VERTICAL', nombre: 'JALÓN AL PECHO EN POLEA' },
  { categoria: 'TRACCIÓN VERTICAL', nombre: 'DOMINADA ESTRICTA' },
  { categoria: 'EXTENSIÓN DE CADERA', nombre: 'PATADA DE GLÚTEO EN POLEA CON TOBILLERA' },
]

function medir(construir) {
  const m = new Malla(4096)
  construir(m)
  return { vertices: m.vertices, triangulos: m.indice.length / 3 }
}

const patronDe = (categoria) => PATRONES.find((p) => p.categoria === categoria)

console.log('COSTE DE CADA IMPLEMENTO, EN VÉRTICES Y TRIÁNGULOS')
console.log('')

// Las referencias contra las que se lee todo lo demás.
const esqueleto = construirHuesos()
console.log(
  `referencia · esqueleto del sujeto      ${String(esqueleto.vertices).padStart(6)} vértices  ` +
    `${String(esqueleto.indice.length / 3).padStart(6)} triángulos`,
)
const lab = medir((m) => construirLaboratorio(m))
console.log(
  `referencia · bahía de medida           ${String(lab.vertices).padStart(6)} vértices  ` +
    `${String(lab.triangulos).padStart(6)} triángulos`,
)
const salaM = medir((m) => construirSala(m, { series: 3, reps: 8, rir: 2 }))
console.log(
  `referencia · sala con marcadores       ${String(salaM.vertices).padStart(6)} vértices  ` +
    `${String(salaM.triangulos).padStart(6)} triángulos`,
)
console.log('')

let totalMax = 0
for (const caso of CASOS) {
  const escena = implementosDeEscena(caso.categoria, caso.nombre)
  const patron = patronDe(caso.categoria)
  // El esqueleto de la fase media: es donde la barra está más lejos del reposo.
  const esq = patron ? esqueletoEnFase(patron, 0.5, 1, 0) : resolver({}, [0, 0.95, 0], [0, 0, 0])

  console.log(`${caso.nombre}  [${caso.categoria}]`)
  if (escena.supuesto) {
    console.log('    el nombre no declara implemento: la escena supone peso libre')
  }
  if (escena.piezas.length === 0) {
    console.log('    sin implementos (el patrón no lleva carga externa que dibujar)')
  }
  let suma = 0
  for (const pieza of escena.piezas) {
    const r = medir((m) => construirPieza(m, pieza, esq))
    suma += r.vertices
    const etiqueta = pieza.forma ? `${pieza.pieza}/${pieza.forma}` : pieza.pieza
    console.log(
      `    ${etiqueta.padEnd(24)} ${String(r.vertices).padStart(5)} vértices  ` +
        `${String(r.triangulos).padStart(5)} triángulos   agarres: ${pieza.agarres
          .map((a) => a.hueso)
          .join(' + ') || 'ninguno (va en el suelo)'}`,
    )
    console.log(`      ${pieza.porQue}`)
  }
  if (suma > totalMax) totalMax = suma
  console.log(`    suma de la escena        ${String(suma).padStart(5)} vértices`)
  for (const aviso of escena.avisos) console.log(`    aviso: ${aviso}`)
  console.log('')
}

console.log(`El caso más caro de los medidos añade ${totalMax} vértices.`)
console.log(
  `Sobre el esqueleto solo (${esqueleto.vertices} vértices) eso es un ` +
    `${((totalMax / esqueleto.vertices) * 100).toFixed(1)} % más.`,
)
