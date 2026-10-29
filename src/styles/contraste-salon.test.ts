import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL TEXTO DEL SALÓN LLEGA A 4,5:1 EN LOS DOS TEMAS, MEDIDO.
 *
 * El salón dejó de ser siempre oscuro (zona 8): en claro, el cuerpo, el rojo de
 * «por trabajar», los números de las paredes, la banda del día y el cronómetro se
 * leen sobre la pared clara. Aquí se lee `tokens.css` y se recalcula el cociente de
 * `--salon-3d-texto`, `--salon-3d-tenue` y `--salon-3d-accion` contra la pared y
 * contra las superficies del salón, y el de las cifras del marcador contra su panel.
 */
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8').replace(/\r\n/g, '\n')

function bloques(selector: RegExp): string {
  const partes: string[] = []
  let desde = 0
  while (desde < css.length) {
    const encontrado = selector.exec(css.slice(desde))
    if (!encontrado) break
    const inicio = desde + encontrado.index
    const fin = css.indexOf('\n}', inicio)
    if (fin < 0) break
    partes.push(css.slice(inicio, fin))
    desde = fin + 1
  }
  return partes.join('\n')
}

const claro = bloques(/\[data-theme="light"\]\s*\{/)
const oscuro = bloques(/:root,\s*\[data-theme="dark"\]\s*\{/)

type Rgb = [number, number, number]

function color(bloque: string, nombre: string): Rgb {
  const crudo = new RegExp(`^\\s*--${nombre}:\\s*([^;]+);`, 'm').exec(bloque)?.[1]?.trim()
  if (!crudo) throw new Error(`no está --${nombre}`)
  const hex = /^#([0-9a-f]{6})$/i.exec(crudo)
  if (!hex) throw new Error(`--${nombre} no es #rrggbb: ${crudo}`)
  const n = Number.parseInt(hex[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const lineal = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luz = ([r, g, b]: Rgb) => 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b)
const contraste = (a: Rgb, b: Rgb) => {
  const [x, y] = [luz(a), luz(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const TEMAS = [
  { nombre: 'claro', bloque: claro },
  { nombre: 'oscuro', bloque: oscuro },
] as const

describe.each(TEMAS)('contraste del salón en tema $nombre', ({ bloque }) => {
  it.each(['salon-3d-texto', 'salon-3d-tenue', 'salon-3d-accion'])(
    '%s llega a 4,5:1 sobre la pared del salón',
    (token) => {
      const c = contraste(color(bloque, token), color(bloque, 'salon-3d-pared'))
      expect(Number(c.toFixed(2)), token).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('las cifras encendidas del marcador llegan a 3:1 sobre su panel, y las apagadas se distinguen de ellas', () => {
    const panel = color(bloque, 'salon-3d-panel')
    const vivo = color(bloque, 'salon-3d-segmento')
    const apagado = color(bloque, 'salon-3d-segmento-apagado')
    expect(contraste(vivo, panel)).toBeGreaterThanOrEqual(3)
    expect(contraste(vivo, apagado)).toBeGreaterThanOrEqual(3)
  })

  it('el rojo de «por trabajar» (acción) y el texto no se confunden: distinto tono, no solo brillo', () => {
    const [r, g, b] = color(bloque, 'salon-3d-accion')
    expect(r).toBeGreaterThan(g + 40)
    expect(r).toBeGreaterThan(b + 40)
  })
})
