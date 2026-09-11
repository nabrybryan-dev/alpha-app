/**
 * Devuelve el fallo a su sitio, una pieza cada vez, y exige que la bateria de
 * `corridaEnSombra.test.ts` se ponga ROJA.
 *
 *   node scripts/mutar-corrida-en-sombra.mjs
 *
 * La mutacion que mas importa es la tercera: si `sinCaminoEscrito` dejara de
 * contarse, un mecanismo BLOQUEADO —hoy no hay una sola escalera escrita en
 * produccion— pasaria por un mecanismo que decide no actuar. Son cosas opuestas
 * y el informe entero se leeria al reves.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const BATERIA = 'src/domain/corridaEnSombra.test.ts'
const CR = String.fromCharCode(13)
const FUENTE = 'src/domain/corridaEnSombra.ts'

const MUTACIONES = [
  {
    nombre: 'ignora el campo `fecha` y se queda con la marca',
    archivo: FUENTE,
    viejo: "if (sesion.fecha) return { fecha: sesion.fecha, origen: 'campo' }",
    nuevo: "if (false) return { fecha: sesion.fecha, origen: 'campo' }",
  },
  {
    nombre: 'coge la ULTIMA marca en vez de la primera',
    archivo: FUENTE,
    viejo: "if (marcas.length > 0) return { fecha: marcas[0].slice(0, 10), origen: 'marca' }",
    nuevo: "if (marcas.length > 0) return { fecha: marcas[marcas.length - 1].slice(0, 10), origen: 'marca' }",
  },
  {
    nombre: 'los cruces bloqueados dejan de contarse (el peor de todos)',
    archivo: FUENTE,
    viejo: "        decision.escenario !== 'ninguno' &&",
    nuevo: '        false &&',
  },
  {
    nombre: 'la regla del martes mira tambien hacia atras',
    archivo: FUENTE,
    viejo: 'sombraDeSesion(s, m.numero, checkins, enOrden.slice(i + 1))',
    nuevo: 'sombraDeSesion(s, m.numero, checkins, enOrden.filter((_, j) => j !== i))',
  },
  {
    nombre: 'el PRS del test deja de contar como contexto',
    archivo: FUENTE,
    viejo: 'prsEntrada: sesion.testPost?.prsEntrada,',
    nuevo: 'prsEntrada: undefined,',
  },
  {
    nombre: 'vale el check-in de cualquier dia',
    archivo: FUENTE,
    viejo: 'const checkin = fecha ? checkins.find((c) => c.fecha === fecha) : undefined',
    nuevo: 'const checkin = checkins[0]',
  },
  {
    nombre: 'los microciclos se cruzan en el orden en que llegan',
    archivo: FUENTE,
    viejo: 'const enOrden = [...(m.sesiones ?? [])].sort((a, b) => a.orden - b.orden)',
    nuevo: 'const enOrden = [...(m.sesiones ?? [])]',
  },
]

function corre() {
  try {
    execFileSync('npx', ['vitest', 'run', BATERIA], { stdio: 'pipe', shell: true })
    return true
  } catch {
    return false
  }
}

if (!corre()) {
  console.log('FALLO  la bateria no pasa SIN mutar. Arregla eso antes de mutar nada.')
  process.exit(2)
}

let fallos = 0
for (const m of MUTACIONES) {
  const enDisco = readFileSync(m.archivo, 'utf8')
  const original = enDisco.split(CR).join('')
  const veces = original.split(m.viejo).length - 1
  if (veces !== 1) {
    console.log(`ROTO   ${m.nombre}: el ancla aparece ${veces} veces`)
    fallos += 1
    continue
  }
  let paso
  try {
    writeFileSync(m.archivo, original.replace(m.viejo, m.nuevo))
    paso = corre()
  } finally {
    writeFileSync(m.archivo, enDisco)
  }
  if (paso) {
    console.log(`VERDE  ${m.nombre}  <- LA MUTACION SOBREVIVIO: el check no protege nada`)
    fallos += 1
  } else {
    console.log(`rojo   ${m.nombre}`)
  }
}

console.log(`\n${MUTACIONES.length - fallos}/${MUTACIONES.length} mutaciones cazadas.`)
if (!corre()) {
  console.log('FALLO  la bateria NO vuelve a verde: algo quedo mal restaurado.')
  process.exit(2)
}
process.exit(fallos === 0 ? 0 : 1)
