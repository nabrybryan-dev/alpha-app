import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL MÍNIMO DE CONTRASTE ES 4,5:1, Y SE MIDE, NO SE MIRA.
 *
 * La auditoría del 26-oct midió 3,5–3,7 en los rótulos de Bienestar (el texto de
 * un `Badge` sobre su propio tinte al 15 %) y 2,4 en la hora del chat sobre la
 * burbuja roja. Un cambio de token puede volver a bajar cualquiera de los dos sin
 * que nada se ponga rojo, así que la cuenta queda escrita aquí: se lee el token
 * de `tokens.css` y se recalcula el cociente.
 *
 * Solo cubre lo que el encargo pidió: los tres tonos de estado en claro y las
 * dos capas de la burbuja propia del chat. No es un barrido de toda la app.
 */
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8').replace(/\r\n/g, '\n')
const claro = css.slice(css.indexOf('[data-theme="light"] {'), css.indexOf('\n}', css.indexOf('[data-theme="light"] {')))

function canales(nombre: string): [number, number, number] {
  const valor = new RegExp(`^\\s*--${nombre}:\\s*([^;]+);`, 'm').exec(claro)?.[1]
  if (!valor) throw new Error(`no está --${nombre} en el bloque claro`)
  const indirecto = valor.match(/^rgb\(var\(--([\w-]+)\)\)$/)
  if (indirecto) return canales(indirecto[1])
  const rgb = valor.match(/^rgb\((\d+) (\d+) (\d+)\)$/) ?? valor.match(/^(\d+) (\d+) (\d+)$/)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  const hex = valor.trim().match(/^#([0-9a-f]{6})$/i)
  if (!hex) throw new Error(`--${nombre} no es un color legible: ${valor}`)
  const n = Number.parseInt(hex[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const lineal = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminancia = ([r, g, b]: [number, number, number]) =>
  0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b)
const contraste = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [luminancia(a), luminancia(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
/** El tinte real de `bg-<tono>/15` sobre la tarjeta blanca. */
const tinte = (color: [number, number, number]) =>
  color.map((v, i) => Math.round(v * 0.15 + [255, 255, 255][i] * 0.85)) as [number, number, number]

describe('contraste de los rótulos de estado en tema claro', () => {
  it.each([
    ['rojo', 'rojo'],
    ['verde', 'verde'],
    ['ámbar', 'ambar'],
  ])('el texto del Badge %s llega a 4,5:1 sobre su propio tinte', (_etiqueta, token) => {
    const color = canales(token)
    expect(Number(contraste(color, tinte(color)).toFixed(2))).toBeGreaterThanOrEqual(4.5)
  })

  it('el blanco sobre la burbuja roja del chat pasa, y su hora al 70 % también', () => {
    const fondo = canales('rojo-osc')
    expect(contraste([255, 255, 255], fondo)).toBeGreaterThanOrEqual(4.5)
    const hora = [255, 255, 255].map((v, i) => Math.round(v * 0.7 + fondo[i] * 0.3)) as [
      number,
      number,
      number,
    ]
    expect(contraste(hora, fondo)).toBeGreaterThanOrEqual(4.5)
  })
})
