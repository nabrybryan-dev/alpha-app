/**
 * EL DETECTOR DE «LA CADENA SE FUE A UN MODELO EXTERNO».
 *
 * Decisión de Bryan, 22-oct: «Todo en el PC». El mensaje semanal no puede mandar contexto de
 * salud a ningún modelo externo. Esto recorre lo que la cadena del viernes ALCANZA —el `.ps1`, los
 * scripts de npm que lanza y todo lo que éstos importan— y devuelve cada línea que llama a uno.
 * La prueba que lo usa (`cadena-sin-modelo-externo.test.mjs`) falla si hay un solo hallazgo.
 *
 * Por qué recorrer y no mirar una lista fija de archivos: la llamada de septiembre vivía en una
 * librería (`lib/redactar-una-revision.mjs`) que importaba un script que lanzaba el `.ps1`. Una
 * lista de archivos no ve la librería que alguien importe mañana.
 *
 * LÍMITE DECLARADO: es un detector de formas conocidas (la CLI del modelo, su variable de entorno,
 * las URL y los SDK de los proveedores). No ve una llamada escrita de forma que no conoce. Por eso
 * la prueba lo comprueba con positivos sembrados, y por eso no sustituye a leer el diff.
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

/** Cada forma conocida de llamar a un modelo que no corre en este equipo. */
export const PATRONES_DE_MODELO_EXTERNO = [
  { nombre: 'la CLI del modelo por nombre', regex: /['"`]claude(?:\.exe)?['"`]/i },
  { nombre: 'la CLI del modelo en una orden', regex: /(?:^|[\s;&|('"`])claude(?:\.exe)?\s+-p\b/im },
  { nombre: 'el ejecutable del modelo', regex: /\bclaude\.exe\b/i },
  { nombre: 'la variable del ejecutable', regex: /\bCLAUDE_BIN\b/ },
  { nombre: 'el modelo elegido por opción', regex: /--model\s+['"`]?(?:sonnet|haiku|opus)/i },
  { nombre: 'un proveedor de modelos por HTTP', regex: /api\.(?:anthropic|openai)\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.cohere\.(?:ai|com)/i },
  { nombre: 'un SDK de modelos', regex: /@anthropic-ai\/|from ['"]openai['"]|@google\/generative-ai/i },
]

const EXTENSIONES = ['', '.mjs', '.ts', '.js', '.mts', '.tsx', '/index.ts', '/index.mjs']

async function leer(ruta) {
  try {
    return await readFile(ruta, 'utf8')
  } catch {
    return null
  }
}

function importsRelativos(texto) {
  const hallados = new Set()
  const formas = [
    /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
    /\bimport\s+['"](\.{1,2}\/[^'"]+)['"]/g,
    /\brequire\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
  ]
  for (const f of formas) for (const m of texto.matchAll(f)) hallados.add(m[1])
  return [...hallados]
}

function resolverImport(desde, especificador) {
  const base = resolve(dirname(desde), especificador)
  for (const ext of EXTENSIONES) {
    const candidata = `${base}${ext}`
    if (existsSync(candidata) && !candidata.endsWith('/') && /\.[a-z0-9]+$/i.test(candidata)) return candidata
  }
  return null
}

/** Los archivos que un script de npm lanza, mirando su comando (`vite-node scripts/x.mjs`). */
function archivosDeUnScript(comando, raiz) {
  const salida = []
  for (const m of String(comando).matchAll(/([\w./\\-]+\.(?:mjs|ts|mts|js|ps1|py))/g)) {
    const ruta = resolve(raiz, m[1])
    if (existsSync(ruta)) salida.push(ruta)
  }
  return salida
}

/**
 * @param {{raiz: string, entradas: string[]}} p  `entradas` relativas a la raíz (el `.ps1`)
 * @returns {Promise<{archivos: string[], hallazgos: {archivo: string, linea: number, patron: string, texto: string}[]}>}
 */
export async function recorrerLaCadena({ raiz, entradas }) {
  const paquete = JSON.parse((await leer(join(raiz, 'package.json'))) ?? '{"scripts":{}}')
  const scripts = paquete.scripts ?? {}
  const pendientes = entradas.map((e) => resolve(raiz, e))
  const vistos = new Set()
  const hallazgos = []

  while (pendientes.length) {
    const ruta = pendientes.pop()
    if (vistos.has(ruta)) continue
    vistos.add(ruta)
    const texto = await leer(ruta)
    if (texto === null) continue
    const relativa = relative(raiz, ruta).replace(/\\/g, '/')

    texto.split(/\r?\n/).forEach((linea, i) => {
      for (const p of PATRONES_DE_MODELO_EXTERNO) {
        if (p.regex.test(linea)) {
          hallazgos.push({ archivo: relativa, linea: i + 1, patron: p.nombre, texto: linea.trim().slice(0, 160) })
        }
      }
    })

    if (/\.(?:mjs|ts|mts|js|tsx)$/i.test(ruta)) {
      for (const esp of importsRelativos(texto)) {
        const destino = resolverImport(ruta, esp)
        if (destino) pendientes.push(destino)
      }
    } else if (/\.ps1$/i.test(ruta)) {
      // El `.ps1` nombra los scripts de npm como palabras sueltas ('revision-semanal', 'run ...')
      // y a veces rutas a otros scripts: se siguen las dos cosas.
      for (const [nombre, comando] of Object.entries(scripts)) {
        const palabra = new RegExp(`(?<![\\w.-])${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`)
        if (palabra.test(texto)) pendientes.push(...archivosDeUnScript(comando, raiz))
      }
      for (const m of texto.matchAll(/(scripts[\\/][\w./\\-]+\.(?:mjs|ps1|py))/g)) {
        const ruta2 = resolve(raiz, m[1])
        if (existsSync(ruta2)) pendientes.push(ruta2)
      }
    }
  }

  return {
    archivos: [...vistos].map((r) => relative(raiz, r).replace(/\\/g, '/')).sort(),
    hallazgos,
  }
}
