import { describe, expect, it } from 'vitest'
import EJEMPLO from './consolaCoach/guion-llamada-v1.fixture.json'
import {
  TOPE_BYTES,
  esFechaReal,
  igualesSeguro,
  revisionDe,
  validarCuerpo,
} from '../../supabase/functions/guion-llamada/validar.ts'

// La validación de la Edge Function guion-llamada (módulo puro, sin Deno), contra la forma de
// guion-llamada-v1. Fixture y UUID inventados.
const USUARIO = '00000000-0000-4000-8000-0000000000a1'
const REVISION_EJEMPLO = Date.parse('2026-10-30T15:00:00.000Z')

function cuerpo(guion: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ usuario_id: USUARIO, guion: { ...EJEMPLO, ...guion }, ...extra })
}

function error(texto: string): string | null {
  const r = validarCuerpo(texto)
  return r.ok ? null : r.error
}

describe('guion-llamada · validarCuerpo', () => {
  it('acepta el ejemplo y deriva revisión, día y franja', () => {
    const r = validarCuerpo(cuerpo())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valor).toMatchObject({ usuarioId: USUARIO, revision: REVISION_EJEMPLO, diaPreferido: '2026-11-05', franjaPreferida: 'tarde' })
    // El guion se guarda tal cual, contacto incluido (lo lee solo la consola, por RLS).
    expect(r.valor.guion).toEqual(EJEMPLO)
  })

  it('el mismo guion reenviado da la misma revisión; uno rehecho, una mayor', () => {
    const a = validarCuerpo(cuerpo())
    const b = validarCuerpo(cuerpo())
    const rehecho = validarCuerpo(cuerpo({ generado_en: '2026-10-31T09:30:00.000Z' }))
    expect(a.ok && b.ok && a.valor.revision === b.valor.revision).toBe(true)
    expect(rehecho.ok && a.ok && rehecho.valor.revision > a.valor.revision).toBe(true)
  })

  it('normaliza el UUID a minúsculas y guarda claves nuevas del guion', () => {
    const r = validarCuerpo(JSON.stringify({ usuario_id: USUARIO.toUpperCase(), guion: { ...EJEMPLO, campo_nuevo: 1 } }))
    expect(r.ok && r.valor.usuarioId).toBe(USUARIO)
    expect(r.ok && r.valor.guion.campo_nuevo).toBe(1)
  })

  it('rechaza una versión que no conoce (el esquema lo pide) y un generado_en sin zona', () => {
    expect(error(cuerpo({ version: 'guion-llamada-v2' }))).toBe('version no soportada')
    expect(error(cuerpo({ version: 1 }))).toBe('version no soportada')
    expect(error(cuerpo({ generado_en: 'ayer' }))).toBe('generado_en invalido')
    expect(error(cuerpo({ generado_en: '2026-10-30T15:00:00' }))).toBe('generado_en invalido')
    expect(error(cuerpo({ generado_en: undefined }))).toBe('generado_en invalido')
  })

  it('rechaza claves de más en el cuerpo, sin repetir texto libre', () => {
    expect(error(cuerpo({}, { dia_preferido: '2026-11-05' }))).toBe('campo no esperado: dia_preferido')
    expect(error(cuerpo({}, { 'Persona Ficticia': 1 }))).toBe('campo no esperado')
  })

  it('rechaza JSON roto, cuerpos que no son objeto y usuario_id inválido', () => {
    expect(error('{')).toBe('json invalido')
    expect(error('[]')).toBe('cuerpo invalido')
    expect(error(JSON.stringify({ usuario_id: 'abc', guion: EJEMPLO }))).toBe('usuario_id invalido')
    expect(error(JSON.stringify({ usuario_id: USUARIO, guion: [] }))).toBe('guion invalido')
  })

  it.each([
    ['reserva', { reserva: undefined }],
    ['reserva', { reserva: { ...EJEMPLO.reserva, fecha: '2026-02-31' } }],
    ['reserva', { reserva: { ...EJEMPLO.reserva, hora: '3 pm' } }],
    ['reserva', { reserva: { ...EJEMPLO.reserva, zona: 'UTC' } }],
    ['persona', { persona: 'x' }],
    ['persona', { persona: { ...EJEMPLO.persona, edad: '31' } }],
    ['alerta_salud', { alerta_salud: 'Hipertensión' }],
    ['alerta_salud', { alerta_salud: { hay: true, requiere_aval: 'si', menor_de_edad: false } }],
    ['origen', { origen: 'otro' }],
    ['apertura', { apertura: 3 }],
    ['dolores', { dolores: ['texto suelto'] }],
    ['que_mostrar', { que_mostrar: [{ tema: 'pasos', titulo: 'T', como_decirlo: 'C' }] }],
    ['objeciones_probables', { objeciones_probables: [{ objecion: 'a', respuesta: 'b' }] }],
    ['avisos', { avisos: [1] }],
    ['recomendaciones_praxis', { recomendaciones_praxis: 'una' }],
  ])('rechaza %s mal formado y dice cuál', (campo, cambio) => {
    expect(error(cuerpo(cambio as Record<string, unknown>))).toBe(`campo mal formado: ${campo}`)
  })

  it('acepta temas y tipos nuevos (texto cualquiera) y hora nula', () => {
    expect(
      error(
        cuerpo({
          reserva: { ...EJEMPLO.reserva, hora: null },
          que_mostrar: [{ tema: 'tema_nuevo', titulo: 'T', dato: null, como_decirlo: 'C' }],
          objeciones_probables: [{ tipo: 'tipo_nuevo', objecion: 'a', respuesta: 'b' }],
        }),
      ),
    ).toBeNull()
  })

  it('corta por tamaño en BYTES antes de parsear', () => {
    expect(error(cuerpo({ apertura: 'a'.repeat(TOPE_BYTES) }))).toBe('cuerpo demasiado grande')
    const tildes = 'á'.repeat(Math.ceil(TOPE_BYTES / 2) + 10)
    expect(tildes.length).toBeLessThan(TOPE_BYTES)
    expect(error(cuerpo({ apertura: tildes }))).toBe('cuerpo demasiado grande')
    expect(error('x'.repeat(TOPE_BYTES + 1))).toBe('cuerpo demasiado grande')
  })

  it('ningún error repite contenido ni contacto', () => {
    const r = validarCuerpo(cuerpo({ persona: { ...EJEMPLO.persona, edad: 'treinta' }, apertura: 'dato-sensible' }))
    expect(r.ok).toBe(false)
    for (const fuga of ['persona.ficticia@ejemplo.test', '+57 300', 'Persona Ficticia', 'dato-sensible']) {
      expect(JSON.stringify(r)).not.toContain(fuga)
    }
  })
})

describe('guion-llamada · revisionDe, esFechaReal e igualesSeguro', () => {
  it('la revisión son los milisegundos de un ISO con zona', () => {
    expect(revisionDe('2026-10-30T15:00:00.000Z')).toBe(REVISION_EJEMPLO)
    expect(revisionDe('2026-10-30T10:00:00-05:00')).toBe(REVISION_EJEMPLO)
    expect(revisionDe('2026-10-30')).toBeNull()
    expect(revisionDe(1)).toBeNull()
  })

  it('distingue fechas reales de las que solo tienen la forma', () => {
    expect(esFechaReal('2028-02-29')).toBe(true)
    expect(esFechaReal('2026-02-29')).toBe(false)
  })

  it('compara claves sin aceptar la vacía', () => {
    expect(igualesSeguro('clave', 'clave')).toBe(true)
    expect(igualesSeguro('clave', 'clavE')).toBe(false)
    expect(igualesSeguro('', '')).toBe(false)
  })
})
