import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL MÍNIMO DE CONTRASTE ES 4,5:1, Y SE MIDE, NO SE MIRA.
 *
 * La auditoría del 26-oct midió 3,5–3,7 en los rótulos de Bienestar (el texto de
 * un `Badge` sobre su propio tinte al 15 %) y 2,4 en la hora del chat sobre la
 * burbuja roja. La ronda 2 midió también el tema oscuro: el rótulo rojo daba
 * 4,23 y el ámbar claro sobre `bg`, 4,48. Un cambio de token puede volver a
 * bajar cualquiera de esos sin que nada se ponga rojo, así que la cuenta queda
 * escrita aquí: se leen los tokens de `tokens.css` y se recalcula el cociente.
 *
 * Se miden los DOS temas, sobre `bg` y sobre `surface-1`, porque una tarjeta
 * (`surface-1`) y el fondo de la página (`bg`) no dan el mismo contraste.
 *
 * Los rellenos usan su propio token: `bg-rojo` y `bg-accion` son el rojo de
 * RELLENO, que tiene que aguantar el blanco encima; `text-rojo` y `text-accion`
 * son el de TEXTO, que tiene que aguantar las superficies. Un solo rojo no puede
 * hacer las dos cosas.
 */
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8').replace(/\r\n/g, '\n')

function bloque(selector: RegExp): string {
  const donde = css.search(selector)
  if (donde < 0) throw new Error(`no está el bloque ${selector}`)
  const fin = css.indexOf('\n}', donde)
  if (fin < 0) throw new Error(`el bloque ${selector} no cierra`)
  return css.slice(donde, fin)
}

/** Todos los bloques de un selector: el tema claro se declara dos veces. */
function bloques(selector: RegExp): string[] {
  const partes: string[] = []
  let desde = 0
  while (desde < css.length) {
    const resto = css.slice(desde)
    const encontrado = selector.exec(resto)
    if (!encontrado) break
    const inicio = desde + encontrado.index
    const fin = css.indexOf('\n}', inicio)
    if (fin < 0) break
    partes.push(css.slice(inicio, fin))
    desde = fin + 1
  }
  return partes
}

const claro = bloques(/\[data-theme="light"\]\s*\{/).join('\n')
// El oscuro hereda de `:root` los tokens que no están en su bloque de tema.
const oscuro = [bloque(/:root,\s*\[data-theme="dark"\]\s*\{/), bloque(/:root\s*\{/)].join('\n')

function valor(bloqueCss: string, nombre: string): string {
  const valorCrudo = new RegExp(`^\\s*--${nombre}:\\s*([^;]+);`, 'm').exec(bloqueCss)?.[1]
  if (!valorCrudo) throw new Error(`no está --${nombre}`)
  return valorCrudo.trim()
}

/** Los tokens fijos en los dos temas (`--rojo-relleno-rgb`, `--rojo-foto`…). */
function valorGlobal(nombre: string): string {
  return valor(css, nombre)
}

/** El token en el bloque del tema; si el tema no lo redefine, el global. */
function valorDelTema(bloqueCss: string, nombre: string): string {
  try {
    return valor(bloqueCss, nombre)
  } catch {
    return valorGlobal(nombre)
  }
}

function canalesDeValor(valorCrudo: string, nombre: string): [number, number, number] {
  const indirecto = valorCrudo.match(/^rgb\(var\(--([\w-]+)\)\)$/)
  if (indirecto) return canalesDeValor(valorGlobal(indirecto[1]!), indirecto[1]!)

  const rgb = valorCrudo.match(/^(\d+)\s+(\d+)\s+(\d+)$/)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]

  const hex = valorCrudo.trim().match(/^#([0-9a-f]{6})$/i)
  if (!hex) throw new Error(`--${nombre} no es un color legible: ${valorCrudo}`)
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
/** El tinte real de `bg-<tono>/15` sobre la superficie que hay debajo. */
const tinte = (color: [number, number, number], fondo: [number, number, number]) =>
  color.map((v, i) => Math.round(v * 0.15 + fondo[i]! * 0.85)) as [number, number, number]

const TEMAS = [
  { nombre: 'claro', bloque: claro },
  { nombre: 'oscuro', bloque: oscuro },
] as const

const FONDOS = ['bg-rgb', 'surface-1-rgb'] as const

/** `bg-rojo/15` lee el rojo de relleno; `bg-verde/15` y `bg-ambar/15`, el suyo. */
const TONOS = [
  { nombre: 'rojo', texto: 'rojo-rgb', fondoDelTinte: 'rojo-relleno-rgb' },
  { nombre: 'accion', texto: 'accion-rgb', fondoDelTinte: 'accion-relleno-rgb' },
  { nombre: 'verde', texto: 'verde-rgb', fondoDelTinte: 'verde-rgb' },
  { nombre: 'ambar', texto: 'ambar-rgb', fondoDelTinte: 'ambar-rgb' },
] as const

describe.each(TEMAS)('contraste de los rótulos de estado en tema $nombre', (tema) => {
  const superficie = (token: string) => canalesDeValor(valor(tema.bloque, token), token)

  it.each(TONOS)(
    'el texto del Badge $nombre llega a 4,5:1 sobre su tinte en bg y surface-1',
    ({ texto, fondoDelTinte }) => {
      const color = canalesDeValor(valor(tema.bloque, texto), texto)
      // El tinte se lee en el bloque del tema: el verde y el ámbar cambian entre
      // claro y oscuro, y leerlos del global medía el claro con el color oscuro.
      const tinteColor = canalesDeValor(valorDelTema(tema.bloque, fondoDelTinte), fondoDelTinte)
      for (const fondo of FONDOS) {
        const cociente = contraste(color, tinte(tinteColor, superficie(fondo)))
        expect(Number(cociente.toFixed(2)), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it.each(['rojo-rgb', 'accion-rgb'] as const)(
    'el texto --%s llega a 4,5:1 sobre bg y surface-1',
    (token) => {
      const color = canalesDeValor(valor(tema.bloque, token), token)
      for (const fondo of FONDOS) {
        expect(Number(contraste(color, superficie(fondo)).toFixed(2)), `${token} sobre ${fondo}`)
          .toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it.each(['rojo-relleno-rgb', 'accion-relleno-rgb'] as const)(
    'el blanco sobre --%s llega a 4,5:1',
    (token) => {
      const relleno = canalesDeValor(valorGlobal(token), token)
      expect(Number(contraste([255, 255, 255], relleno).toFixed(2))).toBeGreaterThanOrEqual(4.5)
    },
  )
})

describe('contraste de la burbuja del chat y la foto de las rachas', () => {
  it('el blanco sobre la burbuja roja del chat pasa, y su hora al 70 % también', () => {
    const fondo = canalesDeValor(valorGlobal('rojo-osc'), 'rojo-osc')
    expect(contraste([255, 255, 255], fondo)).toBeGreaterThanOrEqual(4.5)
    const hora = [255, 255, 255].map((v, i) => Math.round(v * 0.7 + fondo[i]! * 0.3)) as [
      number,
      number,
      number,
    ]
    expect(contraste(hora, fondo)).toBeGreaterThanOrEqual(4.5)
  })

  it('la cifra de la racha sobre la foto nocturna llega a 4,5:1 en los dos temas', () => {
    // La foto es oscura en claro y en oscuro, así que el rojo de texto del tema
    // claro (3,15:1 sobre la calle) no sirve: hace falta el rojo de foto.
    const fondo = canalesDeValor(valorGlobal('ink-900-rgb'), 'ink-900-rgb')
    const cifra = canalesDeValor(valorGlobal('rojo-foto'), 'rojo-foto')
    expect(Number(contraste(cifra, fondo).toFixed(2))).toBeGreaterThanOrEqual(4.5)
  })
})
