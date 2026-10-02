-- ============================================================================
-- 0106 · Dos cuentas para Bryan: «Alpha» (solo tablero) y la personal (los cinco espacios)
-- ============================================================================
--
-- DECISIÓN DE BRYAN (2-oct-2026), que corrige el PR #334: NO una sola cuenta que cambia con el ancho
-- de pantalla, sino DOS CUENTAS.
--
--   1. «Alpha» = alphaathletics301@gmail.com (uid 28c3cfe8-…): SOLO el tablero (la consola del coach,
--      en /tablero), para los dos computadores. Se marca con la capacidad nueva `solo_tablero`.
--   2. La cuenta PERSONAL (nabry.bryan@gmail.com): el mismo diseño de Manuela (Mi día, Mi entreno,
--      Equipo, Estrategias, Administración). Todavía no existe: se crea desde el panel de Supabase y
--      luego se le asigna su papel con `asignar_cuenta_personal_bryan(correo)` (solo service_role).
--
-- POR QUÉ UNA CAPACIDAD Y NO EL ANCHO DE PANTALLA: la cuenta es lo que dice qué ve la persona; el
-- navegador no. `solo_tablero` solo ESCONDE pantallas (la app manda a /tablero): no quita ningún
-- permiso de datos y no se usa en ninguna política de RLS de lectura.
--
-- LA CUENTA ALPHA SIGUE SIENDO COACH (rol 'coach', con todas sus capacidades), por dos razones:
--   · el tablero lee con las políticas de coach (`es_coach()`): sin ser coach no vería nada;
--   · «bryan» en Mi plan (0098 `plan_dueno_actual`), en los avisos (0099) y en el autor de los
--     comentarios de mercadeo (0103/0104) NO sale de un uid fijo sino de `es_coach()`. Así que las
--     dos cuentas son la MISMA persona «bryan»: comparten Mi plan y avisos, que es lo que se quiere
--     (un solo dueño, dos puertas). No hay uid de Bryan escrito en ninguna política.
--   · El único sitio que sí distingue por uid es el registro de decisiones compartidas (0094): ahí
--     la firma se pide a OTRA persona (`companeros_de_decision`). Sin retoque, la cuenta Alpha
--     aparecería como «compañero» de la personal y Bryan se pediría la firma a sí mismo en una cuenta
--     que nunca abre ese registro. Por eso esta migración la excluye de esa lista (sección 3).
--
-- Los 28c3cfe8-… de las migraciones 0086, 0087, 0090, 0094, 0098 y 0102 solo ASIGNAN capacidades a la
-- cuenta Alpha (ya aplicadas; no se tocan). La cuenta personal recibe las suyas aquí, por correo.
--
-- SEGURIDAD, la regla de siempre: `revoke all … from public, anon, authenticated` antes de conceder;
-- la función es SECURITY DEFINER con `search_path` fijo y solo la ejecuta service_role.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDAD NUEVA: solo_tablero (conserva todas las actuales)
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
  v_lista := array(select distinct x from unnest(v_lista || array['solo_tablero']) as x order by x);
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
-- 2 · ASIGNAR LA CUENTA PERSONAL DE BRYAN (por correo, idempotente)
-- ────────────────────────────────────────────────────────────────────────────
-- Uso, con service_role, después de crear el usuario en el panel de Supabase:
--   select public.asignar_cuenta_personal_bryan('nabry.bryan@gmail.com');
-- Hace tres cosas, todas repetibles sin efecto extra:
--   a) rol 'coach' (y nombre/iniciales si estaban vacíos): con eso ya es «bryan» para Mi plan,
--      avisos y comentarios, porque esos sitios preguntan `es_coach()`;
--   b) las capacidades de la cuenta Alpha MENOS `solo_tablero` (se copian de la base, no de una lista
--      escrita aquí: si a la cuenta Alpha se le suma una, la personal la recibe al repetir la llamada);
--   c) quita `solo_tablero` si por error la tuviera.
-- Falla (sin cambiar nada) si el correo no existe, si es el de la propia cuenta Alpha, o si la cuenta
-- Alpha no tiene capacidades que copiar.
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
    raise exception 'no existe un usuario con el correo «%»: créalo primero en el panel de Supabase', p_correo
      using errcode = 'P0002';
  end if;
  if v_id = c_alpha then
    raise exception 'ese es el correo de la cuenta Alpha (solo tablero): la personal es otra cuenta'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.capacidades_staff
     where usuario_id = c_alpha and capacidad <> 'solo_tablero'
  ) then
    raise exception 'la cuenta Alpha no tiene capacidades que copiar: no se asigna a ciegas'
      using errcode = 'P0002';
  end if;

  insert into public.usuarios_app (id, nombre, rol, avatar_iniciales)
  values (v_id, 'Bryan', 'coach', 'BR')
  on conflict (id) do update set
    rol = 'coach',
    nombre = coalesce(nullif(btrim(public.usuarios_app.nombre), ''), 'Bryan'),
    avatar_iniciales = coalesce(nullif(btrim(public.usuarios_app.avatar_iniciales), ''), 'BR');

  insert into public.capacidades_staff (usuario_id, capacidad)
  select v_id, c.capacidad
    from public.capacidades_staff c
   where c.usuario_id = c_alpha and c.capacidad <> 'solo_tablero'
  on conflict do nothing;

  delete from public.capacidades_staff where usuario_id = v_id and capacidad = 'solo_tablero';

  return v_id;
end;
$$;

comment on function public.asignar_cuenta_personal_bryan(text) is
  '0106: convierte el usuario con ese correo en la cuenta PERSONAL de Bryan (coach + capacidades de la '
  'cuenta Alpha menos solo_tablero). Idempotente. Solo service_role.';

revoke all on function public.asignar_cuenta_personal_bryan(text) from public, anon, authenticated;
grant execute on function public.asignar_cuenta_personal_bryan(text) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · LA CUENTA ALPHA NO ES UN «COMPAÑERO» PARA FIRMAR (0094)
-- ────────────────────────────────────────────────────────────────────────────
-- Igual que la 0094, más: no entra quien tiene `solo_tablero`.
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
          or exists (select 1 from public.capacidades_staff c
                      where c.usuario_id = u.id and c.capacidad = 'decisiones_compartidas'))
     and not exists (select 1 from public.capacidades_staff t
                      where t.usuario_id = u.id and t.capacidad = 'solo_tablero')
   order by u.nombre;
$$;
revoke all on function public.companeros_de_decision() from public, anon;
grant execute on function public.companeros_de_decision() to authenticated, service_role;

commit;
