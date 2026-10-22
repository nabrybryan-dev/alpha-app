import { describe, expect, it, vi } from 'vitest'
import { AREAS_A_ACLARAR, enrutar, PREGUNTA_ACLARAR, UMBRAL_CONFIANZA, type Dependencias } from './enrutador'

/**
 * Contrato del enrutador (decisiones de Bryan, 17-oct): mirar todo, mover con permiso;
 * solo el equipo; el riesgo va primero y gana. Estas pruebas se escribieron ANTES del código.
 * Frases ficticias, sin datos de nadie.
 */
function deps(over: Partial<Dependencias> = {}): Dependencias {
  return {
    leerRiesgo: vi.fn(() => 'ninguno' as const),
    detectarIntencion: vi.fn(() => ({ area: 'entrenar' as const, accion: 'explicar' as const, confianza: 0.9 })),
    ...over,
  }
}
const coach = { frase: 'frase de prueba', rol: 'coach' as const, personaId: 'p1' }

describe('enrutar · puerta', () => {
  it('un asesorado con el interruptor apagado queda bloqueado y no se mira su intencion', () => {
    const d = deps()
    const r = enrutar({ ...coach, rol: 'asesorado' }, d)
    expect(r.ruta).toBe('bloqueada')
    expect(d.detectarIntencion).not.toHaveBeenCalled()
  })
  it('el equipo pasa', () => {
    expect(enrutar(coach, deps()).ruta).not.toBe('bloqueada')
  })
})

describe('enrutar · el riesgo va ANTES que la puerta (Bryan, 17-oct)', () => {
  it.each(['riesgo', 'salud'] as const)('un asesorado bloqueado con una frase de %s recibe esa ruta, no «bloqueada»', (nivel) => {
    const d = deps({ leerRiesgo: vi.fn(() => nivel) })
    const r = enrutar({ ...coach, rol: 'asesorado' }, d)
    expect(r.ruta).toBe(nivel)
    expect(d.detectarIntencion).not.toHaveBeenCalled()
  })
  it('sin persona y con riesgo: ruta de riesgo, sin inventar una persona', () => {
    const r = enrutar({ ...coach, personaId: '' }, deps({ leerRiesgo: () => 'riesgo' }))
    expect(r.ruta).toBe('riesgo')
    expect(r.personaId).toBeUndefined()
  })
  it('sin riesgo, el bloqueo sigue funcionando', () => {
    expect(enrutar({ ...coach, rol: 'asesorado' }, deps()).ruta).toBe('bloqueada')
  })
  it('una aclaracion de salud no abre la puerta a quien no tiene permiso', () => {
    expect(enrutar({ ...coach, rol: 'asesorado', aclaracionSalud: true }, deps()).ruta).toBe('bloqueada')
  })
})

describe('enrutar · el riesgo va primero y gana', () => {
  it('riesgo: ruta de riesgo, sin intención, sin cambios', () => {
    const d = deps({ leerRiesgo: vi.fn(() => 'riesgo' as const) })
    const r = enrutar(coach, d)
    expect(r.ruta).toBe('riesgo')
    expect(d.detectarIntencion).not.toHaveBeenCalled()
    expect(r.requiereConfirmacion).toBe(false)
    expect(r.escribe).toBe(false)
  })
  it('salud (síntoma, urgencia): ruta de salud aparte, nunca el selector común', () => {
    const d = deps({ leerRiesgo: vi.fn(() => 'salud' as const) })
    expect(enrutar(coach, d).ruta).toBe('salud')
    expect(d.detectarIntencion).not.toHaveBeenCalled()
  })
  it('aunque la intención sea cambiar algo, si hay riesgo no se propone nada', () => {
    const d = deps({
      leerRiesgo: vi.fn(() => 'riesgo' as const),
      detectarIntencion: vi.fn(() => ({ area: 'entrenar' as const, accion: 'cambiar' as const, confianza: 0.99 })),
    })
    expect(enrutar(coach, d).ruta).toBe('riesgo')
  })
})

describe('enrutar · mirar todo, mover con permiso', () => {
  it.each(['entrenar', 'nutricion', 'plan', 'hoy', 'progreso', 'bienestar', 'relacion', 'avisos', 'chat'] as const)(
    'mirar en %s: L0, responde, sin confirmación',
    (area) => {
      const r = enrutar(coach, deps({ detectarIntencion: () => ({ area, accion: 'mirar', confianza: 0.9 }) }))
      expect(r).toMatchObject({ ruta: 'responder', area, nivel: 'L0', requiereConfirmacion: false, escribe: false })
    },
  )
  it('explicar: L1', () => {
    expect(enrutar(coach, deps()).nivel).toBe('L1')
  })
  it('cambiar en un área con escritura: propone (L2) y SIEMPRE pide confirmar; el enrutador no escribe', () => {
    const r = enrutar(coach, deps({ detectarIntencion: () => ({ area: 'entrenar', accion: 'cambiar', confianza: 0.9 }) }))
    expect(r).toMatchObject({ ruta: 'proponer', nivel: 'L2', requiereConfirmacion: true, escribe: false })
  })
  it('cambiar en un área SIN escritura hoy: se degrada a explicar, no propone', () => {
    const r = enrutar(coach, deps({ detectarIntencion: () => ({ area: 'progreso', accion: 'cambiar', confianza: 0.9 }) }))
    expect(r).toMatchObject({ ruta: 'responder', nivel: 'L1', requiereConfirmacion: false })
  })
  it('confianza bajo el umbral: nunca propone un cambio', () => {
    const r = enrutar(
      coach,
      deps({ detectarIntencion: () => ({ area: 'entrenar', accion: 'cambiar', confianza: UMBRAL_CONFIANZA - 0.01 }) }),
    )
    expect(r.ruta).not.toBe('proponer')
    expect(r.requiereConfirmacion).toBe(false)
  })
})

describe('enrutar · limites', () => {
  it('justo en el umbral SI propone (>=, no >)', () => {
    const r = enrutar(coach, deps({ detectarIntencion: () => ({ area: 'entrenar', accion: 'cambiar', confianza: UMBRAL_CONFIANZA }) }))
    expect(r.ruta).toBe('proponer')
  })
  it.each(['plan', 'hoy', 'progreso', 'bienestar', 'relacion', 'avisos', 'chat'] as const)('cambiar en %s (sin escritura hoy) no propone', (area) => {
    const r = enrutar(coach, deps({ detectarIntencion: () => ({ area, accion: 'cambiar', confianza: 0.99 }) }))
    expect(r.ruta).toBe('responder')
    expect(r.requiereConfirmacion).toBe(false)
  })
  it('una aclaracion de salud sigue por salud aunque la frase no tenga marca, como decidirTurno', () => {
    const d = deps()
    expect(enrutar({ ...coach, aclaracionSalud: true }, d).ruta).toBe('salud')
    expect(d.detectarIntencion).not.toHaveBeenCalled()
  })
  it('el riesgo gana a la aclaracion de salud', () => {
    expect(enrutar({ ...coach, aclaracionSalud: true }, deps({ leerRiesgo: () => 'riesgo' })).ruta).toBe('riesgo')
  })
})

describe('enrutar · aislamiento', () => {
  it('la decisión lleva la persona de la conversación y ninguna otra', () => {
    expect(enrutar({ ...coach, personaId: 'p7' }, deps()).personaId).toBe('p7')
  })
  it.each(['', '   '])('sin persona («%s») no hay ruta de datos: queda bloqueada', (personaId) => {
    expect(enrutar({ ...coach, personaId }, deps()).ruta).toBe('bloqueada')
  })
})

describe('enrutar · aclarar cuando no se sabe de qué área habla (Bryan, 21-oct: 9 de 30 frases son ambiguas)', () => {
  const baja = (accion: 'mirar' | 'explicar' | 'cambiar') =>
    deps({ detectarIntencion: () => ({ area: 'chat', accion, confianza: UMBRAL_CONFIANZA - 0.01 }) })

  it.each(['mirar', 'explicar', 'cambiar'] as const)('confianza bajo el umbral con «%s»: ruta aclarar, sin área, sin escribir ni confirmar', (accion) => {
    const r = enrutar(coach, baja(accion))
    expect(r).toMatchObject({ ruta: 'aclarar', escribe: false, requiereConfirmacion: false, personaId: 'p1' })
    expect(r.area).toBeUndefined()
    expect(r.nivel).toBeUndefined()
  })
  it('justo en el umbral NO aclara (>=, como proponer)', () => {
    const r = enrutar(coach, deps({ detectarIntencion: () => ({ area: 'entrenar', accion: 'explicar', confianza: UMBRAL_CONFIANZA }) }))
    expect(r.ruta).toBe('responder')
  })
  it('el riesgo gana a aclarar: una frase de riesgo o de salud nunca se pierde en una repregunta', () => {
    expect(enrutar(coach, { ...baja('explicar'), leerRiesgo: () => 'riesgo' }).ruta).toBe('riesgo')
    expect(enrutar(coach, { ...baja('explicar'), leerRiesgo: () => 'salud' }).ruta).toBe('salud')
  })
  it('la puerta gana a aclarar: un asesorado bloqueado no recibe repregunta', () => {
    expect(enrutar({ ...coach, rol: 'asesorado' }, baja('explicar')).ruta).toBe('bloqueada')
  })
  it('una aclaracion de salud sigue por salud, no por aclarar', () => {
    expect(enrutar({ ...coach, aclaracionSalud: true }, baja('explicar')).ruta).toBe('salud')
  })
  it('ofrece las cuatro áreas de Bryan: entrenar, nutricion, bienestar (hábitos) y relacion (consigo mismo)', () => {
    expect([...AREAS_A_ACLARAR]).toEqual(['entrenar', 'nutricion', 'bienestar', 'relacion'])
  })
  it.each(['tu', 'usted'] as const)('la pregunta (%s) es una sola, corta y nombra las cuatro áreas', (trato) => {
    const q = PREGUNTA_ACLARAR[trato]
    expect(q.length).toBeLessThanOrEqual(280)
    expect(q.match(/\?/g)).toHaveLength(1)
    expect(q).toMatch(/entren/i)
    expect(q).toMatch(/comida/i)
    expect(q).toMatch(/hábitos/i)
    expect(q).toMatch(/mism[oa]/i)
  })
  it('la pregunta de «tu» no usa «usted» y la de «usted» no usa «tu»', () => {
    expect(PREGUNTA_ACLARAR.tu).not.toMatch(/\b(usted|su|sus)\b/i)
    expect(PREGUNTA_ACLARAR.usted).not.toMatch(/\b(tu|tus|te)\b/i)
  })
})

describe('enrutar · revisión ciega del 21-oct (hallazgos 6 y 8)', () => {
  it.each([Number.NaN, undefined as unknown as number])('una confianza no válida (%s) aclara: nunca responde sobre un área dudosa', (confianza) => {
    const r = enrutar(coach, deps({ detectarIntencion: () => ({ area: 'entrenar', accion: 'cambiar', confianza }) }))
    expect(r.ruta).toBe('aclarar')
    expect(r.requiereConfirmacion).toBe(false)
  })
  it('el interruptor explícito manda: un asesorado pasa solo con abiertaAAsesorados en true y se bloquea con false', () => {
    expect(enrutar({ ...coach, rol: 'asesorado', abiertaAAsesorados: true }, deps()).ruta).not.toBe('bloqueada')
    expect(enrutar({ ...coach, rol: 'asesorado', abiertaAAsesorados: false }, deps()).ruta).toBe('bloqueada')
  })
})
