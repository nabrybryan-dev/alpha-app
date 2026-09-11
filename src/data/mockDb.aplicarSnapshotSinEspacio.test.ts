import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aplicarSnapshot, crearMockDb } from './mockDb'
import { seedDb } from './seed'
import { olvidarSinEspacio, sinEspacioEnElDispositivo } from './sinEspacio'

/**
 * R-16 de la auditoría.
 *
 * `aplicarSnapshot` escribía la foto del servidor en `localStorage` SIN
 * try/catch, a diferencia de `guardar()` -el camino de las escrituras
 * locales-, que sí lo tiene. Si el dispositivo se queda sin espacio justo
 * cuando baja la foto (hidratación desde la nube), la escritura revienta
 * hacia arriba en mitad de esa descarga, sin avisar.
 *
 * La decisión (Bryan): cuando no quepa, liberar espacio con la rutina que YA
 * existe -`liberarEspacioDeInstantanea`, la misma que usa `guardar()` y
 * `escribirCola`-, reintentar UNA vez, y si sigue sin caber, conservar lo que
 * el dispositivo ya tenía (ni el disco ni la memoria se mueven a la foto que
 * no cupo) y marcar la falta de espacio con `marcarSinEspacio`. Nada se
 * pierde y no hay pantalla rota.
 */

const CLAVE_INSTANTANEA = 'alpha-db-v2'

/** Como lo lanza el navegador de verdad. */
function errorDeCuota() {
  const e = new Error('no cabe') as Error & { name: string; code: number }
  e.name = 'QuotaExceededError'
  e.code = 22
  return e
}

describe('aplicarSnapshot sin espacio en el dispositivo', () => {
  let real: typeof Storage.prototype.setItem

  beforeEach(() => {
    localStorage.clear()
    olvidarSinEspacio()
    real = Storage.prototype.setItem
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('no revienta cuando ni liberando espacio cabe la foto del servidor', () => {
    crearMockDb()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      clave: string,
      valor: string,
    ) {
      if (clave === CLAVE_INSTANTANEA) throw errorDeCuota()
      real.call(this, clave, valor)
    })

    const foto = structuredClone(seedDb)
    expect(() => aplicarSnapshot(foto)).not.toThrow()
    expect(sinEspacioEnElDispositivo()).toBe(true)
  })

  it('si ni liberando espacio cabe, conserva lo que el dispositivo ya tenía', () => {
    const db = crearMockDb()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const antes = localStorage.getItem(CLAVE_INSTANTANEA)

    // La foto NUEVA nunca cabe -ni tras liberar la caché-, pero devolver la
    // que YA había (más pequeña, y que ya estaba puesta) sí cabe: así se
    // puede comprobar que el arreglo restaura y no se queda a medias.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      clave: string,
      valor: string,
    ) {
      if (clave === CLAVE_INSTANTANEA && valor !== antes) throw errorDeCuota()
      real.call(this, clave, valor)
    })

    const foto = structuredClone(seedDb)
    foto.checkins = [
      ...foto.checkins,
      { id: 'marca-de-la-nube', usuarioId: 'u-valentina', fecha: '2099-01-01', estres: 'POCO' } as never,
    ]

    expect(() => aplicarSnapshot(foto)).not.toThrow()

    expect(localStorage.getItem(CLAVE_INSTANTANEA)).toBe(antes)
    expect(db.bienestar.byUsuario('u-valentina').some((c) => c.fecha === '2099-01-01')).toBe(false)
    expect(sinEspacioEnElDispositivo()).toBe(true)
  })

  it('libera la instantánea y reintenta: si con eso ya cabe, aplica la foto', () => {
    const db = crearMockDb()

    let primeraEscrituraInstantanea = true
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      clave: string,
      valor: string,
    ) {
      if (clave === CLAVE_INSTANTANEA && primeraEscrituraInstantanea) {
        primeraEscrituraInstantanea = false
        throw errorDeCuota()
      }
      real.call(this, clave, valor)
    })

    const foto = structuredClone(seedDb)
    foto.checkins = [
      ...foto.checkins,
      { id: 'marca-de-la-nube', usuarioId: 'u-valentina', fecha: '2099-01-01', estres: 'POCO' } as never,
    ]

    expect(() => aplicarSnapshot(foto)).not.toThrow()

    expect(db.bienestar.byUsuario('u-valentina').some((c) => c.fecha === '2099-01-01')).toBe(true)
    expect(localStorage.getItem(CLAVE_INSTANTANEA)).toContain('2099-01-01')
    expect(sinEspacioEnElDispositivo()).toBe(false)
  })
})
