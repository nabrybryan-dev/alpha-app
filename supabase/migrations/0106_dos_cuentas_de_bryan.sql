-- ============================================================================
-- 0106 · Dos cuentas para Bryan: «Alpha» (solo tablero) y la personal (los cinco espacios)
-- ============================================================================
--
-- DECISIÓN DE BRYAN (2-oct-2026), que corrige el PR #334: NO una sola cuenta que cambia con el ancho
-- de pantalla, sino DOS CUENTAS.
--
--   1. «Alpha» = alphaathletics301@gmail.com (uid 28c3cfe8-…, rol coach): SOLO el tablero (la consola
--      del coach, en /tablero), para los dos computadores. Se marca con la capacidad `solo_tablero`.
--   2. La cuenta PERSONAL = alpha+bryan@gmail.com (ya existe y entrena como ASESORADO con su propio
--      microciclo M1): los cinco espacios de Manuela con el puesto de Bryan. Se le da el puesto con
--      `asignar_cuenta_personal_bryan(correo)` (solo service_role).
--
-- POR QUÉ LA CUENTA PERSONAL NO PASA A rol 'coach' (revisado en src, supabase y scripts):
--   Un segundo coach rompería en silencio lo que supone que hay UNO: `idCoach()` (el primero de la lista),
--   el ranking y las preguntas al coach, la lista de remitentes del chat de los asesorados («Coach X»
--   dos veces), `responder-chat` (`usuarios_app?rol=eq.coach&limit=1`: la respuesta a una asesorada la
--   firmaría uno u otro según el orden). Y al dejar de ser `asesorado` él mismo saldría de `entrenan()`
--   (cartera, consola, cadena de agentes, Equipo) y de `revision-semanal.mjs` (filtra
--   rol in ('asesorado','nutricionista')), y perdería el cribado y el recordatorio de check-in.
--   Manuela ya es el precedente de «staff que además entrena», pero con rol nutricionista (que sí está
--   en `entrenan()`); no existe un equivalente para un segundo coach.
--
-- LO QUE SE HACE: el rol sigue siendo `asesorado` y la cuenta recibe la capacidad nueva `puesto_de_coach`,
--   que `es_coach()` y `es_staff()` reconocen. Así, en la base, TODO lo que ya decide «bryan» por
--   `es_coach()` (Mi plan `plan_dueno_actual` 0098, avisos 0099, autor de mercadeo 0103/0104, decisiones
--   compartidas 0094, las políticas de coach) funciona para ella sin tocar esas funciones, y sus propias
--   filas de asesorado (microciclos, check-ins, medidas) siguen por las mismas políticas de siempre.
--   ⚠ Es una EXCEPCIÓN consciente al principio de la 0083 («una capacidad no convierte a nadie en coach»):
--   vale para UNA cuenta, la asigna solo service_role (capacidades_staff no tiene política de escritura
--   para authenticated) y se revoca borrando una fila. El poder que da es el que Bryan ya tiene en la
--   cuenta Alpha; no se abre nada nuevo para nadie más.
--
-- LA CUENTA ALPHA SIGUE SIENDO COACH (rol 'coach' con todas sus capacidades): el tablero lee con las
--   políticas de coach, y «bryan» en Mi plan y los avisos sale de `es_coach()`, no de un uid. Las dos
--   cuentas son la MISMA persona «bryan» (comparten Mi plan y avisos: un dueño, dos puertas). El único
--   sitio que distingue por uid es el registro de decisiones compartidas (0094): la firma se pide a OTRA
--   persona (`companeros_de_decision`); sin retoque, la cuenta Alpha aparecería como compañero de la
--   personal. Por eso esta migración la excluye de esa lista (sección 4).
--
-- `solo_tablero` solo ESCONDE pantallas (la app manda a /tablero): no quita ningún permiso de datos.
--
-- Los 28c3cfe8-… de las migraciones 0086, 0087, 0090, 0094, 0098 y 0102 solo ASIGNAN capacidades a la
-- cuenta Alpha (ya aplicadas; no se tocan).
--
-- SEGURIDAD, la regla de siempre: `revoke all … from public, anon, authenticated` antes de conceder;
-- la función es SECURITY DEFINER con `search_path` fijo y solo la ejecuta service_role.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDADES NUEVAS: solo_tablero y puesto_de_coach (conserva todas las actuales)
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_nombre text;
  v_def    text;
  v_lista  text[];
begin
  select conname, pg_get_constraintdef(oid) into v_nombre, v_def
    from pg_constraint
   where conrelid = 'public.capacidades_staff'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%capacidad%'
   limit 1;
  if v_nombre is null then
    raise exception 'no se encontró el check de capacidades_staff: no se reescribe a ciegas';
  end if;
  select array_agg(distinct x order by x) into v_lista
    from (
      select m[1] as x from regexp_matches(v_def, '''([a-z_]+)''', 'g') as t(m)
      union
      select regexp_split_to_table(substring(v_def from '''\{([a-z_,]+)\}'''), ',')
    ) s
   where x is not null;
  v_lista := array(select distinct x from unnest(v_lista || array['solo_tablero', 'puesto_de_coach']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  execute format(
    'alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x)
  );
end
$$;

-- La cuenta Alpha: solo el tablero. Solo casa con la fila real (el CI arranca con la base vacía).
--   28c3cfe8-… = alphaathletics301@gmail.com
insert into public.capacidades_staff (usuario_id, capacidad)
select u.id, 'solo_tablero'
  from public.usuarios_app u
 where u.id = '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce'
on conflict do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · EL PUESTO DE COACH POR CAPACIDAD: es_coach() y es_staff()
-- ────────────────────────────────────────────────────────────────────────────
-- Igual que la 0001 y la 0006, más: quien tiene `puesto_de_coach` también cuenta. Una sola subconsulta
-- por clave primaria; `security definer` + `search_path` fijo como antes (así lee capacidades_staff sin
-- depender de su RLS, que a su vez llama a es_coach()). `create or replace` conserva dueño y permisos.
create or replace function public.es_coach()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_app
    where id = auth.uid() and rol = 'coach'
  ) or exists (
    select 1 from public.capacidades_staff
    where usuario_id = auth.uid() and capacidad = 'puesto_de_coach'
  );
$$;

create or replace function public.es_staff()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_app
    where id = auth.uid() and rol in ('coach', 'nutricionista')
  ) or exists (
    select 1 from public.capacidades_staff
    where usuario_id = auth.uid() and capacidad = 'puesto_de_coach'
  );
$$;

revoke all on function public.es_coach() from public, anon;
revoke all on function public.es_staff() from public, anon;
grant execute on function public.es_coach() to authenticated, service_role;
grant execute on function public.es_staff() to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · ASIGNAR LA CUENTA PERSONAL DE BRYAN (por correo, idempotente)
-- ────────────────────────────────────────────────────────────────────────────
-- Uso, con service_role:   select public.asignar_cuenta_personal_bryan('alpha+bryan@gmail.com');
-- NO toca `usuarios_app` (el rol sigue siendo `asesorado`: su entreno, su cartera y su cadena no cambian).
-- Hace dos cosas, repetibles sin efecto extra:
--   a) las capacidades de la cuenta Alpha MENOS `solo_tablero` (copiadas de la base, no de una lista
--      escrita aquí: si a la cuenta Alpha se le suma una, la personal la recibe al repetir la llamada);
--   b) `puesto_de_coach`; y quita `solo_tablero` si por error la tuviera.
-- Falla (sin cambiar nada) si el correo no existe o aún no tiene fila en usuarios_app, si es el de la
-- propia cuenta Alpha, o si la cuenta Alpha no tiene capacidades que copiar.
create or replace function public.asignar_cuenta_personal_bryan(p_correo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c_alpha constant uuid := '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce';
  v_id    uuid;
begin
  select id into v_id
    from auth.users
   where lower(email) = lower(btrim(coalesce(p_correo, '')))
   limit 1;
  if v_id is null then
    raise exception 'no existe un usuario con el correo «%»', p_correo using errcode = 'P0002';
  end if;
  if v_id = c_alpha then
    raise exception 'ese es el correo de la cuenta Alpha (solo tablero): la personal es otra cuenta'
      using errcode = '22023';
  end if;
  if not exists (select 1 from public.usuarios_app where id = v_id) then
    raise exception 'el usuario «%» todavía no tiene fila en usuarios_app', p_correo using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.capacidades_staff
     where usuario_id = c_alpha and capacidad <> 'solo_tablero'
  ) then
    raise exception 'la cuenta Alpha no tiene capacidades que copiar: no se asigna a ciegas'
      using errcode = 'P0002';
  end if;

  insert into public.capacidades_staff (usuario_id, capacidad)
  select v_id, c.capacidad
    from public.capacidades_staff c
   where c.usuario_id = c_alpha and c.capacidad <> 'solo_tablero'
  on conflict do nothing;

  insert into public.capacidades_staff (usuario_id, capacidad)
  values (v_id, 'puesto_de_coach')
  on conflict do nothing;

  delete from public.capacidades_staff where usuario_id = v_id and capacidad = 'solo_tablero';

  return v_id;
end;
$$;

comment on function public.asignar_cuenta_personal_bryan(text) is
  '0106: da a la cuenta PERSONAL de Bryan (sigue siendo asesorado) el puesto de coach: capacidades de la '
  'cuenta Alpha menos solo_tablero, más puesto_de_coach. Idempotente. Solo service_role.';

revoke all on function public.asignar_cuenta_personal_bryan(text) from public, anon, authenticated;
grant execute on function public.asignar_cuenta_personal_bryan(text) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · LA CUENTA ALPHA NO ES UN «COMPAÑERO» PARA FIRMAR (0094)
-- ────────────────────────────────────────────────────────────────────────────
-- Igual que la 0094, más: no entra quien tiene `solo_tablero`; y la cuenta personal (puesto_de_coach)
-- cuenta como coach.
create or replace function public.companeros_de_decision()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.nombre
    from public.usuarios_app u
   where public.puede_decidir_compartido()
     and u.id <> auth.uid()
     and (u.rol = 'coach'
          or exists (select 1 from public.capacidades_staff p
                      where p.usuario_id = u.id and p.capacidad = 'puesto_de_coach')
          or exists (select 1 from public.capacidades_staff c
                      where c.usuario_id = u.id and c.capacidad = 'decisiones_compartidas'))
     and not exists (select 1 from public.capacidades_staff t
                      where t.usuario_id = u.id and t.capacidad = 'solo_tablero')
   order by u.nombre;
$$;
revoke all on function public.companeros_de_decision() from public, anon;
grant execute on function public.companeros_de_decision() to authenticated, service_role;

commit;
