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
  // ── Fase 2 ──
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'tobillo: suma(g.porEncimaDelTobillo, (z) => z - g.tobillo.z),',
    reemplazar: 'tobillo: suma(g.porEncimaDelTobillo, (z) => g.tobillo.z - z),',
    que: 'signo del tobillo invertido',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'rodilla: suma(g.porEncimaDeLaRodilla, (z) => g.rodilla.z - z),',
    reemplazar: 'rodilla: suma(g.porEncimaDeLaRodilla, (z) => z - g.rodilla.z),',
    que: 'signo de la rodilla invertido',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: "const barra: MasaPuntual = { nombre: 'barra', kg: cargaKg, ...puntoBarra }",
    reemplazar: "const barra: MasaPuntual = { nombre: 'barra', kg: 0, ...puntoBarra }",
    que: 'se ignora la barra',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'kg: 2 * (m.brazo.masaKg + m.antebrazo.masaKg + m.mano.masaKg),',
    reemplazar: 'kg: 0,',
    que: 'se ignoran los brazos',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'z: prox.z - cm * largo * u.z,',
    reemplazar: 'z: prox.z + cm * largo * u.z,',
    que: 'el centro de masas medido hacia el lado equivocado del segmento',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'const sobreLaCadera = [tronco, cabeza, brazos, barra]',
    reemplazar: 'const sobreLaCadera = [tronco, brazos, barra]',
    que: 'se olvida la cabeza',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: "if (!finito(e.cargaKg) || e.cargaKg < 0) return faltan('carga ausente o negativa')",
    reemplazar: '',
    que: 'una carga ausente pasa como si fuera 0',
  },
  // ── Fase 3 ──
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const talla = (e.talla as number) + u.talla * normal(azar)',
    reemplazar: 'const talla = (e.talla as number) + 0 * u.talla * normal(azar)',
    que: 'ignora la incertidumbre de la talla',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const masa = (e.masa as number) + u.masa * normal(azar)',
    reemplazar: 'const masa = (e.masa as number) + 0 * u.masa * normal(azar)',
    que: 'ignora la incertidumbre de la masa',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const a = (x: number) => x + u.angulo * normal(azar)',
    reemplazar: 'const a = (x: number) => x + 0 * u.angulo * normal(azar)',
    que: 'ignora la incertidumbre de los ángulos',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const carga = Math.max(0, (e.cargaKg as number) + u.carga * normal(azar))',
    reemplazar: 'const carga = Math.max(0, (e.cargaKg as number) + 0 * u.carga * normal(azar))',
    que: 'ignora la incertidumbre de la carga',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const k = antes / despues',
    reemplazar: 'const k = 1',
    que: 'quita la renormalización de masas (la masa total deja de conservarse)',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'inf: Math.min(percentil(orden, 0.05), c.valor as number),',
    reemplazar: 'inf: Math.min(percentil(orden, 0.95), c.valor as number),',
    que: 'percentil inferior tomado del 95',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: '{ muestras = 2000, semilla = 20261020 }: OpcionesDeBanda = {},\n): MuestrasDeMomentos {\n  const azar = crearAzar(semilla)',
    reemplazar: '{ muestras = 2000, semilla = 20261020 }: OpcionesDeBanda = {},\n): MuestrasDeMomentos {\n  const azar = crearAzar(1)',
    que: 'ignora la semilla pedida',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'nuevaMasa[n] = s.segmentos[n].masa * factor()\n    nuevoCm[n]',
    reemplazar: 'nuevaMasa[n] = s.segmentos[n].masa\n    nuevoCm[n]',
    que: 'ignora la incertidumbre de la masa de los segmentos',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'if (datos.length < n * 0.9) {',
    reemplazar: 'if (false) {',
    que: 'deja de abstenerse cuando las muestras fallan',
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
