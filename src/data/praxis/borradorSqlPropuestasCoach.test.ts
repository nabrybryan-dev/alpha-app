import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOTIVOS_RECHAZO, ORIGENES_CONTACTO, TEMAS_CONTACTO } from '../../domain/praxis/propuestaCoach'
import { MAX_PENDIENTES_POR_PERSONA, TABLA_PROPUESTAS_COACH } from './propuestasCoach'

/**
 * El borrador SQL del canal «proponer al coach» es TEXTO: no es una migración, no tiene número y no está
 * aplicada. Estas pruebas leen el texto y vigilan lo que la RLS y el esquema tienen que cumplir.
 */
const RAIZ = process.cwd()
const RUTA = join(RAIZ, 'supabase', 'borradores', 'praxis_propuestas_coach.sql')
const sql = existsSync(RUTA) ? readFileSync(RUTA, 'utf8') : ''
/** El SQL sin comentarios de línea, para no confundir un comentario con una instrucción. */
const codigo = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')

describe('el borrador es un borrador', () => {
  it('existe en supabase/borradores/', () => expect(existsSync(RUTA)).toBe(true))

  it('dice en su encabezado que no está aplicada y que la numera y aplica Bryan', () => {
    expect(sql.slice(0, 600)).toContain('BORRADOR, NO ESTÁ APLICADA, la numera y aplica Bryan')
  })

  it('no hay ninguna copia en supabase/migrations ni con número', () => {
    const migraciones = readdirSync(join(RAIZ, 'supabase', 'migrations'))
    expect(migraciones.filter((n) => n.includes('propuestas_coach'))).toEqual([])
  })
})

describe('esquema', () => {
  it('crea la tabla con el nombre que usa el repositorio', () => {
    expect(codigo).toContain(`create table if not exists public.${TABLA_PROPUESTAS_COACH}`)
  })

  it('RLS se activa en el mismo paso que el create table (antes de cualquier otro create)', () => {
    const iCrear = codigo.indexOf('create table')
    const iRls = codigo.indexOf(`alter table public.${TABLA_PROPUESTAS_COACH} enable row level security`)
    expect(iRls).toBeGreaterThan(iCrear)
    expect(codigo.slice(iCrear, iRls)).not.toMatch(/create (or replace )?(function|policy|trigger)/)
  })

  it('todo corre dentro de una transacción', () => {
    expect(codigo).toMatch(/^\s*begin;/m)
    expect(codigo).toMatch(/^\s*commit;/m)
  })

  it('revoca a anon y public, y a authenticated antes de dar los grants justos', () => {
    expect(codigo).toMatch(/revoke all on public\.praxis_propuestas_coach from anon, public;/)
    expect(codigo).toMatch(/revoke all on public\.praxis_propuestas_coach from authenticated;/)
    expect(codigo).not.toMatch(/grant\s[^;]*\bto\b[^;]*\b(anon|public)\b(?!\.)/i)
  })

  it('no hay NINGUNA columna de texto libre: toda columna text lleva un check de lista cerrada o patrón', () => {
    const cuerpo = codigo.slice(codigo.indexOf('create table'), codigo.indexOf(');', codigo.indexOf('create table')))
    const columnasText = cuerpo.split('\n').filter((l) => /^\s+[a-z_]+\s+text\b/.test(l))
    expect(columnasText.length).toBeGreaterThan(5)
    for (const l of columnasText) expect(l, l).toMatch(/check\s*\(/)
  })

  it('no hay varchar ni columnas con nombre de texto (frase, texto, comentario, nota, mensaje)', () => {
    expect(codigo).not.toMatch(/\bvarchar\b|character varying/i)
    expect(codigo).not.toMatch(/^\s+(frase|texto|comentario|nota|notas|mensaje|descripcion|observacion)\w*\s/m)
  })

  it('las listas cerradas del SQL son las del dominio', () => {
    for (const v of [...TEMAS_CONTACTO, ...ORIGENES_CONTACTO, ...MOTIVOS_RECHAZO, 'bajar_carga', 'voy_a_escribirte', 'pendiente', 'aceptada', 'ajustada', 'rechazada', 'atendida']) {
      expect(codigo, v).toContain(`'${v}'`)
    }
  })

  it('el motivo «dolor» no entra a la tabla y la regla firmada no puede ser true', () => {
    expect(codigo).toMatch(/motivo\s+text[^\n]*check\s*\(motivo in \('cansancio', 'tecnica', 'otro'\)\)/)
    expect(codigo).not.toMatch(/motivo[^\n]*'dolor'/)
    expect(codigo).toMatch(/regla_firmada\s+boolean not null default false check \(regla_firmada = false\)/)
  })

  it('la propuesta nunca es igual ni mayor a la serie de origen (check de tabla)', () => {
    expect(codigo).toMatch(/carga_propuesta_kg < serie_carga_kg/)
  })

  it('el tope de pendientes por persona es el del repositorio', () => {
    expect(codigo).toContain(`>= ${MAX_PENDIENTES_POR_PERSONA}`)
  })

  it('el plazo es de 12 horas', () => {
    expect(codigo).toContain("interval '12 hours'")
    expect(codigo).not.toContain("interval '24 hours'")
  })
})

describe('permisos', () => {
  it('la persona inserta solo lo suyo y el grant de insert no incluye columnas de decisión', () => {
    expect(codigo).toMatch(/for insert to authenticated\s+with check \(usuario_id = \(select auth\.uid\(\)\)\)/)
    const grant = codigo.match(/grant insert \(([^)]*)\)/)
    expect(grant).not.toBeNull()
    const columnas = grant![1].split(',').map((c) => c.trim())
    for (const prohibida of ['estado', 'decidido_por', 'decidido_en', 'carga_decidida_kg', 'motivo_rechazo', 'aplicada_en', 'creado_en', 'vence_en', 'id']) {
      expect(columnas, prohibida).not.toContain(prohibida)
    }
  })

  it('la persona no lee: ninguna política de select se apoya en usuario_id = auth.uid()', () => {
    const select = codigo.match(/for select[\s\S]*?;/g) ?? []
    expect(select.length).toBeGreaterThan(0)
    for (const p of select) expect(p).not.toMatch(/usuario_id\s*=\s*\(?\s*select auth\.uid/)
  })

  it('la nutricionista solo ve voy_a_escribirte: la política de lectura separa los dos roles', () => {
    const select = (codigo.match(/for select[\s\S]*?;/g) ?? []).join('\n')
    expect(select).toMatch(/es_coach\(\)/)
    expect(select).toMatch(/es_nutricionista\(\)[\s\S]*tipo = 'voy_a_escribirte'/)
  })

  it('la nutricionista solo decide voy_a_escribirte hacia atendida', () => {
    const update = (codigo.match(/for update[\s\S]*?;/g) ?? []).join('\n')
    expect(update).toMatch(/es_nutricionista\(\)[\s\S]*tipo = 'voy_a_escribirte'/)
    expect(update).toMatch(/estado = 'atendida'/)
  })

  it('no hay política de delete', () => {
    expect(codigo).not.toMatch(/for delete/i)
  })

  it('toda función security definer fija search_path y se revoca a anon/public', () => {
    const funciones = codigo.match(/create or replace function[\s\S]*?\$\$;/g) ?? []
    expect(funciones.length).toBeGreaterThanOrEqual(2)
    for (const f of funciones) {
      if (/security definer/i.test(f)) expect(f).toMatch(/set search_path = public, pg_temp/)
      const nombre = f.match(/function (public\.\w+)/)![1]
      expect(codigo, nombre).toMatch(new RegExp(`revoke all on function ${nombre.replace('.', '\\.')}\\(\\) from public, anon, authenticated;`))
    }
  })

  it('la persona no puede fijar la hora ni el estado: un trigger de insert los pisa', () => {
    expect(codigo).toMatch(/before insert on public\.praxis_propuestas_coach/)
    expect(codigo).toMatch(/new\.estado := 'pendiente'/)
    expect(codigo).toMatch(/pg_advisory_xact_lock/)
  })

  it('al decidir, aplicada_en se pone en null SIEMPRE: aplicar es un segundo paso que confirma el plan', () => {
    // Sentencia de primer nivel del cuerpo de la función (2 espacios), fuera de cualquier if.
    const inicio = codigo.indexOf('function public.praxis_propuesta_no_reescribe')
    const cuerpo = codigo.slice(inicio, codigo.indexOf('$$;', inicio))
    expect(cuerpo).toMatch(/\n {2}new\.aplicada_en := null;/)
  })

  it('aplicada_en solo vale con aceptada o ajustada (check de tabla), nunca con rechazada, atendida o pendiente', () => {
    expect(codigo).toMatch(/check \(aplicada_en is null or estado in \('aceptada', 'ajustada'\)\)/)
    expect(codigo).toMatch(/estado = 'pendiente' and decidido_en is null and carga_decidida_kg is null and motivo_rechazo is null and aplicada_en is null/)
  })

  it('el dedupe de «voy_a_escribirte» exige el mismo tema y el mismo origen (no pierde una señal distinta)', () => {
    expect(codigo).toMatch(/new\.tipo = 'voy_a_escribirte' and p\.tema = new\.tema and p\.origen_contacto = new\.origen_contacto and p\.creado_en > now\(\) - interval '1 day'/)
  })

  it('una fila decidida no se reescribe: un trigger de update lo impide', () => {
    expect(codigo).toMatch(/before update on public\.praxis_propuestas_coach/)
  })
})
