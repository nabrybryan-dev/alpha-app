import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../data/dbInstance'
import ConsolaCoachPage from './ConsolaCoachPage'

/**
 * La prueba que manda en esta entrega: abrir la consola y navegar por sus
 * siete pestañas y por la cartera **no puede escribir nada**. Se espía cada
 * método de escritura de `db` (el mismo objeto que usa la app real, en modo
 * demo) y se comprueba que ninguno se llamó, ni una sola vez.
 *
 * Desde el rediseño (zona 5), la pestaña y la persona viven en la URL: estas
 * pruebas montan la consola dentro de un router y leen la dirección con una
 * sonda, porque «sobrevive a recargar y a volver» es una promesa de la
 * dirección, no del `sessionStorage`.
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

/** El botón de la persona EN LA CARTERA (la Revisión también tiene «Ver la ficha de…»). */
function botonDeCartera(nombre: string): HTMLElement {
  return within(screen.getByRole('navigation', { name: 'Cartera de asesorados' })).getByRole('button', {
    name: new RegExp(nombre),
  })
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

/** Enseña la dirección actual y deja pedir «atrás», como el gesto del teléfono. */
function Sonda() {
  const { search } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="url">{search}</output>
      <button type="button" onClick={() => navigate(-1)}>
        atrás
      </button>
    </>
  )
}

function montar(entrada = '/coach/consola') {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <ConsolaCoachPage />
      <Sonda />
    </MemoryRouter>,
  )
}

describe('ConsolaCoachPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('la persona elegida en la cartera manda en todas las pestañas de persona', () => {
    const cartera = db.usuarios.entrenan()
    if (cartera.length < 2) return
    montar()
    const segunda = cartera[1].nombre
    fireEvent.click(botonDeCartera(segunda))
    for (const etiqueta of ['Ficha del asesorado', 'Microciclos', 'Condición y salud', 'Estilo de vida']) {
      fireEvent.click(screen.getByRole('tab', { name: etiqueta }))
      // La cabecera de la persona se queda arriba con SU nombre al cambiar de pestaña.
      expect(screen.getByRole('heading', { level: 2, name: segunda })).toBeInTheDocument()
    }
    expect(botonDeCartera(segunda)).toHaveAttribute('aria-current', 'true')
  })

  it('la selección y la pestaña viven en la URL: sobreviven a montar la consola de nuevo', () => {
    const cartera = db.usuarios.entrenan()
    if (cartera.length < 2) return
    const { unmount } = montar()
    fireEvent.click(botonDeCartera(cartera[1].nombre))
    fireEvent.click(screen.getByRole('tab', { name: 'Microciclos' }))
    const url = screen.getByTestId('url').textContent
    expect(url).toContain('pestana=microciclos')
    expect(url).toContain(`persona=${encodeURIComponent(cartera[1].id)}`)
    unmount()
    // Abrir la dirección guardada (lo que hace recargar) devuelve a la misma persona y pestaña.
    montar(`/coach/consola${url}`)
    expect(screen.getByRole('tab', { name: 'Microciclos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { level: 2, name: cartera[1].nombre })).toBeInTheDocument()
  })

  it('una dirección con persona y pestaña abre directamente ahí', () => {
    const cartera = db.usuarios.entrenan()
    if (cartera.length < 2) return
    montar(
      `/coach/consola?persona=${encodeURIComponent(cartera[1].id)}&pestana=condicion`,
    )
    expect(screen.getByRole('tab', { name: 'Condición y salud' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('heading', { level: 2, name: cartera[1].nombre })).toBeInTheDocument()
  })

  it('el gesto de atrás devuelve a la pestaña anterior, no a la portada', () => {
    montar()
    fireEvent.click(screen.getByRole('tab', { name: 'Microciclos' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Ficha del asesorado' }))
    fireEvent.click(screen.getByRole('button', { name: 'atrás' }))
    expect(screen.getByRole('tab', { name: 'Microciclos' })).toHaveAttribute('aria-selected', 'true')
  })

  it('en el teléfono la cartera se abre en una hoja, elige a la persona y se cierra', () => {
    const cartera = db.usuarios.entrenan()
    if (cartera.length < 2) return
    montar()
    fireEvent.click(screen.getByRole('button', { name: /abrir la cartera/i }))
    const hoja = screen.getByRole('dialog', { name: 'Cartera de asesorados' })
    fireEvent.click(within(hoja).getByRole('button', { name: new RegExp(cartera[1].nombre) }))
    expect(screen.queryByRole('dialog', { name: 'Cartera de asesorados' })).not.toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent(`persona=${encodeURIComponent(cartera[1].id)}`)
  })

  it('desde la Revisión, «Ver ficha» elige a la persona y abre su ficha', () => {
    const cartera = db.usuarios.entrenan()
    const ultima = cartera[cartera.length - 1].nombre
    montar()
    fireEvent.click(screen.getByRole('button', { name: `Ver la ficha de ${ultima}` }))
    expect(screen.getByRole('tab', { name: 'Ficha del asesorado' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { level: 2, name: ultima })).toBeInTheDocument()
  })

  it('la cabecera muestra las cinco cifras de la persona, con un vacío que dice qué falta', () => {
    montar()
    fireEvent.click(screen.getByRole('tab', { name: 'Ficha del asesorado' }))
    const cabecera = screen.getByLabelText(/Resumen de/)
    for (const kpi of ['Semana', 'Adherencia', 'Peso', 'Riesgo', 'Cadena']) {
      expect(within(cabecera).getByText(kpi)).toBeInTheDocument()
    }
  })

  it('renderiza las siete pestañas ARIA', () => {
    montar()
    const tablist = screen.getByRole('tablist', { name: /pestañas de la consola/i })
    for (const etiqueta of PESTANAS) {
      expect(within(tablist).getByRole('tab', { name: etiqueta })).toBeInTheDocument()
    }
  })

  it('la pestaña activa lleva aria-selected="true" y las demás "false"', () => {
    montar()
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
    montar()

    for (const etiqueta of PESTANAS) {
      fireEvent.click(screen.getByRole('tab', { name: etiqueta }))
    }

    // Cambiar de persona en la cartera y volver a recorrer las pestañas.
    const nombres = db.usuarios.entrenan().map((u) => u.nombre)
    if (nombres.length > 1) {
      fireEvent.click(botonDeCartera(nombres[1]))
      for (const etiqueta of PESTANAS) {
        fireEvent.click(screen.getByRole('tab', { name: etiqueta }))
      }
    }

    for (const espia of espias) {
      expect(espia).not.toHaveBeenCalled()
    }
  })

  it('las otras pantallas del equipo siguen a un toque, en la hoja «Herramientas»', () => {
    montar()
    expect(screen.queryByRole('link', { name: 'Praxis del equipo' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Herramientas' }))
    const hoja = screen.getByRole('dialog', { name: 'Herramientas del equipo' })
    expect(within(hoja).getByRole('link', { name: /Equipo/ })).toHaveAttribute('href', '/equipo')
    expect(within(hoja).getByRole('link', { name: /Praxis del equipo/ })).toHaveAttribute('href', '/praxis')
  })

  it('sin cartera, se rinde con un estado vacío en vez de reventar', () => {
    const espiaEntrenan = vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([])
    montar()
    expect(screen.getByText('Sin cartera')).toBeInTheDocument()
    espiaEntrenan.mockRestore()
  })
})
