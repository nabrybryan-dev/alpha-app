import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../data/dbInstance'
import ConsolaCoachPage from './ConsolaCoachPage'

/**
 * La prueba que manda en esta entrega: abrir la consola y navegar por sus
 * siete pestañas y por la cartera **no puede escribir nada**. Se espía cada
 * método de escritura de `db` (el mismo objeto que usa la app real, en modo
 * demo) y se comprueba que ninguno se llamó, ni una sola vez.
 */
function espiarEscrituras() {
  return [
    vi.spyOn(db.perfiles, 'agregarMedida'),
    vi.spyOn(db.perfiles, 'guardarValoracion'),
    vi.spyOn(db.perfiles, 'guardarPeldano'),
    vi.spyOn(db.microciclos, 'guardarPropuesta'),
    vi.spyOn(db.microciclos, 'activarPropuesta'),
    vi.spyOn(db.microciclos, 'registrarSerie'),
    vi.spyOn(db.microciclos, 'guardarTestPost'),
    vi.spyOn(db.microciclos, 'marcarParte'),
    vi.spyOn(db.bienestar, 'guardar'),
    vi.spyOn(db.nutricion, 'marcarAdherencia'),
    vi.spyOn(db.nutricion, 'registrarHidratacion'),
    vi.spyOn(db.perfilNutricion, 'guardar'),
    vi.spyOn(db.visibilidad, 'decidir'),
    vi.spyOn(db.vetados, 'vetar'),
    vi.spyOn(db.vetados, 'quitar'),
    vi.spyOn(db.despensa, 'agregar'),
    vi.spyOn(db.despensa, 'quitar'),
    vi.spyOn(db.registroComidas, 'abrirComida'),
    vi.spyOn(db.registroComidas, 'editarComida'),
    vi.spyOn(db.registroComidas, 'agregarItem'),
    vi.spyOn(db.registroComidas, 'quitarItem'),
    vi.spyOn(db.registroComidas, 'borrarComida'),
    vi.spyOn(db.registroComidas, 'recordarPreferencia'),
    vi.spyOn(db.calibracion, 'registrar'),
    vi.spyOn(db.mensajes, 'enviar'),
    vi.spyOn(db.mensajes, 'anotarPath'),
    vi.spyOn(db.mensajes, 'marcarAdjuntoListo'),
    vi.spyOn(db.mensajes, 'marcarLeidos'),
    vi.spyOn(db.mensajes, 'recibirDeAlpha'),
    vi.spyOn(db.cuestionarios, 'responder'),
  ]
}

const PESTANAS = [
  'Revisión de la semana',
  'Ficha del asesorado',
  'Microciclos',
  'Agentes',
  'Condición y salud',
  'Estilo de vida',
  'Revisión en vídeo',
]

describe('ConsolaCoachPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza las siete pestañas ARIA', () => {
    render(<ConsolaCoachPage />)
    const tablist = screen.getByRole('tablist', { name: /pestañas de la consola/i })
    for (const etiqueta of PESTANAS) {
      expect(within(tablist).getByRole('tab', { name: etiqueta })).toBeInTheDocument()
    }
  })

  it('la pestaña activa lleva aria-selected="true" y las demás "false"', () => {
    render(<ConsolaCoachPage />)
    const tabFicha = screen.getByRole('tab', { name: 'Ficha del asesorado' })
    fireEvent.click(tabFicha)
    expect(tabFicha).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Revisión de la semana' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('no escribe nada al recorrer las siete pestañas y cambiar de asesorado en la cartera', () => {
    const espias = espiarEscrituras()
    render(<ConsolaCoachPage />)

    for (const etiqueta of PESTANAS) {
      fireEvent.click(screen.getByRole('tab', { name: etiqueta }))
    }

    // Cambiar de persona en la cartera y volver a recorrer las pestañas.
    const nombres = db.usuarios.entrenan().map((u) => u.nombre)
    if (nombres.length > 1) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(nombres[1]) }))
      for (const etiqueta of PESTANAS) {
        fireEvent.click(screen.getByRole('tab', { name: etiqueta }))
      }
    }

    for (const espia of espias) {
      expect(espia).not.toHaveBeenCalled()
    }
  })

  it('sin cartera, se rinde con un estado vacío en vez de reventar', () => {
    const espiaEntrenan = vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([])
    render(<ConsolaCoachPage />)
    expect(screen.getByText('Sin cartera')).toBeInTheDocument()
    espiaEntrenan.mockRestore()
  })
})
