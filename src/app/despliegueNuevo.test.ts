import { beforeEach, describe, expect, it, vi } from 'vitest'
import { esModuloQueYaNoExiste, recargarPorDespliegue } from './despliegueNuevo'

/**
 * El fallo que la asesorada ve como «Esta sección no se pudo mostrar» y que la
 * obligaba a salir de la app y volver a entrar. Ver el encabezado del módulo.
 */

describe('esModuloQueYaNoExiste', () => {
  /** El que se reportó desde producción, tal cual llegó. */
  it('reconoce el de Chrome, que es el que se vio', () => {
    expect(
      esModuloQueYaNoExiste(
        new Error(
          'Failed to fetch dynamically imported module: https://alpha-athletics-app.vercel.app/assets/NutricionLayout-BuMVtoI_.js',
        ),
      ),
    ).toBe(true)
  })

  /** Cada motor lo dice a su manera, y el equipo usa los tres. */
  it('reconoce también el de Firefox y el de Safari', () => {
    expect(
      esModuloQueYaNoExiste(new Error('error loading dynamically imported module')),
    ).toBe(true)
    expect(esModuloQueYaNoExiste(new Error('Importing a module script failed.'))).toBe(true)
  })

  /**
   * El cuarto no habla de módulos siquiera. Vercel reescribe todo a
   * `index.html`, así que pedir un fichero que ya no existe NO da un 404: da
   * HTML donde se esperaba JavaScript. Sin esta rama, el caso más habitual en
   * este hosting se escaparía.
   */
  it('reconoce el HTML que devuelve el rewrite en vez de un 404', () => {
    expect(
      esModuloQueYaNoExiste(
        new Error(
          "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of \"text/html\". Strict MIME type checking is enforced for module scripts per HTML spec.",
        ),
      ),
    ).toBe(true)
  })

  /**
   * Y NO se traga cualquier cosa: si recargara ante un error de datos, taparía
   * un fallo real con una recarga infinita y nadie vería nunca el mensaje.
   */
  it('no confunde un error normal de la app', () => {
    expect(esModuloQueYaNoExiste(new Error("Cannot read properties of undefined"))).toBe(false)
    expect(esModuloQueYaNoExiste(new Error('Network request failed'))).toBe(false)
    expect(esModuloQueYaNoExiste(undefined)).toBe(false)
    expect(esModuloQueYaNoExiste('vaya')).toBe(false)
  })
})

describe('recargarPorDespliegue', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('recarga la primera vez', async () => {
    const recargar = vi.fn()

    expect(recargarPorDespliegue(1_000_000, recargar)).toBe(true)
    // La recarga es asincrona: antes se tira la cache que sirve lo viejo.
    await vi.waitFor(() => expect(recargar).toHaveBeenCalledTimes(1))
  })

  /**
   * EL FRENO CONTRA EL BUCLE. Si la recarga no arreglara el problema —el
   * servidor sigue sin ese fichero, no hay red— sin este límite la app se
   * recargaría sola sin parar, y eso es PEOR que el error: al menos el error
   * deja leer qué pasa y tocar un botón.
   */
  it('no recarga dos veces seguidas', async () => {
    const recargar = vi.fn()

    recargarPorDespliegue(1_000_000, recargar)
    const segunda = recargarPorDespliegue(1_005_000, recargar) // 5 s después

    expect(segunda).toBe(false)
    await vi.waitFor(() => expect(recargar).toHaveBeenCalledTimes(1))
  })

  /** Pasada la ventana sí: un despliegue nuevo horas después merece su recarga. */
  it('vuelve a recargar pasada la ventana', async () => {
    const recargar = vi.fn()

    recargarPorDespliegue(1_000_000, recargar)
    const despues = recargarPorDespliegue(1_020_000, recargar) // 20 s después

    expect(despues).toBe(true)
    await vi.waitFor(() => expect(recargar).toHaveBeenCalledTimes(2))
  })

  /**
   * En modo privado `sessionStorage` puede lanzar. Se prefiere recargar —que
   * casi siempre arregla— a quedarse sin hacer nada por no poder anotarlo.
   */
  it('recarga aunque no pueda anotar el intento', async () => {
    const recargar = vi.fn()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })

    expect(recargarPorDespliegue(1_000_000, recargar)).toBe(true)
    await vi.waitFor(() => expect(recargar).toHaveBeenCalledTimes(1))

    vi.restoreAllMocks()
  })
})

describe('tirar lo viejo antes de recargar', () => {
  /**
   * EL FALLO QUE ESTE ARREGLO CIERRA, Y QUE LA PRIMERA VERSIÓN NO VEÍA.
   *
   * `vite-plugin-pwa` PRECACHEA `index.html`. Así que recargar a secas se lo
   * pedía al service worker viejo, que devolvía el MISMO html de antes, que
   * pedía los MISMOS ficheros que ya no existen. Fallaba otra vez, el freno
   * impedía el segundo intento, y la persona acababa recargando a mano igual
   * que antes de que existiera el arreglo.
   *
   * Borrando la caché primero, la recarga no tiene de dónde sacar lo viejo.
   */
  it('borra las cachés y suelta el service worker ANTES de recargar', async () => {
    const orden: string[] = []
    const borradas: string[] = []

    vi.stubGlobal('caches', {
      keys: () => Promise.resolve(['workbox-precache-v2', 'imagenes']),
      delete: (n: string) => {
        borradas.push(n)
        orden.push('cache:' + n)
        return Promise.resolve(true)
      },
    })
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        getRegistrations: () =>
          Promise.resolve([
            {
              unregister: () => {
                orden.push('unregister')
                return Promise.resolve(true)
              },
            },
          ]),
      },
    })

    const recargar = vi.fn(() => orden.push('reload'))
    sessionStorage.clear()

    recargarPorDespliegue(1_000_000, recargar)
    await vi.waitFor(() => expect(recargar).toHaveBeenCalled())

    expect(borradas.sort()).toEqual(['imagenes', 'workbox-precache-v2'])
    // Y el ORDEN importa: recargar antes de limpiar no arreglaría nada.
    expect(orden[orden.length - 1]).toBe('reload')
    expect(orden.indexOf('unregister')).toBeLessThan(orden.indexOf('reload'))

    vi.unstubAllGlobals()
  })

  /** Un navegador sin `caches` no puede quedarse sin recargar por eso. */
  it('si no hay Cache Storage, recarga igual', async () => {
    vi.stubGlobal('caches', undefined)
    const recargar = vi.fn()
    sessionStorage.clear()

    recargarPorDespliegue(1_000_000, recargar)
    await vi.waitFor(() => expect(recargar).toHaveBeenCalledTimes(1))

    vi.unstubAllGlobals()
  })
})
