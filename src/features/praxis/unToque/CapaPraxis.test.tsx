import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapaPraxis, type CapaPraxisProps } from './CapaPraxis'
import { registrarEngancheDeCharla } from './engancheDeCharla'
import { _reiniciarCapaParaPruebas, abrirCapa, capaAbierta } from './estadoCapa'
import { TEXTOS_APROBADOS as A, TEXTOS_PENDIENTES as P } from './textos'

const asesorado = { rol: 'asesorado' as const, capacidades: new Set<never>() }

function montar(extra: Partial<CapaPraxisProps> = {}) {
  const navegar = vi.fn()
  const alAvisarCoachDeSalud = vi.fn()
  const alAbrirCheckin = vi.fn()
  const r = render(
    <CapaPraxis
      perfil={asesorado}
      pantallaActual="/nutricion"
      navegar={navegar}
      alAvisarCoachDeSalud={alAvisarCoachDeSalud}
      alAbrirCheckin={alAbrirCheckin}
      {...extra}
    />,
  )
  return { ...r, navegar, alAvisarCoachDeSalud, alAbrirCheckin }
}

async function escribir(frase: string) {
  const u = userEvent.setup()
  await u.type(screen.getByLabelText(P.etiquetaDelCampo), frase)
  await u.click(screen.getByRole('button', { name: P.enviar }))
  return u
}

beforeEach(() => {
  _reiniciarCapaParaPruebas()
  registrarEngancheDeCharla(null)
})
afterEach(() => _reiniciarCapaParaPruebas())

describe('CapaPraxis', () => {
  it('cerrada no pinta nada; al abrirla sale el diálogo con el saludo aprobado y el foco en el campo', () => {
    montar()
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => abrirCapa())
    expect(screen.getByRole('dialog', { name: P.nombreDeLaCapa })).toBeInTheDocument()
    expect(screen.getByText(A.saludoTitulo)).toBeInTheDocument()
    expect(screen.getByText(A.saludoLinea)).toBeInTheDocument()
    expect(screen.getByLabelText(P.etiquetaDelCampo)).toHaveFocus()
  })

  it('Escape y el botón de cerrar la cierran', async () => {
    const u = userEvent.setup()
    montar()
    act(() => abrirCapa())
    await u.keyboard('{Escape}')
    expect(capaAbierta()).toBe(false)
    act(() => abrirCapa())
    await u.click(screen.getByRole('button', { name: P.cerrar }))
    expect(capaAbierta()).toBe(false)
  })

  it('traer navega sin pedir confirmación y deja la píldora', async () => {
    const { navegar } = montar()
    act(() => abrirCapa())
    await escribir('Muéstrame el agua')
    expect(await screen.findByText(P.pildoraTraje('el agua'))).toBeInTheDocument()
    expect(navegar).toHaveBeenCalledWith('/nutricion')
    expect(capaAbierta()).toBe(false)
  })

  it('ocultar pide tarjeta, no pasa nada hasta pulsar, y al aceptar cuenta 1 de 6 con «Deshacer» en la píldora', async () => {
    montar()
    act(() => abrirCapa())
    const u = await escribir('Oculta las recetas')
    const si = await screen.findByRole('button', { name: A.confirmaOcultarSi })
    expect(screen.getByRole('button', { name: A.confirmaOcultarNo })).toBeInTheDocument()
    expect(capaAbierta()).toBe(true)
    await u.click(si)
    expect(screen.getByText(P.pildoraOculte('las recetas'))).toBeInTheDocument()
    expect(screen.getByText(P.ocultasCuenta(1))).toBeInTheDocument()
    expect(capaAbierta()).toBe(false)
    // Deshacer desde la píldora abre la capa y propone la tarjeta de deshacer.
    await u.click(screen.getByRole('button', { name: P.deshacer }))
    expect(await screen.findByRole('button', { name: P.deshacerSi })).toBeInTheDocument()
  })

  it('«No, dejarlo» no cambia nada', async () => {
    montar()
    act(() => abrirCapa())
    const u = await escribir('Oculta las recetas')
    await u.click(await screen.findByRole('button', { name: A.confirmaOcultarNo }))
    expect(screen.getByText(P.loDejeComoEsta)).toBeInTheDocument()
    expect(capaAbierta()).toBe(true)
  })

  it('una parte fija no se oculta y no aparece ninguna tarjeta de confirmación', async () => {
    montar()
    act(() => abrirCapa())
    await escribir('Oculta mi check-in del día')
    expect(await screen.findByText(A.ocultarFija)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: A.confirmaOcultarSi })).toBeNull()
  })

  it('el esquema de orden trae sus pasos', async () => {
    montar()
    act(() => abrirCapa())
    await escribir('Pon el agua arriba')
    const esquema = await screen.findByRole('region', { name: P.esquemaTitulo })
    expect(esquema.querySelectorAll('li[data-paso]').length).toBe(3)
    expect(esquema.querySelector('[data-plano]')).not.toBeNull()
  })

  it('una frase de salud se desvía al coach antes que nada y el botón avisa por el camino que la app ya tiene', async () => {
    const { alAvisarCoachDeSalud, navegar } = montar({ charlaActiva: true })
    act(() => abrirCapa())
    const u = await escribir('Me duele la rodilla al bajar en sentadilla')
    expect(await screen.findByText(A.saludTitulo)).toBeInTheDocument()
    expect(screen.queryByText(P.pensando)).toBeNull()
    await u.click(screen.getByRole('button', { name: A.saludAvisar }))
    expect(alAvisarCoachDeSalud).toHaveBeenCalledTimes(1)
    expect(navegar).not.toHaveBeenCalled()
  })

  it('«Abrir mi check-in» lo abre', async () => {
    const { alAbrirCheckin } = montar()
    act(() => abrirCapa())
    const u = await escribir('Me duele la rodilla')
    await u.click(await screen.findByRole('button', { name: A.saludCheckin }))
    expect(alAbrirCheckin).toHaveBeenCalledTimes(1)
  })

  it('con la charla apagada una pregunta de conocimiento da «no entendí»', async () => {
    montar({ charlaActiva: false })
    act(() => abrirCapa())
    await escribir('¿Cuántas series por músculo a la semana?')
    expect(await screen.findByText(A.noEntendi)).toBeInTheDocument()
  })

  it('con la charla encendida pero sin enganche conectado dice que no está conectada y no llama a nada', async () => {
    montar({ charlaActiva: true })
    act(() => abrirCapa())
    await escribir('¿Cuántas series por músculo a la semana?')
    expect(await screen.findByText(P.charlaSinConectar)).toBeInTheDocument()
  })

  it('con un enganche registrado la respuesta lleva el rótulo provisional y los dos bloques separados', async () => {
    const responder = vi.fn().mockResolvedValue({
      texto: 'Te traje 1 ficha.',
      fichas: [{ id: 'f1', titulo: 'Volumen', estudios: 'Lo que dicen los estudios de ejemplo.', criterio: 'Criterio de ejemplo.' }],
    })
    registrarEngancheDeCharla({ responder })
    montar({ charlaActiva: true })
    act(() => abrirCapa())
    await escribir('¿Cuántas series por músculo a la semana?')
    expect(await screen.findByText(A.rotuloProvisional)).toBeInTheDocument()
    expect(screen.getByText(P.fichaEstudios)).toBeInTheDocument()
    expect(screen.getByText(P.fichaCriterio)).toBeInTheDocument()
    expect(responder).toHaveBeenCalledWith('¿Cuántas series por músculo a la semana?')
  })

  it('una ficha sin estudios no pinta el bloque «Lo que dicen los estudios»', async () => {
    registrarEngancheDeCharla({ responder: async () => ({ texto: 'x', fichas: [{ id: 'f', titulo: 'T', estudios: '', criterio: 'C' }] }) })
    montar({ charlaActiva: true })
    act(() => abrirCapa())
    await escribir('¿Cuánto descanso entre series?')
    expect(await screen.findByText(P.fichaCriterio)).toBeInTheDocument()
    expect(screen.queryByText(P.fichaEstudios)).toBeNull()
  })

  it('si el enganche falla, la capa dice que no hay respuesta y no se rompe', async () => {
    registrarEngancheDeCharla({ responder: () => Promise.reject(new Error('caído')) })
    montar({ charlaActiva: true })
    act(() => abrirCapa())
    await escribir('¿Cuánto descanso entre series?')
    expect(await screen.findByText(P.charlaSinRespuesta)).toBeInTheDocument()
  })
})

describe('CapaPraxis: aviso real de salud (D09)', () => {
  it('con escritor que acepta: llama con el tipo, dice «listo» y NO navega', async () => {
    const alAvisarCoachDeSalud = vi.fn().mockResolvedValue({ ok: true })
    const { navegar } = montar({ alAvisarCoachDeSalud })
    act(() => abrirCapa())
    const u = await escribir('Me duele la rodilla al bajar en sentadilla')
    await u.click(await screen.findByRole('button', { name: A.saludAvisar }))
    expect(alAvisarCoachDeSalud).toHaveBeenCalledWith('salud')
    expect(await screen.findByText(P.avisoSaludHecho)).toBeInTheDocument()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('con escritor que falla: NO dice «listo», dice la verdad y ofrece el chat', async () => {
    const alAvisarCoachDeSalud = vi.fn().mockResolvedValue({ ok: false, motivo: 'no_disponible' })
    const { navegar } = montar({ alAvisarCoachDeSalud })
    act(() => abrirCapa())
    const u = await escribir('Me duele la rodilla al bajar en sentadilla')
    await u.click(await screen.findByRole('button', { name: A.saludAvisar }))
    expect(await screen.findByText(P.avisoSaludNoPude)).toBeInTheDocument()
    expect(screen.queryByText(P.avisoSaludHecho)).toBeNull()
    await u.click(screen.getByRole('button', { name: P.avisoSaludAlChat }))
    expect(navegar).toHaveBeenCalledWith('/chat')
  })

  it('si el escritor revienta, tampoco finge', async () => {
    const alAvisarCoachDeSalud = vi.fn().mockRejectedValue(new Error('red'))
    montar({ alAvisarCoachDeSalud })
    act(() => abrirCapa())
    const u = await escribir('Me duele la rodilla al bajar en sentadilla')
    await u.click(await screen.findByRole('button', { name: A.saludAvisar }))
    expect(await screen.findByText(P.avisoSaludNoPude)).toBeInTheDocument()
    expect(screen.queryByText(P.avisoSaludHecho)).toBeNull()
  })
})
