import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from './mockDb'
import type { MedicionVelocidad } from '../domain/medicionVelocidad'

function medicion(sobre: Partial<MedicionVelocidad> = {}): MedicionVelocidad {
  const base: MedicionVelocidad = {
    id: 'u-valentina:2026-08-20:remo:1',
    usuarioId: 'u-valentina',
    microcicloId: null,
    fecha: '2026-08-20',
    ejercicioId: 'remo',
    ejercicioNom: 'Remo',
    ordenSerie: 1,
    cargaKg: 20,
    repsMedidas: 8,
    vPrimera: 0.62,
    vUltima: 0.44,
    pvPct: 29.03,
    concMsMedia: 610,
    tipoVelocidad: 'VM',
    calidad: 'buena',
    motivosCalidad: [],
    versionAlgo: 'v1.0.0',
    captura: { fpsReal: 58.3 },
    reps: [{ n: 1, vMedia: 0.62 }],
  }
  return { ...base, ...sobre }
}

describe('mockDb · mediciones de velocidad', () => {
  beforeEach(() => localStorage.clear())

  it('guarda y devuelve la medicion de su dueño', () => {
    const db = crearMockDb()
    db.mediciones.guardar(medicion())
    expect(db.mediciones.byUsuario('u-valentina')).toHaveLength(1)
  })

  it('persiste entre instancias', () => {
    const db = crearMockDb()
    db.mediciones.guardar(medicion())
    expect(crearMockDb().mediciones.byUsuario('u-valentina')).toHaveLength(1)
  })

  it('NO deja ver la medicion de un asesorado a otro', () => {
    // El aislamiento entre asesorados es la propiedad mas importante de la app y
    // ya se rompio dos veces. Cada repositorio nuevo la vuelve a poner en juego,
    // asi que cada repositorio nuevo trae su prueba.
    const db = crearMockDb()
    db.mediciones.guardar(medicion())
    db.mediciones.guardar(medicion({
      id: 'u-otro:2026-08-20:remo:1', usuarioId: 'u-otro',
    }))

    const suyas = db.mediciones.byUsuario('u-valentina')
    expect(suyas).toHaveLength(1)
    expect(suyas.every((m) => m.usuarioId === 'u-valentina')).toBe(true)
  })

  it('volver a medir la misma serie REEMPLAZA, no acumula', () => {
    // El id se deriva de usuario + fecha + ejercicio + orden, igual que el
    // `unique` de la tabla. Si aqui se acumulara, el almacen local y la nube
    // dirian cosas distintas sobre la misma serie.
    const db = crearMockDb()
    db.mediciones.guardar(medicion({ calidad: 'descartada', motivosCalidad: ['sin_escala'], vPrimera: null }))
    db.mediciones.guardar(medicion({ vPrimera: 0.71 }))

    const suyas = db.mediciones.byUsuario('u-valentina')
    expect(suyas).toHaveLength(1)
    expect(suyas[0].calidad).toBe('buena')
    expect(suyas[0].vPrimera).toBe(0.71)
  })

  it('otra serie del mismo dia SI es otra fila', () => {
    const db = crearMockDb()
    db.mediciones.guardar(medicion())
    db.mediciones.guardar(medicion({ id: 'u-valentina:2026-08-20:remo:2', ordenSerie: 2 }))
    expect(db.mediciones.byUsuario('u-valentina')).toHaveLength(2)
  })

  it('guarda tambien las descartadas', () => {
    // Una fila descartada no es basura: es el registro de que el protocolo
    // fallo ahi. Sin ellas no se puede contar que falla mas.
    const db = crearMockDb()
    db.mediciones.guardar(medicion({
      calidad: 'descartada',
      motivosCalidad: ['marcador_perdido', 'sin_escala'],
      vPrimera: null, vUltima: null, pvPct: null, reps: [],
    }))
    const [m] = db.mediciones.byUsuario('u-valentina')
    expect(m.calidad).toBe('descartada')
    expect(m.motivosCalidad).toEqual(['marcador_perdido', 'sin_escala'])
  })
})
