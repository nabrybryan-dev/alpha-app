// RUTA B (opcional): borradores de imagen contra la API de Gemini con el free tier.
//
//   GEMINI_API_KEY=... node scripts/generar-imagenes-gemini.mjs docs/video/paquetes/<slug>.md
//
// Para qué: iterar mucho sobre un encuadre sin gastar la cuota de la suscripción.
// Usa **Flash Image**, que sí tiene free tier; Nano Banana **Pro** no lo tiene y se
// paga por imagen, así que el plano definitivo se genera en AI Studio a mano.
//
// La key va SIEMPRE en el entorno. Nunca en un archivo del repo, nunca en un commit.
// Ver docs/specs/2026-08-22-video-nano-banana-diseno.md.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const MODELO = 'gemini-3.1-flash-image-preview'
const RAIZ = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Saca del paquete Markdown los prompts de imagen con el archivo al que van.
 * Se apoya en el formato que escribe `generar-paquete-video.mjs`: la línea
 * "guardar como `x.png`" y el bloque de código que viene justo detrás.
 */
export function extraerPromptsDeImagen(markdown) {
  const encontrados = []
  const lineas = markdown.split('\n')
  for (let i = 0; i < lineas.length; i += 1) {
    const cabecera = lineas[i].match(/guardar como `(.+\.png)`/)
    if (!cabecera) continue
    const inicio = lineas.indexOf('```', i + 1)
    if (inicio === -1) continue
    const fin = lineas.indexOf('```', inicio + 1)
    if (fin === -1) continue
    encontrados.push({
      archivo: cabecera[1],
      prompt: lineas.slice(inicio + 1, fin).join('\n'),
    })
    i = fin
  }
  return encontrados
}

/** Cuerpo de la petición. Aislado para poder probarlo sin llamar a nadie. */
export function construirPeticion(prompt) {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  }
}

/** Saca el base64 de la primera imagen de la respuesta, o lanza diciendo qué vino. */
export function extraerImagenBase64(respuesta) {
  const partes = respuesta?.candidates?.[0]?.content?.parts ?? []
  const imagen = partes.find((parte) => parte?.inlineData?.data)
  if (imagen) return imagen.inlineData.data
  const texto = partes.find((parte) => parte?.text)?.text
  const motivo = respuesta?.promptFeedback?.blockReason ?? respuesta?.candidates?.[0]?.finishReason
  throw new Error(
    `La respuesta no traía imagen${motivo ? ` (motivo: ${motivo})` : ''}${texto ? `: ${texto.slice(0, 200)}` : '.'}`,
  )
}

async function generar(prompt, clave) {
  const respuesta = await fetch(`${RAIZ}/${MODELO}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify(construirPeticion(prompt)),
  })
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text()
    throw new Error(`HTTP ${respuesta.status}: ${cuerpo.slice(0, 300)}`)
  }
  return extraerImagenBase64(await respuesta.json())
}

async function principal() {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) {
    console.error('Falta GEMINI_API_KEY en el entorno. Se saca gratis en aistudio.google.com.')
    console.error('No la escribas en ningún archivo del repo.')
    process.exit(1)
  }
  const ruta = process.argv[2]
  if (!ruta) {
    console.error('Uso: GEMINI_API_KEY=... node scripts/generar-imagenes-gemini.mjs <paquete.md>')
    process.exit(1)
  }

  const planos = extraerPromptsDeImagen(readFileSync(ruta, 'utf8'))
  if (!planos.length) {
    console.error(`No encontré prompts de imagen en "${ruta}". ¿Es un paquete de npm run video?`)
    process.exit(1)
  }

  const destino = join(dirname(ruta), 'borradores')
  mkdirSync(destino, { recursive: true })
  console.log(`${planos.length} planos → ${destino}/ (borradores con Flash Image)`)

  let fallos = 0
  for (const plano of planos) {
    try {
      const base64 = await generar(plano.prompt, clave)
      writeFileSync(join(destino, plano.archivo), Buffer.from(base64, 'base64'))
      console.log(`  ✓ ${plano.archivo}`)
    } catch (error) {
      fallos += 1
      console.error(`  ✗ ${plano.archivo}: ${error.message}`)
    }
  }
  console.log('Borradores para encuadre. El plano que se publica, en AI Studio con Nano Banana Pro.')
  process.exit(fallos ? 1 : 0)
}

// Solo corre como CLI; importarlo desde un test no dispara nada.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await principal()
}
