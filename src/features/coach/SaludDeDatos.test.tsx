import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/dbInstance'
import { SaludDeDatos } from './SaludDeDatos'

/**
 * La prueba que importa: con el seed, el registro de comidas está vacío —igual
 * que estuvo en producción durante semanas— mientras los check-ins y los
 * mensajes sí tienen datos. El panel tiene que gritar exactamente eso.
 */
function filaDe(nombre: string): HTMLElement {
  const etiqueta = screen.getByText(nombre)
  const fila = etiqueta.closest('div')
  expect(fila).not.toBeNull()
  return fila as HTMLElement
}

describe('SaludDeDatos', () => {
  beforeEach(() => localStorage.clear())

  it('señala la familia que nunca llegó, con el resto al día', () => {
    render(<SaludDeDatos />)
    expect(within(filaDe('Registro de comidas')).getByText('Nunca llegó')).toBeInTheDocument()
    expect(within(filaDe('Registro de comidas')).getByText('Sin un solo registro')).toBeInTheDocument()
  })

  it('no se queda callado: avisa de que el dato puede estar sin subir', () => {
    // El coach tiene que poder distinguir "nadie lo usa" de "no está llegando".
    render(<SaludDeDatos />)
    expect(screen.getByText(/guardado en el teléfono sin subir/i)).toBeInTheDocument()
  })

  it('lista las cinco familias que se vigilan', () => {
    render(<SaludDeDatos />)
    for (const nombre of [
      'Registro de comidas',
      'Check-ins',
      'Adherencia nutricional',
      'Pruebas de calibración',
      'Mensajes',
    ]) {
      expect(screen.getByText(nombre)).toBeInTheDocument()
    }
  })

  it('con datos en todas, felicita en vez de alarmar', () => {
    // Se simula un equipo sano registrando una comida hoy para cada persona.
    const hoy = new Date()
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    for (const persona of db.usuarios.entrenan()) {
      const id = db.registroComidas.abrirComida({
        usuarioId: persona.id,
        momentoIso: `${fecha}T08:00:00`,
        comida: 'desayuno',
        cocinadoPorEl: true,
        // null = no se preguntó, distinto de 0 = se preguntó y no lleva.
        aceiteG: null,
        salG: null,
        confianza: 'estimado',
      })
      expect(id).toBeTruthy()
      db.calibracion.registrar({
        usuarioId: persona.id,
        fecha,
        alimentoId: 'a1',
        gramosEstimados: 100,
        gramosReales: 100,
      })
    }

    render(<SaludDeDatos />)
    expect(screen.getByText('Todo llegando')).toBeInTheDocument()
    expect(screen.queryByText('Nunca llegó')).not.toBeInTheDocument()
  })
})
