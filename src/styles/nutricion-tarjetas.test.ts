import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * C3: las tarjetas de Nutricion llevan el aspecto de la maqueta (build-v8, 1-css.css):
 * tarjeta 22, fila de comida 18, ficha de macro 18 con fondo hundido, barra hundida de 8 px.
 * Solo aspecto: esta prueba fija los radios y los tokens, no los textos ni la logica.
 */
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8').replace(/\r\n/g, '\n')
const src = (f: string) =>
  readFileSync(join(__dirname, '..', 'features', 'nutricion', f), 'utf8')

function regla(selector: string): string {
  const i = css.indexOf(`\n${selector} {`)
  expect(i, `no hay regla «${selector}»`).toBeGreaterThanOrEqual(0)
  return css.slice(i, css.indexOf('}', i))
}

describe('tarjetas de Nutricion al estandar de la maqueta', () => {
  it('tarjeta del resumen: radio 22, brillo y sombra de tarjeta', () => {
    const r = regla('.nutri-resumen')
    expect(r).toContain('border-radius: 22px')
    expect(r).toContain('var(--brillo), var(--sombra-card)')
  })
  it('fila de comida: radio 18 con brillo', () => {
    const r = regla('.nutri-fila-comida')
    expect(r).toContain('border-radius: 18px')
    expect(r).toContain('box-shadow: var(--brillo)')
  })
  it('ficha de macro: radio 18 hundida', () => {
    const r = regla('.nutri-tile-macro')
    expect(r).toContain('border-radius: 18px')
    expect(r).toContain('var(--sombra-hundido)')
    expect(r).toContain('var(--relleno-hundido)')
  })
  it('barra de calorias: 8 px, radio 9, hundida', () => {
    const r = regla('.nutri-pista-kcal')
    expect(r).toContain('height: 8px')
    expect(r).toContain('border-radius: 9px')
    expect(r).toContain('var(--sombra-hundido)')
  })
  it('los componentes usan esas clases', () => {
    const resumen = src('ResumenDia.tsx')
    for (const c of ['nutri-resumen', 'nutri-pista-kcal', 'nutri-tile-macro', 'nutri-chip-margen'])
      expect(resumen).toContain(c)
    expect(src('FilaComida.tsx')).toContain('nutri-fila-comida')
  })
})
