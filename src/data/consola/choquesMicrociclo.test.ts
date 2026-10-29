import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: true,
  tabla: { data: [] as unknown, error: null as { message: string; code?: string } | null },
  rpc: { error: null as { message: string; code?: string } | null },
  llamadasRpc: [] as { fn: string; args: unknown }[],
  tablasPedidas: [] as string[],
}

vi.mock('../supabase', () => {
  const consulta = () => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) q[m] = () => q
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(estado.tabla).then(ok, ko)
    return q
  }
  return {
    get modoNube() {
      return estado.activo
    },
    supabase: () => ({
      from: (tabla: string) => {
        estado.tablasPedidas.push(tabla)
        return consulta()
      },
      rpc: (fn: string, args: unknown) => {
        estado.llamadasRpc.push({ fn, args })
        return Promise.resolve(estado.rpc)
      },
    }),
  }
})

const { choquesPendientes, confirmarPisar, descartarChoque, textoChoque } = await import('./choquesMicrociclo')

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0147_candado_de_microciclos.sql'), 'utf8')

const fila = (p: Record<string, unknown> = {}) => ({
  id: 'c-1', usuario_id: 'u-1', propuesta_id: 'm-10', propuesta_numero: 9, propuesta_origen: 'app',
  existente_id: 'm-9', existente_numero: 9, existente_origen: 'cadena',
  existente_en: '2026-10-27T13:05:00Z', existente_por: null, creado_en: '2026-10-28T09:00:00Z', ...p,
})

beforeEach(() => {
  estado.activo = true
  estado.tabla = { data: [], error: null }
  estado.rpc = { error: null }
  estado.llamadasRpc = []
  estado.tablasPedidas = []
})

describe('choquesPendientes', () => {
  it('en modo demo no pregunta a nadie', async () => {
    estado.activo = false
    expect(await choquesPendientes()).toEqual({ ok: true, choques: [] })
    expect(estado.tablasPedidas).toEqual([])
  })

  it('traduce la fila: quién la cargó y cuándo', async () => {
    estado.tabla = { data: [fila()], error: null }
    const r = await choquesPendientes()
    expect(estado.tablasPedidas).toEqual(['microciclos_choques'])
    expect(r).toEqual({
      ok: true,
      choques: [{
        id: 'c-1', usuarioId: 'u-1', propuestaId: 'm-10', propuestaNumero: 9, propuestaOrigen: 'app',
        existenteNumero: 9, existenteOrigen: 'cadena', existenteEn: '2026-10-27T13:05:00Z',
      }],
    })
  })

  it('un fallo es ok:false, nunca una lista vacía', async () => {
    estado.tabla = { data: null, error: { message: 'x', code: '42P01' } }
    expect((await choquesPendientes()).ok).toBe(false)
  })
})

describe('las dos decisiones del coach', () => {
  it('confirmar llama a la función de confirmación con la propuesta', async () => {
    expect(await confirmarPisar('m-10')).toEqual({ ok: true })
    expect(estado.llamadasRpc).toEqual([{ fn: 'confirmar_pisar_microciclo', args: { p_propuesta_id: 'm-10' } }])
  })

  it('descartar llama a la función de descarte con el aviso', async () => {
    expect(await descartarChoque('c-1')).toEqual({ ok: true })
    expect(estado.llamadasRpc).toEqual([{ fn: 'descartar_choque_microciclo', args: { p_choque_id: 'c-1' } }])
  })

  it('un error de la base se devuelve, no se traga', async () => {
    estado.rpc = { error: { message: 'no', code: '42501' } }
    expect((await confirmarPisar('m-10')).ok).toBe(false)
  })
})

describe('textoChoque', () => {
  it('dice quién la cargó, cuándo, y que no se hizo nada', () => {
    const t = textoChoque(
      { id: 'c-1', usuarioId: 'u-1', propuestaId: 'm-10', propuestaNumero: 9, existenteNumero: 9, existenteOrigen: 'cadena', existenteEn: '2026-10-27T13:05:00Z' },
      'Persona de prueba',
    )
    expect(t).toContain('Persona de prueba')
    expect(t).toContain('la cadena de agentes')
    expect(t).toContain('M9')
    expect(t).toContain('2026-10-27')
    expect(t).toMatch(/no se (activ|pis)/i)
  })
})

describe('la migración 0147 y este archivo dicen lo mismo', () => {
  it('existen las dos funciones que se llaman y la tabla que se lee', () => {
    expect(SQL).toContain('function public.confirmar_pisar_microciclo(p_propuesta_id text)')
    expect(SQL).toContain('function public.descartar_choque_microciclo(p_choque_id uuid)')
    expect(SQL).toContain('create table if not exists public.microciclos_choques')
  })
})

/**
 * Pruebas ESTRUCTURALES del SQL (no hay Postgres aquí: el comportamiento lo prueba
 * `supabase/test/216-candado-de-microciclos.sql` en el CI). Cada comprobador se prueba también contra
 * una copia MUTADA del SQL, para que se vea que detecta la regresión que dice detectar.
 */
const LEER = (...ruta: string[]) => readFileSync(join(process.cwd(), ...ruta), 'utf8')
const PLANTILLA = LEER('supabase', 'plantilla-carga-microciclo.sql')
const COMPROBAR = LEER('supabase', 'comprobar-migraciones.sql')
const PRUEBA_216 = LEER('supabase', 'test', '216-candado-de-microciclos.sql')

/** Funciones normales (no trigger) de la migración. */
function funcionesLlamables(sql: string): string[] {
  const re = /create or replace function public\.(\w+)\(([^)]*)\)\s*returns\s+(\w+)/gi
  return [...sql.matchAll(re)].filter((m) => m[3].toLowerCase() !== 'trigger').map((m) => m[1])
}

/** Las que NO tienen un `revoke all on function ... from public, anon`. */
function sinRevokeDeAnon(sql: string): string[] {
  return funcionesLlamables(sql).filter((nombre) => {
    const re = new RegExp(`revoke all on function public\\.${nombre}\\([^)]*\\)\\s+from\\s+public,\\s*anon`, 'i')
    return !re.test(sql)
  })
}

function triggersEnOrden(sql: string): { nombre: string; momento: string }[] {
  const re = /create trigger (\w+)\s+(before|after)\s/gi
  return [...sql.matchAll(re)].map((m) => ({ nombre: m[1], momento: m[2].toLowerCase() }))
}

function cuerpoDe(sql: string, funcion: string): string {
  const i = sql.indexOf(`function public.${funcion}(`)
  const j = sql.indexOf('$$;', i)
  return sql.slice(i, j)
}

describe('0147: estructura que no puede perderse', () => {
  it('H2: TODAS las funciones llamables de la 0147 hacen revoke a anon', () => {
    expect(funcionesLlamables(SQL)).toEqual(
      expect.arrayContaining([
        'microciclo_choque',
        'registrar_choque_microciclo',
        'activar_microciclo',
        'confirmar_pisar_microciclo',
        'descartar_choque_microciclo',
        'decidir_primer_plan',
        'vencer_primer_plan',
      ]),
    )
    expect(sinRevokeDeAnon(SQL)).toEqual([])
  })

  it('H2: el comprobador SÍ detecta que a descartar_choque_microciclo le falte anon', () => {
    const mutada = SQL.replace(
      'revoke all on function public.descartar_choque_microciclo(uuid) from public, anon;',
      'revoke all on function public.descartar_choque_microciclo(uuid) from public;',
    )
    expect(mutada).not.toBe(SQL)
    expect(sinRevokeDeAnon(mutada)).toEqual(['descartar_choque_microciclo'])
  })

  it('H1: la regla cuenta los microciclos activos Y cerrados', () => {
    expect(cuerpoDe(SQL, 'microciclo_choque')).toMatch(/estado in \('activo', 'cerrado'\)/)
    const mutada = SQL.replace("m.estado in ('activo', 'cerrado')", "m.estado = 'activo'")
    expect(mutada).not.toBe(SQL)
    expect(cuerpoDe(mutada, 'microciclo_choque')).not.toMatch(/'cerrado'/)
  })

  it('H4: el trigger de origen se dispara antes que el candado y el aviso va después (orden alfabético)', () => {
    const t = triggersEnOrden(SQL)
    const alfabetico = t.map((x) => x.nombre).sort()
    expect(alfabetico).toEqual([
      'trg_microciclos_a_origen',
      'trg_microciclos_b_candado',
      'trg_microciclos_c_registrar_choque',
    ])
    // Los dos primeros son BEFORE; el que registra el aviso es AFTER (la fila ya existe).
    expect(t.find((x) => x.nombre === 'trg_microciclos_a_origen')?.momento).toBe('before')
    expect(t.find((x) => x.nombre === 'trg_microciclos_b_candado')?.momento).toBe('before')
    expect(t.find((x) => x.nombre === 'trg_microciclos_c_registrar_choque')?.momento).toBe('after')
  })

  it('H3: el candado no lanza excepción (se perdería el aviso) y registra con un trigger AFTER', () => {
    expect(cuerpoDe(SQL, 'microciclos_candado')).not.toMatch(/raise exception/i)
    expect(cuerpoDe(SQL, 'microciclos_registrar_choque')).toContain('registrar_choque_microciclo(new.id)')
  })

  it('H7: confirmar_pisar_microciclo comprueba que la propuesta quedó activa ANTES de marcar confirmado', () => {
    const c = cuerpoDe(SQL, 'confirmar_pisar_microciclo')
    expect(c.indexOf('no quedó activa')).toBeGreaterThan(-1)
    expect(c.indexOf('no quedó activa')).toBeLessThan(c.indexOf("set estado = 'confirmado'"))
  })

  it('(b): decidir y vencer_primer_plan mandan el choque a espera_bryan, no a aprobado', () => {
    const d = cuerpoDe(SQL, 'decidir_primer_plan')
    expect(d.indexOf('activar_microciclo')).toBeLessThan(d.indexOf("estado = 'aprobado'"))
    expect(d).toContain("estado = 'espera_bryan'")
    const v = cuerpoDe(SQL, 'vencer_primer_plan')
    expect(v.indexOf('activar_microciclo')).toBeLessThan(v.indexOf("estado = 'vencido_aprobado'"))
    expect(v).toContain("v_estado_mc = 'activo'")
  })

  it('la plantilla de la cadena comprueba el choque ANTES de cerrar el activo, y avisa en vez de fallar', () => {
    const choque = PLANTILLA.indexOf('microciclo_choque(v_uid')
    const cierre = PLANTILLA.indexOf("set estado = 'cerrado'", choque)
    expect(choque).toBeGreaterThan(-1)
    expect(cierre).toBeGreaterThan(choque)
    expect(PLANTILLA).toContain("'CHOQUE · '")
  })

  it('comprobar-migraciones vigila el revoke de anon de TODAS las funciones y el orden de los triggers', () => {
    const fila = COMPROBAR.slice(COMPROBAR.indexOf("select '0147 - candado de microciclos"))
    for (const f of [
      'descartar_choque_microciclo(uuid)',
      'registrar_choque_microciclo(text)',
      'confirmar_pisar_microciclo(text)',
      'microciclo_choque(uuid,text,integer,text)',
      'activar_microciclo(text)',
    ]) {
      expect(fila).toContain(`has_function_privilege('anon', 'public.${f}', 'execute')`)
    }
    expect(fila).toContain('trg_microciclos_a_origen')
    expect(fila).toContain('trg_microciclos_b_candado')
    expect(fila).toContain("not like '%''cerrado''%'")
  })

  it('la prueba 216 cubre cada punto: orden, registro del choque, cerrado, (b), confirmar sin activar y anon', () => {
    for (const marca of [
      'trg_microciclos_a_origen',
      "propuesta_origen = 'cadena'",
      'YA CERRADA',
      'decidir_primer_plan',
      'vencer_primer_plan',
      'no quedó activa',
      "has_function_privilege('anon', 'public.descartar_choque_microciclo(uuid)'",
      'set role anon',
    ]) {
      expect(PRUEBA_216).toContain(marca)
    }
  })
})
