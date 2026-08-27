import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * El fallo que se reportó desde producción: «Esta sección no se pudo mostrar»,
 * recurrente en TODAS las secciones, y con «Reintentar» sin servir de nada —la
 * única salida era cerrar la app y volver a entrar—.
 *
 * Pasaba tras cada despliegue: las rutas van con `lazy(() => import(...))`, así
 * que cada sección es un fichero con hash en el nombre. Al desplegar el hash
 * cambia, y una pestaña abierta desde antes sigue pidiendo el nombre viejo.
 * Reintentar el render pedía otra vez el mismo fichero inexistente.
 *
 * Ver `despliegueNuevo.ts`, que tiene sus propias pruebas de detección.
 */

const ERROR_DE_DESPLIEGUE =
  'Failed to fetch dynamically imported module: https://alpha-athletics-app.vercel.app/assets/NutricionLayout-BuMVtoI_.js'

function Explota({ mensaje }: { mensaje: string }): never {
  throw new Error(mensaje)
}

let recargas: number

beforeEach(() => {
  recargas = 0
  sessionStorage.clear()
  // `location.reload` no se puede espiar directamente en jsdom.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: () => { recargas += 1 } },
  })
  // El boundary escribe en consola a propósito, para poder diagnosticar desde
  // el móvil. Aquí solo estorba.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary · el trozo que ya no existe', () => {
  /**
   * LO QUE ARREGLA EL FALLO REPORTADO. Recargar es lo único que sirve: entonces
   * el navegador pide el `index.html` nuevo, que apunta a los nombres nuevos.
   */
  it('recarga sola cuando el fichero de la sección ya no existe', async () => {
    render(
      <ErrorBoundary>
        <Explota mensaje={ERROR_DE_DESPLIEGUE} />
      </ErrorBoundary>,
    )

    // Asíncrona: antes de recargar se tira la caché del service worker, que es
    // la que servía el `index.html` viejo. Ver `despliegueNuevo.ts`.
    await vi.waitFor(() => expect(recargas).toBe(1))
  })

  /**
   * Y NO recarga ante un error de verdad de la app: hacerlo taparía el fallo
   * con una recarga y nadie llegaría a leer nunca el mensaje.
   */
  it('un error normal no provoca recarga: se enseña, como siempre', async () => {
    render(
      <ErrorBoundary>
        <Explota mensaje="Cannot read properties of undefined" />
      </ErrorBoundary>,
    )

    expect(recargas).toBe(0)
    expect(screen.getByText('Esta sección no se pudo mostrar.')).toBeTruthy()
  })

  /**
   * El freno contra el bucle: si ya se recargó hace nada y sigue fallando,
   * recargar otra vez dejaría la app dando vueltas sin que nadie pueda leer
   * qué pasa. Entonces sí se enseña el aviso, y dice qué hacer.
   */
  it('si ya se recargó hace un momento, enseña el aviso en vez de insistir', async () => {
    sessionStorage.setItem('alpha-recarga-por-despliegue', String(Date.now()))

    render(
      <ErrorBoundary>
        <Explota mensaje={ERROR_DE_DESPLIEGUE} />
      </ErrorBoundary>,
    )

    expect(recargas).toBe(0)
    expect(screen.getByText('Hay una versión nueva de la app. Recarga para seguir.')).toBeTruthy()

    // Y el botón recarga de verdad, que es lo que «Reintentar» no hacía.
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    expect(recargas).toBe(1)
  })
})
