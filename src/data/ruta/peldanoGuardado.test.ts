import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from '../mockDb'

/**
 * El peldaño se GUARDA, no se recalcula al vuelo.
 *
 * Si se calculara en cada render, todo el mundo caeria al nivel 01 cada lunes:
 * uno de los requisitos es la consistencia -que porcentaje de las sesiones lleva
 * registradas- y al empezar el microciclo eso es 0%. Un nivel que sube y baja
 * cada semana no mide dominio, mide que dia es hoy.
 *
 * Y lo escribe el staff, no el asesorado: el trigger proteger_perfil de la 0008
 * solo le deja tocar sus medidas.
 */
describe('peldaño guardado en el perfil', () => {
  beforeEach(() => localStorage.clear())

  it('lo que se guarda es lo que se lee después', () => {
    const db = crearMockDb()
    db.perfiles.guardarPeldano('u-valentina', 4, '2026-08-02')
    expect(db.perfiles.byUsuario('u-valentina')?.peldanoAlfa).toBe(4)
  })

  it('deja anotado cuándo subió, para poder avisárselo', () => {
    const db = crearMockDb()
    db.perfiles.guardarPeldano('u-valentina', 4, '2026-08-02')
    expect(db.perfiles.byUsuario('u-valentina')?.ascensoIso).toBe('2026-08-02')
  })

  /** El aislamiento entre asesorados es la propiedad que ya se rompió dos veces. */
  it('no toca el perfil de nadie más', () => {
    const db = crearMockDb()
    db.perfiles.guardarPeldano('u-valentina', 5, '2026-08-02')
    db.perfiles.guardarPeldano('u-otro', 2, '2026-08-02')
    expect(db.perfiles.byUsuario('u-valentina')?.peldanoAlfa).toBe(5)
  })

  it('no se lleva por delante la valoración de técnica del coach', () => {
    const db = crearMockDb()
    db.perfiles.guardarValoracion('u-valentina', {
      id: 'tecnica',
      pct: 72,
      nota: 'Cadera atrás antes de bajar.',
      fecha: '2026-08-01',
    })
    db.perfiles.guardarPeldano('u-valentina', 4, '2026-08-02')
    const perfil = db.perfiles.byUsuario('u-valentina')
    expect(perfil?.peldanoAlfa).toBe(4)
    expect(perfil?.valoraciones?.find((v) => v.id === 'tecnica')?.pct).toBe(72)
  })
})
