import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: true,
  lectura: { data: [] as unknown, error: null as { message: string } | null },
  escritura: { data: [{ id: 'x' }] as unknown, error: null as { message: string } | null },
  llamadas: [] as { operacion: string; args: unknown; filtros: unknown[] }[],
  lanza: false,
}

vi.mock('../supabase', () => {
  const consulta = () => {
    const q: Record<string, unknown> = {}
    let operacion = 'select'
    let args: unknown = null
    const filtros: unknown[] = []
    q.select = (cols: unknown) => {
      if (operacion === 'select') args = cols
      return q
    }
    q.insert = (v: unknown) => {
      operacion = 'insert'
      args = v
      return q
    }
    q.update = (v: unknown) => {
      operacion = 'update'
      args = v
      return q
    }
    for (const m of ['order', 'limit']) q[m] = () => q
    q.eq = (c: unknown, v: unknown) => {
      filtros.push([c, v])
      return q
    }
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
      estado.llamadas.push({ operacion, args, filtros })
      if (estado.lanza) return Promise.reject(new Error('red caída')).then(ok, ko)
      return Promise.resolve(operacion === 'select' ? estado.lectura : estado.escritura).then(ok, ko)
    }
    return q
  }
  return {
    get modoNube() {
      return estado.activo
    },
    supabase: () => ({ from: () => consulta() }),
  }
})

const {
  COLUMNAS_EDITABLES,
  COLUMNAS_PLAN_ITEMS,
  aItemPlan,
  crearTarea,
  descartarTarea,
  empezarTarea,
  moverTarea,
  planItems,
  terminarTarea,
} = await import('./planItems')

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0098_plan_items.sql'), 'utf8')

function columnasDeLaTabla(): string[] {
  const inicio = SQL.indexOf('create table if not exists public.plan_items (')
  expect(inicio, 'la 0098 no crea plan_items').toBeGreaterThan(0)
  return SQL.slice(inicio, SQL.indexOf('\n);\n', inicio))
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+\s/.test(l) && !/^(unique|constraint|check)\b/.test(l))
    .map((l) => l.split(/\s+/)[0])
}

const fila = {
  id: 'p-1',
  nivel: 'tarea',
  padre_id: 'h-1',
  titulo: 'Filtrar etapa2',
  primer_paso: 'abrir el tablero',
  dueno: 'bryan',
  palanca: 'A',
  fecha: '2026-09-30',
  estimado_min: 30,
  prioridad: 'principal',
  estado: 'pendiente',
  iniciada_en: null,
  hecha_en: null,
  veces_movida: 0,
  origen: null,
  actualizado_en: '2026-09-30T08:00:00Z',
}

beforeEach(() => {
  estado.activo = true
  estado.lectura = { data: [], error: null }
  estado.escritura = { data: [{ id: 'x' }], error: null }
  estado.llamadas = []
  estado.lanza = false
})

describe('las columnas salen de la migración 0098', () => {
  it('todas las que se leen existen en la tabla', () => {
    const enLaTabla = columnasDeLaTabla()
    for (const c of COLUMNAS_PLAN_ITEMS) expect(enLaTabla, `«${c}» no es columna de plan_items`).toContain(c)
  })

  it('las editables coinciden con el `grant update` de la base y no incluyen nivel, padre ni dueño', () => {
    const grant = SQL.slice(SQL.indexOf('grant update ('), SQL.indexOf('on public.plan_items to authenticated', SQL.indexOf('grant update (')))
    const enElSql = [...grant.matchAll(/\b([a-z_]+)\b/g)].map((m) => m[1]).filter((w) => (COLUMNAS_PLAN_ITEMS as readonly string[]).includes(w))
    expect([...enElSql].sort()).toEqual([...COLUMNAS_EDITABLES].sort())
    for (const c of ['nivel', 'padre_id', 'dueno', 'origen']) expect(COLUMNAS_EDITABLES).not.toContain(c)
  })

  it('el navegador no puede borrar: la migración no concede delete a authenticated', () => {
    expect(SQL).not.toMatch(/grant[^;]*delete[^;]*to authenticated/i)
    expect(SQL).toContain('revoke all on public.plan_items from anon, authenticated, public')
  })
})

describe('aItemPlan', () => {
  it('acomoda la fila', () => {
    expect(aItemPlan(fila)).toMatchObject({ id: 'p-1', nivel: 'tarea', estimadoMin: 30, prioridad: 'principal', dueno: 'bryan' })
  })
  it('un valor desconocido no se acomoda en silencio', () => {
    expect(aItemPlan({ ...fila, estado: 'rara' })).toBeNull()
    expect(aItemPlan({ ...fila, dueno: 'otro' })).toBeNull()
    expect(aItemPlan({ ...fila, palanca: 'Z' })).toBeNull()
  })
})

describe('planItems', () => {
  it('en modo demo no consulta y el vacío es confirmado', async () => {
    estado.activo = false
    await expect(planItems()).resolves.toEqual({ ok: true, datos: [] })
    expect(estado.llamadas).toHaveLength(0)
  })
  it('devuelve las filas acomodadas', async () => {
    estado.lectura = { data: [fila], error: null }
    const r = await planItems()
    expect(r.ok && r.datos).toHaveLength(1)
  })
  it('un error de la base es un error, no una lista vacía', async () => {
    estado.lectura = { data: null, error: { message: 'permission denied' } }
    expect(await planItems()).toEqual({ ok: false, error: 'permission denied' })
  })
  it('una fila con un valor desconocido hace fallar la lectura entera', async () => {
    estado.lectura = { data: [fila, { ...fila, id: 'p-2', estado: 'rara' }], error: null }
    const r = await planItems()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('1 filas')
  })
  it('una red caída no lanza', async () => {
    estado.lanza = true
    expect(await planItems()).toEqual({ ok: false, error: 'red caída' })
  })
})

describe('escrituras', () => {
  it('crearTarea manda el dueño y las columnas de la tabla, y devuelve el id', async () => {
    estado.escritura = { data: [{ id: 'nuevo' }], error: null }
    const r = await crearTarea({
      padreId: 'h-1',
      titulo: ' Llamar ',
      primerPaso: ' abrir la lista ',
      dueno: 'manuela',
      fecha: '2026-10-01',
      estimadoMin: 20,
      prioridad: 'pequena',
    })
    expect(r).toEqual({ ok: true, id: 'nuevo' })
    const args = estado.llamadas[0].args as Record<string, unknown>
    expect(args).toMatchObject({ nivel: 'tarea', titulo: 'Llamar', primer_paso: 'abrir la lista', dueno: 'manuela' })
    const enLaTabla = columnasDeLaTabla()
    for (const k of Object.keys(args)) expect(enLaTabla).toContain(k)
  })

  it('si la base rechaza la tarea, lo dice', async () => {
    estado.escritura = { data: null, error: { message: 'máximo 3 tareas por día' } }
    const r = await crearTarea({ padreId: 'h', titulo: 'x', primerPaso: 'y', dueno: 'bryan', fecha: null, estimadoMin: 10, prioridad: 'pequena' })
    expect(r).toEqual({ ok: false, error: 'máximo 3 tareas por día' })
  })

  it('empezar, terminar, mover y descartar cambian solo columnas editables', async () => {
    await empezarTarea('p-1', '2026-09-30T09:00:00Z')
    await terminarTarea('p-1', '2026-09-30T09:30:00Z')
    await moverTarea('p-1', '2026-10-01', 1)
    await descartarTarea('p-1')
    expect(estado.llamadas.map((l) => l.operacion)).toEqual(['update', 'update', 'update', 'update'])
    expect(estado.llamadas[0].args).toEqual({ estado: 'en_curso', iniciada_en: '2026-09-30T09:00:00Z' })
    expect(estado.llamadas[1].args).toEqual({ estado: 'hecha', hecha_en: '2026-09-30T09:30:00Z' })
    expect(estado.llamadas[2].args).toMatchObject({ fecha: '2026-10-01', veces_movida: 2, estado: 'pendiente' })
    for (const l of estado.llamadas) {
      for (const k of Object.keys(l.args as object)) expect(COLUMNAS_EDITABLES as readonly string[]).toContain(k)
      expect(l.filtros).toEqual([['id', 'p-1']])
    }
  })

  it('cero filas cambiadas (RLS: no es tuya) NO es un éxito', async () => {
    estado.escritura = { data: [], error: null }
    const r = await terminarTarea('p-9')
    expect(r.ok).toBe(false)
  })

  it('sin la nube no simula guardar', async () => {
    estado.activo = false
    expect((await terminarTarea('p-1')).ok).toBe(false)
    expect(estado.llamadas).toHaveLength(0)
  })
})
