// Un acta no vale para siempre: certifica UNA pantalla, la del dia que se levanto.
// Sale 0 si el acta es posterior al codigo que dice certificar, 1 si no.
// Lo usa `comprobar-meta.sh` (paso 3).
//
// El 2-sep la meta salia cumplida con un acta del 29-ago. Entre medias se habia
// cambiado el fondo del motor, desmontado la sala del lienzo y roto una prueba. El
// acta seguia ahi, en verde, hablando de una pantalla que ya no existia.
//
// Se compara contra DOS fechas y manda la mas nueva:
//
//   - el ultimo commit que toca `src/features/entrenar/`;
//   - el archivo modificado mas recientemente de esa carpeta.
//
// La segunda no sobra. Casi todo el trabajo pasa un rato largo sin commitear, y con
// solo la primera bastaria con no commitear para que un acta vieja siguiera valiendo.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Los dos por argumento, con los del salon por defecto: desde que hay un segundo
// testigo —el de las cuatro pantallas— la caducidad se comprueba igual y sobre otras
// carpetas. Dos copias de esta comprobacion se separarian al primer ajuste.
const arg = (n, porDefecto) => {
  const encontrado = process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))
  return encontrado ? encontrado.slice(n.length + 3) : porDefecto
}
const ACTA = arg('acta', 'informes/testigo-salon.json')
const VIGILADAS = arg('vigila', 'src/features/entrenar').split(/\s+/).filter(Boolean)
const IGNORADAS = new Set(['node_modules', 'dist', 'coverage', '.git'])

/** El archivo tocado mas recientemente bajo `dir`, con su fecha. */
function masReciente(dir) {
  let top = { ruta: null, ms: 0 }
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORADAS.has(entrada.name)) continue
    const ruta = join(dir, entrada.name)
    if (entrada.isDirectory()) {
      const hijo = masReciente(ruta)
      if (hijo.ms > top.ms) top = hijo
    } else {
      const ms = statSync(ruta).mtimeMs
      if (ms > top.ms) top = { ruta, ms }
    }
  }
  return top
}

let cuando
try {
  cuando = new Date(JSON.parse(readFileSync(ACTA, 'utf8')).cuando)
} catch (e) {
  console.log(`  FALLA ${ACTA} sin campo \`cuando\` legible: ${e.message}`)
  process.exit(1)
}
if (Number.isNaN(cuando.getTime())) {
  console.log('  FALLA el campo `cuando` del acta no es una fecha')
  process.exit(1)
}

let commit = { ms: 0, texto: 'sin commits en la carpeta' }
try {
  const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...VIGILADAS], { encoding: 'utf8' }).trim()
  if (iso) commit = { ms: new Date(iso).getTime(), texto: `ultimo commit ${iso}` }
} catch {
  // sin git no se puede fechar por commit; queda la fecha de los archivos.
}

let archivo = { ruta: null, ms: 0 }
for (const carpeta of VIGILADAS) {
  const top = masReciente(carpeta)
  if (top.ms > archivo.ms) archivo = top
}
const referencia = Math.max(commit.ms, archivo.ms)
const cual = commit.ms >= archivo.ms ? commit.texto : `archivo ${archivo.ruta} (${new Date(archivo.ms).toISOString()})`

if (cuando.getTime() >= referencia) {
  console.log(`  OK    acta ${cuando.toISOString()} posterior a ${cual}`)
  process.exit(0)
}
const horas = ((referencia - cuando.getTime()) / 3600000).toFixed(1)
console.log(`  FALLA acta ${cuando.toISOString()} es ${horas} h ANTERIOR a ${cual}`)
console.log('        certifica una pantalla que ya se ha tocado. Hay que volver a levantarla.')
process.exit(1)
