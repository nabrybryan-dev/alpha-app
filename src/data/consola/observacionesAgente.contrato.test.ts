import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COLUMNAS_OBSERVACIONES_AGENTE,
  RPC_FIRMAR_OBSERVACION,
  TABLA_OBSERVACIONES_AGENTE,
} from './observacionesAgente'

/**
 * Lo que este archivo pide a la base, contra lo que la migración 0115 crea.
 *
 * POR QUÉ EXISTE. `observacionesAgente.test.ts` dobla a Supabase, así que acepta cualquier nombre de
 * columna o de función: una columna mal escrita aquí daría un `select` roto en producción con todas las
 * pruebas en verde (es lo que pasó con la 0112, ver `notasLlamada.contrato.test.ts`). Esta prueba lee el
 * archivo de la migración de verdad. Además fija lo que la regla del dueño necesita que la base haga: el
 * CHECK del carril, la función de firma con sus tres parámetros y los permisos.
 */
const SQL = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '0115_observaciones_agente.sql'),
  'utf8',
)

/** Quita los comentarios `-- …`: el texto de un comentario no es esquema. */
function sinComentarios(sql: string): string {
  return sql
    .split('\n')
    .map((linea) => linea.replace(/--.*$/, ''))
    .join('\n')
}

const LIMPIO = sinComentarios(SQL)

/**
 * Las columnas del `create table`: las líneas que empiezan con un nombre, fuera de todo paréntesis.
 * Los `check (…)` y los `constraint` ocupan varias líneas y sus continuaciones («or (estado <> …») se
 * parecen a una columna; contar paréntesis las deja fuera.
 */
function columnasDelCreateTable(tabla: string): string[] {
  const inicio = LIMPIO.indexOf(`create table if not exists public.${tabla} (`)
  expect(inicio, `la 0115 no crea ${tabla}`).toBeGreaterThanOrEqual(0)
  const cuerpo = LIMPIO.slice(inicio, LIMPIO.indexOf('\n);', inicio)).split('\n').slice(1)
  const columnas: string[] = []
  let profundidad = 0
  for (const linea of cuerpo) {
    const texto = linea.trim()
    if (profundidad === 0 && /^[a-z_]+\s/.test(texto) && !/^(unique|constraint|check|primary|foreign)\b/.test(texto)) {
      columnas.push(texto.split(/\s+/)[0])
    }
    profundidad += (texto.match(/\(/g) ?? []).length - (texto.match(/\)/g) ?? []).length
  }
  return columnas
}

describe('observaciones del agente · las columnas del código son las de la 0115', () => {
  const enLaBase = columnasDelCreateTable(TABLA_OBSERVACIONES_AGENTE)

  it('el lector de la migración ve las columnas (si no ve ninguna, lo de abajo no prueba nada)', () => {
    expect(enLaBase).toEqual([
      'id',
      'usuario_id',
      'creado_en',
      'tema',
      'carril',
      'titulo',
      'texto',
      'fuentes',
      'agente',
      'corrida_id',
      'estado',
      'firmada_por',
      'firmada_en',
      'nota_de_firma',
    ])
  })

  it('cada columna que el código pide existe en la tabla', () => {
    for (const columna of COLUMNAS_OBSERVACIONES_AGENTE) {
      expect(enLaBase, `el código pide «${columna}» y la migración no la crea`).toContain(columna)
    }
  })

  it('y no queda ninguna columna de la tabla sin leer', () => {
    expect([...COLUMNAS_OBSERVACIONES_AGENTE].sort()).toEqual([...enLaBase].sort())
  })
})

describe('observaciones del agente · la regla del dueño vive en la base', () => {
  it('un CHECK manda seguridad y prescripción al carril para_firma', () => {
    expect(LIMPIO).toMatch(
      /check\s*\(\s*tema not in \('seguridad', 'prescripcion'\) or carril = 'para_firma'\s*\)/,
    )
  })

  it('una observación sin fuentes no entra: arreglo no vacío', () => {
    expect(LIMPIO).toContain("jsonb_typeof(fuentes) = 'array'")
    expect(LIMPIO).toContain('jsonb_array_length(fuentes) > 0')
  })

  it('los temas, carriles y estados de la tabla son los que el código conoce', () => {
    for (const tema of ['nota_de_llamada', 'prescripcion', 'estilo_de_vida', 'seguridad', 'nutricion']) {
      expect(LIMPIO).toContain(`'${tema}'`)
    }
    expect(LIMPIO).toContain("check (carril in ('anotada', 'para_firma'))")
    expect(LIMPIO).toContain("check (estado in ('pendiente', 'aceptada', 'descartada'))")
  })
})

describe('observaciones del agente · la firma es la función, con estos parámetros', () => {
  it('la función se llama como el código la llama y recibe p_id, p_decision y p_nota', () => {
    expect(LIMPIO).toContain(`create or replace function public.${RPC_FIRMAR_OBSERVACION}(`)
    const inicio = LIMPIO.indexOf(`function public.${RPC_FIRMAR_OBSERVACION}(`)
    const firma = LIMPIO.slice(inicio, LIMPIO.indexOf(')', inicio))
    expect(firma).toMatch(/p_id\s+uuid/)
    expect(firma).toMatch(/p_decision\s+text/)
    expect(firma).toMatch(/p_nota\s+text default null/)
  })

  it('es security definer con search_path fijo, exige la puerta de la consola y no es de anon', () => {
    expect(LIMPIO).toContain('security definer')
    expect(LIMPIO).toContain('set search_path = public')
    const inicio = LIMPIO.indexOf(`function public.${RPC_FIRMAR_OBSERVACION}(`)
    const cuerpo = LIMPIO.slice(inicio)
    expect(cuerpo).toContain("public.es_coach() or public.tiene_capacidad('leer_entrenamiento')")
    expect(LIMPIO).toContain(`revoke all on function public.${RPC_FIRMAR_OBSERVACION}(uuid, text, text) from public, anon;`)
    expect(LIMPIO).toContain(
      `grant execute on function public.${RPC_FIRMAR_OBSERVACION}(uuid, text, text) to authenticated, service_role;`,
    )
  })
})

describe('observaciones del agente · la puerta es la de la consola y nadie con sesión escribe', () => {
  it('la política de lectura abre por es_coach() o leer_entrenamiento, solo a authenticated', () => {
    const inicio = LIMPIO.indexOf('create policy observaciones_agente_leer')
    expect(inicio).toBeGreaterThanOrEqual(0)
    const cuerpo = LIMPIO.slice(inicio, LIMPIO.indexOf(';', inicio))
    expect(cuerpo).toContain('for select to authenticated')
    expect(cuerpo).toContain('public.es_coach()')
    expect(cuerpo).toContain("public.tiene_capacidad('leer_entrenamiento')")
  })

  it('no hay otra política, y authenticated solo recibe select', () => {
    expect(LIMPIO.match(/create policy/g)).toHaveLength(1)
    expect(LIMPIO).toContain('revoke all on public.observaciones_agente from anon, public;')
    expect(LIMPIO).toContain('revoke all on public.observaciones_agente from authenticated;')
    expect(LIMPIO).toContain('grant select on public.observaciones_agente to authenticated;')
    expect(LIMPIO).toContain('grant all on public.observaciones_agente to service_role;')
    expect(LIMPIO).not.toMatch(/grant[^;]*\b(insert|update|delete|truncate|all)\b[^;]*to authenticated/)
  })
})
