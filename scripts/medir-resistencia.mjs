/**
 * ¿LA RESISTENCIA SE OPONE AL MOVIMIENTO? Y ¿HAY ALGO BAJO EL SUELO?
 *
 * Dos preguntas que Bryan hizo el 2026-09-06 con las mismas palabras: «si yo voy a hacer
 * fuerza hacia arriba, yo requiero que la fuerza de la máquina me impulse hacia abajo», y
 * el pie de atrás del búlgaro hundido bajo la goma.
 *
 * Las dos se miden, no se opinan:
 *
 * 1. **Oposición.** Se saca el punto por donde entra la carga (`agarres` de la escena de
 *    implementos, resueltos sobre el esqueleto real de cada fase), se mide hacia dónde va
 *    y hacia dónde tira el implemento, y se compara con un coseno. −1 es oposición
 *    perfecta; 0 es una resistencia PERPENDICULAR al gesto, o sea una máquina que no
 *    resiste nada; +1 es una máquina que AYUDA, que es peor todavía.
 * 2. **Suelo.** Se recorre cada extremo de cada hueso en once fases y se mira el punto más
 *    bajo. Los pies se miden por la planta (7,5 cm bajo el tobillo); el resto, por el hueso.
 *
 *     npx vite-node scripts/medir-resistencia.mjs
 *     npx vite-node scripts/medir-resistencia.mjs --suelo
 *     npx vite-node scripts/medir-resistencia.mjs --id sentadilla_unilateral
 */
import process from 'node:process'
import { PATRONES } from '../src/domain/patrones/catalogo.ts'
import { esqueletoEnFase } from '../src/domain/patrones/escena.ts'
import { puntoDeHueso } from '../src/domain/patrones/esqueleto.ts'
import { ESQUELETO, PLANTA_NEUTRA } from '../src/domain/patrones/huesosNeutros.ts'
import { V } from '../src/domain/patrones/algebra.ts'
import { implementosDeEscena } from '../src/features/entrenar/escena/implementos.ts'
// La regla y su medida viven en el código, no aquí: este script solo las pasea por el
// catálogo. Dos definiciones de «oponerse» acabarían diciendo cosas distintas.
import { direccionDeResistencia, oposicion } from '../src/features/entrenar/escena/lineaDeResistencia.ts'

const FASES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
const cm = (m) => Math.round(m * 1000) / 10
const dos = (x) => (Math.round(x * 100) / 100).toFixed(2)

const args = process.argv.slice(2)
const soloSuelo = args.includes('--suelo')
const soloResistencia = args.includes('--resistencia')
const idPedido = args.includes('--id') ? args[args.indexOf('--id') + 1] : undefined

// `--ejemplo "Sentadilla con barra"` fuerza el nombre con el que se pregunta, para poder
// medir la variante de peso libre de una ficha cuyo primer ejemplo es una máquina.
const nombreForzado = args.includes('--ejemplo') ? args[args.indexOf('--ejemplo') + 1] : undefined
const primerEjemplo = (p) => nombreForzado ?? p.ejemplos.split('·')[0].trim()

/** El punto de mundo de un agarre, con el esqueleto ya resuelto. */
function puntoDeAgarre(esq, agarre) {
  return puntoDeHueso(esq, agarre.hueso, agarre.t, agarre.desvio)
}

/** El punto por donde entra la carga: el medio de los agarres cuando hay dos. */
function puntoDeCarga(esq, agarres) {
  if (agarres.length === 0) return undefined
  const suma = agarres.reduce((acc, a) => V.sumar(acc, puntoDeAgarre(esq, a)), [0, 0, 0])
  return V.escalar(suma, 1 / agarres.length)
}

function medirResistencia(patron) {
  const ejemplo = primerEjemplo(patron)
  const escena = implementosDeEscena(patron.categoria, ejemplo)
  const esqs = FASES.map((f) => esqueletoEnFase(patron, f))
  const filas = []
  for (const pieza of escena.piezas) {
    if (pieza.pieza === 'banco' || pieza.pieza === 'barra-fija') continue
    if (pieza.agarres.length === 0) continue
    const puntos = esqs.map((e) => puntoDeCarga(e, pieza.agarres))
    const mov = V.restar(puntos[puntos.length - 1], puntos[0])
    const recorrido = Math.hypot(mov[0], mov[1], mov[2])
    if (recorrido < 1e-4) {
      filas.push({ pieza: pieza.pieza, forma: pieza.forma, recorrido: 0, cos: null, nota: 'isométrico' })
      continue
    }
    const u = V.escalar(mov, 1 / recorrido)
    // El coseno en el MEDIO del recorrido, que es donde la resistencia manda, y los
    // extremos para ver si se tuerce.
    const cosenos = []
    let brazo = []
    for (let i = 0; i < FASES.length; i++) {
      const r = direccionDeResistencia(pieza, puntos[i])
      if (!r) continue
      cosenos.push(oposicion(r, u))
      const anclaje = pieza.enElSuelo?.anclaje
      if (anclaje && r.origen !== 'gravedad') brazo.push(Math.hypot(...V.restar(anclaje, puntos[i])))
    }
    if (cosenos.length === 0) {
      filas.push({ pieza: pieza.pieza, forma: pieza.forma, recorrido, cos: null, nota: 'sin línea' })
      continue
    }
    const medio = cosenos[Math.floor(cosenos.length / 2)]
    filas.push({
      pieza: pieza.pieza,
      forma: pieza.forma,
      de: direccionDeResistencia(pieza, puntos[0])?.origen,
      recorrido,
      cos: medio,
      cosMin: Math.min(...cosenos),
      cosMax: Math.max(...cosenos),
      // Para la máquina de placas: el brazo dibujado tiene que ser RÍGIDO.
      estira: brazo.length ? Math.max(...brazo) - Math.min(...brazo) : 0,
      mov: u,
    })
  }
  return { ejemplo, escena, filas }
}

function medirSuelo(patron) {
  let peor = { y: Infinity, hueso: '', fase: 0 }
  /** Lo más bajo que llega CADA hueso en todo el ciclo. */
  const porHueso = new Map()
  for (const f of FASES) {
    const esq = esqueletoEnFase(patron, f)
    for (const h of ESQUELETO) {
      // LA SONDA DE LA PLANTA VA EN +Z LOCAL, no restando de la Y del mundo. El pie lleva
      // un reposo de −90° sobre X, asi que su +Z local apunta hacia abajo, y restar 7,5 cm
      // de la altura solo acierta con el pie horizontal: con el pie inclinado —una
      // dorsiflexion, un apoyo a una pierna— cuenta de mas y saca hundimientos de medio
      // centimetro que no existen. Es la misma sonda que usa `resolverConApoyo`.
      const esPie = h.nombre.startsWith('pie')
      for (const t of [0, 0.5, 1]) {
        const y = esPie
          ? Math.min(
              puntoDeHueso(esq, h.nombre, t)[1],
              puntoDeHueso(esq, h.nombre, t, [0, 0, PLANTA_NEUTRA])[1],
            )
          : puntoDeHueso(esq, h.nombre, t)[1]
        if (y < peor.y) peor = { y, hueso: h.nombre, fase: f }
        const antes = porHueso.get(h.nombre)
        if (!antes || y < antes.y) porHueso.set(h.nombre, { y, fase: f, t })
      }
    }
  }
  return { ...peor, porHueso }
}

/**
 * ¿EN QUÉ SENTIDO CORRE LA REPETICIÓN? Contra la gravedad, o a favor.
 *
 * `faseDeTiempo` da 1,2 s al tramo 0→1 con su punto de atasco y 1,9 s al 1→0 «bajando
 * frenando»: el repo declara que **0→1 es la concéntrica**. Así que una ficha cuyo punto
 * cargado BAJA de 0 a 1 se está animando al revés —cae rápido con atasco y se levanta
 * despacio—, que es de las cosas que más delatan a un maniquí.
 *
 * Se mide sobre el punto que la ficha declara seguir, y si no sigue ninguno, sobre la
 * pelvis, que es el centro del cuerpo.
 */
function sentidoDeLaRepeticion(patron) {
  const [hueso, t, desvio] = patron.seguimiento ?? ['pelvis', 0, [0, 0, 0]]
  const nombre = patron.seguimiento && !ESQUELETO.some((h) => h.nombre === hueso) ? hueso + 'D' : hueso
  const y = FASES.map((f) => puntoDeHueso(esqueletoEnFase(patron, f), nombre, t, desvio)[1])
  return { hueso: nombre, subida: y[y.length - 1] - y[0], recorrido: Math.max(...y) - Math.min(...y) }
}

const patrones = idPedido ? PATRONES.filter((p) => p.id === idPedido) : PATRONES

// `--rastro tibiaI,pieD` imprime dónde va cada uno de esos huesos en las once fases.
if (args.includes('--rastro')) {
  const huesos = args[args.indexOf('--rastro') + 1].split(',')
  for (const p of patrones) {
    console.log(`## ${p.id}`)
    console.log('| fase | ' + huesos.map((h) => `${h} t0 | ${h} t1`).join(' | ') + ' |')
    for (const f of FASES) {
      const esq = esqueletoEnFase(p, f)
      const celdas = huesos.flatMap((h) =>
        [0, 1].map((t) => puntoDeHueso(esq, h, t).map((v) => dos(v)).join(' ')),
      )
      console.log(`| ${dos(f)} | ${celdas.join(' | ')} |`)
    }
  }
  process.exit(0)
}

if (!soloSuelo) {
  console.log('## OPOSICIÓN: ¿la resistencia va contra el gesto?\n')
  console.log('cos ≈ −1 se opone · cos ≈ 0 es perpendicular (no resiste) · cos > 0 AYUDA\n')
  console.log('| patrón | pieza | línea | recorrido | cos medio | cos min→max | estira |')
  console.log('| --- | --- | --- | --- | --- | --- | --- |')
  const malos = []
  for (const p of patrones) {
    const { filas } = medirResistencia(p)
    for (const f of filas) {
      const c = f.cos === null ? '—' : dos(f.cos)
      console.log(
        `| ${p.id} | ${f.pieza}${f.forma ? '/' + f.forma : ''} | ${f.de ?? f.nota ?? ''} | ` +
          `${cm(f.recorrido)} cm | ${c} | ${f.cos === null ? '—' : dos(f.cosMin) + '→' + dos(f.cosMax)} | ` +
          `${f.estira ? cm(f.estira) + ' cm' : '—'} |`,
      )
      if (f.cos !== null && f.cos > -0.35) malos.push({ id: p.id, f })
    }
  }
  console.log('\n### Los que NO se oponen (cos > −0,35)\n')
  if (malos.length === 0) console.log('ninguno')
  for (const m of malos) {
    console.log(
      `- **${m.id}** · ${m.f.pieza}${m.f.forma ? '/' + m.f.forma : ''} · cos ${dos(m.f.cos)} · ` +
        `el gesto va hacia [${m.f.mov.map((v) => dos(v)).join(', ')}]`,
    )
  }
  console.log('')
}

if (!soloResistencia) {
  console.log('## SUELO: el punto más bajo del cuerpo en las once fases\n')
  console.log('| patrón | apoyo | hueso más bajo | fase | y (cm) |')
  console.log('| --- | --- | --- | --- | --- |')
  const hundidos = []
  for (const p of patrones) {
    const s = medirSuelo(p)
    console.log(`| ${p.id} | ${p.apoyo} | ${s.hueso} | ${dos(s.fase)} | ${cm(s.y)} |`)
    if (s.y < -0.005) hundidos.push({ id: p.id, ...s })
  }
  console.log('\n### Los que se hunden (más de medio centímetro bajo el suelo)\n')
  if (hundidos.length === 0) console.log('ninguno')
  for (const h of hundidos) {
    const bajo = [...h.porHueso.entries()]
      .filter(([, v]) => v.y < -0.005)
      .sort((a, b) => a[1].y - b[1].y)
      .map(([n, v]) => `${n} ${cm(v.y)}`)
    console.log(`- **${h.id}** · ${bajo.join(' · ')} (cm)`)
  }

  console.log('\n## SENTIDO: ¿la concéntrica (0→1) sube o baja?\n')
  console.log('| patrón | punto seguido | recorrido vertical | 0→1 |')
  console.log('| --- | --- | --- | --- |')
  const alReves = []
  for (const p of patrones) {
    const s = sentidoDeLaRepeticion(p)
    const veredicto = s.recorrido < 0.03 ? 'plano' : s.subida > 0 ? 'SUBE' : 'BAJA'
    console.log(`| ${p.id} | ${s.hueso} | ${cm(s.recorrido)} cm | ${veredicto} ${cm(s.subida)} cm |`)
    if (veredicto === 'BAJA') alReves.push({ id: p.id, ...s })
  }
  console.log('\n### Los que bajan en la concéntrica\n')
  if (alReves.length === 0) console.log('ninguno')
  for (const a of alReves) console.log(`- **${a.id}** · ${a.hueso} baja ${cm(-a.subida)} cm de 0 a 1`)
}
