import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { parsearFicha, textoParaEmbedding, validarFicha } from '../src/domain/ficha.ts'

const CARPETA = resolve(process.cwd(), '..', 'wiki', 'centro-respuestas')
const MODELO = 'text-embedding-3-small'
const DIMENSION = 1536

const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

for (const [nombre, valor] of Object.entries({ OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre}.`)
    process.exit(1)
  }
}

/** Pide los embeddings de varios textos en una sola llamada. */
async function pedirEmbeddings(textos) {
  const respuesta = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODELO, input: textos }),
  })

  if (!respuesta.ok) {
    throw new Error(`OpenAI respondió ${respuesta.status}: ${await respuesta.text()}`)
  }

  const datos = await respuesta.json()
  return datos.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}

const archivos = (await readdir(CARPETA))
  .filter((n) => n.endsWith('.md') && n !== 'README.md')
  .sort()

const fichas = []
for (const archivo of archivos) {
  const ficha = parsearFicha(await readFile(join(CARPETA, archivo), 'utf8'))
  const errores = validarFicha(ficha)
  if (errores.length) {
    console.error(`✖ ${archivo} no es válida. Corre "npm run validar-fichas" primero.`)
    for (const e of errores) console.error(`    ${e}`)
    process.exit(1)
  }
  fichas.push(ficha)
}

console.log(`${fichas.length} fichas válidas. Pidiendo embeddings...`)

const vectores = await pedirEmbeddings(fichas.map(textoParaEmbedding))

if (vectores.length !== fichas.length) {
  console.error(`OpenAI devolvió ${vectores.length} vectores para ${fichas.length} fichas.`)
  process.exit(1)
}
for (const v of vectores) {
  if (v.length !== DIMENSION) {
    console.error(`Dimensión inesperada: ${v.length}, se esperaba ${DIMENSION}.`)
    process.exit(1)
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

const filas = fichas.map((ficha, i) => ({
  id: ficha.id,
  bloque: ficha.bloque,
  titulo: ficha.titulo,
  variantes: ficha.variantes,
  cuerpo: ficha.cuerpo,
  datos_que_usa: ficha.datosQueUsa,
  bandera_salud: ficha.banderaSalud,
  fuentes: ficha.fuentes,
  publicada: true,
  embedding: vectores[i],
  actualizado: new Date().toISOString(),
}))

const { error } = await supabase.from('fichas_respuesta').upsert(filas, { onConflict: 'id' })

if (error) {
  console.error('Fallo el upsert:', error.message)
  process.exit(1)
}

console.log(`✔ ${filas.length} fichas publicadas en Supabase.`)
