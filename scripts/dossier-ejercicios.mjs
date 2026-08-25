/**
 * Un expediente biomecánico por ejercicio, con los vídeos que lo prueban.
 *
 *     node --experimental-strip-types scripts/dossier-ejercicios.mjs <catalogo.tsv> > EJERCICIOS.md
 *
 * Sale de cruzar dos cosas que ya existen y no se habían juntado:
 *
 *   - el **catálogo de 168 vídeos** de gimnasio, mirado uno a uno, que dice qué
 *     ejercicio hay en cada archivo y desde dónde está grabado;
 *   - la **tabla de palancas** (`src/domain/biomecanica/`), que dice qué gira,
 *     sobre qué eje y contra qué línea.
 *
 * El resultado es lo que hacía falta para poder evaluar de verdad: cada
 * ejercicio con su grupo objetivo, su articulación protagónica, su anclaje, sus
 * segmentos móviles, su línea de fuerza, la vista que exige — **y los números de
 * los vídeos donde mirarlo**. Sin esa última columna el expediente es teoría; con
 * ella se puede ir al archivo y comprobar cada afirmación.
 *
 * Se genera, no se escribe a mano, por la razón de siempre: una tabla copiada se
 * separa de su fuente en cuanto alguien toca una de las dos.
 */

import { readFileSync } from 'node:fs'
import { modeloDePalanca, planDeMedida } from '../src/domain/biomecanica/palancas.ts'

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

const ruta = process.argv[2]
if (!ruta) {
  console.error('Uso: node --experimental-strip-types scripts/dossier-ejercicios.mjs <catalogo.tsv>')
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
  .filter((f) => f.patron !== '-' && f.calidad !== 'descartar')

// Un ejercicio es la pareja ejercicio+implemento: un remo con barra y uno con
// mancuerna a una mano son el mismo patrón y dos medidas distintas, y meterlos
// en la misma ficha es exactamente el error que la tabla de implementos arregló.
const fichas = new Map()
for (const f of filas) {
  const clave = `${f.ejercicio} · ${f.implemento}`
  if (!fichas.has(clave)) fichas.set(clave, { ...f, videos: [] })
  fichas.get(clave).videos.push(f)
}

const cal = (v) => (v.calidad === 'excelente' ? '★' : v.calidad === 'buena' ? '+' : v.calidad.includes('mala') || v.calidad === 'inutilizable' ? '−' : '·')

const salida = []
const p = (s = '') => salida.push(s)

p('# Expediente biomecánico por ejercicio')
p()
p('> **Generado, no escrito a mano**, por `scripts/dossier-ejercicios.mjs` cruzando el')
p('> catálogo de 168 vídeos de gimnasio con la tabla de palancas. Si los dos divergen,')
p('> manda [`segmentos-ejes-y-palancas.md`](../../wiki/conocimiento/segmentos-ejes-y-palancas.md).')
p('>')
p('> **Cómo leer la columna de vídeos.** Son los números del catálogo')
p('> (`banco/corpus-gimnasio.tsv`), y el símbolo dice para qué sirve cada uno:')
p('> `★` encuadre excelente · `+` bueno · `·` regular · `−` no vale para medir.')
p('> Es la columna que convierte esto en algo comprobable: cada afirmación de la')
p('> ficha se puede ir a mirar al archivo.')
p()

// Índice por patrón, para poder recorrerlo por familia y no por nombre.
const porPatron = new Map()
for (const [clave, f] of fichas) {
  const cat = A_CATEGORIA[f.patron] ?? `SIN MODELO · ${f.patron}`
  if (!porPatron.has(cat)) porPatron.set(cat, [])
  porPatron.get(cat).push([clave, f])
}

p('## Índice')
p()
p('| patrón | ejercicios | vídeos |')
p('|---|---|---|')
for (const [cat, lista] of [...porPatron].sort((a, b) => b[1].length - a[1].length)) {
  const nv = lista.reduce((s, [, f]) => s + f.videos.length, 0)
  p(`| ${cat} | ${lista.length} | ${nv} |`)
}
p()
p('---')
p()

for (const [cat, lista] of [...porPatron].sort((a, b) => b[1].length - a[1].length)) {
  p(`## ${cat}`)
  p()

  const sinModelo = cat.startsWith('SIN MODELO')
  if (sinModelo) {
    p('⚠ **Este patrón no tiene modelo en la tabla**, así que de aquí no sale ninguna')
    p('medida. No es un descuido: o la taxonomía de 32 no lo contempla —la prensa va')
    p('por un raíl inclinado y no hereda el modelo de la sentadilla— o el ejercicio no')
    p('se pudo clasificar de un vistazo al catalogarlo.')
    p()
    for (const [clave, f] of lista) {
      p(`- **${clave}** — ${f.videos.map((v) => `${v.id}${cal(v)}`).join(' ')}`)
    }
    p()
    p('---')
    p()
    continue
  }

  const primera = lista[0][1]
  const modelo = modeloDePalanca(cat, `${primera.ejercicio} con ${primera.implemento}`)
  if (modelo) {
    p('**La mecánica del patrón**, común a todos los ejercicios de abajo:')
    p()
    p(`- **Cadena** — ${modelo.cadena}: ${modelo.cadena === 'cerrada' ? 'el extremo distal está fijo al mundo y el cuerpo se mueve sobre él' : 'el extremo distal viaja libre y el cuerpo está apoyado'}.`)
    p(`- **Anclaje** (lo que toca el mundo y no se desplaza) — ${modelo.anclaje}.`)
    p(`- **Segmentos móviles** (lo que la fuerza muscular hace girar) — ${modelo.segmentosMoviles.join(', ')}.`)
    p(`- **Referencia** (contra qué se leen los ángulos) — ${modelo.referencia === 'vertical' ? 'la vertical del mundo' : `el ${modelo.referencia}`}.`)
    p(`- **Alineación** — ${modelo.alineacion.regla} (±${modelo.alineacion.toleranciaMm} mm).`)
    p(`  <br>*${modelo.alineacion.porQue}*`)
    if (modelo.dosApoyos) {
      p(`- ⚠ **Dos apoyos** — ${modelo.dosApoyos}`)
    }
    p()

    p('**Los ejes, y qué hay que hacer con cada uno:**')
    p()
    p('| eje | manda | acción | músculo que genera el momento | brazo interno | qué hacer con él |')
    p('|---|---|---|---|---|---|')
    for (const e of modelo.ejes) {
      const regla = e.regla ? `**${e.regla.tipo}**: ${e.regla.regla}` : e.protagonismo === 'principal' ? '*se mide*' : '—'
      p(`| ${e.articulacion} | ${e.protagonismo} | ${e.accion} | ${e.motores.join(', ') || '—'} | ${e.brazoInternoMm[0]}–${e.brazoInternoMm[1]} mm | ${regla} |`)
    }
    p()
  }

  for (const [clave, f] of lista) {
    const nombre = `${f.ejercicio} con ${f.implemento === 'mancuerna' ? 'mancuerna a una mano' : f.implemento}`
    const plan = planDeMedida(cat, nombre)
    p(`### ${clave}`)
    p()
    p(`**Vídeos** — ${f.videos.map((v) => `\`${v.id}\`${cal(v)}`).join(' ')}  (${f.videos.length})`)
    p()
    if (!plan) { p('Sin plan de medida.'); p(); continue }

    p(`- **Grupo muscular objetivo** — ${plan.grupoObjetivo ?? '—'}`)
    p(`- **Articulación protagónica** (donde ese grupo se inserta y genera la tensión) — **${plan.ejeObjetivo ?? '—'}**`)
    p(`- **Línea de fuerza resultante** — ${plan.linea.origen}${plan.linea.nota ? `. ${plan.linea.nota}` : ''}`)
    p(`- **Vista que exige** — cámara ${plan.vista}`)
    p(`- **Marcas necesarias** — ${plan.marcas.join(', ')}. Si falta una, no hay número.`)
    p(`- **Brazo por distancia horizontal** — ${plan.brazoPorDistanciaHorizontal ? 'sí, la regla de §2.1 vale' : '**NO**: salen ángulos, no momentos'}`)
    if (plan.necesitaRepartoDeApoyos) p('- ⚠ **Dos apoyos**: sin plataforma de fuerza, aquí salen ángulos y no newtons.')
    if (plan.unilateral) p('- ⚠ **Carga a un lado**: hay un momento en el plano frontal que la lateral no ve.')
    for (const t of plan.limites) p(`- ⚠ ${t}`)
    for (const t of plan.fueraDeVista) p(`- ⚠ fuera de vista — ${t}`)

    // Las vistas con las que está grabado de verdad, que es lo que decide si
    // este ejercicio se puede evaluar hoy o no.
    const vistas = [...new Set(f.videos.map((v) => v.vista))]
    const buenos = f.videos.filter((v) => v.calidad === 'excelente' || v.calidad === 'buena')
    p(`- **En el corpus está grabado** — ${vistas.join(', ')}; ${buenos.length} de ${f.videos.length} con encuadre utilizable`)
    p()
  }
  p('---')
  p()
}

console.log(salida.join('\n'))
