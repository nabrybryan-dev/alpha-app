import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hoyIso } from '../lib/fecha'
import { crearMockDb } from './mockDb'

/**
 * La sesión se queda con el día en que la persona apareció.
 *
 * ## Por qué hacía falta un campo nuevo
 *
 * `dia` no vale: guarda «LUNES», «MARTES», el hueco de la semana que pidió el
 * plan. Medido el 2026-09-04 sobre la cartera entera —607 sesiones— **ninguna
 * tenía una fecha**. El único rastro fechado que dejaba el asesorado era la
 * primera marca de `preparacion`, y solo la tenían 33 de las 107 sesiones
 * activas: tres de cada cuatro días no se podían emparejar con su check-in.
 *
 * ## Qué se defiende aquí
 *
 * Que las tres puertas de entrada la escriben, que **solo se escribe una vez**,
 * que no se derrama sobre las sesiones vecinas, y —lo que da sentido a todo—
 * que el valor **casa carácter a carácter con el del check-in**. Si las dos
 * fechas no coincidieran, el campo existiría y no serviría para nada.
 */
describe('la sesión se queda con la fecha en que se tocó', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.useRealTimers())

  const activo = (db: ReturnType<typeof crearMockDb>) =>
    db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')!

  it('la escribe al marcar una parte del calentamiento', () => {
    const db = crearMockDb()
    const m = activo(db)
    const sesion = m.sesiones[0]
    expect(sesion.fecha).toBeUndefined()

    db.microciclos.marcarParte(m.id, sesion.id, sesion.preparacion![0].id)

    expect(activo(db).sesiones[0].fecha).toBe(hoyIso())
  })

  it('la escribe al guardar el test posterior', () => {
    const db = crearMockDb()
    const m = activo(db)
    db.microciclos.guardarTestPost(m.id, m.sesiones[1].id, { prsEntrada: 7, rpeSesion: 8, duracionMin: 60 })
    expect(activo(db).sesiones[1].fecha).toBe(hoyIso())
  })

  it('la escribe al anotar una serie, y SOLO en la sesión de ese ejercicio', () => {
    const db = crearMockDb()
    const m = activo(db)
    const sesion = m.sesiones.find((s) => s.ejercicios.length > 0)!
    const ejercicio = sesion.ejercicios[0]

    db.microciclos.registrarSerie(m.id, ejercicio.id, { orden: 1, cargaKg: 40, reps: 10, rir: 2 })

    const despues = activo(db)
    expect(despues.sesiones.find((s) => s.id === sesion.id)!.fecha).toBe(hoyIso())
    // El derrame es el fallo fácil aquí: `registrarSerie` recorre TODAS las
    // sesiones para encontrar el ejercicio, así que sellarlas de paso pondría el
    // lunes en las cinco sesiones de la semana.
    const otras = despues.sesiones.filter((s) => s.id !== sesion.id)
    expect(otras.map((s) => s.fecha)).toEqual(otras.map(() => undefined))
  })

  it('NO la pisa: el día que manda es el primero, no el último', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 10, 0, 0)) // martes 1 de septiembre
    const db = crearMockDb()
    const m = activo(db)
    const sesion = m.sesiones[0]
    db.microciclos.marcarParte(m.id, sesion.id, sesion.preparacion![0].id)
    expect(activo(db).sesiones[0].fecha).toBe('2026-09-01')

    // El jueves anota una serie que le faltaba del martes.
    vi.setSystemTime(new Date(2026, 8, 3, 10, 0, 0))
    const ejercicio = activo(db).sesiones[0].ejercicios[0]
    if (ejercicio) {
      db.microciclos.registrarSerie(m.id, ejercicio.id, { orden: 1, cargaKg: 40, reps: 10, rir: 2 })
    }
    db.microciclos.guardarTestPost(m.id, sesion.id, { prsEntrada: 7, rpeSesion: 8, duracionMin: 60 })

    expect(activo(db).sesiones[0].fecha).toBe('2026-09-01')
  })

  it('casa carácter a carácter con la fecha del check-in — que es para lo que existe', () => {
    const db = crearMockDb()
    const m = activo(db)
    const sesion = m.sesiones[0]
    db.microciclos.marcarParte(m.id, sesion.id, sesion.preparacion![0].id)
    db.bienestar.guardar({
      id: 'c-hoy',
      usuarioId: 'u-valentina',
      fecha: hoyIso(),
      horasSueno: 7,
      calidadSueno: 'BUENA',
      estres: 'POCO',
      cansancio: 'POCO',
      motivacion: 'MUCHO',
    })
    const checkin = db.bienestar.byUsuario('u-valentina').find((c) => c.id === 'c-hoy')!
    expect(activo(db).sesiones[0].fecha).toBe(checkin.fecha)
  })
})

/**
 * La fecha es LOCAL, y la trampa tiene hora exacta: en Bogotá (UTC−5) una sesión
 * de las ocho de la tarde cae ya en el día siguiente en Greenwich. Si esto se
 * calculara con `toISOString()`, la sesión del martes por la noche se emparejaría
 * con el check-in del miércoles.
 */
describe('hoyIso no se va a Greenwich', () => {
  it('a las 20:00 de Bogotá sigue siendo el mismo día', () => {
    // 2026-09-01 20:30 hora local. En UTC−5 eso es 2026-09-02T01:30Z.
    const nocheDelMartes = new Date(2026, 8, 1, 20, 30, 0)
    expect(hoyIso(nocheDelMartes)).toBe('2026-09-01')
  })
})
