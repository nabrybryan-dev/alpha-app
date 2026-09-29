import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DIAS_DE_VIGENCIA,
  ESTADOS_PREGUNTA,
  ESTADOS_REGLA,
  REFERENCIAS_MINIMAS,
  TIPOS_REFERENCIA,
  contactoEnTexto,
  normalizarUrl,
  preguntaVencida,
  referenciasQueCuentan,
  reglaEfectiva,
  urlValida,
} from './mercadeoManuela'

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0096_buzon_mercadeo.sql'), 'utf8')

const enumDe = (desde: string, hasta: string) => {
  const inicio = SQL.indexOf(desde)
  expect(inicio, `no se encontró «${desde}» en la 0096`).toBeGreaterThan(0)
  return [...SQL.slice(inicio, SQL.indexOf(hasta, inicio)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

describe('buzón de mercadeo: el vocabulario es el de la migración 0096', () => {
  it('estados de la regla, de la pregunta y tipos de referencia', () => {
    // El primero de cada bloque con `default` es el valor por defecto; el resto, la lista del check.
    expect(enumDe('regla_estado           text not null default', 'regla_codigo').slice(1)).toEqual([...ESTADOS_REGLA])
    expect(enumDe("estado                 text not null default 'pendiente'", 'respuesta              text').slice(1)).toEqual([
      ...ESTADOS_PREGUNTA,
    ])
    expect(enumDe('tipo             text not null check (tipo in', 'url              text')).toEqual([...TIPOS_REFERENCIA])
  })
  it('el mínimo de referencias y la vigencia son los que exige la base', () => {
    expect(SQL).toContain(`if v_n < ${REFERENCIAS_MINIMAS} then`)
    expect(SQL).toContain(`regla_vigente_desde + ${DIAS_DE_VIGENCIA}`)
  })
})

describe('enlaces', () => {
  it('solo https y sin espacios', () => {
    expect(urlValida('https://instagram.com/reel/abc')).toBe(true)
    expect(urlValida('http://instagram.com/reel/abc')).toBe(false)
    expect(urlValida('https://ins tagram.com')).toBe(false)
    expect(urlValida('instagram.com/reel')).toBe(false)
  })
  it('normaliza igual que la base: sin ?, #, barra final ni www., dominio en minúscula', () => {
    expect(normalizarUrl('https://www.Instagram.com/reel/AbC123/?igsh=xyz')).toBe('https://instagram.com/reel/AbC123')
    expect(normalizarUrl('https://instagram.com/p/GhI789/#uno')).toBe('https://instagram.com/p/GhI789')
  })
  it('cuenta enlaces DISTINTOS de los tipos que cuentan; el curso no cuenta', () => {
    expect(
      referenciasQueCuentan([
        { tipo: 'reel', urlNormalizada: 'https://a.com/1' },
        { tipo: 'reel', urlNormalizada: 'https://a.com/1' },
        { tipo: 'carrusel', urlNormalizada: 'https://a.com/2' },
        { tipo: 'curso', urlNormalizada: 'https://a.com/3' },
      ]),
    ).toBe(2)
  })
})

describe('la regla y la pregunta en el tiempo', () => {
  it('una vigente pasada de su fecha de revisión se ve caducada', () => {
    expect(reglaEfectiva('vigente', '2026-11-27', '2026-11-27')).toBe('vigente')
    expect(reglaEfectiva('vigente', '2026-11-27', '2026-11-28')).toBe('caducada')
    expect(reglaEfectiva('propuesta', null, '2030-01-01')).toBe('propuesta')
  })
  it('una pendiente que ya pasó su fecha está vencida', () => {
    expect(preguntaVencida('pendiente', '2026-10-01', '2026-10-01')).toBe(false)
    expect(preguntaVencida('pendiente', '2026-10-01', '2026-10-02')).toBe(true)
    expect(preguntaVencida('respondida', '2026-10-01', '2026-10-09')).toBe(false)
  })
  it('detecta contactos en el texto', () => {
    expect(contactoEnTexto('escribe a persona@ejemplo.test')).toContain('@')
    expect(contactoEnTexto('llámala al 300 123 4567')).toContain('teléfono')
    expect(contactoEnTexto('corta al segundo 1')).toBeNull()
  })
})
