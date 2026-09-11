/**
 * La pantalla del chat deja de tener un solo hilo clavado al coach.
 *
 * Hasta el 10-sep, `ChatPage` fijaba `idCoach()` y no había forma de escribirle
 * a nadie más: la nutricionista del equipo existe en la base, puede escribirle
 * a un asesorado y el asesorado no tenía dónde contestarle. Este archivo nació
 * ROJO contra esa pantalla —no existía ni el selector ni la cabecera— y es el
 * que impide volver atrás.
 *
 * Lo que de verdad protege es la última prueba: el Centro de Respuestas es del
 * coach y solo del coach. Un mensaje escrito a la nutricionista NO puede
 * dispararlo, o la persona recibiría una respuesta automática firmada por
 * alguien que no la escribió.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Usuario } from '../../domain/types'

// jsdom no tiene `scrollIntoView`, y el hilo baja solo al último mensaje. Sin
// este relleno el fallo que se ve es el del entorno de prueba y tapa el de
// verdad. No se prueba el desplazamiento: se prueba con quién se habla.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const COACH: Usuario = { id: 'u-bryan', nombre: 'Bryan', rol: 'coach', avatarIniciales: 'B' }
const NUTRI: Usuario = {
  id: 'u-manuela',
  nombre: 'Manuela Quintero',
  rol: 'nutricionista',
  avatarIniciales: 'MQ',
}

// El reparto de remitentes tiene su propia prueba (`remitentes.test.ts`). Aquí
// se fija para poder mirar la pantalla con los dos, que es lo que el seed de
// demostración todavía no trae.
vi.mock('./remitentes', async (original) => ({
  ...(await original<typeof import('./remitentes')>()),
  remitentesDe: () => [COACH, NUTRI],
}))

const pedirRespuestaAlpha = vi.fn(async () => null)
vi.mock('./asistente', () => ({
  pedirRespuestaAlpha: (...args: unknown[]) => pedirRespuestaAlpha(...(args as [])),
}))

async function abrirChat() {
  const { SessionProvider } = await import('../../app/SessionProvider')
  const { default: ChatPage } = await import('./ChatPage')
  return render(
    <SessionProvider>
      <ChatPage />
    </SessionProvider>,
  )
}

function escribir(texto: string) {
  const campo = screen.getByPlaceholderText('Escribe un mensaje…')
  fireEvent.change(campo, { target: { value: texto } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
}

describe('el chat del asesorado tiene dos remitentes', () => {
  beforeEach(() => {
    localStorage.clear()
    pedirRespuestaAlpha.mockClear()
  })
  afterEach(cleanup)

  it('ofrece al coach y a la nutricionista, y arranca en el coach', async () => {
    await abrirChat()
    const selector = await screen.findByRole('tablist', { name: 'Con quién hablas' })
    expect(selector).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Bryan/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Manuela/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('cambia de hilo al elegir a la nutricionista', async () => {
    await abrirChat()
    fireEvent.click(await screen.findByRole('tab', { name: /Manuela/ }))
    expect(screen.getByRole('tab', { name: /Manuela/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /Manuela/ })).toBeInTheDocument()
  })

  it('la revisión de la semana NO vive aquí: vive en Hoy, y no se duplica', async () => {
    // Estuvo encima de la conversación unas horas del 10-sep. Bryan pidió que
    // se viera sin entrar al chat, así que se mudó a Hoy; dejarla en las dos
    // pantallas serían dos reproductores del mismo vídeo.
    await abrirChat()
    await screen.findByRole('tablist', { name: 'Con quién hablas' })
    expect(screen.queryByRole('region', { name: 'Tu revisión de la semana' })).not.toBeInTheDocument()
  })

  it('el hilo de la nutricionista avisa de que ahí no contesta ninguna máquina', async () => {
    // Sin esta línea, el silencio del asistente se lee como que la app está
    // rota. Pasó de verdad el 10-sep: dos mensajes a la nutricionista sin
    // respuesta automática, y la conclusión fue «no me responde».
    await abrirChat()
    expect(screen.queryByText(/te responde en persona/)).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('tab', { name: /Manuela/ }))
    expect(screen.getByText(/Manuela te responde en persona/)).toBeInTheDocument()
    expect(screen.getByText(/no hay respuestas automáticas/)).toBeInTheDocument()
  })

  it('el Centro de Respuestas es del coach: no contesta en el hilo de la nutricionista', async () => {
    await abrirChat()
    fireEvent.click(await screen.findByRole('tab', { name: /Manuela/ }))
    escribir('¿Puedo cambiar la cena?')
    await waitFor(() => expect(screen.getByText('¿Puedo cambiar la cena?')).toBeInTheDocument())
    // El hilo se rotula por quien lo atiende: ya no dice «con tu coach» siempre.
    expect(screen.getByText('Conversación con tu nutricionista')).toBeInTheDocument()
    expect(pedirRespuestaAlpha).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: /Bryan/ }))
    escribir('¿Subo la sentadilla?')
    await waitFor(() => expect(pedirRespuestaAlpha).toHaveBeenCalledTimes(1))
  })
})
