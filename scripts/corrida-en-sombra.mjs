/**
 * La corrida en sombra del bucle del día, sobre la historia real.
 *
 *   npx vite-node scripts/corrida-en-sombra.mjs <export.json> [--detalle]
 *
 * El `<export.json>` lo produce `supabase/exportar-corrida-en-sombra.sql`, y
 * **vive fuera del repo**: lleva el entrenamiento de personas reales.
 *
 * QUÉ CONTESTA, y qué no. Contesta la primera mitad del §7.1 del supuesto del
 * 2026-08-25: ¿se dispara el cruce, cuántas veces y en qué dirección? La segunda
 * mitad —¿el ajuste habría reducido la discrepancia?— **no se puede contestar
 * hasta que las prescripciones traigan `escenarios`**, las dos escaleras que el
 * coach preautoriza (§8 punto 1). Por eso el informe imprime `sin camino escrito`
 * como una fila propia: es la medida de cuánto está esperando esa decisión.
 *
 * No inventa nada: el cruce lo hace `src/domain/bucleDelDia.ts`, el mismo módulo
 * que decidiría en vivo. Este archivo solo lee, adapta y cuenta.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { corridaEnSombra } from '../src/domain/corridaEnSombra.ts'

const [ruta, ...banderas] = process.argv.slice(2)
const detalle = banderas.includes('--detalle')

if (!ruta) {
  console.error('Uso: npx vite-node scripts/corrida-en-sombra.mjs <export.json> [--detalle]')
  process.exit(2)
}

const destino = resolve(ruta)

// El export lleva entrenamiento y bienestar de personas reales. Si alguien lo ha
// dejado dentro de un árbol git, se para: es medio paso de un commit accidental.
for (let d = destino; ; d = dirname(d)) {
  if (existsSync(join(d, '.git'))) {
    console.error(
      `ABORTA: ${destino} cae dentro del repo git ${d}.\n` +
        'Este archivo lleva el entrenamiento real de personas. Sácalo del árbol.',
    )
    process.exit(2)
  }
  if (dirname(d) === d) break
}

const datos = JSON.parse(readFileSync(destino, 'utf8'))

/**
 * Del export reducido a lo que el dominio espera.
 *
 * `cargaPautadaOndulada` viene ya promediada desde el SQL y aquí se devuelve como
 * UNA serie prescrita con ese valor: `rendimientoDelDia` promedia las series
 * prescritas, así que una sola con la media da exactamente el mismo número. Es
 * reducción de datos, no una segunda copia de la regla.
 */
function aEjercicio(e) {
  return {
    id: e.id ?? '',
    categoria: e.categoria ?? '',
    nombre: e.categoria ?? '',
    cues: '',
    prescripcion: '',
    descansoMin: 0,
    sets: e.sets ?? 0,
    rango: '',
    repsDiana: 0,
    rirObjetivo: e.rirObjetivo ?? 0,
    cargaKg: e.cargaKg ?? undefined,
    seriesPrescritas:
      e.cargaPautadaOndulada != null ? [{ orden: 1, cargaKg: Number(e.cargaPautadaOndulada) }] : undefined,
    escenarios: e.escenarios ?? undefined,
    series: (e.series ?? []).map((s, i) => ({
      orden: i + 1,
      cargaKg: Number(s.cargaKg ?? 0),
      reps: 0,
      rir: s.rir == null ? undefined : Number(s.rir),
    })),
  }
}

function aSesion(s) {
  return {
    id: `${s.orden}`,
    nombre: s.nombre ?? '',
    orden: s.orden ?? 0,
    // El SQL ya resolvió el día (campo o primera marca). Se entrega como `fecha`
    // para que el dominio no tenga que volver a decidirlo.
    fecha: s.fecha ?? undefined,
    testPost: s.prsEntrada == null ? undefined : { duracionMin: 0, rpeSesion: 0, prsEntrada: Number(s.prsEntrada) },
    ejercicios: (s.ejercicios ?? []).map(aEjercicio),
  }
}

const total = {
  personas: 0,
  sesionesMiradas: 0,
  sesionesCruzables: 0,
  ejerciciosMirados: 0,
  verde: 0,
  rojo: 0,
  ninguno: 0,
  sinCaminoEscrito: 0,
  sinSeries: 0,
  sinContexto: 0,
  propagaciones: 0,
}
const porPersona = []

for (const persona of datos.gente ?? []) {
  const microciclos = (persona.microciclos ?? []).map((m) => ({
    id: `${persona.usuarioId}-${m.numero}`,
    usuarioId: persona.usuarioId,
    numero: m.numero,
    cadenciaDias: 8,
    estado: m.estado,
    fechaInicio: '',
    sesiones: (m.sesiones ?? []).map(aSesion),
  }))
  const checkins = (persona.checkins ?? []).map((c, i) => ({
    id: `c${i}`,
    usuarioId: persona.usuarioId,
    fecha: c.fecha,
    horasSueno: c.horasSueno ?? undefined,
    calidadSueno: c.calidadSueno ?? undefined,
    estres: c.estres ?? undefined,
    cansancio: c.cansancio ?? undefined,
    motivacion: c.motivacion ?? undefined,
  }))

  const informe = corridaEnSombra(microciclos, checkins)
  total.personas += 1
  total.sesionesMiradas += informe.sesionesMiradas
  total.sesionesCruzables += informe.sesionesCruzables
  total.ejerciciosMirados += informe.ejerciciosMirados
  total.verde += informe.porEscenario.verde
  total.rojo += informe.porEscenario.rojo
  total.ninguno += informe.porEscenario.ninguno
  total.sinCaminoEscrito += informe.sinCaminoEscrito
  total.sinSeries += informe.noCruzables.sinSeries
  total.sinContexto += informe.noCruzables.sinContexto
  total.propagaciones += informe.propagaciones
  porPersona.push({ id: persona.usuarioId.slice(0, 8), informe })
}

const pct = (n, d) => (d === 0 ? '  —  ' : `${((100 * n) / d).toFixed(1).padStart(5)}%`)

console.log(`\nCORRIDA EN SOMBRA — export de ${datos.generadoEn ?? '(sin fecha)'}\n`)
console.log(`  ${total.personas} personas · ${total.sesionesMiradas} sesiones · ${total.ejerciciosMirados} ejercicios\n`)
console.log('  EL CRUCE (por ejercicio-día)')
console.log(`    verde                ${String(total.verde).padStart(5)}   ${pct(total.verde, total.ejerciciosMirados)}`)
console.log(`    rojo                 ${String(total.rojo).padStart(5)}   ${pct(total.rojo, total.ejerciciosMirados)}`)
console.log(`    ninguno              ${String(total.ninguno).padStart(5)}   ${pct(total.ninguno, total.ejerciciosMirados)}`)
console.log('\n  POR QUE «NINGUNO», cuando lo es')
console.log(`    sin series anotadas  ${String(total.sinSeries).padStart(5)}   ${pct(total.sinSeries, total.ejerciciosMirados)}`)
console.log(`    sin contexto del dia ${String(total.sinContexto).padStart(5)}   ${pct(total.sinContexto, total.ejerciciosMirados)}`)
console.log('\n  LO QUE ESTA ESPERANDO UNA DECISION')
console.log(`    cruces que pedian actuar y no tenian escaleras escritas: ${total.sinCaminoEscrito}`)
console.log(`    (mientras siga en ${total.sinCaminoEscrito}, la segunda mitad del §7.1 no se puede medir)`)
console.log(`\n  REGLA DEL MARTES: ${total.propagaciones} propagaciones de fatiga a una sesion posterior`)
console.log(`\n  Sesiones con las DOS mitades del cruce: ${total.sesionesCruzables} de ${total.sesionesMiradas}\n`)

if (detalle) {
  console.log('  POR PERSONA (id acortado)')
  console.log(`    ${'id'.padEnd(10)}${'ses'.padStart(5)}${'cruz'.padStart(6)}${'verde'.padStart(7)}${'rojo'.padStart(6)}${'bloq'.padStart(6)}`)
  for (const p of porPersona.sort((a, b) => b.informe.porEscenario.verde + b.informe.porEscenario.rojo - (a.informe.porEscenario.verde + a.informe.porEscenario.rojo))) {
    const i = p.informe
    console.log(
      `    ${p.id.padEnd(10)}${String(i.sesionesMiradas).padStart(5)}${String(i.sesionesCruzables).padStart(6)}` +
        `${String(i.porEscenario.verde).padStart(7)}${String(i.porEscenario.rojo).padStart(6)}${String(i.sinCaminoEscrito).padStart(6)}`,
    )
  }
  console.log()
}
