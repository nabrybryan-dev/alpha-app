import { describe, expect, it } from 'vitest'
import {
  TOPE_BYTES,
  VERSION_MAXIMA,
  esFechaReal,
  igualesSeguro,
  validarCuerpo,
} from '../../supabase/functions/guion-llamada/validar.ts'

// La validación de la Edge Function guion-llamada (módulo puro, sin Deno). UUID inventado.
const USUARIO = '00000000-0000-4000-8000-0000000000a1'

function cuerpo(extra: Record<string, unknown> = {}, guion: Record<string, unknown> = {}): string {
  return JSON.stringify({
    usuario_id: USUARIO,
    guion: { version: 1, apertura: 'Hola', dolores: ['Tiempo'], ...guion },
    ...extra,
  })
}

function error(texto: string): string | null {
  const r = validarCuerpo(texto)
  return r.ok ? null : r.error
}

describe('guion-llamada · validarCuerpo', () => {
  it('acepta el cuerpo mínimo y deja la preferencia en null', () => {
    const r = validarCuerpo(cuerpo())
    expect(r).toEqual({
      ok: true,
      valor: {
        usuarioId: USUARIO,
        guion: { version: 1, apertura: 'Hola', dolores: ['Tiempo'] },
        version: 1,
        diaPreferido: null,
        franjaPreferida: null,
      },
    })
  })

  it('acepta día y franja válidos', () => {
    const r = validarCuerpo(cuerpo({ dia_preferido: '2026-11-05', franja_preferida: 'tarde' }))
    expect(r.ok && r.valor.diaPreferido).toBe('2026-11-05')
    expect(r.ok && r.valor.franjaPreferida).toBe('tarde')
  })

  it('normaliza el UUID a minúsculas (la base lo compara así en el upsert)', () => {
    const r = validarCuerpo(JSON.stringify({ usuario_id: USUARIO.toUpperCase(), guion: { version: 1 } }))
    expect(r.ok && r.valor.usuarioId).toBe(USUARIO)
  })

  it('guarda las claves desconocidas DEL GUION (compatibilidad hacia adelante)', () => {
    const r = validarCuerpo(cuerpo({}, { campo_nuevo: { a: 1 } }))
    expect(r.ok && r.valor.guion.campo_nuevo).toEqual({ a: 1 })
  })

  it('rechaza claves desconocidas DEL CUERPO, sin repetir texto libre', () => {
    expect(error(cuerpo({ email: 'x' }))).toBe('campo no esperado: email')
    expect(error(cuerpo({ 'Juan Pérez': 1 }))).toBe('campo no esperado')
  })

  it('rechaza JSON roto, cuerpos que no son objeto y usuario_id inválido', () => {
    expect(error('{')).toBe('json invalido')
    expect(error('[]')).toBe('cuerpo invalido')
    expect(error('null')).toBe('cuerpo invalido')
    expect(error(JSON.stringify({ usuario_id: 'abc', guion: { version: 1 } }))).toBe('usuario_id invalido')
    expect(error(JSON.stringify({ guion: { version: 1 } }))).toBe('usuario_id invalido')
  })

  it('exige guion objeto con versión entera positiva', () => {
    expect(error(JSON.stringify({ usuario_id: USUARIO, guion: 'x' }))).toBe('guion invalido')
    expect(error(JSON.stringify({ usuario_id: USUARIO, guion: [] }))).toBe('guion invalido')
    for (const version of [undefined, 0, -1, 1.5, '2', VERSION_MAXIMA + 1, Number.NaN]) {
      expect(error(JSON.stringify({ usuario_id: USUARIO, guion: { version } })), String(version)).toBe('version invalida')
    }
  })

  it('rechaza campos conocidos con forma equivocada y dice cuál', () => {
    expect(error(cuerpo({}, { apertura: 3 }))).toBe('campo mal formado: apertura')
    expect(error(cuerpo({}, { dolores: 'uno' }))).toBe('campo mal formado: dolores')
    expect(error(cuerpo({}, { avisos: [1] }))).toBe('campo mal formado: avisos')
    expect(error(cuerpo({}, { persona: 'x' }))).toBe('campo mal formado: persona')
    expect(error(cuerpo({}, { alerta_salud: 3 }))).toBe('campo mal formado: alerta_salud')
    expect(error(cuerpo({}, { objeciones_probables: [{ objecion: 'a' }] }))).toBe('campo mal formado: objeciones_probables')
  })

  it('acepta null en los campos conocidos y la alerta como texto, booleano u objeto', () => {
    expect(error(cuerpo({}, { apertura: null, dolores: null, persona: null }))).toBeNull()
    for (const alerta_salud of ['Embarazo', true, false, null, { motivo: 'x' }]) {
      expect(error(cuerpo({}, { alerta_salud }))).toBeNull()
    }
  })

  it('rechaza días inexistentes y franjas inventadas', () => {
    expect(error(cuerpo({ dia_preferido: '2026-02-31' }))).toBe('dia_preferido invalido')
    expect(error(cuerpo({ dia_preferido: '5 de noviembre' }))).toBe('dia_preferido invalido')
    expect(error(cuerpo({ dia_preferido: 20261105 }))).toBe('dia_preferido invalido')
    expect(error(cuerpo({ franja_preferida: 'madrugada' }))).toBe('franja_preferida invalida')
    expect(error(cuerpo({ dia_preferido: null, franja_preferida: null }))).toBeNull()
  })

  it('corta por tamaño en BYTES antes de parsear', () => {
    const relleno = 'a'.repeat(TOPE_BYTES)
    expect(error(cuerpo({}, { apertura: relleno }))).toBe('cuerpo demasiado grande')
    // Con multibyte: menos caracteres que el tope, más bytes.
    const tildes = 'á'.repeat(Math.ceil(TOPE_BYTES / 2) + 10)
    expect(tildes.length).toBeLessThan(TOPE_BYTES)
    expect(error(cuerpo({}, { apertura: tildes }))).toBe('cuerpo demasiado grande')
    // Y el texto que no es JSON también se mide primero.
    expect(error('x'.repeat(TOPE_BYTES + 1))).toBe('cuerpo demasiado grande')
  })

  it('ningún error repite el contenido del guion', () => {
    const r = validarCuerpo(cuerpo({ franja_preferida: 'Persona Inventada' }, { apertura: 'dato-sensible' }))
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('Persona Inventada')
    expect(JSON.stringify(r)).not.toContain('dato-sensible')
  })
})

describe('guion-llamada · esFechaReal e igualesSeguro', () => {
  it('distingue fechas reales de las que solo tienen la forma', () => {
    expect(esFechaReal('2028-02-29')).toBe(true)
    expect(esFechaReal('2026-02-29')).toBe(false)
    expect(esFechaReal('2026-13-01')).toBe(false)
  })

  it('compara claves sin aceptar la vacía', () => {
    expect(igualesSeguro('clave', 'clave')).toBe(true)
    expect(igualesSeguro('clave', 'clavE')).toBe(false)
    expect(igualesSeguro('clave', 'clave2')).toBe(false)
    expect(igualesSeguro('', '')).toBe(false)
  })
})
