import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Malla } from '../../../domain/patrones/malla'
import { cifrasDeLaSerie, construirSala } from './sala'
import { colorACss, leerColor, paletaDeLaSala, TOKENS } from './paletaDeLaSala'

/**
 * LA ESCENA SIGUE EL TEMA Y LO RELEE AL CAMBIAR, SIN RECARGAR (zona 8).
 *
 * Se inyectan en jsdom los tokens `--salon-3d-*` reales de `tokens.css` (solo esas
 * líneas, por tema) y se cambia `data-theme` en `<html>` como hace `ThemeProvider`.
 */
const css = readFileSync(join(__dirname, '../../../styles/tokens.css'), 'utf8').replace(/\r\n/g, '\n')

function tokensDelSalon(selector: RegExp): string {
  const i = css.search(selector)
  const bloque = css.slice(i, css.indexOf('\n}', i))
  return bloque
    .split('\n')
    .filter((l) => /^\s*--salon-3d-(pared|zocalo|marco|panel|segmento|segmento-apagado|tierra|sombra|brillo):/.test(l))
    .join('\n')
}

let estilo: HTMLStyleElement

beforeEach(() => {
  estilo = document.createElement('style')
  estilo.textContent =
    `:root, [data-theme="dark"] {${tokensDelSalon(/:root,\s*\n?\[data-theme="dark"\]\s*\{/)}}\n` +
    `[data-theme="light"] {${tokensDelSalon(/\n\[data-theme="light"\]\s*\{/)}}`
  document.head.appendChild(estilo)
})

afterEach(() => {
  estilo.remove()
  document.documentElement.removeAttribute('data-theme')
})

describe('paletaDeLaSala', () => {
  it('lee los tokens del tema activo y los relee cuando cambia data-theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const oscura = paletaDeLaSala()
    document.documentElement.setAttribute('data-theme', 'light')
    const clara = paletaDeLaSala()
    // La pared clara es el hueso de la maqueta; la oscura, carbón.
    expect(clara.pared[0]).toBeGreaterThan(0.9)
    expect(oscura.pared[0]).toBeLessThan(0.1)
    // El segmento encendido se distingue del apagado en los dos temas.
    for (const p of [oscura, clara]) {
      expect(p.vivo.reduce((a, c, i) => a + Math.abs(c - p.apagado[i]!), 0)).toBeGreaterThan(0.3)
    }
    expect(clara.sombra).toBe(0.2)
    expect(oscura.sombra).toBe(0.45)
  })

  it('la sala construida cambia de color con el tema', () => {
    const datos = cifrasDeLaSerie({ series: 3, reps: 8, rir: 2 as const })
    document.documentElement.setAttribute('data-theme', 'dark')
    const oscura = new Malla()
    construirSala(oscura, datos, 72)
    document.documentElement.setAttribute('data-theme', 'light')
    const clara = new Malla()
    construirSala(clara, datos, 72)
    expect(clara.vertices).toBe(oscura.vertices)
    // La pared es lo primero que se construye: el tercer vértice es su borde alto.
    const alto = (m: Malla) => m.color[2 * 3]!
    expect(alto(clara)).toBeGreaterThan(0.9)
    expect(alto(oscura)).toBeLessThan(0.1)
    // El panel del marcador también sigue el tema (se compara la sala entera de un color a otro).
    expect(Array.from(clara.color)).not.toEqual(Array.from(oscura.color))
  })
})

describe('paletaDeLaSala: leer el token, no caer al respaldo', () => {
  it('un token con un valor raro llega a la paleta tal cual', () => {
    const el = document.createElement('div')
    el.setAttribute('data-theme', 'light')
    el.style.setProperty('--salon-3d-pared', '#123456')
    el.style.setProperty('--salon-3d-lienzo', '#654321')
    document.body.appendChild(el)
    const p = paletaDeLaSala(el)
    expect(colorACss(p.pared)).toBe('#123456')
    expect(colorACss(p.lienzo)).toBe('#654321')
    el.remove()
  })

  it('sin token cae al respaldo del tema', () => {
    const el = document.createElement('div')
    el.setAttribute('data-theme', 'dark')
    document.body.appendChild(el)
    document.documentElement.setAttribute('data-theme', 'dark')
    estilo.textContent = ''
    expect(colorACss(paletaDeLaSala(el).pared)).toBe(TOKENS.pared[1])
    el.remove()
  })
})

describe('el respaldo no se desvía de tokens.css', () => {
  const css = readFileSync(join(__dirname, '../../../styles/tokens.css'), 'utf8').replace(/\r\n/g, '\n')
  const bloque = (selector: RegExp) => {
    const i = css.search(selector)
    return css.slice(i, css.indexOf('\n}', i))
  }
  const oscuro = bloque(/:root,\s*\n?\[data-theme="dark"\]\s*\{/)
  const claro = bloque(/\n\[data-theme="light"\]\s*\{/)
  it.each(Object.entries(TOKENS))('%s', (_campo, [token, hexOscuro, hexClaro]) => {
    const leer = (b: string) => new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'm').exec(b)?.[1]?.trim()
    expect(leerColor(leer(oscuro)!, [9, 9, 9])).toEqual(leerColor(hexOscuro, [8, 8, 8]))
    expect(leerColor(leer(claro)!, [9, 9, 9])).toEqual(leerColor(hexClaro, [8, 8, 8]))
  })
})
