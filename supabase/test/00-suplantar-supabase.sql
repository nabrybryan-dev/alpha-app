-- Lo mínimo de Supabase para poder aplicar las migraciones en un Postgres pelado.
--
-- POR QUÉ EXISTE. Los tests de la app corren siempre en modo demo, sin Supabase,
-- así que todo lo que vive del lado del servidor —RLS, triggers, ON CONFLICT,
-- tipos— era invisible para la suite. Un índice único parcial dejó el registro
-- de comidas sin subir NADA durante semanas y ningún test podía verlo (ver
-- `Cerebro Programacion Alpha/wiki/incidentes/2026-08-02-comidas-que-nunca-subieron.md`).
--
-- Esto NO pretende reimplementar Supabase. Solo crea aquello de lo que dependen
-- las migraciones, para que se puedan aplicar y para que las políticas RLS se
-- puedan evaluar de verdad.
--
-- Si una migración nueva usa algo de Supabase que no esté aquí, el CI se cae al
-- aplicarla. Eso es lo correcto: obliga a declararlo en vez de descubrirlo en
-- producción.

-- ─────────────────────────── Roles ───────────────────────────
-- Los mismos tres que trae un proyecto de Supabase. `authenticated` es con el
-- que se prueban las políticas: no es dueño de las tablas, así que RLS SÍ se le
-- aplica (al dueño no, salvo `force row level security`).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

-- ──────────────────────── Esquemas ────────────────────────
-- Supabase los trae de fábrica; las migraciones dan por hecho que existen.
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;
create schema if not exists pruebas;

-- ──────────────────────── auth ────────────────────────
-- `usuarios_app.id` referencia `auth.users(id)`, así que la tabla tiene que
-- existir aunque aquí solo se use como ancla de la clave ajena.
create table if not exists auth.users (
  id uuid primary key,
  email text
);

-- Las dos cuentas de staff que la 0006 exige.
--
-- Esa migración se planta con «No existe la cuenta …» si no las encuentra, y en
-- una base recién creada no hay ninguna: sin esto, la cadena de migraciones se
-- corta en la sexta y las treinta y seis siguientes no se comprueban nunca.
--
-- Se crean AQUÍ y no se omite la 0006, que sería lo cómodo: lo que este job
-- promete es que la 0001 → 00NN corren seguidas sobre una base vacía, y saltarse
-- una a mitad convierte esa promesa en otra más pequeña sin que se note.
--
-- Los correos son los mismos que ya están escritos en la 0006. No se añade aquí
-- ningún dato que no estuviera ya en el repositorio, y no hay ninguno de
-- asesorado: son las dos cuentas de staff.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'alpha+bryan@gmail.com'),
  ('00000000-0000-4000-8000-000000000002', 'alpha+manu@gmail.com')
on conflict (id) do nothing;

/**
 * Quién es el usuario de la petición.
 *
 * Supabase lo saca del JWT. Aquí se lee de una variable de sesión, que es lo
 * que permite a una prueba decir "ahora soy esta persona" y comprobar que las
 * políticas la tratan como debe.
 */
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- ──────────────────────── storage ────────────────────────
-- Lo usa la 0022 (adjuntos del chat). Se replica la forma, no el comportamiento.
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;

/** Parte la ruta del objeto en carpetas, igual que la de Supabase. */
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/')
$$;

-- ─────────────────── Privilegios por defecto ───────────────────
-- En Supabase, `anon` y `authenticated` reciben permisos sobre las tablas por
-- grants por defecto. Sin esto, cada prueba fallaría con "permission denied"
-- ANTES de llegar a evaluar la política, y no probaríamos nada.
--
-- Se hace ANTES de aplicar las migraciones, a propósito: así los `revoke` que
-- alguna migración haga después (la 0013 le quita `es_staff()` a `anon`) siguen
-- valiendo. Un grant masivo al final los desharía en silencio.
grant usage on schema public, extensions, storage to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

grant all on all tables in schema storage to anon, authenticated, service_role;

-- ──────────────────── Ayudas de las pruebas ────────────────────

/** Falla ruidosamente. Sin esto, una comprobación que no se cumple no se nota. */
create or replace function pruebas.afirmar(condicion boolean, mensaje text)
returns void
language plpgsql
as $$
begin
  if condicion is not true then
    raise exception 'FALLO: %', mensaje;
  end if;
end
$$;

/**
 * Fija de quién es la petición. El `set role authenticated` va SUELTO en cada
 * archivo de prueba, no aquí dentro.
 *
 * POR QUÉ NO SE ESCONDE EN UNA FUNCIÓN. Si el cambio de rol no llegara a
 * persistir al salir de la función, las pruebas seguirían corriendo como dueño
 * de las tablas —que se salta RLS— y el test de aislamiento pasaría **sin
 * probar absolutamente nada**. Un test que no puede fallar es peor que no
 * tenerlo: da permiso para confiar. Por eso el rol se cambia a la vista y
 * después se comprueba con `pruebas.exigir_rls()`.
 */
create or replace function pruebas.soy(quien uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', quien::text, false)::void
$$;

/**
 * Aborta si la sesión NO está sujeta a RLS.
 *
 * Es el seguro del párrafo de arriba: comprueba que el rol actual es
 * `authenticated` y que no tiene el privilegio de saltarse las políticas.
 */
create or replace function pruebas.exigir_rls()
returns void
language plpgsql
as $$
declare
  salta boolean;
begin
  if current_user <> 'authenticated' then
    raise exception 'FALLO: la prueba corre como % y no como authenticated: RLS no se estaría evaluando', current_user;
  end if;
  select rolbypassrls into salta from pg_roles where rolname = current_user;
  if salta then
    raise exception 'FALLO: el rol % se salta RLS', current_user;
  end if;
end
$$;
