-- 0143 · PROPUESTA (NO APLICADA, I-16; CAMBIO DE PERMISOS: requiere visto bueno de Bryan). Decision D-17-59 (22-oct): la regla de riesgo 0141 la enciende Bryan o Manuela, con registro de quien y cuando.
-- Se aplica DESPUES de 0141. NO enciende la regla: sigue APAGADA (D-17-22) hasta que Bryan conceda la capacidad nueva `encender_regla_ventana` (solo a Bryan y Manuela) y alguien llame a la funcion.
-- Registro: un disparador AFTER UPDATE OF activa anota TODO cambio de `activa` (por la funcion, por el SQL Editor o por cualquier canal): auth.uid() (nulo si fue el SQL Editor o servicio),
-- el rol de sesion y la hora del servidor. Asi un encendido sin funcion queda visible como fila sin autor.
-- LIMITES: el dueno de la base (rol postgres) puede encender/apagar sin pasar por la funcion y puede deshabilitar el disparador; queda anotado pero no impedido. No hay funcion de apagado (se apaga desde el SQL Editor y queda anotado).
-- Reversa: borrar funcion, disparador, tabla; quitar la capacidad del check.
begin;

do $$
declare
  v_nombre text;
  v_def text;
  v_lista text[];
begin
  select conname, pg_get_constraintdef(oid) into v_nombre, v_def
    from pg_constraint
   where conrelid = 'public.capacidades_staff'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%capacidad%'
   limit 1;
  if v_nombre is null then
    raise exception 'no se encontro el check de capacidades_staff: no se reescribe a ciegas';
  end if;
  select array_agg(distinct m[1] order by m[1]) into v_lista from regexp_matches(v_def, '''([a-z_]+)''', 'g') as t(m);
  v_lista := array(select distinct x from unnest(v_lista || array['encender_regla_ventana']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  execute format('alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x));
end
$$;

create table public.cambios_regla_ventana (
  id bigint generated always as identity primary key,
  activa_antes boolean not null,
  activa_despues boolean not null,
  hecho_por uuid,              -- auth.uid() de quien cambio la regla; nulo = sin sesion (SQL Editor o servicio)
  rol_sesion text not null,
  hecho_en timestamptz not null default clock_timestamp(),
  nota text
);
alter table public.cambios_regla_ventana enable row level security;
revoke all on public.cambios_regla_ventana from public, anon, authenticated, service_role;
grant select on public.cambios_regla_ventana to service_role;

create function public.registrar_cambio_regla_ventana()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.activa is distinct from old.activa then
    insert into public.cambios_regla_ventana (activa_antes, activa_despues, hecho_por, rol_sesion, nota)
    values (old.activa, new.activa, auth.uid(), session_user::text, nullif(current_setting('alpha.nota_regla', true), ''));
  end if;
  return null;
end;
$$;
revoke all on function public.registrar_cambio_regla_ventana() from public, anon, authenticated, service_role;
create trigger trg_registrar_cambio_regla_ventana
  after update of activa on public.regla_ventana_primer_plan
  for each row execute function public.registrar_cambio_regla_ventana();

create function public.encender_regla_ventana(p_nota text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_antes boolean;
begin
  if v_uid is null then
    raise exception 'encender_regla_ventana: se requiere sesion' using errcode = '42501';
  end if;
  if not public.es_staff() then
    raise exception 'encender_regla_ventana: solo el staff' using errcode = '42501';
  end if;
  if not public.tiene_capacidad('encender_regla_ventana') then
    raise exception 'encender_regla_ventana: falta la capacidad de encender' using errcode = '42501';
  end if;
  select activa into v_antes from public.regla_ventana_primer_plan;
  perform set_config('alpha.nota_regla', coalesce(left(p_nota, 500), ''), true);
  update public.regla_ventana_primer_plan set activa = true, actualizada_en = clock_timestamp();
  return jsonb_build_object('activa_antes', v_antes, 'activa', true, 'por', v_uid, 'en', clock_timestamp());
end;
$$;
revoke all on function public.encender_regla_ventana(text) from public, anon;
grant execute on function public.encender_regla_ventana(text) to authenticated;

commit;
