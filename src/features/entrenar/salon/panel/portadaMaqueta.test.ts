import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SALON_PORTADA_MAQUETA, clasesDeLaHoja } from './portadaMaqueta'

const css = readFileSync(join(__dirname, '../../../../styles/tokens.css'), 'utf8').replace(/\r\n/g, '\n')
const panel = readFileSync(join(__dirname, 'PanelInferior.tsx'), 'utf8')
const fuenteDeLaHoja = readFileSync(join(__dirname, 'portadaMaqueta.ts'), 'utf8')

function regla(selector: string): string {
  const i = css.indexOf(`${selector} {`)
  expect(i, `no hay regla «${selector}» en tokens.css`).toBeGreaterThanOrEqual(0)
  return css.slice(i, css.indexOf('\n}', i))
}

describe('la hoja de la portada del salón (C2)', () => {
  it('la bandera sale apagada', () => {
    expect(SALON_PORTADA_MAQUETA).toBe(false)
  })

  it('apagada, la hoja conserva las clases y la sombra en línea de siempre', () => {
    const c = clasesDeLaHoja(false)
    expect(c.hoja).toContain('rounded-t-[20px]')
    expect(c.hoja).toContain('bg-ink-900/95')
    expect(c.hoja).not.toContain('hoja-portada')
    expect(c.asa).toBe('h-1 w-11 rounded-full bg-silver-500/60 transition-colors duration-base')
    expect(c.titulo).toContain('text-[15px]')
    expect(c.sombraEnLinea).toBe(true)
  })

  it('encendida, la hoja pasa a la piel de la maqueta y deja la sombra a la clase', () => {
    const c = clasesDeLaHoja(true)
    expect(c.hoja).toContain('hoja-portada')
    expect(c.hoja).not.toContain('bg-ink-900/95')
    expect(c.hoja).not.toContain('rounded-t-[20px]')
    expect(c.asa).toBe('hoja-portada-asa')
    expect(c.titulo).toContain('hoja-portada-titulo')
    expect(c.titulo).not.toContain('text-[15px]')
    expect(c.sombraEnLinea).toBe(false)
  })

  it('el CSS fija radio 22, relleno alzado, asa 38 x 5 y título de 19 px', () => {
    const hoja = regla('.hoja-portada')
    expect(hoja).toContain('border-radius: 22px 22px 0 0')
    expect(hoja).toContain('var(--relleno-alzado)')
    expect(hoja).toContain('0 -10px 30px')
    const asa = regla('.hoja-portada-asa')
    expect(asa).toContain('width: 38px')
    expect(asa).toContain('height: 5px')
    const titulo = regla('.hoja-portada-titulo')
    expect(titulo).toContain('font-size: 19px')
    expect(titulo).toContain('font-weight: 800')
  })

  it('con movimiento reducido la hoja no anima su transición', () => {
    const i = css.indexOf('@media (prefers-reduced-motion: reduce) {\n  /* La transición de la hoja')
    expect(i, 'falta el bloque de movimiento reducido de la hoja').toBeGreaterThanOrEqual(0)
    expect(css.slice(i, i + 260)).toMatch(/\.hoja-portada \{\s+transition: none !important;/)
  })

  it('la hoja no añade trabajo por fotograma: ni animaciones ni will-change ni filtros', () => {
    const bloque = css.slice(css.indexOf('LA HOJA DE LA PORTADA DEL SALÓN'))
    expect(bloque).not.toMatch(/@keyframes|will-change|backdrop-filter|filter:/)
  })

  it('PanelInferior lee sus clases de clasesDeLaHoja y no las lleva escritas', () => {
    expect(panel).toContain('clases.hoja')
    expect(panel).toContain('clases.asa')
    expect(panel).toContain('clases.titulo')
    expect(panel).not.toContain('bg-ink-900/95"')
    // Sin argumento manda la bandera de código: el valor por omisión vive en clasesDeLaHoja.
    expect(panel).toContain('sombraDeLaHoja(clases)')
    expect(fuenteDeLaHoja).toContain('maqueta: boolean = SALON_PORTADA_MAQUETA')
    expect(clasesDeLaHoja()).toEqual(clasesDeLaHoja(SALON_PORTADA_MAQUETA))
  })
})
