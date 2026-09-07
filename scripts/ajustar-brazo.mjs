/**
 * QUÉ CANALES PONER PARA QUE EL BRAZO QUEDE DONDE SE QUIERE.
 *
 * Los tres canales del hombro son ángulos de Euler encadenados, así que no se pueden elegir
 * de uno en uno: subir la abducción cambia lo que hace la rotación, y con el brazo elevado
 * la flexión barre en horizontal. Este barrido va al revés que la intuición: se pide el
 * RESULTADO en huesos —cuánto sube el húmero, en qué plano, cuánto dobla el codo y hacia
 * dónde apunta el antebrazo— y devuelve los cuatro canales que lo producen.
 *
 * Nació el 2026-09-07 para recolocar los press después de arreglar la bisagra del codo
 * (`esqueleto.ts`), y sirve para cualquier ficha con hombro.
 *
 *     npx vite-node scripts/ajustar-brazo.mjs empuje_horizontal inicio 55 15 95 frente
 *     npx vite-node scripts/ajustar-brazo.mjs <patrón> <inicio|medio|fin> <elev> <plano> <codo> [frente|fuera|arriba|ninguno]
 *
 * Con `ninguno` no se pide nada al antebrazo, que es lo que quiere un gesto de brazo casi
 * recto: ahí el antebrazo va donde lo lleve el húmero y pedirle una dirección tuerce el resto.
 */
import { PATRONES } from '../src/domain/patrones/catalogo.ts'
import { esqueletoEnFase } from '../src/domain/patrones/escena.ts'
import { puntoDeHueso } from '../src/domain/patrones/esqueleto.ts'

const grados = (r) => (r * 180) / Math.PI
const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norma = (v) => Math.hypot(v[0], v[1], v[2])
const unitario = (v) => { const n = norma(v) || 1; return [v[0] / n, v[1] / n, v[2] / n] }
const angulo = (a, b) => grados(Math.acos(Math.max(-1, Math.min(1, punto(a, b) / ((norma(a) * norma(b)) || 1)))))

/** Húmero y antebrazo en el sistema del tronco, que es como se describe un gesto. */
export function brazoEnElTronco(esq, lado = 'D') {
  const otro = lado === 'D' ? 'I' : 'D'
  const hombro = puntoDeHueso(esq, 'brazo' + lado, 0)
  const codo = puntoDeHueso(esq, 'brazo' + lado, 1)
  const muneca = puntoDeHueso(esq, 'antebrazo' + lado, 1)
  const arriba = unitario(resta(puntoDeHueso(esq, 'torax', 1), puntoDeHueso(esq, 'pelvis', 0)))
  const fueraCrudo = resta(hombro, puntoDeHueso(esq, 'brazo' + otro, 0))
  const fuera = unitario(resta(fueraCrudo, arriba.map((c) => c * punto(fueraCrudo, arriba))))
  const frente = unitario(cruz(arriba, fuera))
  const humero = resta(codo, hombro)
  const antebrazo = unitario(resta(muneca, codo))
  return {
    elevacion: angulo(humero, arriba.map((c) => -c)),
    plano: grados(Math.atan2(punto(humero, frente), punto(humero, fuera))),
    codo: angulo([-humero[0], -humero[1], -humero[2]], resta(muneca, codo)),
    // Hacia dónde mira el antebrazo, en los tres ejes del tronco, de −1 a 1.
    antebrazo: { frente: punto(antebrazo, frente), fuera: punto(antebrazo, fuera), arriba: punto(antebrazo, arriba) },
  }
}

// El barrido solo corre si se le pide por línea de órdenes: así `brazoEnElTronco` se puede
// importar desde otro script sin que este se ponga a barrer.
const [id, cual, elevObj, planoObj, codoObj, haciaDonde = 'frente'] = process.argv.slice(2)
if (id) barrer()

function barrer() {
const base = PATRONES.find((p) => p.id === id)
if (!base) throw new Error(`no existe el patrón ${id}`)
const pose = { ...(base[cual] ?? base.inicio) }
const conPose = (extra) => {
  const p = { ...pose, ...extra }
  return esqueletoEnFase({ ...base, inicio: p, fin: p, medio: undefined }, 0)
}

const E = Number(elevObj)
const A = Number(planoObj)
const C = Number(codoObj)
let mejor = null
for (let abd = -20; abd <= 180; abd += 2) {
  for (let flex = -60; flex <= 180; flex += 3) {
    for (let rot = -90; rot <= 90; rot += 5) {
      for (const codo of [C]) {
        const m = brazoEnElTronco(conPose({ hombroAbd: abd, hombroFlex: flex, hombroRot: rot, codoFlex: codo }))
        const coste =
          Math.abs(m.elevacion - E) +
          Math.abs(m.plano - A) +
          Math.abs(m.codo - (180 - C)) * 0.5 +
          (haciaDonde === 'ninguno' ? 0 : (1 - m.antebrazo[haciaDonde]) * 60)
        if (!mejor || coste < mejor.coste) mejor = { coste, abd, flex, rot, codo, m }
      }
    }
  }
}
const r1 = (x) => Math.round(x * 10) / 10
console.log(`${id}.${cual}: hombroAbd ${mejor.abd} · hombroFlex ${mejor.flex} · hombroRot ${mejor.rot} · codoFlex ${mejor.codo}`)
console.log(`  → elevación ${r1(mejor.m.elevacion)} (pedida ${E}) · plano ${r1(mejor.m.plano)} (pedido ${A}) · codo ${r1(mejor.m.codo)}`)
console.log(`  → antebrazo hacia: frente ${r1(mejor.m.antebrazo.frente)} · fuera ${r1(mejor.m.antebrazo.fuera)} · arriba ${r1(mejor.m.antebrazo.arriba)}`)
}
