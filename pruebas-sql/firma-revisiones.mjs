import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// PostgreSQL aislado en memoria. No usa credenciales ni red.
const db = new PGlite()
const coach = '00000000-0000-4000-8000-000000000001'
const persona = '00000000-0000-4000-8000-000000000002'
const path = `personas/${persona}/2026-09-14/00000000-0000-4000-8000-000000000003.mp4`
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${coach}'), ('${persona}');
    create function auth.uid() returns uuid language sql as
      $$ select nullif(current_setting('prueba.usuario', true), '')::uuid $$;
    create function public.es_coach() returns boolean language sql as
      $$ select auth.uid() = '${coach}'::uuid $$;
    create table storage.objects(bucket_id text, name text);
    create table public.videos_semanales(usuario_id uuid, semana date, path text, guion text,
      tipo text default 'video', publicado_en timestamptz default now(), aprobado_en timestamptz,
      primary key(usuario_id,semana));
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/0079_firma_revision_por_version.sql', import.meta.url), 'utf8'))
  await db.query('insert into videos_semanales(usuario_id, semana, path, guion) values ($1,$2,$3,$4)', [persona, '2026-09-14', path, 'Guion ficticio'])
  await db.query('insert into storage.objects values ($1,$2)', ['medios-app', path])
  const decidir = (version, aprobar = true, correccion = null) => db.query('select decidir_revision_semanal($1,$2,$3,$4,$5)', [persona, '2026-09-14', version, aprobar, correccion])
  const usuario = id => db.query("select set_config('prueba.usuario', $1, false)", [id])
  const fila = async () => (await db.query('select * from videos_semanales')).rows[0]
  await usuario(persona)
  await assert.rejects(decidir(1), /Solo el coach/)
  await usuario(coach)
  await assert.rejects(decidir(null), /cambió/)
  await assert.rejects(decidir(2), /cambió/)
  await decidir(1)
  assert.equal((await fila()).aprobado_por, coach)
  await assert.rejects(decidir(1), /cambió/)
  await db.query("update videos_semanales set guion = 'Otro guion'")
  assert.equal((await fila()).version, 2)
  assert.equal((await fila()).aprobado_en, null)
  await decidir(2, false, 'Corregir pronunciación')
  await assert.rejects(decidir(2), /corregirse/)
  await db.query("update videos_semanales set guion = 'Guion corregido'")
  assert.equal((await fila()).correccion_solicitada, null)
  await decidir(3)
  await db.query("update videos_semanales set path = 'personas/historico.mp4'")
  await assert.rejects(decidir(4), /histórico/)
  const permisos = (await db.query("select has_function_privilege('anon', 'decidir_revision_semanal(uuid,date,integer,boolean,text)', 'execute') as anon, has_function_privilege('authenticated', 'decidir_revision_semanal(uuid,date,integer,boolean,text)', 'execute') as autenticado")).rows[0]
  assert.equal(permisos.anon, false)
  assert.equal(permisos.autenticado, true)
  console.log('SQL: rol, versión nula/obsoleta, firma, reemplazo, corrección, histórico y permisos comprobados.')
} finally {
  await db.close()
}
