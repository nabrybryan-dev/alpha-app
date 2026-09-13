/**
 * La pregunta del coach, debajo del vídeo de la revisión y sin entrar al chat.
 *
 * Decisión de Bryan (2026-09-12): el mensaje con la pregunta tiene que verse justo
 * debajo del vídeo. Hasta hoy solo asomaba recortado en una línea dentro del cuadro
 * «Escríbele a tu coach», y de esa respuesta depende ahora si el plan sigue.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db, idCoach } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import HoyPage from './HoyPage'

const PREGUNTA = '¿Del 0 al 10, cuánto te duele hoy la rodilla al bajar escaleras?'

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

describe('la pregunta del coach debajo del vídeo', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })
  afterEach(cleanup)

  it('se ve dentro de la revisión, debajo de los números, con su botón para responder', () => {
    db.mensajes.enviar({ deId: idCoach(), paraId: 'u-valentina', texto: PREGUNTA })
    renderizarHoy()

    const revision = screen.getByRole('region', { name: 'Tu revisión de la semana' })
    const tarjeta = within(revision).getByRole('region', { name: 'Pregunta de tu coach' })
    expect(within(tarjeta).getByText(PREGUNTA)).toBeInTheDocument()
    expect(within(tarjeta).getByRole('link', { name: 'Responder' })).toHaveAttribute('href', '/chat')

    const numeros = within(revision).getByRole('region', { name: 'Tu semana en números' })
    expect(numeros.compareDocumentPosition(tarjeta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('desaparece cuando la persona ya contestó', () => {
    db.mensajes.enviar({ deId: idCoach(), paraId: 'u-valentina', texto: PREGUNTA })
    db.mensajes.enviar({ deId: 'u-valentina', paraId: idCoach(), texto: 'Un 2, ya casi no molesta' })
    renderizarHoy()
    expect(screen.queryByRole('region', { name: 'Pregunta de tu coach' })).not.toBeInTheDocument()
  })

  it('un mensaje sin pregunta no ocupa el sitio', () => {
    db.mensajes.enviar({ deId: idCoach(), paraId: 'u-valentina', texto: 'Buen trabajo esta semana' })
    renderizarHoy()
    expect(screen.queryByRole('region', { name: 'Pregunta de tu coach' })).not.toBeInTheDocument()
  })
})
