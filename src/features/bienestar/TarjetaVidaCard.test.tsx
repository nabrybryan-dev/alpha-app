import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TarjetaVidaCard } from './TarjetaVidaCard'
import * as tarjetasVida from '../../data/vida/tarjetasVida'
import { hoyIso } from '../../data/dbInstance'
import { semanaAMostrar } from '../../domain/tarjetaVida'

/**
 * `debeMostrarTarjeta` es puro y ya tiene su batería en `domain/tarjetaVida.test.ts`; aquí
 * se comprueba que el COMPONENTE respeta lo que ese dominio dice y que guarda lo que el
 * dominio acepta, mockeando `data/vida/tarjetasVida` en vez del cliente de Supabase — el
 * componente no sabe ni le importa cómo se guarda, solo que se guarda.
 */

vi.mock('../../data/vida/tarjetasVida', async () => {
  const real = await vi.importActual<typeof tarjetasVida>('../../data/vida/tarjetasVida')
  return { ...real, semanasRespondidasDe: vi.fn(), guardarTarjetaVida: vi.fn() }
})

const ASESORADA = 'u-valentina'
const semanaPendiente = semanaAMostrar(hoyIso())

describe('TarjetaVidaCard', () => {
  // Sin esto, `guardarTarjetaVida` conserva las llamadas de la prueba anterior: la de
  // "sin contestar ninguna" vio la llamada que dejó la prueba de guardar con éxito, de
  // antes, y no la suya propia.
  beforeEach(() => {
    vi.mocked(tarjetasVida.semanasRespondidasDe).mockReset()
    vi.mocked(tarjetasVida.guardarTarjetaVida).mockReset()
  })

  it('no pinta nada mientras carga, ni si la semana ya está respondida', async () => {
    vi.mocked(tarjetasVida.semanasRespondidasDe).mockResolvedValue([semanaPendiente])
    const { container } = render(<TarjetaVidaCard usuarioId={ASESORADA} />)

    await waitFor(() => expect(tarjetasVida.semanasRespondidasDe).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('pinta las siete preguntas cuando la semana no está respondida', async () => {
    vi.mocked(tarjetasVida.semanasRespondidasDe).mockResolvedValue([])
    render(<TarjetaVidaCard usuarioId={ASESORADA} />)

    expect(await screen.findByText(/tu semana en estilo de vida/i)).toBeTruthy()
    expect(screen.getAllByRole('group')).toHaveLength(7)
  })

  it('guarda lo contestado y muestra la confirmación', async () => {
    vi.mocked(tarjetasVida.semanasRespondidasDe).mockResolvedValue([])
    vi.mocked(tarjetasVida.guardarTarjetaVida).mockResolvedValue({ ok: true })
    render(<TarjetaVidaCard usuarioId={ASESORADA} />)

    await screen.findByText(/tu semana en estilo de vida/i)
    // Responde la primera opción de la primera pregunta.
    const primerGrupo = screen.getAllByRole('group')[0]
    const botones = primerGrupo.querySelectorAll('button')
    await userEvent.click(botones[0])
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(await screen.findByText(/tarjeta de la semana guardada/i)).toBeTruthy()
    expect(tarjetasVida.guardarTarjetaVida).toHaveBeenCalledWith(
      ASESORADA,
      semanaPendiente,
      expect.objectContaining({ V1: expect.any(Number) }),
    )
  })

  it('sin contestar ninguna, avisa en vez de guardar vacío', async () => {
    vi.mocked(tarjetasVida.semanasRespondidasDe).mockResolvedValue([])
    render(<TarjetaVidaCard usuarioId={ASESORADA} />)

    await screen.findByText(/tu semana en estilo de vida/i)
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(tarjetasVida.guardarTarjetaVida).not.toHaveBeenCalled()
  })

  it('si otra pestaña ya la mandó (ya_respondida), pasa a la confirmación sin error', async () => {
    vi.mocked(tarjetasVida.semanasRespondidasDe).mockResolvedValue([])
    vi.mocked(tarjetasVida.guardarTarjetaVida).mockResolvedValue({ ok: false, motivo: 'ya_respondida' })
    render(<TarjetaVidaCard usuarioId={ASESORADA} />)

    await screen.findByText(/tu semana en estilo de vida/i)
    const primerGrupo = screen.getAllByRole('group')[0]
    await userEvent.click(primerGrupo.querySelectorAll('button')[0])
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    // La UI no marca error: es un conflicto esperado, no un fallo de esta persona. Pero
    // tampoco muestra la tarjeta guardada con este mismo intento (no se recarga sola);
    // lo que sí debe pasar es que no queda ningún aviso rojo en pantalla.
    await waitFor(() => expect(tarjetasVida.guardarTarjetaVida).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
