/**
 * Choca la tabla de palancas contra vídeo real de gimnasio.
 *
 * Hasta ahora la tabla se probaba contra sí misma: un test comprueba que el
 * grupo que cobra el trabajo directo aparece generando momento en algún eje, y
 * poco más. Eso valida coherencia interna, no que la tabla sirva para lo que se
 * construyó — decirle a una cámara qué mirar en un gimnasio de verdad.
 *
 * Este script lee el catálogo de 168 vídeos de WhatsApp (grabados por el
 * asesorado, no por nosotros: móvil en el suelo, gente cruzando, discos
 * tapando) y para cada uno pregunta `planDeMedida`. Lo que sale no es una nota
 * de la tabla: es el reparto entre lo que HOY se puede medir en ese corpus y lo
 * que no, y por qué motivo concreto.
 *
 *     node --experimental-strip-types scripts/corpus-video.mjs catalogo.tsv
 *
 * Las columnas del catálogo salen de mirar los 168 uno a uno:
 *   id, ejercicio, patron, implemento, vista, altura_camara, calidad, nota
 */

import { readFileSync } from 'node:fs'
import { planDeMedida } from '../src/domain/biomecanica/palancas.ts'

/** Del vocabulario del gimnasio al de la taxonomía. */
const A_CATEGORIA = {
  'bisagra de cadera': 'BISAGRA DE CADERA',
  'extension de cadera': 'EXTENSIÓN DE CADERA',
  'abduccion de cadera': 'ABDUCCIÓN DE CADERA',
  sentadilla: 'SENTADILLA',
  'sentadilla unilateral': 'SENTADILLA UNILATERAL',
  'flexion de rodilla': 'FLEXIÓN DE RODILLA',
  'empuje horizontal': 'EMPUJE HORIZONTAL',
  'empuje inclinado': 'EMPUJE INCLINADO',
  'empuje vertical': 'EMPUJE VERTICAL',
  'traccion vertical': 'TRACCIÓN VERTICAL',
  'traccion horizontal': 'TRACCIÓN HORIZONTAL',
  'abduccion de hombro': 'ABDUCCIÓN DE HOMBRO',
  'abduccion horizontal': 'ABDUCCIÓN HORIZONTAL',
  'flexion de codo': 'FLEXIÓN DE CODO',
  'extension de codo': 'EXTENSIÓN DE CODO',
}

/**
 * Patrones del corpus que la taxonomía no tiene, y no es un descuido de quien
 * catalogó: son ejercicios que existen en el gimnasio y no en la tabla.
 */
const SIN_CATEGORIA = {
  prensa: 'la prensa no es una categoría: su carga va por un raíl inclinado, no por la vertical',
  'flexion de muneca': 'no hay categoría de muñeca en la taxonomía de 32',
}

const ruta = process.argv[2]
if (!ruta) {
  console.error('Uso: node --experimental-strip-types scripts/corpus-video.mjs <catalogo.tsv>')
  process.exit(2)
}

const filas = readFileSync(ruta, 'utf8')
  .split('\n')
  .slice(1)
  .filter((l) => l.trim())
  .map((l) => {
    const [id, ejercicio, patron, implemento, vista, altura, calidad, nota] = l.split('\t')
    return { id, ejercicio, patron, implemento, vista, altura, calidad: calidad ?? '', nota: nota ?? '' }
  })

const cuenta = (obj, clave) => {
  obj[clave] = (obj[clave] ?? 0) + 1
}

const resultado = []
const sinModelo = {}
const vistaEquivocada = []
const necesitaReparto = []
const porLinea = {}
const porEjeObjetivo = {}
const porGrupo = {}

for (const f of filas) {
  if (f.patron === '-' || f.calidad === 'descartar') continue

  const categoria = A_CATEGORIA[f.patron]
  if (!categoria) {
    cuenta(sinModelo, SIN_CATEGORIA[f.patron] ?? `patrón ambiguo al catalogar: ${f.patron}`)
    continue
  }

  // El implemento vive en columna aparte en el catálogo y en el NOMBRE en la
  // app, que es de donde lo lee `implementoDe`. Se juntan aquí para que el
  // informe pase por el mismo camino que pasaría un ejercicio de verdad.
  //
  // El singular «mancuerna» del catálogo significa a una mano —así se anotó al
  // mirar los vídeos— y eso en un nombre de ejercicio se escribe con palabras.
  const implementoTexto = f.implemento === 'mancuerna' ? 'mancuerna a una mano' : f.implemento
  const nombre =
    implementoTexto && implementoTexto !== '-' ? `${f.ejercicio} con ${implementoTexto}` : f.ejercicio
  const plan = planDeMedida(categoria, nombre)
  if (!plan) {
    cuenta(sinModelo, `${categoria}: la tabla no le da modelo`)
    continue
  }

  // La vista del catálogo es dónde estaba el móvil; la del plan, dónde tenía
  // que estar. Cuando no coinciden no hay número peor: no hay número.
  const vistaReal = f.vista.split('-')[0]
  const vistaOk = vistaReal === plan.vista || (plan.vista === 'frontal' && vistaReal === 'posterior')
  if (!vistaOk) vistaEquivocada.push({ ...f, exige: plan.vista })
  if (plan.necesitaRepartoDeApoyos) necesitaReparto.push(f)

  cuenta(porLinea, plan.linea.origen)
  if (plan.ejeObjetivo) cuenta(porEjeObjetivo, plan.ejeObjetivo)
  if (plan.grupoObjetivo) cuenta(porGrupo, plan.grupoObjetivo)

  resultado.push({ ...f, categoria, plan, vistaOk })
}

const pct = (n) => `${((100 * n) / filas.length).toFixed(0)} %`

console.log(`\n${filas.length} vídeos catalogados · ${resultado.length} con modelo de palanca (${pct(resultado.length)})\n`)

console.log('GRUPO OBJETIVO — dónde está el trabajo, según la taxonomía')
console.log('─'.repeat(64))
for (const [g, n] of Object.entries(porGrupo).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${g.padEnd(14)} ${String(n).padStart(3)}  ${'█'.repeat(Math.round(n / 2))}`)
}

console.log('\nEJE PROTAGÓNICO — dónde se inserta ese grupo y hay que medir')
console.log('─'.repeat(64))
for (const [e, n] of Object.entries(porEjeObjetivo).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${e.padEnd(14)} ${String(n).padStart(3)}  ${'█'.repeat(Math.round(n / 2))}`)
}

console.log('\nLÍNEA DE FUERZA — contra qué se mide el brazo')
console.log('─'.repeat(64))
for (const [l, n] of Object.entries(porLinea).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${l.padEnd(16)} ${String(n).padStart(3)}`)
}

console.log('\nLO QUE NO TIENE MODELO')
console.log('─'.repeat(64))
for (const [motivo, n] of Object.entries(sinModelo).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)} · ${motivo}`)
}

console.log(`\nVISTA EQUIVOCADA — ${vistaEquivocada.length} vídeos grabados desde donde ese eje no se ve`)
console.log('─'.repeat(64))
for (const v of vistaEquivocada) {
  console.log(`  ${v.id}  ${v.ejercicio.padEnd(32)} grabado ${v.vista.padEnd(18)} exige ${v.exige}`)
}

console.log(`\nSIN NEWTONS — ${necesitaReparto.length} vídeos de patrón con dos apoyos (salen ángulos, no fuerzas)`)
console.log('─'.repeat(64))
const porEjercicio = {}
for (const v of necesitaReparto) cuenta(porEjercicio, v.ejercicio)
for (const [e, n] of Object.entries(porEjercicio).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)} · ${e}`)
}

console.log('\nIMPLEMENTO — lo que el catálogo dice, y lo que la tabla reconoce del nombre')
console.log('─'.repeat(64))
const porImplemento = {}
for (const r of resultado) {
  cuenta(porImplemento, `${r.implemento.padEnd(18)} → ${r.plan.implemento ?? 'NO RECONOCIDO'}`)
}
for (const [i, n] of Object.entries(porImplemento).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${i.padEnd(42)} ${String(n).padStart(3)}`)
}

const unilaterales = resultado.filter((r) => r.plan.unilateral)
console.log(`\nCARGA A UN LADO — ${unilaterales.length} vídeos con un momento frontal que la vista lateral no ve`)
console.log('─'.repeat(64))
const porImplementoUni = {}
for (const r of unilaterales) cuenta(porImplementoUni, r.plan.implemento ?? 'sin declarar')
for (const [i, n] of Object.entries(porImplementoUni).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)} · ${i}`)
}
console.log('  (unilateral no es un implemento: sale con mancuerna, con polea y con barra)')

const sinBrazo = resultado.filter((r) => !r.plan.brazoPorDistanciaHorizontal)
console.log(`\nSALEN ÁNGULOS, NO MOMENTOS — ${sinBrazo.length} vídeos donde el implemento rompe la regla de §2.1`)
console.log('─'.repeat(64))
const porMotivo = {}
for (const r of sinBrazo) cuenta(porMotivo, r.plan.perfilDeImplemento.nombre)
for (const [m, n] of Object.entries(porMotivo).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)} · ${m}`)
}
console.log(
  `\n  Antes de la tabla de implementos, estos ${sinBrazo.length} devolvían un brazo de momento` +
    `\n  con la misma cara que los ${resultado.length - sinBrazo.length} buenos.`,
)

console.log('\nALTURA DE CÁMARA — el brazo externo es una distancia horizontal en el plano de imagen')
console.log('─'.repeat(64))
const porAltura = {}
for (const r of resultado) cuenta(porAltura, r.altura)
for (const [a, n] of Object.entries(porAltura).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${a.padEnd(10)} ${String(n).padStart(3)}`)
}
console.log()
