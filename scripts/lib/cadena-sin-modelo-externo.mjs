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
 * Y NO SOLO MODELOS (revisión 06, H2): subir los audios de la tanda a un servicio externo es lo mismo. La
 * cara se hacía subiendo los `*.mp3` (con el nombre y las cifras de salud de cada persona) a Kaggle.
 * Esas formas —Kaggle, una subida por HTTP, `curl`, un host de fuera— se marcan `optIn`: son un
 * hallazgo SALVO que estén dentro de un bloque `if ($ConCara) { … }` de un `.ps1`, la bandera
 * explícita que las apaga por defecto. Entonces salen aparte, en `optIn`, para que la prueba vea que
 * existen y sepa que están detrás de la bandera. Un modelo de lenguaje NUNCA es opt-in.
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
  // ── servicios externos a los que subir audios (opt-in detrás de `if ($ConCara)`) ──
  { nombre: 'Kaggle (la cara en GPU de fuera)', regex: /\bkaggle\b|lanzar_en_kaggle/i, optIn: true },
  { nombre: 'el entorno de la cara en GPU', regex: /cara-gpu|cara-alpha/i, optIn: true },
  { nombre: 'una subida o descarga por HTTP desde PowerShell', regex: /\b(?:Invoke-RestMethod|Invoke-WebRequest|Start-BitsTransfer)\b/i, optIn: true },
  { nombre: 'curl, scp, rsync o sftp', regex: /(?:^|[\s;&|('"`])(?:curl(?:\.exe)?|scp|rsync|sftp)\s/im, optIn: true },
  {
    nombre: 'un host de fuera (no es Supabase ni este equipo)',
    regex: /https?:\/\/(?!(?:[\w-]+\.)*supabase\.co\b|localhost\b|127\.0\.0\.1\b|\[::1\])[\w.-]+\.[a-z]{2,}/i,
    optIn: true,
  },
  // ── modelos de lenguaje: NUNCA opt-in ──
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
 * @returns {Promise<{archivos: string[], hallazgos: Hallazgo[], optIn: Hallazgo[]}>}
 */
/**
 * Una línea que solo es un comentario no ejecuta nada: explicar en un comentario por qué la cara está
 * apagada («sube los audios a Kaggle») no puede encender el detector. Una línea con código y un comentario
 * al final SÍ se mira.
 */
function esComentario(linea, ruta) {
  return /\.ps1$/i.test(ruta) ? /^\s*#/.test(linea) : /^\s*(?:\/\/|\/\*|\*)/.test(linea)
}

/** Las líneas (1-based) que quedan dentro de un `if ($ConCara) { … }`: la bandera que apaga lo externo. */
function lineasDeLaBandera(lineas) {
  const dentro = new Set()
  for (let i = 0; i < lineas.length; i++) {
    if (!/^\s*if\s*\(\s*\$ConCara\s*\)\s*\{/i.test(lineas[i])) continue
    let profundidad = 0
    for (let j = i; j < lineas.length; j++) {
      profundidad += (lineas[j].match(/\{/g) ?? []).length - (lineas[j].match(/\}/g) ?? []).length
      dentro.add(j + 1)
      if (profundidad <= 0) break
    }
  }
  return dentro
}

export async function recorrerLaCadena({ raiz, entradas }) {
  const paquete = JSON.parse((await leer(join(raiz, 'package.json'))) ?? '{"scripts":{}}')
  const scripts = paquete.scripts ?? {}
  const pendientes = entradas.map((e) => resolve(raiz, e))
  const vistos = new Set()
  const hallazgos = []
  const optIn = []

  while (pendientes.length) {
    const ruta = pendientes.pop()
    if (vistos.has(ruta)) continue
    vistos.add(ruta)
    const texto = await leer(ruta)
    if (texto === null) continue
    const relativa = relative(raiz, ruta).replace(/\\/g, '/')

    const lineas = texto.split(/\r?\n/)
    const enLaBandera = /\.ps1$/i.test(ruta) ? lineasDeLaBandera(lineas) : new Set()
    lineas.forEach((linea, i) => {
      if (esComentario(linea, ruta)) return
      for (const p of PATRONES_DE_MODELO_EXTERNO) {
        if (!p.regex.test(linea)) continue
        const hallazgo = { archivo: relativa, linea: i + 1, patron: p.nombre, texto: linea.trim().slice(0, 160) }
        if (p.optIn && enLaBandera.has(i + 1)) optIn.push(hallazgo)
        else hallazgos.push(hallazgo)
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
      const sinComentarios = lineas.filter((l) => !esComentario(l, ruta)).join('\n')
      for (const m of sinComentarios.matchAll(/(scripts[\\/][\w./\\-]+\.(?:mjs|ps1|py))/g)) {
        const ruta2 = resolve(raiz, m[1])
        if (existsSync(ruta2)) pendientes.push(ruta2)
      }
    }
  }

  return {
    archivos: [...vistos].map((r) => relative(raiz, r).replace(/\\/g, '/')).sort(),
    hallazgos,
    optIn,
  }
}
