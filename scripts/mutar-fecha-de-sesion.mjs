/**
 * Devuelve el fallo a su sitio, una pieza cada vez, y exige que la bateria de
 * `sesionConFecha.test.ts` se ponga ROJA. Ningun check cuenta verde hasta
 * haberlo visto fallar a proposito.
 *
 *   node scripts/mutar-fecha-de-sesion.mjs
 *
 * Nota de intendencia: el repo esta en CRLF y las anclas se escriben con saltos
 * de linea normales, asi que antes de comparar se quitan los retornos de carro.
 * Lo que se restaura al final es el texto TAL CUAL estaba en disco.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const BATERIAS = ['src/data/sesionConFecha.test.ts', 'src/data/nube/fecha-de-sesion-sync.test.ts']
const CR = String.fromCharCode(13)

const MUTACIONES = [
  {
    nombre: 'conFecha deja de escribir nada',
    archivo: 'src/data/mockDb.ts',
    viejo: 'return sesion.fecha ? sesion : { ...sesion, fecha: hoy }',
    nuevo: 'return sesion',
  },
  {
    nombre: 'conFecha PISA la fecha que ya habia',
    archivo: 'src/data/mockDb.ts',
    viejo: 'return sesion.fecha ? sesion : { ...sesion, fecha: hoy }',
    nuevo: 'return { ...sesion, fecha: hoy }',
  },
  {
    nombre: 'anotar una serie sella TODAS las sesiones de la semana',
    archivo: 'src/data/mockDb.ts',
    viejo: 's.ejercicios.some((e) => e.id === ejercicioId)',
    nuevo: 'true || s.ejercicios.some((e) => e.id === ejercicioId)',
  },
  {
    nombre: 'marcar el calentamiento deja de sellar',
    archivo: 'src/data/mockDb.ts',
    viejo: 'return conFecha({',
    nuevo: 'return ({',
  },
  {
    nombre: 'el test posterior deja de sellar',
    archivo: 'src/data/mockDb.ts',
    viejo: 's.id === sesionId ? conFecha({ ...s, testPost: test }) : s,',
    nuevo: 's.id === sesionId ? { ...s, testPost: test } : s,',
  },
  {
    nombre: 'la fecha nunca sale hacia el servidor',
    archivo: 'src/data/nube/sync.ts',
    viejo: '  if (!fecha) return',
    nuevo: '  if (!fecha) return\n  if (fecha) return',
  },
  {
    nombre: 'la fecha no sube al anotar una serie',
    archivo: 'src/data/nube/sync.ts',
    viejo: 'subirFechaDeSesion(local, microcicloId, sesionDelEjercicio(local, microcicloId, ejercicioId))',
    nuevo: 'void 0',
  },
  {
    nombre: 'la operacion se encola con otro nombre de funcion',
    archivo: 'src/data/nube/sync.ts',
    viejo: "funcion: 'fijar_fecha_sesion',",
    nuevo: "funcion: 'fijar_otra_cosa',",
  },
  {
    nombre: 'la serie sella la sesion equivocada',
    archivo: 'src/data/nube/sync.ts',
    viejo: '    s.ejercicios.some((e) => e.id === ejercicioId),',
    nuevo: '    true,',
  },
  {
    nombre: 'hoyIso se va a Greenwich (toISOString)',
    archivo: 'src/lib/fecha.ts',
    viejo: 'const mes = String(fecha.getMonth() + 1)',
    nuevo: 'return fecha.toISOString().slice(0, 10)\n  const mes = String(fecha.getMonth() + 1)',
  },
]

function corre() {
  try {
    execFileSync('npx', ['vitest', 'run', ...BATERIAS], { stdio: 'pipe', shell: true })
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
