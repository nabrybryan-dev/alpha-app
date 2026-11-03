import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Utilidades de LECTURA de código para las pruebas de `app/rutas.*.test`: de dónde salen las direcciones
 * que la app promete abrir. No se importan desde la app.
 */

const RAIZ = process.cwd()

function leer(rutaRelativa: string): string {
  return readFileSync(join(RAIZ, rutaRelativa), 'utf8')
}

function sinComentarios(texto: string): string {
  return texto.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Todos los patrones completos que monta `router.tsx` (con el prefijo de los `<Route>` padre). */
export function patronesDelRouter(): string[] {
  const texto = sinComentarios(leer('src/app/router.tsx'))
  const pila: string[] = []
  const salida: string[] = []
  let i = 0
  while (i < texto.length) {
    const cierre = texto.indexOf('</Route>', i)
    const apertura = texto.indexOf('<Route', i)
    if (apertura === -1 && cierre === -1) break
    if (cierre !== -1 && (apertura === -1 || cierre < apertura)) {
      pila.pop()
      i = cierre + '</Route>'.length
      continue
    }
    // Fin de la etiqueta de apertura, respetando las llaves de `element={...}`.
    let j = apertura + '<Route'.length
    let llaves = 0
    while (j < texto.length) {
      const c = texto[j]
      if (c === '{') llaves++
      else if (c === '}') llaves--
      else if (c === '>' && llaves === 0) break
      j++
    }
    const etiqueta = texto.slice(apertura, j + 1)
    const autocerrada = texto[j - 1] === '/'
    const ruta = /\spath="([^"]*)"/.exec(etiqueta)?.[1]
    const esIndice = /\sindex[\s/>]/.test(etiqueta)
    const prefijo = pila.filter(Boolean).join('/')
    const completa = ruta !== undefined ? `/${[prefijo, ruta].filter(Boolean).join('/')}`.replace(/\/+/g, '/') : null
    if (completa !== null) salida.push(completa)
    else if (esIndice) salida.push(prefijo === '' ? '/' : `/${prefijo}`)
    if (!autocerrada) pila.push(ruta ?? '')
    i = j + 1
  }
  return [...new Set(salida)]
}

export interface Cita {
  origen: string
  ruta: string
}

const RUTA_ENTRE_COMILLAS = /['"`](\/[a-z][a-z0-9/-]*)(?:\?[^'"`]*)?['"`]/g

function citasEn(rutaRelativa: string, regex: RegExp, grupo = 1): Cita[] {
  const texto = leer(rutaRelativa)
  return [...texto.matchAll(regex)].map((m) => ({ origen: rutaRelativa, ruta: m[grupo] }))
}

/** Las direcciones que abren los avisos push, `avisos-plan` y los scripts de firma. */
export function citasDeAvisosYScripts(): Cita[] {
  return [
    ...citasEn('public/push-sw.js', RUTA_ENTRE_COMILLAS),
    ...citasEn('supabase/functions/avisos-plan/decidir.ts', RUTA_ENTRE_COMILLAS),
    ...citasEn('scripts/firmar-revisiones.mjs', /(\/coach\/[a-z][a-z0-9-]*)/g),
  ]
}

function archivosDeCodigo(dir: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) archivosDeCodigo(ruta, salida)
    else if (/\.(ts|tsx)$/.test(nombre) && !/\.test\.|\.d\.ts$/.test(nombre)) salida.push(ruta)
  }
  return salida
}

/**
 * Las direcciones internas que las pantallas dicen abrir: `to="/x"`, `href="/x"`, `navigate('/x')`,
 * `<Navigate to="/x">`. Las plantillas (`/entrenar/sesion/${id}`) se leen con un `x` en cada hueco.
 */
export function citasDePantallas(): Cita[] {
  const regex = /(?:\bto=\{?|\bhref=\{?|\bnavigate\(|\bnavegar\()\s*['"`](\/[a-z][^'"`?#]*)/g
  const citas: Cita[] = []
  for (const archivo of archivosDeCodigo(join(RAIZ, 'src'))) {
    const texto = sinComentarios(readFileSync(archivo, 'utf8'))
    for (const m of texto.matchAll(regex)) {
      citas.push({ origen: relative(RAIZ, archivo).replace(/\\/g, '/'), ruta: m[1].replace(/\$\{[^}]*\}/g, 'x') })
    }
  }
  return citas
}
