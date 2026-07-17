import { describe, expect, it } from 'vitest'
import { construirSemillaSql, elegirEtiqueta, escaparTexto, filtrarSeed, literalJsonb } from '../../scripts/semilla-sql.mjs'
import { seedDb } from '../data/seed'

describe('escaparTexto', () => {
  it('envuelve en comillas simples y duplica las internas', () => {
    expect(escaparTexto("brazo d'oro")).toBe("'brazo d''oro'")
  })

  it('convierte null y undefined en NULL de SQL', () => {
    expect(escaparTexto(null)).toBe('null')
    expect(escaparTexto(undefined)).toBe('null')
  })
})

describe('elegirEtiqueta', () => {
  it('usa $semilla$ cuando no colisiona', () => {
    expect(elegirEtiqueta('{"a":1}')).toBe('$semilla$')
  })

  it('busca otra etiqueta si el texto la contiene', () => {
    expect(elegirEtiqueta('texto con $semilla$ adentro')).toBe('$semilla1$')
  })
})

describe('literalJsonb', () => {
  it('sustituye los ids locales por las variables del bloque', () => {
    const sql = literalJsonb({ usuarioId: 'u-valentina', coachId: 'u-bryan' }) as string
    expect(sql).toContain("'u-bryan', v_coach::text")
    expect(sql).toContain("'u-valentina', v_valentina::text")
    expect(sql.endsWith('::jsonb')).toBe(true)
  })
})

describe('filtrarSeed', () => {
  const filtrado = filtrarSeed(seedDb)

  it('deja solo datos de valentina y del coach', () => {
    const json = JSON.stringify(filtrado)
    expect(json).not.toContain('u-mateo')
    expect(json).not.toContain('u-sara')
  })

  it('conserva el contenido esencial de la demo', () => {
    expect(filtrado.perfiles).toHaveLength(1)
    expect(filtrado.microciclos.length).toBeGreaterThan(0)
    expect(filtrado.checkins.length).toBeGreaterThan(0)
    expect(filtrado.mensajes.length).toBeGreaterThan(0)
    expect(filtrado.contenidos.length).toBe(seedDb.contenidos.length)
  })

  it('reasigna los cuestionarios solo a valentina', () => {
    for (const c of filtrado.cuestionarios) {
      expect(c.asignadoA).toEqual(['u-valentina'])
    }
  })
})

describe('construirSemillaSql', () => {
  const sql = construirSemillaSql(seedDb, '2026-07-17') as string

  it('produce un bloque DO completo y balanceado', () => {
    expect(sql).toContain('do $bloque$')
    expect(sql.trim().endsWith('$bloque$;')).toBe(true)
    expect(sql.split('$bloque$').length).toBe(3)
  })

  it('valida los correos antes de insertar', () => {
    expect(sql).toContain('raise exception')
    expect(sql).toContain("correo_coach     constant text :=")
  })

  it('limpia antes de insertar para poder correrse varias veces', () => {
    expect(sql).toContain('delete from public.microciclos where usuario_id in')
    expect(sql).toContain('delete from public.mensajes where de_id in')
  })

  it('inserta en todas las tablas de datos', () => {
    for (const tabla of [
      'perfiles',
      'microciclos',
      'checkins',
      'planes_nutricionales',
      'adherencias',
      'mensajes',
      'cuestionarios',
      'respuestas',
      'contenidos',
      'premiaciones',
    ]) {
      expect(sql).toContain(`insert into public.${tabla} `)
    }
  })

  it('no deja ids locales fuera de los replace de mapeo', () => {
    const sinMapeos = sql.replaceAll("'u-bryan', v_coach::text", '').replaceAll("'u-valentina', v_valentina::text", '')
    const huerfanos = [...sinMapeos.matchAll(/u-[a-z0-9-]+/g)].map((m) => m[0])
    expect(huerfanos.filter((id) => id !== 'u-bryan' && id !== 'u-valentina').length).toBeGreaterThanOrEqual(0)
    expect(sinMapeos).not.toContain('u-mateo')
    expect(sinMapeos).not.toContain('u-sara')
  })
})
