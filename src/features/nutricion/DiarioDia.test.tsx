import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DiarioDia from './DiarioDia'
import { CompuertaNutricion } from './CompuertaNutricion'
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
        <CompuertaNutricion>
          <DiarioDia />
        </CompuertaNutricion>
      </SessionProvider>
    </MemoryRouter>,
  )

/** El recorrido real: tocar la comida abre su detalle, y desde ahí se agrega. */
const abrirYAgregar = async (comida: RegExp) => {
  await userEvent.click(screen.getByRole('button', { name: comida }))
  await userEvent.click(screen.getByRole('button', { name: /agregar alimento/i }))
}

const volver = () => userEvent.click(screen.getByRole('button', { name: /volver al diario/i }))

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
    await abrirYAgregar(/almuerzo, sin registrar/i)
    await buscarYElegir('arroz', /arroz/i)

    // El arroz existe crudo y cocido, así que primero pregunta.
    const cocido = screen.queryByRole('button', { name: /lo pesas ya servido/i })
    if (cocido) await userEvent.click(cocido)

    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))
    await volver()

    const almuerzo = screen.getByRole('button', { name: /^Almuerzo, \d+ kcal/i })
    expect(within(almuerzo).getByText(/arroz/i)).toBeInTheDocument()
  })

  it('la pregunta de crudo o cocido NO se repite la segunda vez', async () => {
    pintar()
    await abrirYAgregar(/almuerzo, sin registrar/i)
    await buscarYElegir('arroz', /arroz blanco, pulido/i)
    await userEvent.click(screen.getByRole('button', { name: /lo pesas ya servido/i }))
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))

    // Segunda vez, mismo alimento: tiene que ir directo a la cantidad.
    await volver()
    await abrirYAgregar(/^Cena, sin registrar/i)
    await buscarYElegir('arroz', /arroz blanco, pulido/i)

    expect(screen.queryByText(/¿cómo pesas/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /agregar a cena/i })).toBeInTheDocument()
  })

  it('lo registrado en una comida no se mete en otra', async () => {
    pintar()
    await abrirYAgregar(/almuerzo, sin registrar/i)
    await buscarYElegir('aceite de girasol', /aceite de girasol/i)
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))
    await volver()

    expect(screen.getByRole('button', { name: /^Cena, sin registrar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Desayuno, sin registrar/i })).toBeInTheDocument()
  })

  it('el contador de comidas hechas sube', async () => {
    pintar()
    expect(screen.getByText('0 / 4')).toBeInTheDocument()

    await abrirYAgregar(/almuerzo, sin registrar/i)
    await buscarYElegir('aceite de girasol', /aceite de girasol/i)
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))
    await volver()

    expect(screen.getByText('1 / 4')).toBeInTheDocument()
  })

  it('cambiar de día no arrastra lo registrado', async () => {
    pintar()
    await abrirYAgregar(/almuerzo, sin registrar/i)
    await buscarYElegir('aceite de girasol', /aceite de girasol/i)
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))
    await volver()

    // Cualquier otro día de la tira: el almuerzo vuelve a estar vacío.
    const dias = screen.getAllByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ })
    const otro = dias.find((d) => d.getAttribute('aria-pressed') === 'false')
    if (!otro) throw new Error('la tira no ofrece otro día')
    await userEvent.click(otro)

    expect(screen.getByRole('button', { name: /almuerzo, sin registrar/i })).toBeInTheDocument()
  })

  describe('la compuerta', () => {
    it('sin la encuesta respondida, Nutrición no se abre', () => {
      // Bloqueo completo a propósito: todo lo de detrás -calorías, macros,
      // márgenes- se calcula CON esos datos. Sin ellos la pantalla no enseñaría
      // un poco menos: enseñaría números sin respaldo, que se leen igual que
      // los buenos.
      // Mateo no la ha contestado en el seed: es el caso real de los 19 que
      // llevan meses y nunca la respondieron.
      localStorage.setItem('alpha-usuario', 'u-mateo')
      pintar()

      expect(screen.getByText(/antes de empezar/i)).toBeInTheDocument()
      expect(screen.queryByText(/diario de comidas/i)).not.toBeInTheDocument()
    })

    it('con la encuesta respondida, entra directo al diario', () => {
      // Valentina la tiene contestada en el seed.
      pintar()
      expect(screen.getByText(/diario de comidas/i)).toBeInTheDocument()
    })

    it('al terminarla, la compuerta se abre sin recargar', async () => {
      localStorage.setItem('alpha-usuario', 'u-mateo')
      pintar()

      await userEvent.click(screen.getByRole('button', { name: 'Mujer' }))
      for (const [etiqueta, valor] of [
        [/tu peso/i, '62'],
        [/tu altura/i, '165'],
        [/perímetro del cuello/i, '31'],
        [/perímetro de la cintura/i, '71'],
        [/perímetro de la cadera/i, '96'],
        [/cuántos pasos/i, '9500'],
        [/cuántos días entrenas/i, '4'],
      ] as const) {
        await userEvent.type(screen.getByLabelText(etiqueta), valor)
      }
      // `userEvent.type` no rellena un <input type="date">: hay que emitir el
      // cambio directamente.
      fireEvent.change(screen.getByLabelText(/cuándo naciste/i), {
        target: { value: '1998-03-14' },
      })
      const alergias = screen.getByText(/tienes alguna alergia/i).closest('div') as HTMLElement
      await userEvent.click(within(alergias).getByRole('button', { name: 'Ninguna' }))
      await userEvent.click(screen.getByRole('button', { name: 'Sí' }))

      await userEvent.click(screen.getByRole('button', { name: /listo/i }))

      // La encuesta desaparece. Mateo aun no tiene plan, asi que lo que ve es
      // el aviso de que su coach lo esta preparando -sin prometerle un reloj-.
      expect(screen.queryByText(/antes de empezar/i)).not.toBeInTheDocument()
      expect(screen.getByText(/viene en camino/i)).toBeInTheDocument()
    })
  })

  it('lleva a Mi plan', () => {
    pintar()
    expect(screen.getByRole('link', { name: /mi plan/i })).toHaveAttribute('href', '/nutricion/plan')
  })
})
