import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * H3: `bg-ink-900` solo se define en `:root` y NO cambia con el tema claro, mientras `--texto`
 * sí: texto casi negro sobre un panel casi negro. Las pantallas de aprobación usan
 * `bg-surface-1`, que sí cambia, y aquí se mide el contraste de su texto en los dos temas.
 */
const RAIZ = process.cwd()
const css = readFileSync(join(RAIZ, 'src/styles/tokens.css'), 'utf8').replace(/\r\n/g, '\n')
const bloque = (inicio: RegExp) => {
  const i = css.search(inicio)
  return css.slice(i, css.indexOf('\n}', i))
}
const claro = bloque(/\[data-theme="light"\]\s*\{/)
const oscuro = bloque(/:root,\s*\[data-theme="dark"\]\s*\{/) + '\n' + bloque(/:root\s*\{/)
const canales = (b: string, n: string): [number, number, number] => {
  const m = new RegExp(String.raw`^\s*--${n}:\s*(\d+) (\d+) (\d+);`, 'm').exec(b)
  if (!m) throw new Error(`falta --${n}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const lum = ([r, g, b]: number[]) => 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!)
const contraste = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

const ARCHIVOS = ['EstadoDeLaPuerta.tsx', 'RevisionesPage.tsx', 'BandejaAprobacion.tsx']

describe('aprobación: las tarjetas se leen en los dos temas', () => {
  it.each(ARCHIVOS)('%s no usa bg-ink-900 (no cambia con el tema)', (a) => {
    expect(readFileSync(join(RAIZ, 'src/features/aprobacion', a), 'utf8')).not.toMatch(/bg-ink-900/)
  })

  it.each([['claro', claro], ['oscuro', oscuro]] as const)(
    'texto y texto tenue llegan a 4,5:1 sobre surface-1 en tema %s', (_n, b) => {
      const fondo = canales(b, 'surface-1-rgb')
      for (const t of ['texto-rgb', 'tenue-rgb']) {
        expect(contraste(canales(b, t), fondo), t).toBeGreaterThanOrEqual(4.5)
      }
    })
})
