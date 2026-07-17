// Genera supabase/migrations/0002_semilla.sql a partir del seed local de la demo.
// Uso: npm run semilla   (regenerar cuando cambie el seed: las fechas son relativas a hoy)
import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { construirSemillaSql } from './semilla-sql.mjs'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const paquete = resolve(raiz, 'node_modules/.cache/semilla/seed.mjs')
const destino = resolve(raiz, 'supabase/migrations/0002_semilla.sql')

async function main() {
  await build({
    entryPoints: [resolve(raiz, 'src/data/seed/index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile: paquete,
    logLevel: 'silent',
  })

  const { seedDb } = await import(pathToFileURL(paquete).href)
  const hoy = new Date().toISOString().slice(0, 10)
  const sql = construirSemillaSql(seedDb, hoy)

  await mkdir(dirname(destino), { recursive: true })
  await writeFile(destino, sql, 'utf8')
  process.stdout.write(`Semilla escrita en supabase/migrations/0002_semilla.sql (${sql.length} caracteres)\n`)
}

main().catch((error) => {
  process.stderr.write(`Error generando la semilla: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
