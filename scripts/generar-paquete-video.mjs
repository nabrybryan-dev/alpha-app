// CLI: convierte un brief JSON en un paquete de producción de vídeo en Markdown.
//
//   npm run video -- docs/video/briefs/ejemplo-ajuste-semanal.json
//
// Toda la lógica vive en `produccion-video.mjs` (pura y testeada); aquí solo hay I/O.
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { construirPaquete, normalizarBrief } from './produccion-video.mjs'

const ruta = process.argv[2]
if (!ruta) {
  console.error('Uso: npm run video -- <ruta-al-brief.json>')
  console.error('Ejemplo: npm run video -- docs/video/briefs/ejemplo-ajuste-semanal.json')
  process.exit(1)
}

let brief
try {
  brief = JSON.parse(readFileSync(ruta, 'utf8'))
} catch (error) {
  console.error(`No se pudo leer el brief "${ruta}": ${error.message}`)
  process.exit(1)
}

let paquete
try {
  paquete = construirPaquete(brief, new Date().toISOString().slice(0, 10))
} catch (error) {
  console.error(`El brief tiene un problema: ${error.message}`)
  process.exit(1)
}

const salida = `docs/video/paquetes/${normalizarBrief(brief).slug}.md`
writeFileSync(salida, paquete, 'utf8')
console.log(`Paquete escrito en ${salida}`)
console.log(`Ábrelo y ve pegando los prompts en AI Studio. No gasta API: la cuota es la de tu suscripción.`)
console.log(`(brief: ${basename(ruta)})`)
