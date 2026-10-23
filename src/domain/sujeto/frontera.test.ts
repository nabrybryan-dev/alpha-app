// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as publico from './index'

/**
 * FRONTERA DEL SUJETO: lo de esta carpeta tiene que poder importarlo el laboratorio anatómico (un visor
 * TypeScript + Vite aparte) sin arrastrar React ni la app. Si esta prueba se pone roja, el dominio del
 * sujeto dejó de ser portable: quita la importación, no la prueba.
 *
 * Mira los ARCHIVOS de producción (los `.test.ts` pueden importar lo que quieran). Sigue las
 * importaciones relativas que SALEN de la carpeta (`../patrones/…`) hasta el final, porque arrastrar la
 * app por la puerta de atrás cuenta igual.
 */
const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = resolve(aqui, '..', '..', '..')

const PROHIBIDOS: { nombre: string; esto: RegExp }[] = [
  { nombre: 'React', esto: /^react($|\/)|^react-dom($|\/)|^@react-three\// },
  { nombre: 'three', esto: /^three($|\/)/ },
  { nombre: 'Supabase', esto: /supabase/i },
  { nombre: 'react-router', esto: /^react-router/ },
  { nombre: 'el DOM / pruebas de interfaz', esto: /^@testing-library\/|^jsdom$|^happy-dom$/ },
  {
    nombre: 'Node (el laboratorio corre en el navegador)',
    esto: /^node:|^(?:fs|path|os|url|util|crypto|child_process|http|https|net|stream|buffer|events|process|worker_threads|zlib|readline)(?:\/|$)/,
  },
  { nombre: 'features/', esto: /(^|\/)features(\/|$)/ },
  { nombre: 'components/', esto: /(^|\/)components(\/|$)/ },
  { nombre: 'data/ (repositorios y nube)', esto: /(^|\/)data(\/|$)/ },
  { nombre: 'app/', esto: /(^|\/)app(\/|$)/ },
]
/** Globales del navegador que un dominio puro no toca. */
const GLOBALES_DEL_DOM = /\b(?:window|document|localStorage|sessionStorage|navigator|HTMLElement|fetch)\b\s*[.([]/

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

export function especificadores(codigo: string): string[] {
  const limpio = sinComentarios(codigo)
  const salida = new Set<string>()
  // `from '...'` cubre import y export ... from, de una o de varias líneas; `import '...'` y `import('...')` el resto.
  for (const re of [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\s+['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(limpio))) salida.add(m[1])
  }
  return [...salida]
}

function archivosDeProduccion(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const ruta = join(dir, d.name)
    if (d.isDirectory()) return archivosDeProduccion(ruta)
    return /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [ruta] : []
  })
}

function resolverRelativa(desde: string, esp: string): string | null {
  const base = resolve(dirname(desde), esp)
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      readFileSync(c)
      return c
    } catch {
      /* siguiente */
    }
  }
  return null
}

/** Todas las importaciones que alcanza el dominio del sujeto, dentro y fuera de su carpeta. */
function alcanzadas(): { archivo: string; esp: string }[] {
  const vistos = new Set<string>()
  const pendientes = archivosDeProduccion(aqui)
  const todas: { archivo: string; esp: string }[] = []
  while (pendientes.length) {
    const a = pendientes.pop()!
    if (vistos.has(a)) continue
    vistos.add(a)
    for (const esp of especificadores(readFileSync(a, 'utf8'))) {
      todas.push({ archivo: a, esp })
      if (esp.startsWith('.')) {
        const r = resolverRelativa(a, esp)
        if (r) pendientes.push(r)
      }
    }
  }
  return todas
}

const rel = (a: string) => a.replace(raiz, '').replace(/\\/g, '/').replace(/^\//, '')

describe('frontera del sujeto: nada de React, de la app, del DOM ni de Supabase', () => {
  const todas = alcanzadas()

  it('lee de verdad los archivos (no pasa en vacío)', () => {
    expect(archivosDeProduccion(aqui).length).toBeGreaterThanOrEqual(12)
    expect(todas.length).toBeGreaterThan(20)
    expect(todas.some((t) => t.esp === './convenciones')).toBe(true)
  })

  for (const p of PROHIBIDOS) {
    it(`no importa ${p.nombre}`, () => {
      const malos = todas.filter((t) => p.esto.test(t.esp)).map((t) => `${rel(t.archivo)} importa «${t.esp}»`)
      expect(malos).toEqual([])
    })
  }

  it('no toca globales del navegador', () => {
    const malos = archivosDeProduccion(aqui)
      .filter((a) => GLOBALES_DEL_DOM.test(sinComentarios(readFileSync(a, 'utf8'))))
      .map(rel)
    expect(malos).toEqual([])
  })

  it('lo que sale de la carpeta es solo dominio puro (src/domain/…)', () => {
    const fuera = todas
      .filter((t) => t.esp.startsWith('..'))
      .map((t) => resolverRelativa(t.archivo, t.esp))
      .filter((r): r is string => r !== null)
      .map(rel)
    for (const f of fuera) expect(f.startsWith('src/domain/')).toBe(true)
  })
})

describe('el detector de importaciones ve lo que debe ver', () => {
  it('encuentra una importación simple, de tipo, de varias líneas, reexportada, de efecto y dinámica', () => {
    const codigo = [
      "import { useState } from 'react'",
      "import type { X } from '../features/y'",
      'import {',
      '  a,',
      '  b,',
      "} from '@supabase/supabase-js'",
      "export { c } from './c'",
      "import './efecto'",
      "const m = await import('three')",
      "// import { z } from 'react-dom'   <- comentado, no cuenta",
      "/* import q from 'jsdom' */",
    ].join('\n')
    expect(especificadores(codigo).sort()).toEqual(['../features/y', './c', './efecto', '@supabase/supabase-js', 'react', 'three'].sort())
  })
  it('una importación de React SÍ la cazaría la regla, y una local no', () => {
    const esp = especificadores("import { useMemo } from 'react'\nimport x from './x'")
    expect(esp.some((e) => PROHIBIDOS[0].esto.test(e))).toBe(true)
    expect(especificadores("import x from './x'").some((e) => PROHIBIDOS.some((p) => p.esto.test(e)))).toBe(false)
  })
  it('ve la importacion dinamica con espacio antes del parentesis', () => {
    expect(especificadores("const x = import ('react');")).toEqual(['react'])
    expect(especificadores("const x = import('react');")).toEqual(['react'])
  })
  it('Node sin el prefijo node: tambien esta prohibido', () => {
    const node = PROHIBIDOS.find((p) => p.nombre.startsWith('Node'))!
    for (const m of ['fs', 'path', 'node:fs', 'child_process', 'fs/promises']) expect(node.esto.test(m)).toBe(true)
    for (const m of ['./fs', './pasivo', '../patrones/gravedad', 'pathfinder']) expect(node.esto.test(m)).toBe(false)
  })
  it('las globales del navegador se detectan', () => {
    expect(GLOBALES_DEL_DOM.test('const q = window.location.search')).toBe(true)
    expect(GLOBALES_DEL_DOM.test('await fetch(url)')).toBe(true)
    expect(GLOBALES_DEL_DOM.test('const ventana = 3 // sin globales')).toBe(false)
  })
})

describe('la API pública', () => {
  const nombres = Object.keys(publico).sort()
  it('exporta lo que el laboratorio necesita', () => {
    for (const n of [
      'DE_LEVA',
      'DE_LEVA_CERV',
      'construirSujeto',
      'geometriaSagital',
      'momentosEstaticos',
      'momentosDeSentadilla',
      'bandasDeSentadilla',
      'momentosPasivosDeLaPose',
      'momentosDeSilder',
      'dominioDeSilder',
      'angulosDeLaPose',
      'proporcionesDeAreaDeCadera',
      'proporcionesCentrales',
      'ESTADOS',
      'UNIDADES',
      'VERSION_DEL_MODELO',
      'GRAVEDAD',
      'noAfirmable',
      'verificarCifras',
    ]) {
      expect(nombres).toContain(n)
    }
  })
  it('no filtra la decisión de dibujo del salón ni los arneses de procedencias', () => {
    for (const n of ['capaDeMomentos', 'repartoDeSentadilla', 'VALORES_REGISTRADOS', 'leerProcedencias', 'SUJETO_DE_EJEMPLO']) {
      expect(nombres).not.toContain(n)
    }
  })
  it('funciona de punta a punta usando solo el punto de entrada', () => {
    const e = {
      sexo: 'h' as const,
      talla: 1.78,
      masa: 82,
      cargaKg: 100,
      pose: { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, barraT: 0.1, pieZ: 0.05 },
    }
    const r = publico.momentosDeSentadilla(e)
    expect(Math.round(r.tobillo.valor as number)).toBe(151)
    expect(Math.round(r.rodilla.valor as number)).toBe(188)
    expect(Math.round(r.cadera.valor as number)).toBe(497)
    expect(publico.verificarCifras([r.tobillo, r.rodilla, r.cadera])).toEqual([])
    expect(publico.VERSION_DEL_MODELO).toBe('sujeto-0.1.0')
  })
})
