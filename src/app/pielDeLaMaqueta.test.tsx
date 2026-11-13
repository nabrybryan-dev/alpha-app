import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CUENTAS_CON_DISENO_FINAL } from '../domain/praxis/rapidezLocal'
import { reiniciarOrganizacionViva, useOrganizacionVisible } from './organizacionViva'
import { usePielDeLaMaqueta } from './pielDeLaMaqueta'

/**
 * La piel de «Alpha · Rediseño» (maqueta 7, validada por Bryan el 13-nov-2026) para toda la app, solo en las cuentas
 * con el diseño final: la raíz lleva `data-piel="maqueta"` y los estilos de la maqueta cuelgan de esa marca.
 */
const [PERSONAL] = [...CUENTAS_CON_DISENO_FINAL]
const OTRA = '00000000-0000-0000-0000-0000000000cc'
const piel = () => document.documentElement.dataset.piel

function Raiz({ usuarioId }: { usuarioId: string }) {
  useOrganizacionVisible(usuarioId)
  usePielDeLaMaqueta()
  return null
}

afterEach(() => {
  reiniciarOrganizacionViva()
  delete document.documentElement.dataset.piel
})

describe('la piel de la maqueta en la raíz', () => {
  it('la cuenta con el diseño final la enciende', () => {
    render(<Raiz usuarioId={PERSONAL!} />)
    expect(piel()).toBe('maqueta')
  })

  it('cualquier otra cuenta no la tiene', () => {
    render(<Raiz usuarioId={OTRA} />)
    expect(piel()).toBeUndefined()
  })

  it('al salir la cuenta, la marca se quita', () => {
    const { unmount } = render(<Raiz usuarioId={PERSONAL!} />)
    unmount()
    expect(piel()).toBeUndefined()
  })
})

describe('los estilos de la maqueta cuelgan de la marca', () => {
  const css = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8')
  const bloque = css.slice(css.indexOf('PIEL DE LA MAQUETA 7'))

  it('existe el bloque y todo lo que cambia está bajo [data-piel="maqueta"]', () => {
    expect(css).toContain('PIEL DE LA MAQUETA 7')
    const sinComentarios = bloque.slice(bloque.indexOf('*/') + 2, bloque.indexOf('FIN DE LA PIEL')).replace(/\/\*[\s\S]*?\*\//g, '')
    const selectores = sinComentarios.match(/^[^{}\n][^{}]*\{/gm) ?? []
    expect(selectores.length).toBeGreaterThan(0)
    for (const s of selectores) {
      for (const parte of s.replace('{', '').split(',')) expect(parte.trim()).toMatch(/^\[data-piel="maqueta"\]/)
    }
  })

  it('tarjeta sólida de 22 sin vidrio, ficha y fila de 18, botón de 14', () => {
    expect(bloque).toMatch(/\.tarjeta-base\.glass\s*\{[^}]*border-radius:\s*22px/)
    expect(bloque).toMatch(/\.tarjeta-base\.glass\s*\{[^}]*background:\s*var\(--surface-1\)/)
    expect(bloque).toMatch(/\.tarjeta-base\.glass\s*\{[^}]*backdrop-filter:\s*none/)
    expect(bloque).toMatch(/\.rounded-tarjeta\s*\{[^}]*border-radius:\s*18px/)
    expect(bloque).toMatch(/\.rounded-boton\s*\{[^}]*border-radius:\s*14px/)
  })

  it('título sin mayúsculas a 30 px, rótulo gris de 13 px, segmentos de la semana en plata y pista de 10 px', () => {
    expect(bloque).toMatch(/h1\.font-display\s*\{[^}]*font-size:\s*30px[^}]*text-transform:\s*none/)
    expect(bloque).toMatch(/\.kicker\s*\{[^}]*color:\s*var\(--tenue\)[^}]*font-size:\s*13px[^}]*text-transform:\s*none/)
    expect(bloque).toMatch(/de la semana hecho"\] \.bg-accion\s*\{[^}]*var\(--placa\)/)
    expect(bloque).toMatch(/\.nutri-pista-kcal\s*\{[^}]*height:\s*10px/)
  })

  it('pregunta del día: opciones de 48 px con relieve y la elegida con contorno plata', () => {
    expect(bloque).toMatch(/\.pregunta-del-dia button\[aria-pressed\]\s*\{[^}]*min-height:\s*48px[^}]*border-radius:\s*14px/)
    expect(bloque).toMatch(/\.pregunta-del-dia button\[aria-pressed="true"\]\s*\{[^}]*outline:\s*2px solid var\(--placa\)/)
    const tarjeta = readFileSync(resolve(__dirname, '../features/preguntas/TarjetaPregunta.tsx'), 'utf8')
    expect(tarjeta).toContain('className="pregunta-del-dia ')
  })
})
