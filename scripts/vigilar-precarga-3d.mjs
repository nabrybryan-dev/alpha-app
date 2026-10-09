// Vigila que three.js NO se le descargue a quien no abre la presentación.
//
// POR QUÉ EXISTE. El 9-oct-2026 el PR #361 publicó la presentación 3D y, durante una hora,
// `index.html` salió con un `modulepreload` del trozo de three.js (1,1 MB) y el service worker
// lo nombraba: lo bajaba TODO el mundo al abrir la app, aunque el código lo cargaba con
// `React.lazy`. Nadie lo vio antes de publicar porque el informe del build decía «quedó en un
// trozo aparte», que era cierto y no era suficiente. Esto mira el resultado del build, que es
// lo único que dice la verdad: qué archivos piden `index.html` y `sw.js`.
//
// Uso: `npx vite build && node scripts/vigilar-precarga-3d.mjs`. Sale con 1 si falla.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(process.cwd(), 'dist')
const ASSETS = join(DIST, 'assets')
// Lo que solo existe dentro de three.js. Si un trozo lo contiene, ese trozo ES three.
const MARCA = 'WebGLRenderer'

if (!existsSync(ASSETS)) {
  console.error('vigilar-precarga-3d: no hay dist/assets. Corre antes `npx vite build`.')
  process.exit(1)
}

const trozos3d = readdirSync(ASSETS)
  .filter((nombre) => nombre.endsWith('.js'))
  .filter((nombre) => readFileSync(join(ASSETS, nombre), 'utf8').includes(MARCA))

// Control positivo: si no se encuentra NINGÚN trozo con three, el vigilante no está viendo
// nada (o la presentación dejó de usar three) y un «todo bien» sería mentira.
if (trozos3d.length === 0) {
  console.error(`vigilar-precarga-3d: ningún trozo de dist/assets contiene «${MARCA}». O three ya no se usa (borra este vigilante) o la marca cambió.`)
  process.exit(1)
}

const fallos = []
const index = readFileSync(join(DIST, 'index.html'), 'utf8')
const sw = existsSync(join(DIST, 'sw.js')) ? readFileSync(join(DIST, 'sw.js'), 'utf8') : ''
for (const trozo of trozos3d) {
  if (index.includes(trozo)) fallos.push(`index.html pide ${trozo}: se descargaría al abrir la app`)
  if (sw.includes(trozo)) fallos.push(`sw.js precarga ${trozo}: se descargaría al instalar la app`)
}

// El trozo de entrada tampoco puede importarlo de forma estática.
const entrada = [...index.matchAll(/<script[^>]+src="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
for (const nombre of entrada) {
  const codigo = readFileSync(join(ASSETS, nombre), 'utf8')
  for (const trozo of trozos3d) {
    if (new RegExp(`from\\s*["']\\./${trozo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(codigo)) {
      fallos.push(`la entrada ${nombre} importa ${trozo} de forma estática`)
    }
  }
}

if (fallos.length > 0) {
  console.error('vigilar-precarga-3d: three.js se le descargaría a todo el mundo:')
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`vigilar-precarga-3d: bien. three vive en ${trozos3d.join(', ')} y ni index.html ni sw.js lo piden.`)
