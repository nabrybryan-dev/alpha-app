import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from './mockDb'

describe('mockDb', () => {
  beforeEach(() => localStorage.clear())

  it('carga el seed la primera vez', () => {
    const db = crearMockDb()
    expect(db.usuarios.list().length).toBeGreaterThanOrEqual(4)
  })

  it('persiste una serie registrada entre instancias', () => {
    const db = crearMockDb()
    const m22 = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
    if (!m22) throw new Error('no hay microciclo activo en el seed')
    const ejercicio = m22.sesiones[1].ejercicios[0]
    db.microciclos.registrarSerie(m22.id, ejercicio.id, { orden: 1, cargaKg: 40, reps: 8, rir: 2 })

    const db2 = crearMockDb()
    const m22b = db2.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
    if (!m22b) throw new Error('no hay microciclo activo persistido')
    expect(m22b.sesiones[1].ejercicios[0].series).toHaveLength(1)
  })

  it('guarda y lee check-ins del día', () => {
    const db = crearMockDb()
    db.bienestar.guardar({ id: 'c1', usuarioId: 'u-valentina', fecha: '2026-07-14', estres: 'POCO' })
    expect(db.bienestar.byUsuario('u-valentina').some((c) => c.fecha === '2026-07-14')).toBe(true)
  })

  it('sobrescribe el check-in del mismo día en vez de duplicarlo', () => {
    const db = crearMockDb()
    db.bienestar.guardar({ id: 'c1', usuarioId: 'u-valentina', fecha: '2026-07-14', estres: 'POCO' })
    db.bienestar.guardar({ id: 'c2', usuarioId: 'u-valentina', fecha: '2026-07-14', estres: 'MUCHO' })
    const delDia = db.bienestar.byUsuario('u-valentina').filter((c) => c.fecha === '2026-07-14')
    expect(delDia).toHaveLength(1)
    expect(delDia[0].estres).toBe('MUCHO')
  })

  it('marca adherencia nutricional y la actualiza si ya existe', () => {
    const db = crearMockDb()
    db.nutricion.marcarAdherencia('u-valentina', '2026-07-14', 'parcial', 'viaje')
    db.nutricion.marcarAdherencia('u-valentina', '2026-07-14', 'si')
    const delDia = db.nutricion
      .adherenciasByUsuario('u-valentina')
      .filter((a) => a.fecha === '2026-07-14')
    expect(delDia).toHaveLength(1)
    expect(delDia[0].estado).toBe('si')
  })

  it('envía mensajes y marca leídos', () => {
    const db = crearMockDb()
    db.mensajes.enviar({ deId: 'u-valentina', paraId: 'u-bryan', texto: 'hola coach' })
    const hilo = db.mensajes.hilo('u-valentina', 'u-bryan')
    expect(hilo[hilo.length - 1].texto).toBe('hola coach')
    db.mensajes.marcarLeidos('u-valentina', 'u-bryan')
    expect(db.mensajes.noLeidosPara('u-valentina')).toBe(0)
  })

  it('responde cuestionarios', () => {
    const db = crearMockDb()
    db.cuestionarios.responder('q-dolor-articular', 'u-valentina', { p1: 'No' })
    const r = db.cuestionarios.respuestasDe('u-valentina')
    expect(r.some((x) => x.cuestionarioId === 'q-dolor-articular')).toBe(true)
  })

  it('guarda test post-sesión', () => {
    const db = crearMockDb()
    const m22 = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
    if (!m22) throw new Error('no hay microciclo activo')
    const sesion = m22.sesiones[1]
    db.microciclos.guardarTestPost(m22.id, sesion.id, { duracionMin: 120, rpeSesion: 8, prsEntrada: 7 })
    const m22b = crearMockDb().microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
    expect(m22b?.sesiones[1].testPost?.rpeSesion).toBe(8)
  })
})
