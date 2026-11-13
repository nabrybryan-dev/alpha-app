import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomNav } from '../../../components/ui/BottomNav'
import golden from './golden/barra-apagada.json'
import { PRAXIS_UN_TOQUE_ACTIVO, PRAXIS_UN_TOQUE_CHARLA } from './banderas'

/**
 * Con la bandera APAGADA la app queda exactamente igual. `golden/barra-apagada.json` es el HTML que producía
 * `BottomNav` en `main` (f28b15ba) ANTES de este cambio, tomado con el mismo render. Si alguien deja la bandera
 * en `true` por error, o cambia la barra apagada sin querer, esta prueba se pone en rojo.
 */
describe('banderas de Praxis a un toque: apagadas', () => {
  it('las dos nacen apagadas', () => {
    expect(PRAXIS_UN_TOQUE_ACTIVO).toBe(false)
    expect(PRAXIS_UN_TOQUE_CHARLA).toBe(false)
  })

  for (const espacios of ['asesorado', 'staff'] as const) {
    it(`la barra ${espacios} es idéntica, carácter por carácter, al HTML de main`, () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <BottomNav espacios={espacios} />
        </MemoryRouter>,
      )
      expect(container.innerHTML).toBe((golden as Record<string, string>)[espacios])
    })
  }

  it('el botón de Praxis del equipo sigue siendo el enlace a /praxis, no un botón de capa', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav espacios="staff" />
      </MemoryRouter>,
    )
    expect(container.querySelector('a[href="/praxis"]')).not.toBeNull()
    expect(container.querySelector('[aria-controls]')).toBeNull()
  })
})
