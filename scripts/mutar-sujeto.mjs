// Mutaciones a propósito del dominio del sujeto: "ningún arnés cuenta verde hasta haberlo visto
// fallar". Para cada mutación quita UNA regla del código (reemplazo textual exacto), corre las
// pruebas del dominio y exige que fallen; al terminar restaura el archivo, pase lo que pase.
//
//   npm run mutar-sujeto            todas
//   npm run mutar-sujeto -- fase1   solo las de una fase
//
// Sale con código 1 si alguna mutación SOBREVIVE (las pruebas siguen en verde con la regla
// rota: el arnés no ve ese defecto) o si el texto a mutar ya no existe (la mutación quedó vieja).
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const D = 'src/domain/sujeto/'

/** { fase, archivo, buscar, reemplazar, que } — `buscar` debe aparecer exactamente una vez. */
export const MUTACIONES = [
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: "if (c.valor !== null) {\n      fallo('E_CERO_POR_NULL'",
    reemplazar: "if (false) {\n      fallo('E_CERO_POR_NULL'",
    que: 'deja de rechazar un no_afirmable con número (el cero en lugar de null)',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: "if (!(UNIDADES as readonly string[]).includes(c.unidad as string)) {",
    reemplazar: 'if (false) {',
    que: 'deja de rechazar una unidad sin declarar',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: "if (c.fuente.length === 0 || c.fuente.some((f) => f.trim() === '')) {",
    reemplazar: 'if (false) {',
    que: 'deja de rechazar una cifra sin procedencia',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: 'const nula = (c.dependeDe ?? []).find((d) => d.valor === null)',
    reemplazar: 'const nula = undefined as { id: string } | undefined',
    que: 'deja de propagar el null (un cero calculado sobre una entrada ausente pasa)',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: "if (c.estado === 'estimado' && c.banda === null) {",
    reemplazar: 'if (false) {',
    que: 'deja de exigir banda a una estimación',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: '      inf > sup ||\n',
    reemplazar: '      false ||\n',
    que: 'deja de ver una banda invertida',
  },
  {
    fase: 'fase0',
    archivo: D + 'procedencias.ts',
    buscar: 'if (Number(fila.valor) !== valor) {',
    reemplazar: 'if (false) {',
    que: 'el libro y el código pueden diverger sin que el arnés lo vea',
  },
  {
    fase: 'fase0',
    archivo: D + 'procedencias.ts',
    buscar: 'if (propias.length > 1) {',
    reemplazar: 'if (false) {',
    que: 'deja de ver una fila duplicada',
  },
  {
    fase: 'fase0',
    archivo: D + 'procedencias.ts',
    buscar: "export const ESTADOS_QUE_NO_RESPALDAN = ['INVENTADO', 'ENGAÑOSO']",
    reemplazar: 'export const ESTADOS_QUE_NO_RESPALDAN: string[] = []',
    que: 'una cifra puede citar una fila marcada INVENTADO',
  },
]

function correrPruebas() {
  const vitest = join(raiz, 'node_modules', 'vitest', 'vitest.mjs')
  const r = spawnSync(process.execPath, [vitest, 'run', D.replace(/\/$/, '')], {
    cwd: raiz,
    encoding: 'utf8',
    timeout: 170_000,
  })
  return r.status
}

function principal() {
  const filtro = process.argv[2]
  const lista = MUTACIONES.filter((m) => !filtro || m.fase === filtro)
  if (lista.length === 0) {
    console.error(`ninguna mutación para «${filtro}»`)
    process.exit(1)
  }
  // Control: sin mutar, las pruebas tienen que estar en verde, o "fallarían" por otra cosa.
  const base = correrPruebas()
  if (base !== 0) {
    console.error('Las pruebas ya están en rojo SIN mutar: no se puede juzgar a las mutaciones.')
    process.exit(1)
  }
  let sobrevivientes = 0
  let viejas = 0
  for (const m of lista) {
    const ruta = join(raiz, m.archivo)
    const original = readFileSync(ruta, 'utf8')
    const veces = original.split(m.buscar).length - 1
    if (veces !== 1) {
      console.log(`VIEJA      ${m.fase} ${m.archivo}: «${m.que}» (el texto aparece ${veces} veces)`)
      viejas++
      continue
    }
    try {
      writeFileSync(ruta, original.replace(m.buscar, () => m.reemplazar))
      const estado = correrPruebas()
      if (estado === 0) {
        console.log(`SOBREVIVE  ${m.fase} ${m.archivo}: ${m.que}`)
        sobrevivientes++
      } else {
        console.log(`muerta     ${m.fase} ${m.archivo}: ${m.que}`)
      }
    } finally {
      writeFileSync(ruta, original)
    }
  }
  const restaurado = correrPruebas()
  console.log(
    `\n${lista.length} mutaciones · ${sobrevivientes} sobreviven · ${viejas} viejas · pruebas tras restaurar: ${restaurado === 0 ? 'verde' : 'ROJO'}`,
  )
  process.exit(sobrevivientes + viejas > 0 || restaurado !== 0 ? 1 : 0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) principal()
