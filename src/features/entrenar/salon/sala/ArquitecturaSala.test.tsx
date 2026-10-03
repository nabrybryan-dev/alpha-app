import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MATERIALES_ANATOMICOS, RANGOS_MATERIAL_ANATOMICO } from '../materiales/materialesAnatomicos'
import { ArquitecturaSala } from './ArquitecturaSala'

describe('ArquitecturaSala', () => {
  it('declara suelo, techo, tres muros y al menos dos fuentes de luz', () => {
    const { container } = render(<ArquitecturaSala />)
    for (const plano of ['suelo', 'techo', 'muro-izquierdo', 'muro-derecho', 'muro-fondo']) {
      expect(container.querySelector(`[data-plano="${plano}"]`)).toBeInTheDocument()
    }
    expect(container.querySelectorAll('[data-luz]').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('[data-sala="salon"]')).toBeInTheDocument()
  })

  it('mantiene todos los parámetros materiales finitos y dentro de contrato', () => {
    for (const material of Object.values(MATERIALES_ANATOMICOS)) {
      for (const [campo, rango] of Object.entries(RANGOS_MATERIAL_ANATOMICO)) {
        const valor = material[campo as keyof typeof material]
        expect(Number.isFinite(valor)).toBe(true)
        expect(valor).toBeGreaterThanOrEqual(rango[0])
        expect(valor).toBeLessThanOrEqual(rango[1])
      }
    }
  })
})
