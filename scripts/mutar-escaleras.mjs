/**
 * Devuelve el fallo a su sitio, una pieza cada vez, y exige que la bateria de
 * `escaleras.test.ts` se ponga ROJA.
 *
 *   node scripts/mutar-escaleras.mjs
 *
 * La que mas importa es la del techo: si el techo dejara de salir del rango que
 * el coach escribio, «autorizado por adelantado» dejaria de significar nada y el
 * verde seria un cheque en blanco. Es justo lo que este diseno existe para evitar.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const BATERIA = 'src/domain/escaleras.test.ts'
const CR = String.fromCharCode(13)
const FUENTE = 'src/domain/escaleras.ts'

const MUTACIONES = [
  {
    nombre: 'el techo deja de salir del rango y se vuelve un +10% a ojo',
    archivo: FUENTE,
    viejo: 'cargaAOtrasReps(carga, ejercicio.repsDiana, rango.min, objetivo),',
    nuevo: 'carga * 1.1,',
  },
  {
    nombre: 'el escalon salta directo al techo en vez de un peldano',
    archivo: FUENTE,
    viejo: 'cargaAOtrasReps(carga, ejercicio.repsDiana, ejercicio.repsDiana - 1, objetivo),',
    nuevo: 'cargaAOtrasReps(carga, ejercicio.repsDiana, rango.min, objetivo),',
  },
  {
    nombre: 'una diana FUERA de su rango se cuela y fabrica techo',
    archivo: FUENTE,
    viejo: '} else if (ejercicio.repsDiana > rango.max) {',
    nuevo: '} else if (false) {',
  },
  {
    nombre: 'una diana ya en el extremo duro se cuela igual',
    archivo: FUENTE,
    viejo: '} else if (ejercicio.repsDiana <= rango.min) {',
    nuevo: '} else if (false) {',
  },
  {
    nombre: 'el FALLO deja de excluirse del techo',
    archivo: FUENTE,
    viejo: '} else if (esAlFallo(objetivo)) {',
    nuevo: '} else if (false) {',
  },
  {
    nombre: 'se inventa un suelo de RIR cuando la ficha no lo trae',
    archivo: FUENTE,
    viejo: "if (typeof sueloRir !== 'number') {",
    nuevo: 'if (false) {',
  },
  {
    nombre: 'el modulo elige por el coach cuantos escalones suelta el rojo',
    archivo: FUENTE,
    viejo: "} else if (typeof deltaRir !== 'number' || deltaRir <= 0) {",
    nuevo: '} else if (false) {',
  },
  {
    nombre: 'un escalon que redondea a cero se acepta igual',
    archivo: FUENTE,
    viejo: 'if (deltaCargaKg <= 0 || techoCargaKg <= carga) {',
    nuevo: 'if (false) {',
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
