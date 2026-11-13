import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapaPraxis, TEXTO_CAMBIO_EN_OTRO_APARATO, TEXTO_NO_GUARDO, type PuertoDeGuardado } from './CapaPraxis'
import { _reiniciarCapaParaPruebas, abrirCapa, capaAbierta } from './estadoCapa'
import { TEXTOS_APROBADOS as A, TEXTOS_PENDIENTES as P } from './textos'

/** La capa con guardado real (0179): «Hecho» solo si la base contestó `aplicado`. Frases inventadas. */
const asesorado = { rol: 'asesorado' as const, capacidades: new Set<never>() }
type R = 'aplicado' | 'choque' | 'no_se_pudo'

function montar(guardar: PuertoDeGuardado['guardar'], deshacer: PuertoDeGuardado['deshacer'] = async () => 'aplicado', ocultas: string[] = []) {
  const guardado: PuertoDeGuardado = { guardar, deshacer, ocultasGuardadas: new Set(ocultas) }
  return render(<CapaPraxis perfil={asesorado} pantallaActual="/nutricion" navegar={vi.fn()} alAvisarCoachDeSalud={vi.fn()} alAbrirCheckin={vi.fn()} guardado={guardado} />)
}

async function ocultarRecetas() {
  const u = userEvent.setup()
  act(() => abrirCapa())
  await u.type(screen.getByLabelText(P.etiquetaDelCampo), 'Oculta las recetas')
  await u.click(screen.getByRole('button', { name: P.enviar }))
  await u.click(await screen.findByRole('button', { name: A.confirmaOcultarSi }))
  return u
}

beforeEach(() => _reiniciarCapaParaPruebas())
afterEach(() => _reiniciarCapaParaPruebas())

describe('CapaPraxis con guardado real', () => {
  it('al aceptar guarda con la acción y la pieza, y solo con «aplicado» dice que quedó hecho', async () => {
    const guardar = vi.fn(async (): Promise<R> => 'aplicado')
    montar(guardar)
    await ocultarRecetas()
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(guardar).toHaveBeenCalledWith('ocultar', expect.objectContaining({ id: 'nutricion.recetas' }))
    expect(await screen.findByText(P.pildoraOculte('las recetas'))).toBeInTheDocument()
    expect(capaAbierta()).toBe(false)
  })

  it('si la base no pudo guardar NO dice «Hecho», cuenta que no cambió nada y la capa sigue abierta', async () => {
    montar(async () => 'no_se_pudo')
    await ocultarRecetas()
    expect(await screen.findByText(TEXTO_NO_GUARDO)).toBeInTheDocument()
    expect(screen.queryByText(P.pildoraOculte('las recetas'))).toBeNull()
    expect(capaAbierta()).toBe(true)
  })

  it('si la pantalla cambió en otro aparato lo dice y no cambia nada', async () => {
    montar(async () => 'choque')
    await ocultarRecetas()
    expect(await screen.findByText(TEXTO_CAMBIO_EN_OTRO_APARATO)).toBeInTheDocument()
    expect(screen.queryByText(P.pildoraOculte('las recetas'))).toBeNull()
  })

  it('un error inesperado al guardar cuenta como «no se pudo» (nunca lanza)', async () => {
    montar(async () => { throw new Error('red') })
    await ocultarRecetas()
    expect(await screen.findByText(TEXTO_NO_GUARDO)).toBeInTheDocument()
  })

  it('lo ya escondido en la base manda: no se propone esconder de nuevo lo que ya está escondido', async () => {
    const guardar = vi.fn(async (): Promise<R> => 'aplicado')
    montar(guardar, undefined, ['nutricion.recetas'])
    const u = userEvent.setup()
    act(() => abrirCapa())
    await u.type(screen.getByLabelText(P.etiquetaDelCampo), 'Oculta las recetas')
    await u.click(screen.getByRole('button', { name: P.enviar }))
    await waitFor(() => expect(screen.queryByRole('button', { name: A.confirmaOcultarSi })).toBeNull())
    expect(guardar).not.toHaveBeenCalled()
  })
})
