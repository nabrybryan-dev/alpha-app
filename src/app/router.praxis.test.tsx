import { configure, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from './SessionProvider'
import { ThemeProvider } from './ThemeProvider'
import { AppRouter } from './router'

/**
 * La puerta de /praxis probada con el enrutador y la sesión DE VERDAD (modo demo), no con
 * dobles: la asesorada del seed no llega a la escena y el coach del seed sí. Es la prueba
 * de que la ruta quedó montada donde tiene que estar —fuera de los dos layouts— y de que
 * la guarda es la que decide.
 *
 * El margen es el de `router.test.tsx`, por lo mismo: cada caso monta el enrutador entero.
 */
vi.setConfig({ testTimeout: 45_000, hookTimeout: 45_000 })
configure({ asyncUtilTimeout: 30_000 })

function renderizarEn(ruta: string) {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <AppRouter />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

describe('/praxis en el enrutador real', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  it('una asesorada que escribe la dirección acaba en su portada, sin escena', async () => {
    const { container } = renderizarEn('/praxis')
    expect(await screen.findByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
    expect(container.querySelector('.praxis')).toBeNull()
    expect(screen.queryByText('Datos de ejemplo')).not.toBeInTheDocument()
  })

  it('el coach la abre y ve el aviso de ejemplo', async () => {
    localStorage.setItem('alpha-usuario', 'u-bryan')
    const { container } = renderizarEn('/praxis')
    await waitFor(() => expect(container.querySelector('.praxis')).not.toBeNull())
    expect(screen.getByText('Datos de ejemplo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hablar con Praxis' })).toBeInTheDocument()
  })

  it('el panel del coach enlaza con Praxis, rotulada como ejemplo', async () => {
    localStorage.setItem('alpha-usuario', 'u-bryan')
    renderizarEn('/coach')
    const enlace = await screen.findByRole('link', { name: 'Praxis (ejemplo)' })
    expect(enlace).toHaveAttribute('href', '/praxis')
  })
})
