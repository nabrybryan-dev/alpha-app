import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { VisorPatron } from './VisorPatron'

/**
 * En jsdom no hay WebGL: `getContext('webgl')` devuelve null, así que estos
 * tests cubren el material didáctico y el modo degradado. Lo que se ve dibujado
 * se comprueba a ojo en el navegador; lo que NO puede pasar es que la falta de
 * WebGL deje al asesorado con una hoja en blanco.
 */
describe('VisorPatron', () => {
  it('avisa en vez de quedarse en blanco cuando no hay WebGL', async () => {
    render(<VisorPatron patron={PATRON_POR_ID.sentadilla} />)
    await waitFor(() => {
      expect(screen.getByText(/no puede mostrar el modelo 3D/i)).toBeInTheDocument()
    })
  })

  it('muestra las claves de ejecución y los errores del patrón', () => {
    const patron = PATRON_POR_ID.bisagra_cadera
    render(<VisorPatron patron={patron} />)
    for (const clave of patron.claves) {
      expect(screen.getByText(clave)).toBeInTheDocument()
    }
    for (const error of patron.errores) {
      expect(screen.getByText(error)).toBeInTheDocument()
    }
  })

  it('lista la musculatura implicada por orden de participación', () => {
    const { container } = render(<VisorPatron patron={PATRON_POR_ID.bisagra_cadera} />)
    // Solo los porcentajes de músculo, no los de las porciones de dentro: esos
    // se ordenan dentro de su propio músculo y no en la lista general.
    const porcentajes = Array.from(container.querySelectorAll('summary b')).map((n) =>
      Number(n.textContent!.replace('%', '')),
    )
    expect(porcentajes.length).toBeGreaterThan(3)
    expect(porcentajes[0]).toBe(100)
    expect(porcentajes).toEqual([...porcentajes].sort((a, b) => b - a))
    expect(screen.getByText('Isquiotibiales')).toBeInTheDocument()
  })

  it('desglosa las porciones con su origen y su inserción', () => {
    // Es lo que convierte una mancha roja en algo que se puede entender: de
    // dónde nace el vientre y dónde acaba.
    render(<VisorPatron patron={PATRON_POR_ID.flexion_codo} />)
    expect(screen.getByText('Cabeza larga')).toBeInTheDocument()
    expect(screen.getByText('Cabeza corta')).toBeInTheDocument()
    expect(screen.getByText(/tubérculo supraglenoideo/i)).toBeInTheDocument()
    expect(screen.getByText(/apófisis coracoides/i)).toBeInTheDocument()
  })

  it('avisa de las porciones que cruzan dos articulaciones', () => {
    // Explica por qué el recto femoral no puede dar todo su recorrido en una
    // sentadilla: la cadera flexionada ya le ha comido longitud.
    render(<VisorPatron patron={PATRON_POR_ID.sentadilla} />)
    expect(screen.getAllByText(/cruza dos articulaciones/i).length).toBeGreaterThan(0)
  })

  it('no repite un músculo que trabaja en los dos lados', () => {
    // La zancada activa el cuádriceps derecho e izquierdo por separado; en la
    // lista tiene que salir una sola vez o parece que hay dos músculos.
    render(<VisorPatron patron={PATRON_POR_ID.sentadilla_unilateral} />)
    expect(screen.getAllByText('Cuádriceps')).toHaveLength(1)
  })

  it('describe el lienzo para quien usa lector de pantalla', () => {
    render(<VisorPatron patron={PATRON_POR_ID.flexion_codo} />)
    expect(screen.getByLabelText(/Modelo tridimensional del patrón Flexión de codo/i)).toBeInTheDocument()
  })

  it('ofrece el deslizador de fase aunque el modelo no se pueda dibujar', () => {
    // Es la salida de emergencia: sin WebGL el asesorado al menos lee el texto,
    // y el control no debe desaparecer ni quedar roto.
    render(<VisorPatron patron={PATRON_POR_ID.sentadilla} />)
    expect(screen.getByLabelText('Fase del movimiento')).toBeInTheDocument()
  })

  describe('cuando el sistema pide menos movimiento', () => {
    it('no anima solo y lo explica', () => {
      // Sin esto, quien tiene activado «reducir movimiento» se encuentra un
      // bucle corriendo justo en la pantalla donde está entrenando.
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (consulta: string) =>
          ({
            matches: consulta.includes('prefers-reduced-motion'),
            media: consulta,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList,
      )
      render(<VisorPatron patron={PATRON_POR_ID.sentadilla} />)
      expect(screen.getByText(/pide menos movimiento/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reproducir/i })).toBeDisabled()
      vi.restoreAllMocks()
    })
  })
})
