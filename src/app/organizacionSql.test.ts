import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAPACIDADES } from '../data/consola/capacidadesStaff'
import { piezasDePantallas, piezasPara } from './catalogoDePiezas'
import { decidirParaPieza } from './organizacionPraxis'
import { escondePesoOMedidas } from './tarjetaDeOrganizacion'

/**
 * La migración 0179 valida en el servidor qué se puede esconder y organizar. La base no puede leer el catálogo (vive en
 * TypeScript), así que lleva una COPIA de las listas entre `-- INICIO LISTAS GENERADAS` y `-- FIN LISTAS GENERADAS`.
 * Esta prueba las mantiene iguales al catálogo y a las reglas de `decidirParaPieza` (la misma regla que ve el teléfono).
 * Regenerar: `GENERAR_SQL=1 npx vitest run src/app/organizacionSql.test.ts` (y una migración nueva si la 0179 ya se aplicó).
 */
const RUTA = 'supabase/migrations/0179_praxis_organizacion.sql'
const INICIO = '-- INICIO LISTAS GENERADAS'
const FIN = '-- FIN LISTAS GENERADAS'

// Todo lo que alguien puede nombrar: las piezas y pantallas de un asesorado y las pantallas del equipo (que nunca se esconden).
const ASESORADO = { rol: 'asesorado' as const, capacidades: new Set<never>() }
const EQUIPO = { rol: 'coach' as const, capacidades: new Set(CAPACIDADES) }
const TODAS = [...new Map([...piezasPara(ASESORADO), ...piezasDePantallas(EQUIPO)].map((p) => [p.id, p])).values()]
const vacio = { ocultas: new Set<string>(), hayCambiosParaDeshacer: false }
const ordenadas = (ids: string[]) => [...new Set(ids)].sort()

const OCULTABLES = ordenadas(TODAS.filter((p) => decidirParaPieza('ocultar', p, vacio).tipo === 'propone').map((p) => p.id))
const ORGANIZABLES = ordenadas(TODAS.filter((p) => decidirParaPieza('fijar', p, vacio).tipo === 'propone').map((p) => p.id))
const DE_PESO = ordenadas(TODAS.filter((p) => escondePesoOMedidas(p)).map((p) => p.id))

const sqlLista = (ids: string[]) => `array[\n    ${ids.map((i) => `'${i.replace(/'/g, "''")}'`).join(',\n    ')}\n  ]::text[]`
const funcion = (nombre: string, ids: string[]) => `create or replace function public.${nombre}(p_id text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_id = any(${sqlLista(ids)});
$$;`

function generar(): string {
  return [
    INICIO,
    '-- GENERADO por src/app/organizacionSql.test.ts desde el catálogo: no se edita a mano.',
    funcion('praxis_organizacion_es_ocultable', OCULTABLES),
    '',
    funcion('praxis_organizacion_es_organizable', ORGANIZABLES),
    '',
    funcion('praxis_organizacion_esconde_peso', DE_PESO),
    FIN,
  ].join('\n')
}

function bloqueActual(sql: string): string {
  const i = sql.indexOf(INICIO), f = sql.indexOf(FIN)
  return i < 0 || f < 0 ? '' : sql.slice(i, f + FIN.length)
}

describe('listas del catálogo dentro de la migración 0179', () => {
  it('son la copia exacta del catálogo y de las reglas del teléfono', () => {
    const sql = readFileSync(RUTA, 'utf8').replace(/\r\n/g, '\n')
    if (process.env.GENERAR_SQL === '1') writeFileSync(RUTA, sql.replace(bloqueActual(sql), () => generar()))
    expect(bloqueActual(readFileSync(RUTA, 'utf8').replace(/\r\n/g, '\n'))).toBe(generar())
  })

  it('lo fijo, lo asignado, lo del equipo y el núcleo de la barra nunca entran en lo que se esconde', () => {
    for (const p of TODAS) {
      if (p.nivel !== 'libre') expect(OCULTABLES, p.id).not.toContain(p.id)
    }
    expect(ORGANIZABLES).not.toContain('pantalla:/')
    expect(OCULTABLES.some((id) => id.startsWith('pantalla:'))).toBe(true)
    expect(OCULTABLES.length).toBeGreaterThan(5)
  })

  it('peso y medidas están en la lista que avisa al coach', () => {
    expect(DE_PESO).toEqual(expect.arrayContaining(['progreso.medidas', 'bienestar.medidas']))
  })
})
