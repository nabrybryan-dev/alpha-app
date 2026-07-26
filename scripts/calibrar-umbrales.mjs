import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const MODELO = 'text-embedding-3-small'
const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

for (const [nombre, valor] of Object.entries({ OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre}.`)
    process.exit(1)
  }
}

// Preguntas reales escritas como escribe la gente, con la ficha que DEBERÍA
// enganchar. Las tres últimas no tienen ficha: deben quedarse por debajo del
// umbral bajo, y son las que evitan que el sistema conteste cualquier cosa.
const CASOS = [
  ['hasta donde bajo en la sentadilla', 'tecnica-profundidad-sentadilla'],
  ['q es el rir no entiendo', 'vocabulario-rir'],
  ['me duele la rodilla puedo seguir', 'dolor-articular-en-ejercicio'],
  ['se me escapa el pipi cuando salto', 'mujer-suelo-pelvico'],
  ['no me dieron agujetas entonces no sirvio', 'fatiga-sin-agujetas'],
  ['subi de peso esta semana voy mal', 'peso-subi-esta-semana'],
  ['tomo pastillas anticonceptivas afecta', 'mujer-anticonceptivos'],
  ['me maree en la serie', 'dolor-mareo-falta-de-aire'],
  ['cuanta proteina necesito', 'nutricion-cuanta-proteina'],
  ['no tengo ganas de nada', 'vida-sin-ganas'],
  ['puedo tomar creatina', 'suplemento-creatina'],
  ['que es un rest pause', 'vocabulario-rest-pause'],
  ['donde queda el gimnasio', null],
  ['cuanto cuesta la asesoria', null],
  ['me puedes recomendar una serie de netflix', null],
]

async function embeber(texto) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { authorization: `Bearer ${OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO, input: texto }),
  })
  if (!r.ok) throw new Error(`OpenAI respondió ${r.status}: ${await r.text()}`)
  return (await r.json()).data[0].embedding
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

let aciertos = 0
const conFicha = []
const sinFicha = []

for (const [pregunta, esperada] of CASOS) {
  const vector = await embeber(pregunta)
  const { data, error } = await supabase.rpc('buscar_ficha', { consulta: vector, limite: 1 })
  if (error) {
    console.error(`Error consultando "${pregunta}": ${error.message}`)
    process.exit(1)
  }

  const top = data?.[0]
  const sim = top ? Number(top.similitud.toFixed(3)) : 0
  const ok = esperada === null ? true : top?.id === esperada

  if (esperada === null) sinFicha.push(sim)
  else {
    conFicha.push(sim)
    if (ok) aciertos++
  }

  const marca = esperada === null ? '·' : ok ? '✔' : '✖'
  console.log(`${marca} ${sim.toFixed(3)}  "${pregunta}"`)
  console.log(`         → ${top?.id ?? '(nada)'}${esperada && !ok ? `   esperada: ${esperada}` : ''}`)
}

const min = (a) => Math.min(...a)
const max = (a) => Math.max(...a)

console.log(`\nAciertos: ${aciertos}/${CASOS.filter(([, e]) => e !== null).length}`)
console.log(`Con ficha  → mín ${min(conFicha).toFixed(3)}  máx ${max(conFicha).toFixed(3)}`)
console.log(`Sin ficha  → mín ${min(sinFicha).toFixed(3)}  máx ${max(sinFicha).toFixed(3)}`)
console.log(`\nUmbral alto sugerido: por debajo de ${min(conFicha).toFixed(3)}`)
console.log(`Umbral bajo sugerido: por encima de ${max(sinFicha).toFixed(3)}`)
