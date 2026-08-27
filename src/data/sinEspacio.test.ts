import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { esCuotaLlena, olvidarSinEspacio, sinEspacioEnElDispositivo } from './sinEspacio'

/**
 * Qué pasa cuando el dispositivo se queda sin espacio.
 *
 * Medido el 2026-08-27: al coach le tocan 26.920 bytes por asesorado solo de
 * microciclos, así que la cuota de Chrome —5 MB— se llena a los 194. Hasta
 * ahora `setItem` lanzaba y nadie lo capturaba: desde `mutar` eso significaba
 * que la escritura SE PERDÍA, sin un error que lo explicara.
 *
 * Ver `docs/specs/2026-08-27-informe-de-carga-mil-usuarios.md`.
 */

const CLAVE_INSTANTANEA = 'alpha-db-v2'
const CLAVE_COLA = 'alpha-cola-sync'

/** Como lo lanza el navegador de verdad. */
function errorDeCuota(nombre = 'QuotaExceededError', codigo = 22) {
  const e = new Error('no cabe') as Error & { name: string; code: number }
  e.name = nombre
  e.code = codigo
  return e
}

describe('esCuotaLlena', () => {
  it('reconoce las formas de cada navegador', () => {
    expect(esCuotaLlena(errorDeCuota())).toBe(true) // Chrome, Edge, Safari
    expect(esCuotaLlena(errorDeCuota('NS_ERROR_DOM_QUOTA_REACHED', 1014))).toBe(true) // Firefox
    // Y por el código, por si el nombre viniera vacío.
    expect(esCuotaLlena({ code: 22 })).toBe(true)
  })

  /** No se traga cualquier cosa: taparía errores reales. */
  it('no confunde otros errores', () => {
    expect(esCuotaLlena(new Error('cualquier cosa'))).toBe(false)
    expect(esCuotaLlena(null)).toBe(false)
    expect(esCuotaLlena('vaya')).toBe(false)
  })
})

describe('cuando no cabe', () => {
  let real: typeof Storage.prototype.setItem

  beforeEach(() => {
    localStorage.clear()
    olvidarSinEspacio()
    real = Storage.prototype.setItem
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  /**
   * `guardar` lo llama CADA escritura de la app. Lanzar aquí tumbaría la
   * pantalla en mitad de un entreno. La copia en memoria sigue al día, así que
   * la sesión continúa; lo que se pierde es la persistencia entre recargas.
   */
  it('guardar la instantánea no tumba la app', async () => {
    const { crearMockDb } = await import('./mockDb')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = crearMockDb()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      clave: string,
      valor: string,
    ) {
      if (clave === CLAVE_INSTANTANEA) throw errorDeCuota()
      real.call(this, clave, valor)
    })

    expect(() => db.bienestar.guardar({
      id: 'c-1', usuarioId: 'u-valentina', fecha: '2026-08-27',
    } as never)).not.toThrow()

    const { sinEspacioEnElDispositivo: lleno } = await import('./sinEspacio')
    expect(lleno()).toBe(true)
  })

  /**
   * NO se borra lo que ya había guardado: una instantánea vieja pero válida vale
   * más que ninguna. Al recargar, esa foto más la cola reconstruyen el estado.
   */
  it('guardar no destruye la instantánea anterior', async () => {
    const { crearMockDb } = await import('./mockDb')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    crearMockDb()

    const antes = localStorage.getItem(CLAVE_INSTANTANEA)
    expect(antes).toBeTruthy()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      clave: string,
      valor: string,
    ) {
      if (clave === CLAVE_INSTANTANEA) throw errorDeCuota()
      real.call(this, clave, valor)
    })

    const db2 = crearMockDb()
    db2.bienestar.guardar({ id: 'c-2', usuarioId: 'u-valentina', fecha: '2026-08-27' } as never)

    expect(localStorage.getItem(CLAVE_INSTANTANEA)).toBe(antes)
  })

  /**
   * LA REGLA DEL MÓDULO, Y LA PRUEBA QUE LA SUJETA.
   *
   *   la instantánea es una CACHÉ  → se vuelve a bajar de la nube
   *   la cola NO                   → es la única copia de lo que no ha subido
   *
   * Aquí la cola no cabe MIENTRAS la instantánea ocupe sitio. Tiene que soltar
   * la instantánea y volver a intentarlo, no rendirse: perder la instantánea
   * cuesta una descarga, perder la cola cuesta las series que alguien registró
   * sin señal.
   */
  it('la cola sacrifica la instantánea para caber, y lo consigue', async () => {
    const { crearMockDb } = await import('./mockDb')
    const { escribirCola } = await import('./nube/cola')
    crearMockDb()
    expect(localStorage.getItem(CLAVE_INSTANTANEA)).toBeTruthy()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      clave: string,
      valor: string,
    ) {
      // No cabe la cola mientras la instantánea siga ahí.
      if (clave === CLAVE_COLA && localStorage.getItem(CLAVE_INSTANTANEA) !== null) {
        throw errorDeCuota()
      }
      real.call(this, clave, valor)
    })

    const operacion = { tabla: 'checkins', tipo: 'upsert', payload: { id: 'x' } }
    expect(() => escribirCola([operacion as never])).not.toThrow()

    // La cola entró…
    expect(localStorage.getItem(CLAVE_COLA)).toContain('checkins')
    // …y la instantánea cedió su sitio.
    expect(localStorage.getItem(CLAVE_INSTANTANEA)).toBeNull()
  })

  /**
   * Y si después de soltar la caché tampoco cabe, SE LANZA. Taparlo dejaría
   * creer que la operación quedó guardada cuando no lo está, y eso es peor que
   * el error: la persona seguiría entrenando pensando que se registró.
   */
  it('si ni soltando la caché cabe, lanza en vez de mentir', async () => {
    const { escribirCola } = await import('./nube/cola')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw errorDeCuota()
    })

    expect(() => escribirCola([{ tabla: 'checkins', tipo: 'upsert', payload: {} } as never])).toThrow()
  })
})

describe('sinEspacioEnElDispositivo', () => {
  it('arranca en falso', () => {
    olvidarSinEspacio()
    expect(sinEspacioEnElDispositivo()).toBe(false)
  })
})
