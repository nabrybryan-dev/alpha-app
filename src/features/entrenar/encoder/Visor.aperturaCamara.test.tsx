import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Visor } from './Visor'
import type { Ajustes } from './useCaptura'

/* Lo que se prueba aquí es el recuento de toques, que es una doctrina del
 * producto y no un detalle: una medición son DOS toques —tocar el disco y
 * grabar—, y hasta ahora eran tres porque había que abrir la cámara a mano.
 *
 * jsdom no tiene cámara, así que `getUserMedia` falla igual haga lo que haga el
 * componente. Lo que se comprueba es lo único que decide el recuento: si se
 * intenta abrirla sola, y bajo qué condición. */

function conPermiso(estado: PermissionState | null) {
  const abrir = vi.fn().mockRejectedValue(new Error('sin cámara en jsdom'))
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: estado === null ? undefined : { query: vi.fn().mockResolvedValue({ state: estado }) },
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: abrir },
  })
  return abrir
}

/* Los mismos que arma `HojaMedicion`: aquí no se mide nada, pero el tipo no
 * admite un hueco y rellenarlo con valores inventados haría que el día que este
 * test falle nadie sepa si es por el componente o por los ajustes. */
const AJUSTES: Ajustes = {
  referencia: 'disco',
  dianaMm: [140, 220],
  sepMm: 400,
  diametroMm: 450,
  tolTono: 22,
  sentido: 'subir',
  modo: 'serie',
  gRef: 9.80665,
  ejercicio: 'PESO MUERTO CONVENCIONAL',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('el tercer toque', () => {
  it('con el permiso ya concedido, la cámara se abre sola', async () => {
    // De la segunda medición en adelante. Nadie abre la hoja de medición para
    // no medir, así que ese toque no decide nada.
    const abrir = conPermiso('granted')
    render(<Visor ajustes={AJUSTES}>{() => null}</Visor>)
    await waitFor(() => expect(abrir).toHaveBeenCalled())
  })

  it('sin permiso todavía, NO se pide sola', async () => {
    // Llamar a getUserMedia sin gesto dispara el diálogo del navegador nada más
    // abrirse la hoja, y un permiso que se pide sin contexto se deniega — y
    // denegado no se vuelve a pedir. La primera vez pasa por el botón.
    const abrir = conPermiso('prompt')
    render(<Visor ajustes={AJUSTES}>{() => null}</Visor>)
    await new Promise((r) => setTimeout(r, 20))
    expect(abrir).not.toHaveBeenCalled()
    expect(screen.getByText('Abrir cámara')).toBeInTheDocument()
  })

  it('denegado tampoco, obviamente', async () => {
    const abrir = conPermiso('denied')
    render(<Visor ajustes={AJUSTES}>{() => null}</Visor>)
    await new Promise((r) => setTimeout(r, 20))
    expect(abrir).not.toHaveBeenCalled()
  })

  it('sin API de permisos se queda el botón, como siempre', async () => {
    // Firefox no expone la cámara en `permissions`. Ahí no se adivina: se deja
    // el comportamiento de toda la vida.
    const abrir = conPermiso(null)
    render(<Visor ajustes={AJUSTES}>{() => null}</Visor>)
    await new Promise((r) => setTimeout(r, 20))
    expect(abrir).not.toHaveBeenCalled()
    expect(screen.getByText('Abrir cámara')).toBeInTheDocument()
  })
})
