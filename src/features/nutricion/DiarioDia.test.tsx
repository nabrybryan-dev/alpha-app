import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DiarioDia from './DiarioDia'
import { SessionProvider } from '../../app/SessionProvider'
import { reiniciarDb } from '../../data/mockDb'

/**
 * El camino crítico entero: tocar una comida, buscar, elegir, poner la cantidad
 * y verlo sumado en el día. Es la prueba que de verdad importa — las tres hojas
 * pueden estar bien por separado y no encajar.
 */

const pintar = () =>
  render(
    <MemoryRouter>
      <SessionProvider>
        <DiarioDia />
      </SessionProvider>
    </MemoryRouter>,
  )

const buscarYElegir = async (texto: string, nombreParcial: RegExp) => {
  await userEvent.type(screen.getByLabelText('Nombre del alimento'), texto)
  const fila = screen.getAllByRole('button', { name: /kcal\/100 g/i }).find((b) =>
    nombreParcial.test(b.textContent ?? ''),
  )
  if (!fila) throw new Error(`no salió ningún resultado que encaje con ${nombreParcial}`)
  await userEvent.click(fila)
}

describe('DiarioDia', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('pinta las cuatro comidas aunque estén vacías', () => {
    pintar()
    for (const comida of ['Desayuno', 'Almuerzo', 'Cena', 'Snack']) {
      expect(screen.getByRole('button', { name: new RegExp(`${comida}, sin registrar`) })).toBeInTheDocument()
    }
  })

  it('arranca el día en cero', () => {
    pintar()
    expect(screen.getByRole('button', { name: /almuerzo, sin registrar/i })).toBeInTheDocument()
  })

  it('registra un alimento y lo suma al día', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: /almuerzo, sin registrar/i }))
    await buscarYElegir('arroz', /arroz/i)

    // El arroz existe crudo y cocido, así que primero pregunta.
    const cocido = screen.queryByRole('button', { name: /lo pesas ya servido/i })
    if (cocido) await userEvent.click(cocido)

    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))

    const almuerzo = screen.getByRole('button', { name: /^Almuerzo, \d+ kcal/i })
    expect(within(almuerzo).getByText(/arroz/i)).toBeInTheDocument()
  })

  it('la pregunta de crudo o cocido NO se repite la segunda vez', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: /almuerzo, sin registrar/i }))
    await buscarYElegir('arroz', /arroz blanco, pulido/i)
    await userEvent.click(screen.getByRole('button', { name: /lo pesas ya servido/i }))
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))

    // Segunda vez, mismo alimento: tiene que ir directo a la cantidad.
    await userEvent.click(screen.getByRole('button', { name: /^Cena, sin registrar/i }))
    await buscarYElegir('arroz', /arroz blanco, pulido/i)

    expect(screen.queryByText(/¿cómo pesas/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /agregar a cena/i })).toBeInTheDocument()
  })

  it('lo registrado en una comida no se mete en otra', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: /almuerzo, sin registrar/i }))
    await buscarYElegir('aceite de girasol', /aceite de girasol/i)
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))

    expect(screen.getByRole('button', { name: /^Cena, sin registrar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Desayuno, sin registrar/i })).toBeInTheDocument()
  })

  it('el contador de comidas hechas sube', async () => {
    pintar()
    expect(screen.getByText('0 / 4')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /almuerzo, sin registrar/i }))
    await buscarYElegir('aceite de girasol', /aceite de girasol/i)
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))

    expect(screen.getByText('1 / 4')).toBeInTheDocument()
  })

  it('cambiar de día no arrastra lo registrado', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: /almuerzo, sin registrar/i }))
    await buscarYElegir('aceite de girasol', /aceite de girasol/i)
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))

    // Cualquier otro día de la tira: el almuerzo vuelve a estar vacío.
    const dias = screen.getAllByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ })
    const otro = dias.find((d) => d.getAttribute('aria-pressed') === 'false')
    if (!otro) throw new Error('la tira no ofrece otro día')
    await userEvent.click(otro)

    expect(screen.getByRole('button', { name: /almuerzo, sin registrar/i })).toBeInTheDocument()
  })

  it('lleva a Mi plan', () => {
    pintar()
    expect(screen.getByRole('link', { name: /mi plan/i })).toHaveAttribute('href', '/nutricion/plan')
  })
})
