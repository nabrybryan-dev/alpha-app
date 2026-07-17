import { describe, expect, it } from 'vitest'
import { calcularRacha, calcularXp, evaluarLogros, NIVELES, nivelDeXp } from './gamification'

describe('calcularRacha', () => {
  it('cuenta días consecutivos que terminan hoy', () => {
    expect(calcularRacha(['2026-07-11', '2026-07-12', '2026-07-13'], '2026-07-13')).toEqual({
      actual: 3,
      record: 3,
    })
  })

  it('la racha se rompe si el último registro es de antier o antes', () => {
    expect(calcularRacha(['2026-07-10', '2026-07-11'], '2026-07-13').actual).toBe(0)
  })

  it('el registro de ayer aún mantiene la racha viva', () => {
    expect(calcularRacha(['2026-07-11', '2026-07-12'], '2026-07-13').actual).toBe(2)
  })

  it('el récord recuerda la mejor racha histórica', () => {
    const fechas = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-12', '2026-07-13']
    const r = calcularRacha(fechas, '2026-07-13')
    expect(r.actual).toBe(2)
    expect(r.record).toBe(4)
  })

  it('sin fechas: racha cero', () => {
    expect(calcularRacha([], '2026-07-13')).toEqual({ actual: 0, record: 0 })
  })
})

describe('calcularXp', () => {
  it('10 por check-in, 20 por sesión, 10 por adherencia sí, 5 parcial, 15 por respuesta', () => {
    expect(
      calcularXp({ checkins: 3, sesiones: 2, adherenciasSi: 2, adherenciasParcial: 1, respuestas: 1 }),
    ).toBe(3 * 10 + 2 * 20 + 2 * 10 + 5 + 15)
  })
})

describe('nivelDeXp', () => {
  it('escala de niveles con identidad del método', () => {
    expect(NIVELES.map((n) => n.nombre)).toEqual([
      'Iniciado',
      'Constante',
      'Disciplinado',
      'Espartano',
      'Heracles',
    ])
    expect(nivelDeXp(0).nombre).toBe('Iniciado')
    expect(nivelDeXp(150).nombre).toBe('Constante')
    expect(nivelDeXp(399).nombre).toBe('Constante')
    expect(nivelDeXp(400).nombre).toBe('Disciplinado')
    expect(nivelDeXp(1500).nombre).toBe('Heracles')
    expect(nivelDeXp(99999).nombre).toBe('Heracles')
  })
})

describe('evaluarLogros', () => {
  it('desbloquea logros según los datos', () => {
    const logros = evaluarLogros({
      sesionesRegistradas: 1,
      diasCheckinConsecutivos: 7,
      microcicloCompleto: false,
      adherenciaPerfectaMicrociclo: false,
      cuestionariosPendientes: 0,
      semanasConstancia: 2,
    })
    const desbloqueados = logros.filter((l) => l.desbloqueado).map((l) => l.id)
    expect(desbloqueados).toContain('primera-sesion')
    expect(desbloqueados).toContain('semana-bienestar')
    expect(desbloqueados).toContain('cuestionarios-al-dia')
    expect(desbloqueados).not.toContain('microciclo-100')
    expect(desbloqueados).not.toContain('constancia-4-semanas')
  })

  it('todos los logros tienen título y criterio visibles', () => {
    const logros = evaluarLogros({
      sesionesRegistradas: 0,
      diasCheckinConsecutivos: 0,
      microcicloCompleto: false,
      adherenciaPerfectaMicrociclo: false,
      cuestionariosPendientes: 3,
      semanasConstancia: 0,
    })
    expect(logros).toHaveLength(6)
    logros.forEach((l) => {
      expect(l.titulo.length).toBeGreaterThan(3)
      expect(l.criterio.length).toBeGreaterThan(3)
    })
  })
})
