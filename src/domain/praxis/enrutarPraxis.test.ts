import { describe, expect, it } from 'vitest'
import { decisionParaMeta, enrutarPraxis, normalizar, tipoDePregunta, type EntradaPraxis } from './enrutarPraxis'

/**
 * Contrato del enrutador de la Praxis única por reglas (F1, en sombra). Frases ficticias, sin datos de nadie.
 * Lo que no se puede romper: el riesgo gana a todo (también a la puerta), el enrutador nunca escribe, y cuando
 * las reglas no saben, la ruta es `null` y se dice a qué capa le toca; no se inventa.
 */
const coach = (frase: string, extra: Partial<EntradaPraxis> = {}): EntradaPraxis => ({ frase, rol: 'coach', personaId: 'p1', ...extra })

describe('paso 1 · seguridad antes que la puerta', () => {
  it.each(['solo quiero lastimarme', 'me dio un dolor en el pecho haciendo sentadilla'])('«%s» → seguridad/riesgo', (frase) => {
    expect(enrutarPraxis(coach(frase))).toMatchObject({ ruta: 'seguridad', subnivel: 'riesgo', paso: 1 })
  })
  it('lo clínico va por seguridad/salud', () => {
    expect(enrutarPraxis(coach('me duele la rodilla izquierda'))).toMatchObject({ ruta: 'seguridad', subnivel: 'salud' })
  })
  it('un asesorado sin acceso con una frase de riesgo NO queda bloqueado en silencio', () => {
    const d = enrutarPraxis({ frase: 'solo quiero lastimarme', rol: 'asesorado', personaId: 'p2' })
    expect(d.ruta).toBe('seguridad')
  })
  it('sin persona, el riesgo también sale por seguridad', () => {
    expect(enrutarPraxis({ frase: 'solo quiero lastimarme', rol: 'coach' }).ruta).toBe('seguridad')
  })
  it('el riesgo gana a la orden del salón y al registro rápido', () => {
    const d = enrutarPraxis(coach('me mareé en la última serie', { orden: { tipo: 'siguiente' }, registroRapido: true }))
    expect(d.ruta).toBe('seguridad')
  })
})

describe('paso 2 · la puerta es la de la app', () => {
  it('un asesorado con Praxis cerrada queda bloqueado', () => {
    expect(enrutarPraxis({ frase: 'cuanto descanso', rol: 'asesorado', personaId: 'p2' })).toMatchObject({ ruta: 'bloqueada', paso: 2 })
  })
  it('el asesorado que ocupa el puesto de coach entra', () => {
    expect(enrutarPraxis({ frase: 'cuanto descanso', rol: 'asesorado', personaId: 'p2', ocupaElPuesto: true }).ruta).not.toBe('bloqueada')
  })
  it('sin persona queda bloqueado y no arrastra un id vacío', () => {
    const d = enrutarPraxis({ frase: 'cuanto descanso', rol: 'coach', personaId: '  ' })
    expect(d.ruta).toBe('bloqueada')
    expect(d).not.toHaveProperty('personaId')
  })
})

describe('paso 3 · lo pendiente no se reclasifica', () => {
  it('la respuesta a una pregunta de salud sigue por seguridad', () => {
    expect(enrutarPraxis(coach('desde ayer', { aclaracionSalud: true }))).toMatchObject({ ruta: 'seguridad', subnivel: 'salud', paso: 3 })
  })
  it('con un borrador abierto, «80» es registrar y pide confirmar', () => {
    expect(enrutarPraxis(coach('80', { pendiente: 'borrador' }))).toMatchObject({ ruta: 'registrar', paso: 3, requiereConfirmacion: true })
  })
})

describe('paso 4 · órdenes del salón', () => {
  it('una zona navega a la zona', () => {
    expect(enrutarPraxis(coach('muestrame gluteos', { orden: { tipo: 'zona', id: 'glu' } }))).toMatchObject({
      ruta: 'navegar', paso: 4, destino: { clase: 'zona', id: 'glu' }, requiereConfirmacion: false,
    })
  })
  it('«cómo se hace» abre el movimiento y anota el hueco de método (decisión de Bryan, 4-nov)', () => {
    expect(enrutarPraxis(coach('como se hace la sentadilla', { orden: { tipo: 'movimiento' } }))).toMatchObject({
      ruta: 'navegar', destino: { clase: 'movimiento' }, tipo: 'metodo', hueco: 'metodo',
    })
  })
  it('«muéstrame el movimiento» navega sin anotar hueco: no es una pregunta', () => {
    const d = enrutarPraxis(coach('muestrame el movimiento', { orden: { tipo: 'movimiento' } }))
    expect(d.ruta).toBe('navegar')
    expect(d).not.toHaveProperty('hueco')
  })
  it('una orden ambigua aclara con las opciones', () => {
    expect(enrutarPraxis(coach('pierna', { orden: { tipo: 'cual', opciones: ['Cuádriceps', 'Isquios'] } }))).toMatchObject({
      ruta: 'aclarar', opciones: ['Cuádriceps', 'Isquios'],
    })
  })
  it('la salud que detecta el salón va por seguridad', () => {
    expect(enrutarPraxis(coach('algo raro', { orden: { tipo: 'salud' } })).ruta).toBe('seguridad')
  })
  it.each(['duda', 'no_entendi'])('«%s» no es una orden: sigue adelante', (tipo) => {
    expect(enrutarPraxis(coach('cuanto descanso entre series', { orden: { tipo } }))).toMatchObject({ ruta: null, paso: 6 })
  })
  it('fuera del salón (sin orden) «listo» no se vuelve «cerrar»', () => {
    expect(enrutarPraxis(coach('listo, hice 3 series')).ruta).not.toBe('navegar')
  })
})

describe('paso 5 · camino rápido', () => {
  it('un registro rápido propone tarjeta y nunca escribe', () => {
    const d = enrutarPraxis(coach('sentadilla 80 por 8', { registroRapido: true }))
    expect(d).toMatchObject({ ruta: 'registrar', paso: 5, requiereConfirmacion: true, escribe: false })
  })
})

describe('paso 6 · las reglas no cierran: dicen a quién le toca', () => {
  it('una pregunta pasa al portero con su tipo', () => {
    expect(enrutarPraxis(coach('¿cuánto descanso entre series?'))).toMatchObject({ ruta: null, paso: 6, pasaA: 'portero', tipo: 'cantidad' })
  })
  it('una frase que no pregunta pasa al registrador, sin tipo', () => {
    const d = enrutarPraxis(coach('hice mi sentadilla con 80'))
    expect(d).toMatchObject({ ruta: null, pasaA: 'registrador' })
    expect(d).not.toHaveProperty('tipo')
  })
  it('una pregunta sin tipo reconocible va al portero sin tipo', () => {
    const d = enrutarPraxis(coach('¿y lo de la otra vez?'))
    expect(d.pasaA).toBe('portero')
    expect(d).not.toHaveProperty('tipo')
  })
})

describe('tipo de pregunta', () => {
  it.each([
    ['por que se baja la carga', 'razon'],
    ['por que es mejor la barra', 'razon'],
    ['que es mejor, barra o mancuerna', 'comparacion'],
    ['como se hace el peso muerto', 'metodo'],
    ['cuando tomo la proteina', 'momento'],
    ['cada cuanto me peso', 'momento'],
    ['cuantas series hago', 'cantidad'],
    ['que es el rir', 'definicion'],
    ['puedo entrenar en ayunas', 'permiso'],
  ] as const)('«%s» → %s', (frase, tipo) => {
    expect(tipoDePregunta(normalizar(frase))).toBe(tipo)
  })
  it('«mi caso» solo dentro de algo que ya pregunta', () => {
    expect(tipoDePregunta(normalizar('hice mi rutina'))).toBeUndefined()
    expect(tipoDePregunta(normalizar('y en mi caso'), true)).toBe('mi_caso')
  })
})

describe('normalizar', () => {
  it('quita tildes, signos y el «hey Praxis» del principio', () => {
    expect(normalizar('Hey Praxis, ¿Cuánto descanso?')).toBe('cuanto descanso')
  })
})

describe('el enrutador nunca escribe', () => {
  it.each([
    coach('solo quiero lastimarme'),
    coach('80', { pendiente: 'borrador' }),
    coach('gluteos', { orden: { tipo: 'zona', id: 'glu' } }),
    coach('sentadilla 80 por 8', { registroRapido: true }),
    coach('¿cuánto descanso?'),
    { frase: 'hola', rol: 'asesorado' as const, personaId: 'p2' },
  ])('%#', (e) => {
    expect(enrutarPraxis(e).escribe).toBe(false)
  })
})

describe('decisionParaMeta · sin frase, sin persona, sin nombres', () => {
  it('deja solo la ruta, el paso y las etiquetas', () => {
    const d = enrutarPraxis(coach('como se hace el press', { orden: { tipo: 'ejercicio', nombre: 'Press banca' } }))
    const m = decisionParaMeta(d)
    expect(m).toEqual({ ruta: 'navegar', paso: 4, origen: 'reglas', tipo: 'metodo', hueco: 'metodo' })
    expect(JSON.stringify(m)).not.toMatch(/press|p1/i)
  })
})
