import { afterEach, describe, expect, it, vi } from 'vitest'
import { hayVersionNueva, vigilarVersionAlVolver } from './versionNueva'

/**
 * El teléfono que se queda con la app de antes. Ver el encabezado del módulo:
 * el 15-sep tres asesoradas seguían viendo un fallo arreglado el día anterior.
 */

function responde(cuerpo: unknown, ok = true): typeof fetch {
  return (() =>
    Promise.resolve({
      ok,
      json: () =>
        typeof cuerpo === 'string' ? Promise.reject(new SyntaxError('no es JSON')) : Promise.resolve(cuerpo),
    } as Response)) as typeof fetch
}

describe('hayVersionNueva', () => {
  /** El caso de Karin: su teléfono con `4b56d768c78b`, producción con `2cea2c7e0601`. */
  it('dice que sí cuando el servidor tiene otra versión', async () => {
    expect(await hayVersionNueva('4b56d768c78b', responde({ version: '2cea2c7e0601' }))).toBe(true)
  })

  it('dice que no cuando es la misma', async () => {
    expect(await hayVersionNueva('2cea2c7e0601', responde({ version: '2cea2c7e0601' }))).toBe(false)
  })

  /**
   * Sin versión propia (desarrollo, pruebas, un build fuera de Vercel) no hay con
   * qué comparar, y ni siquiera se pregunta.
   */
  it('sin versión propia no pregunta y dice que no', async () => {
    const pedir = vi.fn(responde({ version: 'otra' }))
    expect(await hayVersionNueva('', pedir)).toBe(false)
    expect(pedir).not.toHaveBeenCalled()
  })

  /**
   * Si el archivo no existe, el rewrite de Vercel contesta 200 con `index.html`.
   * Eso NO es una versión nueva: recargar por eso sería recargar sin motivo.
   */
  it('el index.html del rewrite no cuenta como versión nueva', async () => {
    expect(await hayVersionNueva('4b56d768c78b', responde('<!doctype html>'))).toBe(false)
  })

  it('sin red, con error del servidor o con versión vacía dice que no', async () => {
    const sinRed = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch
    expect(await hayVersionNueva('4b56d768c78b', sinRed)).toBe(false)
    expect(await hayVersionNueva('4b56d768c78b', responde({ version: 'x' }, false))).toBe(false)
    expect(await hayVersionNueva('4b56d768c78b', responde({ version: '' }))).toBe(false)
  })

  /** Pedirlo de la caché devolvería la versión vieja: justo lo que se quiere evitar. */
  it('lo pide a la red, no a la caché', async () => {
    const pedir = vi.fn(responde({ version: 'otra' }))
    await hayVersionNueva('4b56d768c78b', pedir)
    const [url, opciones] = pedir.mock.calls[0]
    expect(String(url)).toMatch(/^\/version\.json\?t=\d+$/)
    expect(opciones?.cache).toBe('no-store')
  })
})

describe('vigilarVersionAlVolver', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function conServiceWorker() {
    const update = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { getRegistration: () => Promise.resolve({ update }) },
    })
    return update
  }

  function volver() {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('al volver a la app, pide al service worker que busque versión nueva', async () => {
    const update = conServiceWorker()
    let reloj = 0
    const dejar = vigilarVersionAlVolver(() => reloj)

    reloj = 6 * 60_000
    volver()
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    dejar()
  })

  /** Entrar y salir diez veces en un minuto no son diez preguntas. */
  it('no pregunta otra vez si acaba de preguntar', async () => {
    const update = conServiceWorker()
    let reloj = 0
    const dejar = vigilarVersionAlVolver(() => reloj)

    reloj = 60_000
    volver()
    await Promise.resolve()
    expect(update).not.toHaveBeenCalled()
    dejar()
  })
})
