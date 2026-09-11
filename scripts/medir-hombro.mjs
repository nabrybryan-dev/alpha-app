/**
 * EL HOMBRO, EJERCICIO POR EJERCICIO, EN LOS TRES PLANOS.
 *
 * Bryan, 2026-09-07: «que pueda revisar bien todos los ejercicios que requieran involucrar la
 * articulación glenohumeral, porque como tiene tanta capacidad de ejercer movimiento en
 * diferentes ángulos, al conjugar las abducciones, aducciones, las flexiones, extensiones,
 * rotaciones externas e internas, te puedes confundir y no lo puedes hacer bien… verificas
 * que los segmentos se mueven justamente en los ángulos que estamos hablando… se ven
 * antinaturales. Incluso hacen acciones en el codo que no puede hacer».
 *
 * ## Por qué no basta con leer los canales de la ficha
 *
 * Los tres canales del hombro se aplican como ángulos de Euler encadenados (`Ry·Rx·Rz`), y
 * eso quiere decir que NO son independientes: con el brazo caído `hombroRot` gira el húmero
 * sobre su eje, pero con el brazo elevado ese mismo canal barre el brazo en horizontal.
 * Escribir «rotación externa 40» no garantiza una rotación externa. Así que aquí no se lee
 * la ficha: se resuelve el esqueleto y se miden los HUESOS, que es lo que el asesorado ve.
 *
 * Las cuatro medidas, todas sobre el hueso y en grados:
 *
 * - **elevación** del húmero: 0° brazo colgando, 90° horizontal, 180° vertical sobre la
 *   cabeza. Es el «cuánto sube», sin decir por dónde.
 * - **plano** (azimut): 0° = brazo hacia el lado (plano frontal puro, codos en cruz),
 *   90° = brazo al frente (plano sagital). El plano escapular de un hombro sano cae entre
 *   los 30° y los 45°.
 * - **rotación** del húmero sobre su propio eje, leída con el antebrazo y con la referencia
 *   de la consulta: 0° = antebrazo hacia delante, +90° = hacia arriba (rotación externa),
 *   −90° = hacia abajo (interna). Con el codo estirado no hay nada que leer: sale «—».
 * - **codo**: el ángulo entre húmero y antebrazo. 180° es el codo estirado del todo.
 *
 * ## Lo que el codo NO puede hacer
 *
 * El codo es una bisagra con un solo grado de libertad (más la pronosupinación del
 * antebrazo, que no dobla nada). Dos cosas lo delatan:
 *
 * 1. **Hiperextensión**: pasar de 180° es un codo roto hacia el otro lado. Se tolera hasta
 *    185°, que es el recurvatum normal de mucha gente.
 * 2. **Doblarse de lado**: el antebrazo saliéndose del plano de flexión del codo. En este
 *    rig no puede pasar por construcción, pero se mide igual, porque si algún día alguien
 *    mete un canal nuevo en el antebrazo esto lo caza el primer día.
 *
 * Y la tercera, que no es del codo pero se ve igual de mal: **el codo cambiando de ángulo
 * en un ejercicio de brazo rígido**. Una elevación lateral con el codo yendo de 120° a 175°
 * es un curl disfrazado.
 *
 *     npx vite-node scripts/medir-hombro.mjs
 */
import { PATRONES } from '../src/domain/patrones/catalogo.ts'
import { esqueletoEnFase } from '../src/domain/patrones/escena.ts'
import { puntoDeHueso } from '../src/domain/patrones/esqueleto.ts'

const FASES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
const grados = (r) => (r * 180) / Math.PI
const r0 = (x) => Math.round(x)
const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norma = (v) => Math.hypot(v[0], v[1], v[2])
const unitario = (v) => { const n = norma(v) || 1; return [v[0] / n, v[1] / n, v[2] / n] }
const angulo = (a, b) => grados(Math.acos(Math.max(-1, Math.min(1, punto(a, b) / ((norma(a) * norma(b)) || 1)))))

/**
 * Las cuatro medidas de un brazo, sobre los huesos ya resueltos y EN EL SISTEMA DEL TRONCO.
 *
 * Contra la vertical del mundo, un press de banca daba «elevación 155°» —el sujeto está
 * tumbado— y una apertura inversa de pie doblada daba planos imposibles. Lo que importa es
 * el brazo respecto al torso, que es como se describe cualquier gesto en anatomía: el eje
 * arriba es pelvis→cuello, el eje fuera es la línea de los hombros y el frente sale del
 * producto de los dos. Así el press tumbado y el press de pie se leen igual, que es lo
 * correcto: son el mismo gesto en distinta postura.
 */
export function brazoDe(esq, lado) {
  const otro = lado === 'D' ? 'I' : 'D'
  const hombro = puntoDeHueso(esq, 'brazo' + lado, 0)
  const codo = puntoDeHueso(esq, 'brazo' + lado, 1)
  const muneca = puntoDeHueso(esq, 'antebrazo' + lado, 1)
  const hombroOtro = puntoDeHueso(esq, 'brazo' + otro, 0)
  const humero = resta(codo, hombro)
  const antebrazo = resta(muneca, codo)
  // El sistema del tronco: arriba pelvis→cuello, fuera la línea de hombros, frente el resto.
  const arriba = unitario(resta(puntoDeHueso(esq, 'torax', 1), puntoDeHueso(esq, 'pelvis', 0)))
  const fueraCrudo = resta(hombro, hombroOtro)
  const fuera = unitario(resta(fueraCrudo, arriba.map((c) => c * punto(fueraCrudo, arriba))))
  const frente = unitario(cruz(arriba, fuera))
  const elevacion = angulo(humero, arriba.map((c) => -c))
  const plano = grados(Math.atan2(punto(humero, frente), punto(humero, fuera)))
  // LA ROTACIÓN DEL HÚMERO se lee con el antebrazo, y la referencia es la de la consulta:
  // 0° = antebrazo hacia DELANTE, +90° = rotación externa, −90° = interna. Vale con el brazo
  // pegado al costado (el antebrazo se abre hacia fuera) y con el brazo abducido a 90° (el
  // antebrazo sube), que es justo lo que hace falta para comparar una rotación externa en
  // polea con un face pull.
  //
  // DOS VERSIONES ANTERIORES SE ROMPIERON, y por lo mismo: una referencia que se degenera.
  // Medir el antebrazo contra el plano (húmero, eje del tronco) daba 0° en un face pull
  // acabado, que es rotación externa de manual. Y con el brazo COLGANDO ese plano no existe
  // —el húmero es casi paralelo al eje del tronco—, así que el catálogo entero daba ceros
  // donde había 90° de giro: el hueso se movía y el número no. La buena es esta: se toma la
  // parte de «hacia delante» perpendicular al húmero y se mide el giro alrededor del hueso.
  // Solo se cambia de referencia cuando el brazo apunta al frente y esa parte se queda sin
  // longitud; entonces sirve la de «hacia fuera», corrida los 90° que las separan.
  const eje = unitario(humero)
  const sinEje = (v) => resta(v, eje.map((c) => c * punto(v, eje)))
  const proyectado = sinEje(antebrazo)
  const codoAngulo = angulo([-humero[0], -humero[1], -humero[2]], antebrazo)
  const giroSobre = (base, desfase) => {
    const b = unitario(base)
    const segundo = unitario(cruz(eje, b))
    const a = grados(Math.atan2(punto(proyectado, segundo), punto(proyectado, b))) + desfase
    return a > 180 ? a - 360 : a < -180 ? a + 360 : a
  }
  const haciaDelante = sinEje(frente)
  const haciaFuera = sinEje(fuera)
  // CON EL CODO CASI ESTIRADO NO SE LEE, y el tope es generoso a propósito: a 165° el
  // antebrazo sobresale del eje del húmero tres centímetros, así que el ángulo existe pero
  // basta un pelo para que dé media vuelta. Un pullover de brazo recto marcaba 177° de giro
  // —geometría cierta, gesto invisible—. Por debajo de 150° de codo el antebrazo ya es una
  // aguja fiable.
  const rotacion =
    codoAngulo > 150 || norma(proyectado) < 0.02
      ? null
      : norma(haciaDelante) > 0.3
        ? giroSobre(haciaDelante, 0)
        : giroSobre(haciaFuera, 90)
  // El plano tampoco se lee con el brazo colgando: a 10° de elevación un grado de nada
  // manda el azimut de −80 a +80 sin que el brazo se haya movido.
  return { elevacion, plano: elevacion < 25 ? null : plano, rotacion, codo: codoAngulo }
}

const patronesConHombro = PATRONES.filter((p) => {
  const canales = [...Object.keys(p.inicio), ...Object.keys(p.fin), ...Object.keys(p.medio ?? {})]
  return canales.some((c) => c.startsWith('hombro'))
})

console.log(`## LOS ${patronesConHombro.length} PATRONES QUE MUEVEN O COLOCAN EL HOMBRO\n`)
console.log('elevación 0=colgando 90=horizontal 180=arriba · plano 0=al lado 90=al frente · codo 180=estirado\n')
console.log('| patrón | elevación | plano | rotación | codo |')
console.log('| --- | --- | --- | --- | --- |')

const sospechas = []
for (const p of patronesConHombro) {
  const serie = FASES.map((f) => brazoDe(esqueletoEnFase(p, f), 'D'))
  const rango = (clave) => {
    let v = serie.map((s) => s[clave]).filter((x) => x !== null)
    // La rotación vive en un círculo: 176° y −167° son 17° de distancia, no 343. Se estira la
    // serie sumando o restando vueltas para que dos fases seguidas nunca disten más de media
    // vuelta; sin esto, un face pull que cruza el ±180 parecía dar tres cuartos de vuelta.
    if (clave === 'rotacion') {
      const estirada = []
      for (const x of v) {
        const previo = estirada.length ? estirada[estirada.length - 1] : x
        let y = x
        while (y - previo > 180) y -= 360
        while (previo - y > 180) y += 360
        estirada.push(y)
      }
      v = estirada
    }
    return v.length ? [Math.min(...v), Math.max(...v)] : null
  }
  const e = rango('elevacion')
  const pl = rango('plano')
  const rot = rango('rotacion')
  const codo = rango('codo')
  const txt = (r) => (r ? (r0(r[0]) === r0(r[1]) ? `${r0(r[0])}` : `${r0(r[0])} → ${r0(r[1])}`) : '—')
  console.log(`| ${p.id} | ${txt(e)} | ${txt(pl)} | ${txt(rot)} | ${txt(codo)} |`)

  const motivos = []
  // 1. El codo no se dobla hacia el otro lado.
  if (codo && codo[1] > 185) motivos.push(`codo a ${r0(codo[1])}°: hiperextensión`)
  // 2. Un brazo elevado en el plano frontal PURO es el gesto que pellizca el hombro. Solo
  //    se señala si además sube por encima de la horizontal, que es donde duele.
  if (e && e[1] > 100 && pl && Math.abs(pl[0]) < 12 && Math.abs(pl[1]) < 12) {
    motivos.push(`sube a ${r0(e[1])}° en el plano frontal puro (${r0(pl[0])}°→${r0(pl[1])}°)`)
  }
  // 3. El brazo por detrás del cuerpo TENIÉNDOLO ALTO, y las dos cosas EN LA MISMA FASE: por
  //    separado saltaba el salto, que arranca con los brazos atrás y abajo y acaba con los
  //    brazos arriba y delante, que es exactamente lo que hace quien salta.
  const atrasYArriba = serie.find((x) => x.plano !== null && x.plano < -20 && x.elevacion > 90)
  if (atrasYArriba) motivos.push(`el brazo se va ${r0(-atrasYArriba.plano)}° por detrás con el húmero a ${r0(atrasYArriba.elevacion)}°`)
  // 4. El codo cambiando mucho en un patrón que la ficha llama de brazo rígido.
  const rigido = /codo (fijo|ligeramente|casi)|brazo (rígido|extendido)|sin doblar el codo/i
  const dice = [...p.claves, ...p.errores].find((t) => rigido.test(t))
  if (dice && codo && codo[1] - codo[0] > 25) motivos.push(`el codo recorre ${r0(codo[1] - codo[0])}° y su ficha dice «${dice.slice(0, 40)}…»`)
  // 5. La rotación dando una vuelta entera por el camino: el brazo gira sobre sí mismo.
  if (rot && rot[1] - rot[0] > 120) motivos.push(`el húmero gira ${r0(rot[1] - rot[0])}° sobre su eje`)
  if (motivos.length) sospechas.push({ id: p.id, motivos })
}

console.log('\n## LOS QUE PIDEN UNA MIRADA\n')
if (sospechas.length === 0) console.log('ninguno')
for (const s of sospechas) console.log(`- **${s.id}**: ${s.motivos.join(' · ')}`)

console.log('\n## EL CODO, FASE A FASE, EN LOS QUE MÁS LO MUEVEN\n')
for (const p of patronesConHombro) {
  const serie = FASES.map((f) => brazoDe(esqueletoEnFase(p, f), 'D').codo)
  const recorrido = Math.max(...serie) - Math.min(...serie)
  if (recorrido < 40) continue
  console.log(`${p.id.padEnd(24)} ${serie.map(r0).join(' → ')}`)
}
