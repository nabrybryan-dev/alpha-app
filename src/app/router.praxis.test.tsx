import { configure, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from './SessionProvider'
import { ThemeProvider } from './ThemeProvider'
import { AppRouter } from './router'

/**
 * La puerta de /praxis probada con el enrutador y la sesión DE VERDAD (modo demo), no con
 * dobles: la asesorada del seed no llega a la escena y el coach del seed sí, y lo que ve es
 * lo SUYO (que en el seed es nada), no los datos de ejemplo de la maqueta. Es la prueba
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
    expect(screen.queryByText('Solo el equipo')).not.toBeInTheDocument()
  })

  it('el coach la abre conectada: sin el sello de ejemplo y con el de «solo el equipo»', async () => {
    localStorage.setItem('alpha-usuario', 'u-bryan')
    const { container } = renderizarEn('/praxis')
    await waitFor(() => expect(container.querySelector('.praxis')).not.toBeNull())
    expect(screen.queryByText('Datos de ejemplo')).not.toBeInTheDocument()
    expect(screen.getByText('Solo el equipo')).toBeInTheDocument()
    expect(container.querySelector('.praxis')?.textContent).not.toMatch(/ejemplo|PROTOTIPO/i)
    expect(screen.getByRole('button', { name: 'Hablar con Praxis' })).toBeInTheDocument()
  })

  it('el coach del seed no tiene plan ni check-ins propios, y la pantalla lo dice en vez de enseñar los de otra persona', async () => {
    localStorage.setItem('alpha-usuario', 'u-bryan')
    const { container } = renderizarEn('/praxis')
    await waitFor(() => expect(container.querySelector('.praxis')).not.toBeNull())
    expect(container.querySelector('#contador')?.textContent).toBe('0 firmas en 14 días')
    expect(container.querySelector('#tarjetaTxt')?.textContent).toContain('Aún no tengo tu check-in de hoy')
    expect(container.querySelectorAll('#partitura .firma-tinta')).toHaveLength(0)
  })

  it('/praxis/ejemplo conserva la maqueta completa para el equipo: con su sello de ejemplo y el check-in guiado', async () => {
    localStorage.setItem('alpha-usuario', 'u-bryan')
    const { container } = renderizarEn('/praxis/ejemplo')
    await waitFor(() => expect(container.querySelector('.praxis')).not.toBeNull())
    expect(screen.getByText('Datos de ejemplo')).toBeInTheDocument()
    expect(container.querySelector('#demoSel')).not.toBeNull()
    expect(container.querySelector('.praxis')?.hasAttribute('data-conectada')).toBe(false)
  })

  it('una asesorada tampoco entra a /praxis/ejemplo', async () => {
    const { container } = renderizarEn('/praxis/ejemplo')
    expect(await screen.findByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
    expect(container.querySelector('.praxis')).toBeNull()
  })

  it('el panel del coach enlaza con Praxis, rotulada como solo del equipo', async () => {
    localStorage.setItem('alpha-usuario', 'u-bryan')
    renderizarEn('/coach/asesorados')
    const enlace = await screen.findByRole('link', { name: 'Praxis (solo equipo)' })
    expect(enlace).toHaveAttribute('href', '/praxis')
  })
})
