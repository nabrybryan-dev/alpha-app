// Prueba de las migraciones 0164 (mensajes solo con el equipo) y 0165 (solicitudes de derechos).
// PostgreSQL aislado en memoria (PGlite). Sin credenciales ni red. Las reglas se ejercen con
// `set role authenticated`, para que RLS y los permisos por columna apliquen de verdad.
// Además corre 3 mutantes de las migraciones y exige que cada uno haga fallar al menos un control.
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const COACH = '00000000-0000-4000-8000-0000000000c1'
const COACH_VIEJO = '00000000-0000-4000-8000-0000000000c0'
const NUTRI = '00000000-0000-4000-8000-0000000000a1'
const PERSONA = '00000000-0000-4000-8000-000000000001'
const OTRA = '00000000-0000-4000-8000-000000000002'

const BASE = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql as
    $$ select nullif(current_setting('prueba.usuario', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  create table public.usuarios_app(id uuid primary key, rol text not null default 'asesorado');
  create table public.capacidades_staff(usuario_id uuid, capacidad text);
  create table public.mensajes(
    id text primary key,
    de_id uuid not null references public.usuarios_app(id) on delete cascade,
    para_id uuid not null references public.usuarios_app(id) on delete cascade,
    fecha_iso timestamptz not null default now(), texto text not null,
    origen text not null default 'humano');
  alter table public.mensajes enable row level security;
  create policy mensajes_leer on public.mensajes for select using (de_id = auth.uid() or para_id = auth.uid());
  create policy mensajes_enviar on public.mensajes for insert with check (de_id = auth.uid());
  grant select, insert on public.mensajes to authenticated;
  -- es_staff() y tiene_capacidad() con el texto de 0106 y 0083.
  create function public.es_staff() returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.usuarios_app where id = auth.uid() and rol in ('coach', 'nutricionista'))
        or exists (select 1 from public.capacidades_staff where usuario_id = auth.uid() and capacidad = 'puesto_de_coach'); $$;
  create function public.tiene_capacidad(p_capacidad text) returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.capacidades_staff where usuario_id = auth.uid() and capacidad = p_capacidad); $$;
  grant execute on function public.es_staff(), public.tiene_capacidad(text) to authenticated;
  -- asignaciones_coach y su regla de lectura, como en 0119 (M2).
  create table public.asignaciones_coach(persona_id uuid not null, coach_id uuid not null,
    asignado_desde timestamptz not null default now(), asignado_hasta timestamptz,
    primary key (persona_id, asignado_desde));
  alter table public.asignaciones_coach enable row level security;
  create policy asignaciones_coach_leer on public.asignaciones_coach for select to authenticated
    using (persona_id = (select auth.uid()) or coach_id = (select auth.uid()) or (select public.tiene_capacidad('leer_entrenamiento')));
  grant select on public.asignaciones_coach to authenticated;
  insert into public.usuarios_app values
    ('${COACH}', 'coach'), ('${COACH_VIEJO}', 'coach'), ('${NUTRI}', 'nutricionista'),
    ('${PERSONA}', 'asesorado'), ('${OTRA}', 'asesorado');
  insert into public.asignaciones_coach values
    ('${PERSONA}', '${COACH_VIEJO}', now() - interval '60 days', now() - interval '30 days'),
    ('${PERSONA}', '${COACH}', now() - interval '30 days', null),
    ('${OTRA}', '${COACH}', now() - interval '30 days', null);
`

async function correr(m0164, m0165) {
  const db = new PGlite()
  const fallos = []
  const control = async (nombre, fn) => {
    try { await fn() } catch (e) { fallos.push(`${nombre}: ${e.message}`) }
  }
  const como = async (id, sql, params = []) => {
    await db.query("select set_config('prueba.usuario', $1, false)", [id])
    await db.exec('set role authenticated')
    try { return await db.query(sql, params) } finally { await db.exec('reset role') }
  }
  const rechaza = async (id, sql, params = []) => {
    let ok = false
    try { await como(id, sql, params); ok = true } catch { /* esperado */ }
    if (ok) throw new Error('la base lo aceptó y debía rechazarlo')
  }
  const igual = (a, b, que) => { if (a !== b) throw new Error(`${que}: ${a} !== ${b}`) }
  try {
    await db.exec(BASE)
    await db.exec(m0164)
    await db.exec(m0165)

    // ── 0164 ──
    await control('persona escribe a su coach', () => como(PERSONA, "insert into mensajes(id,de_id,para_id,texto) values ('m1',$1,$2,'hola')", [PERSONA, COACH]))
    await control('persona escribe a la nutricionista', () => como(PERSONA, "insert into mensajes(id,de_id,para_id,texto) values ('m2',$1,$2,'hola')", [PERSONA, NUTRI]))
    await control('coach escribe a una persona', () => como(COACH, "insert into mensajes(id,de_id,para_id,texto) values ('m3',$1,$2,'hola')", [COACH, PERSONA]))
    await control('persona NO escribe a otra persona', () => rechaza(PERSONA, "insert into mensajes(id,de_id,para_id,texto) values ('m4',$1,$2,'hola')", [PERSONA, OTRA]))
    await control('persona NO se hace pasar por el coach', () => rechaza(PERSONA, "insert into mensajes(id,de_id,para_id,texto) values ('m5',$1,$2,'hola')", [COACH, PERSONA]))
    await control('anon no ejecuta es_staff_id', async () => {
      const r = await db.query("select has_function_privilege('anon','public.es_staff_id(uuid)','execute') as x")
      igual(r.rows[0].x, false, 'anon ejecuta es_staff_id')
    })

    // ── 0165: crear ──
    const crear = (id, persona, coach, extra = '') => como(id,
      `insert into solicitudes_derechos(persona_id, coach_id, derecho, detalle${extra ? ', respuesta' : ''}) values ($1,$2,'supresion','bórrenme'${extra ? `, '${extra}'` : ''}) returning id`, [persona, coach])
    let sid = null
    await control('persona crea su solicitud al coach vigente', async () => { sid = (await crear(PERSONA, PERSONA, COACH)).rows[0].id })
    await control('NO al coach anterior', () => rechaza(PERSONA, 'insert into solicitudes_derechos(persona_id, coach_id, derecho) values ($1,$2,\'conocer\')', [PERSONA, COACH_VIEJO]))
    await control('NO a nombre de otra persona', () => rechaza(PERSONA, 'insert into solicitudes_derechos(persona_id, coach_id, derecho) values ($1,$2,\'conocer\')', [OTRA, COACH]))
    await control('NO con la respuesta ya puesta', () => rechaza(PERSONA, "insert into solicitudes_derechos(persona_id, coach_id, derecho, respuesta) values ($1,$2,'conocer','hecho')", [PERSONA, COACH]))
    await control('NO un derecho inventado', () => rechaza(PERSONA, "insert into solicitudes_derechos(persona_id, coach_id, derecho) values ($1,$2,'otro')", [PERSONA, COACH]))
    await control('NO detalle de 501', () => rechaza(PERSONA, "insert into solicitudes_derechos(persona_id, coach_id, derecho, detalle) values ($1,$2,'conocer',repeat('x',501))", [PERSONA, COACH]))

    // ── 0165: leer ──
    await control('la persona ve la suya', async () => igual((await como(PERSONA, 'select * from solicitudes_derechos')).rows.length, 1, 'filas'))
    await control('otra persona no la ve', async () => igual((await como(OTRA, 'select * from solicitudes_derechos')).rows.length, 0, 'filas'))
    await control('el coach anterior no la ve', async () => igual((await como(COACH_VIEJO, 'select * from solicitudes_derechos')).rows.length, 0, 'filas'))
    await control('el coach la ve', async () => igual((await como(COACH, 'select * from solicitudes_derechos')).rows.length, 1, 'filas'))

    // ── 0165: responder y no reescribir ──
    await control('la persona no se responde sola', async () => {
      const r = await como(PERSONA, 'update solicitudes_derechos set respondida_en = now(), respondida_por = $1, respuesta = $2 where id = $3', [PERSONA, 'listo', sid])
      igual(r.affectedRows ?? 0, 0, 'filas cambiadas por la persona')
    })
    await control('nadie reescribe el derecho pedido', () => rechaza(COACH, "update solicitudes_derechos set derecho = 'conocer' where id = $1", [sid]))
    await control('nadie la borra por la app', () => rechaza(COACH, 'delete from solicitudes_derechos where id = $1', [sid]))
    await control('el coach responde', async () => {
      const r = await como(COACH, 'update solicitudes_derechos set respondida_en = now(), respondida_por = $1, respuesta = $2 where id = $3', [COACH, 'Atendida', sid])
      igual(r.affectedRows, 1, 'filas respondidas')
    })
    await control('el coach no firma a nombre de otro', () => rechaza(COACH, 'update solicitudes_derechos set respondida_por = $1 where id = $2', [NUTRI, sid]))

    // ── 0165: la constancia sobrevive al borrado de la cuenta ──
    await control('borrar la cuenta deja la constancia', async () => {
      await db.query('delete from usuarios_app where id = $1', [PERSONA])
      igual((await db.query('select count(*)::int as n from solicitudes_derechos where id = $1', [sid])).rows[0].n, 1, 'constancias')
      igual((await db.query('select count(*)::int as n from mensajes where de_id = $1 or para_id = $1', [PERSONA])).rows[0].n, 0, 'mensajes que quedan (cascada esperada)')
    })

    // ── 0165: purga ──
    await control('authenticated no ejecuta la purga', async () => {
      const r = await db.query("select has_function_privilege('authenticated','public.purgar_solicitudes_derechos(timestamptz)','execute') as x")
      igual(r.rows[0].x, false, 'authenticated purga')
    })
    await control('purga: detalle a los 30 días, fila a los 2 años, sin responder se queda', async () => {
      await db.query("insert into solicitudes_derechos(persona_id, coach_id, derecho, detalle, creada_en) values ($1,$2,'conocer','sin responder', now())", [OTRA, COACH])
      let r = await db.query("select * from purgar_solicitudes_derechos(now() + interval '29 days')")
      igual(r.rows[0].detalles_borrados, 0, 'detalles a los 29 días')
      r = await db.query("select * from purgar_solicitudes_derechos(now() + interval '31 days')")
      igual(r.rows[0].detalles_borrados, 1, 'detalles a los 31 días')
      igual((await db.query('select detalle from solicitudes_derechos where id = $1', [sid])).rows[0].detalle, null, 'detalle respondida')
      r = await db.query("select * from purgar_solicitudes_derechos(now() + interval '91 days')")
      igual(r.rows[0].detalles_borrados, 1, 'detalle sin responder a los 91 días')
      r = await db.query("select * from purgar_solicitudes_derechos(now() + interval '2 years' - interval '1 day')")
      igual(r.rows[0].filas_borradas, 0, 'filas antes de 2 años')
      r = await db.query("select * from purgar_solicitudes_derechos(now() + interval '2 years' + interval '1 day')")
      igual(r.rows[0].filas_borradas, 1, 'filas después de 2 años')
      igual((await db.query('select count(*)::int as n from solicitudes_derechos')).rows[0].n, 1, 'queda la sin responder')
    })
  } catch (e) {
    fallos.push(`preparación: ${e.message}`)
  } finally {
    await db.close()
  }
  return fallos
}

const leer = n => readFile(new URL(`../supabase/migrations/${n}`, import.meta.url), 'utf8')
const m0164 = await leer('0164_mensajes_solo_con_el_equipo.sql')
const m0165 = await leer('0165_solicitudes_de_derechos.sql')

const real = await correr(m0164, m0165)
console.log(`REAL: ${real.length === 0 ? 'todos los controles pasan' : `${real.length} fallos`}`)
for (const f of real) console.log('  ' + f)

const sustituir = (texto, a, b) => {
  if (!texto.includes(a)) throw new Error(`el mutante no encuentra: ${a}`)
  return texto.replace(a, b)
}
const mutantes = [
  ['M1 0164 sin mirar el destinatario', sustituir(m0164, 'and ((select public.es_staff()) or public.es_staff_id(para_id))', ''), m0165],
  ['M2 0165 acepta cualquier coach, no solo el vigente', m0164, sustituir(m0165, 'where a.persona_id = (select auth.uid()) and a.asignado_hasta is null', 'where a.persona_id = (select auth.uid()) order by a.asignado_desde limit 1')],
  ['M3 0165 con llave foránea en cascada', m0164, sustituir(m0165, '  persona_id     uuid not null,', '  persona_id     uuid not null references public.usuarios_app(id) on delete cascade,')],
]
let vivos = 0
for (const [nombre, a, b] of mutantes) {
  const f = await correr(a, b)
  console.log(`${nombre}: ${f.length > 0 ? `CAZADO (${f.length} controles fallan)` : 'VIVO'}`)
  if (f.length === 0) vivos++
}
process.exitCode = real.length === 0 && vivos === 0 ? 0 : 1
