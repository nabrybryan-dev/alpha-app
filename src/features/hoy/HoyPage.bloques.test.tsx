import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import type { Perfil } from '../../domain/types'
import HoyPage from './HoyPage'
import { BloqueActual } from './BloqueActual'

function renderizarHoy() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter>
          <HoyPage />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

const perfilBase: Perfil = {
  usuarioId: 'u1',
  objetivos: 'Recomposición corporal',
  edad: 27,
  diasEntrenamiento: 5,
  tiempoSesionMin: 150,
  somatotipo: 'Mesomorfa',
  volumenSemanal: {},
  medidas: [],
}

describe('BloqueActual', () => {
  it('muestra la pauta que cargó el coach', () => {
    render(
      <BloqueActual
        perfil={{ ...perfilBase, faseEnergetica: 'Déficit 10-15%', proteinaGkg: 2, pasosObjetivo: 9000 }}
      />,
    )
    expect(screen.getByText('Déficit 10-15%')).toBeInTheDocument()
    expect(screen.getByText('2 g/kg')).toBeInTheDocument()
    expect(screen.getByText('9.000/día')).toBeInTheDocument()
    expect(screen.getByText('Recomposición corporal')).toBeInTheDocument()
  })

  it('omite las filas que el coach no llenó en vez de inventarlas', () => {
    render(<BloqueActual perfil={{ ...perfilBase, proteinaGkg: 1.8 }} />)
    expect(screen.getByText('1,8 g/kg')).toBeInTheDocument()
    expect(screen.queryByText('Fase energética')).not.toBeInTheDocument()
    expect(screen.queryByText('Pasos')).not.toBeInTheDocument()
  })

  it('sin perfil no se pinta nada', () => {
    const { container } = render(<BloqueActual perfil={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('HoyPage — bloques del rediseño', () => {
  beforeEach(() => localStorage.clear())

  it('lleva la pauta del bloque, el mensaje del coach, el álbum y el radar', async () => {
    renderizarHoy()
    expect(await screen.findByText('Tu bloque actual')).toBeInTheDocument()
    expect(screen.getByText('Coach')).toBeInTheDocument()
    expect(screen.getByText('Álbum Alfa')).toBeInTheDocument()
    expect(screen.getByText(/Radar Alfa/)).toBeInTheDocument()
  })

  it('la tarjeta de sesión enseña la prioridad de volumen de PERFIL', async () => {
    renderizarHoy()
    // Los nombres de grupo también salen en el mapa de fatiga de más abajo, así
    // que la lista se busca por su etiqueta y no por el texto de los chips.
    const lista = await screen.findByLabelText('Prioridad de volumen')
    const chips = within(lista)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    // Del seed de Valentina: dos grupos de más volumen y el que menos.
    expect(chips).toEqual(['Isquios Muy Alto', 'Pecho Muy Alto', 'Cuádriceps Bajo'])
  })

  it('no pide el check-in ni los mensajes dos veces en la misma pantalla', async () => {
    renderizarHoy()
    await screen.findByText('Tu bloque actual')
    expect(screen.queryByText('Check-in de bienestar')).not.toBeInTheDocument()
    expect(screen.queryByText(/mensajes? del coach/)).not.toBeInTheDocument()
  })
})
