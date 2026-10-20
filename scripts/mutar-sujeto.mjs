// Mutaciones a propósito del dominio del sujeto: "ningún arnés cuenta verde hasta haberlo visto
// fallar". Para cada mutación quita UNA regla del código (reemplazo textual exacto), corre las
// pruebas del dominio y exige que fallen; al terminar restaura el archivo, pase lo que pase.
//
//   npm run mutar-sujeto            todas
//   npm run mutar-sujeto -- fase1   solo las de una fase
//
// Sale con código 1 si alguna mutación SOBREVIVE (las pruebas siguen en verde con la regla
// rota: el arnés no ve ese defecto) o si el texto a mutar ya no existe (la mutación quedó vieja).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const D = 'src/domain/sujeto/'

/**
 * { fase, archivo, buscar, reemplazar, que, con? } — `buscar` debe aparecer exactamente una vez.
 * `con: 'cotejo'` = la mutación la tiene que ver el cotejo contra el PDF (valores transcritos),
 * no las pruebas: una tabla transcrita se juzga contra su fuente, no contra sí misma.
 */
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
  // ── Fase 1 ──
  {
    fase: 'fase1',
    archivo: D + 'deleva.ts',
    buscar: 'muslo: { masa: 0.1416, cm: 0.4095, largo: 0.4222 },',
    reemplazar: 'muslo: { masa: 0.1461, cm: 0.4095, largo: 0.4222 },',
    que: 'varones: dos cifras del muslo intercambiadas (14,16 a 14,61 %)',
  },
  {
    fase: 'fase1',
    archivo: D + 'deleva.ts',
    buscar: 'muslo: { masa: 0.1478, cm: 0.3612, largo: 0.3685 },',
    reemplazar: 'muslo: { masa: 0.1478, cm: 0.3612, largo: 0.3865 },',
    que: 'mujeres: el largo del muslo con dos cifras intercambiadas (solo lo ve el cotejo)',
    con: 'cotejo',
  },
  {
    fase: 'fase1',
    archivo: D + 'deleva.ts',
    buscar: 'cabeza: { masa: 0.0668, cm: 0.5894, largo: 0.2002 },',
    reemplazar: 'cabeza: { masa: 0.0668, cm: 0.5984, largo: 0.2002 },',
    que: 'mujeres: el CM de la cabeza mal copiado (solo lo ve el cotejo)',
    con: 'cotejo',
  },
  {
    fase: 'fase1',
    archivo: D + 'sujeto.ts',
    buscar: 'const escala = e.talla / tabla.estaturaDeReferencia',
    reemplazar: 'const escala = tabla.estaturaDeReferencia / e.talla',
    que: 'la escala a la talla al revés',
  },
  {
    fase: 'fase1',
    archivo: D + 'sujeto.ts',
    buscar: 'masaKg: p.masa * e.masa,',
    reemplazar: 'masaKg: p.masa,',
    que: 'la masa del segmento sin multiplicar por la masa del asesorado',
  },
  {
    fase: 'fase1',
    archivo: D + 'sujeto.ts',
    buscar: 'if (!valido(e.talla) || !valido(e.masa)) return null',
    reemplazar: 'if (false) return null',
    que: 'deja de rechazar una talla o masa NaN',
  },
  {
    fase: 'fase1',
    archivo: D + 'sujeto.ts',
    buscar: 'if (e.talla < LIMITES_DE_CORDURA.tallaMin || e.talla > LIMITES_DE_CORDURA.tallaMax) return null',
    reemplazar: '',
    que: 'deja de rechazar una talla en centímetros',
  },
  {
    fase: 'fase1',
    archivo: D + 'deleva.ts',
    buscar: 'suma + DE_LEVA[sexo].segmentos[s].masa * (SEGMENTOS_PARES.includes(s) ? 2 : 1),',
    reemplazar: 'suma + DE_LEVA[sexo].segmentos[s].masa,',
    que: 'la suma de fracciones no cuenta los pares dos veces',
  },
]

const PDF_DE_LEVA =
  process.env.LEVA_PDF ??
  join(raiz, '..', 'cerebro-alpha', 'herramientas', 'encoder-camara', 'articulos', 'DeLeva_1996_J_Biomech_segment_parameters.pdf')

/** Vuelca las constantes del código y las coteja contra el PDF. Código 0 = coinciden. */
function correrCotejo() {
  if (!existsSync(PDF_DE_LEVA)) {
    console.error(`No encuentro el PDF de de Leva en ${PDF_DE_LEVA}`)
    process.exit(2)
  }
  const volcado = spawnSync(
    process.execPath,
    [join(raiz, 'node_modules', 'vite-node', 'vite-node.mjs'), 'scripts/volcar-valores-sujeto.mts'],
    { cwd: raiz, encoding: 'utf8', timeout: 120_000 },
  )
  if (volcado.status !== 0) return volcado.status ?? 1
  const ruta = join(raiz, 'node_modules', '.tmp', 'valores-sujeto.json')
  writeFileSync(ruta, volcado.stdout)
  const r = spawnSync('python', ['-I', 'scripts/cotejar-deleva-con-pdf.py', ruta, PDF_DE_LEVA], { cwd: raiz, encoding: 'utf8' })
  return r.status
}

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
  if (base !== 0 || (lista.some((m) => m.con === 'cotejo') && correrCotejo() !== 0)) {
    console.error('Las pruebas o el cotejo ya están en rojo SIN mutar: no se puede juzgar a las mutaciones.')
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
      const estado = m.con === 'cotejo' ? correrCotejo() : correrPruebas()
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
