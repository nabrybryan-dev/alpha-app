/**
 * ¿SE ATRAVIESA EL CUERPO? ¿Y ANIMA LA FICHA EL FALLO QUE ELLA MISMA DECLARA?
 *
 * Las dos preguntas salen del encargo de Bryan del 2026-09-06: «las diferentes elevaciones
 * laterales o, de pronto, aperturas... como conjugan muchos planos, las está haciendo de una
 * forma poco asertiva y poco natural».
 *
 * Lo que un ojo llama «poco natural» aquí se puede partir en cosas que se miden:
 *
 * 1. **Manos que se cruzan o entran en el tronco.** Dos manos a menos de un palmo, o una
 *    mano dentro del cilindro del torso, es un cuerpo atravesándose. Se ve antes que
 *    cualquier otra cosa.
 * 2. **La ficha animando su propio error.** Cada ficha lleva escrita una lista de `errores`
 *    y algunos nombran un canal: «encoger el trapecio» es `escapulaElev`, «doblar y estirar
 *    el codo» es `codoFlex`, «arquear la espalda» es `lumbarFlex`. Si el canal se mueve en
 *    la dirección del error, la demostración está enseñando lo contrario de lo que su
 *    propio texto dice.
 * 3. **El plano en el que ocurre.** Una elevación LATERAL que recorre más en profundidad
 *    que de lado no es una elevación lateral.
 *
 *     npx vite-node scripts/medir-gestos.mjs
 */
import { PATRONES } from '../src/domain/patrones/catalogo.ts'
import { esqueletoEnFase } from '../src/domain/patrones/escena.ts'
import { puntoDeHueso } from '../src/domain/patrones/esqueleto.ts'

const FASES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
const cm = (m) => Math.round(m * 1000) / 10
const dos = (x) => (Math.round(x * 100) / 100).toFixed(2)

/** Distancia de un punto al segmento pelvis→cuello, que es el eje del tronco. */
function alEjeDelTronco(esq, p) {
  const a = puntoDeHueso(esq, 'pelvis', 0)
  const b = puntoDeHueso(esq, 'torax', 1)
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const largo2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / largo2))
  const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

console.log('## EL CUERPO NO SE ATRAVIESA\n')
console.log('| patrón | manos, lo más cerca | mano al eje del tronco, lo más cerca |')
console.log('| --- | --- | --- |')
const cruces = []
for (const p of PATRONES) {
  let manos = Infinity
  let alTronco = Infinity
  for (const f of FASES) {
    const esq = esqueletoEnFase(p, f)
    const d = puntoDeHueso(esq, 'manoD', 0.5)
    const i = puntoDeHueso(esq, 'manoI', 0.5)
    manos = Math.min(manos, Math.hypot(d[0] - i[0], d[1] - i[1], d[2] - i[2]))
    alTronco = Math.min(alTronco, alEjeDelTronco(esq, d), alEjeDelTronco(esq, i))
  }
  console.log(`| ${p.id} | ${cm(manos)} cm | ${cm(alTronco)} cm |`)
  // Un tronco humano mide unos 16 cm de semianchura a la altura del pecho; una mano dentro
  // de eso está DENTRO del cuerpo. Y dos manos a menos de 8 cm se tocan.
  if (manos < 0.08 || alTronco < 0.13) cruces.push({ id: p.id, manos, alTronco })
}
console.log('\n### Los que se atraviesan\n')
if (cruces.length === 0) console.log('ninguno')
for (const c of cruces) {
  console.log(`- **${c.id}** · manos a ${cm(c.manos)} cm · mano al tronco ${cm(c.alTronco)} cm`)
}

/**
 * Los errores que la ficha escribe y el canal que los delata.
 *
 * No es una tabla de estilo: cada línea sale de una frase que ya está escrita en el campo
 * `errores` de alguna ficha. Si el patrón encaja con el texto del error Y el canal se mueve
 * en esa dirección, la demostración anima el fallo que ella misma desaconseja.
 */
const ERRORES = [
  { texto: /encoger el trapecio|trapecio.*encog|subir el hombro/i, canal: 'escapulaElev', signo: 1, dice: 'sube el hombro con el brazo' },
  { texto: /doblar y estirar el codo|doblar el codo progresivamente/i, canal: 'codoFlex', signo: 0, dice: 'el codo cambia de ángulo' },
  { texto: /arquear la espalda|perder la espalda neutra|redondear la zona lumbar/i, canal: 'lumbarFlex', signo: 0, dice: 'la lumbar se mueve' },
  { texto: /impulsar con las piernas|ayudarse.*piernas|balanceo/i, canal: 'rodillaFlex', signo: 0, dice: 'la rodilla se mueve' },
]

console.log('\n## LA FICHA ANIMANDO SU PROPIO ERROR\n')
console.log('| patrón | error escrito | canal | inicio → fin |')
console.log('| --- | --- | --- | --- |')
const contradicciones = []
for (const p of PATRONES) {
  for (const e of ERRORES) {
    const frase = p.errores.find((x) => e.texto.test(x))
    if (!frase) continue
    const a = p.inicio[e.canal] ?? 0
    const b = p.fin[e.canal] ?? 0
    const cambio = b - a
    // Con signo 1 el error es que CREZCA; con signo 0, que se mueva en cualquier dirección.
    const anima = e.signo === 1 ? cambio > 6 : Math.abs(cambio) > 10
    if (Math.abs(cambio) < 0.5 && !anima) continue
    console.log(`| ${p.id} | ${frase.slice(0, 46)}… | ${e.canal} | ${a} → ${b} |`)
    if (anima) contradicciones.push({ id: p.id, canal: e.canal, a, b, dice: e.dice, frase })
  }
}
console.log('\n### Los que animan lo que desaconsejan\n')
if (contradicciones.length === 0) console.log('ninguno')
for (const c of contradicciones) {
  console.log(`- **${c.id}** · ${c.canal} ${c.a} → ${c.b}: ${c.dice}, y su ficha dice «${c.frase}»`)
}

console.log('\n## EL PLANO EN EL QUE OCURRE\n')
console.log('cuánto recorre la mano en cada eje: X frontal (de lado), Y vertical, Z sagital\n')
console.log('| patrón | X | Y | Z | manda |')
console.log('| --- | --- | --- | --- | --- |')
for (const p of PATRONES) {
  const pts = FASES.map((f) => puntoDeHueso(esqueletoEnFase(p, f), 'manoD', 0.45))
  const r = [0, 1, 2].map((e) => Math.max(...pts.map((q) => q[e])) - Math.min(...pts.map((q) => q[e])))
  const manda = ['frontal', 'vertical', 'sagital'][r.indexOf(Math.max(...r))]
  console.log(`| ${p.id} | ${cm(r[0])} | ${cm(r[1])} | ${cm(r[2])} | ${manda} (${dos(Math.max(...r) / (r.reduce((s, x) => s + x, 0) || 1))}) |`)
}
