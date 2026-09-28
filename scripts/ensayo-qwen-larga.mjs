// Ensayo (ALPHA_QWEN_LARGA=on): SOLO Qwen redacta (Sonnet apagado con CLAUDE_BIN falso). No publica nada.
import { readFileSync, writeFileSync } from 'node:fs'
import { redactarUna } from './lib/redactar-una-revision.mjs'

const [rutaFichas, salida, ...nombres] = process.argv.slice(2)
const { fichas } = JSON.parse(readFileSync(rutaFichas, 'utf8'))
const res = []
for (const f of fichas.filter((x) => !nombres.length || nombres.includes(x.nombre))) {
  console.log(`== ${f.nombre}`)
  const t0 = Date.now()
  let r
  try {
    r = redactarUna(f, { carpetaTemporal: 'F:/tmp', usarQwen: true })
  } catch (e) {
    r = { entregada: false, error: String(e).slice(0, 160) }
  }
  const s = Math.round((Date.now() - t0) / 1000)
  res.push({ persona: f.nombre, entregada: r.entregada, via: r.via, segundos: s, error: r.error, texto: r.texto,
    intentos: (r.intentos || []).map((i) => ({ via: i.via, problemas: i.problemas })) })
  console.log(`   -> ${r.entregada ? 'PASA con ' + r.via : 'no pasa'} en ${s} s`)
}
writeFileSync(salida, JSON.stringify(res, null, 1))
