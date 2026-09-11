/**
 * La revisión de la semana se ve nada más abrir la app.
 *
 * Nació en la pantalla del chat y Bryan la mudó aquí el 10-sep con un motivo
 * claro: **no se puede pedir que entren al chat para ver el vídeo**. Primero el
 * vídeo, y debajo el cuadro para escribirle al coach o a la nutricionista.
 *
 * Visto romperse: contra la Hoy anterior, dos de las tres pruebas dan rojo
 * —no existía la región de la revisión—. La tercera pasa por construcción,
 * porque comprueba el caso SIN nutricionista, que es justo lo que hacía la
 * pantalla vieja siempre.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import type { Usuario } from '../../domain/types'
import HoyPage from './HoyPage'

const COACH: Usuario = { id: 'u-bryan', nombre: 'Bryan', rol: 'coach', avatarIniciales: 'B' }
const NUTRI: Usuario = {
  id: 'u-manuela',
  nombre: 'Manuela Quintero',
  rol: 'nutricionista',
  avatarIniciales: 'MQ',
}

const remitentes = vi.fn(() => [COACH, NUTRI])
vi.mock('../chat/remitentes', async (original) => ({
  ...(await original<typeof import('../chat/remitentes')>()),
  remitentesDe: () => remitentes(),
}))

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

describe('la revisión de la semana en Hoy', () => {
  beforeEach(() => {
    localStorage.clear()
    remitentes.mockReturnValue([COACH, NUTRI])
  })
  afterEach(cleanup)

  it('se ve sin entrar al chat', () => {
    renderizarHoy()
    expect(screen.getByRole('region', { name: 'Tu revisión de la semana' })).toBeInTheDocument()
  })

  it('va ENCIMA del cuadro para escribirle al equipo', () => {
    renderizarHoy()
    const revision = screen.getByRole('region', { name: 'Tu revisión de la semana' })
    const chat = screen.getByText('Escríbele a tu coach o a tu nutricionista')
    // DOCUMENT_POSITION_FOLLOWING: el cuadro del chat viene DESPUÉS.
    expect(revision.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('nombra a la nutricionista solo cuando existe en la base', () => {
    remitentes.mockReturnValue([COACH])
    renderizarHoy()
    expect(screen.getByText('Escríbele a tu coach')).toBeInTheDocument()
    expect(screen.queryByText('Escríbele a tu coach o a tu nutricionista')).not.toBeInTheDocument()
  })
})
