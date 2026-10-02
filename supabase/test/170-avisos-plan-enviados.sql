-- Avisos push del organizador (migración 0099): avisos_plan_enviados.
--
-- Lo que se prueba:
--   1. RLS encendida; anon y authenticated no leen ni escriben (ni siquiera Bryan, el coach).
--   2. service_role sí escribe.
--   3. Un aviso por tarea y día (índice único); tipo y dueño acotados.
--   4. Al borrar la tarea, su registro se va con ella.
--
-- Bloque de UUID propio (sufijo 17x). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f9000000-0000-0000-0000-000000000171', 'av-bryan@ejemplo.test')
on conflict (id) do nothing;
insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f9000000-0000-0000-0000-000000000171', 'Bryan de prueba avisos', 'coach', 'BA')
on conflict (id) do update set rol = excluded.rol;

insert into public.plan_items (id, nivel, titulo, dueno) values
  ('e9000000-0000-0000-0000-000000000171', 'objetivo', 'Objetivo de prueba', 'bryan');
insert into public.plan_items (id, nivel, padre_id, titulo, dueno) values
  ('e9000000-0000-0000-0000-000000000172', 'hito', 'e9000000-0000-0000-0000-000000000171', 'Hito', 'bryan');
insert into public.plan_items (id, nivel, padre_id, titulo, dueno, fecha, estimado_min, prioridad) values
  ('e9000000-0000-0000-0000-000000000173', 'tarea', 'e9000000-0000-0000-0000-000000000172', 'Tarea', 'bryan',
   current_date, 25, 'principal');

-- 1 · RLS y privilegios
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.avisos_plan_enviados'::regclass) then
    raise exception 'FALLO: avisos_plan_enviados sin RLS';
  end if;
  if has_table_privilege('anon', 'public.avisos_plan_enviados', 'select')
     or has_table_privilege('authenticated', 'public.avisos_plan_enviados', 'select')
     or has_table_privilege('authenticated', 'public.avisos_plan_enviados', 'insert') then
    raise exception 'FALLO: anon o authenticated tienen privilegios sobre avisos_plan_enviados';
  end if;
end $$;

-- 2 · service_role escribe
set local role service_role;
insert into public.avisos_plan_enviados (dueno, tipo, item_id, fecha_aviso)
values ('bryan', 'inicio_bloque', 'e9000000-0000-0000-0000-000000000173', current_date);
reset role;

-- 3 · Un aviso por tarea y día; tipo y dueño acotados
do $$
begin
  begin
    insert into public.avisos_plan_enviados (dueno, tipo, item_id, fecha_aviso)
    values ('bryan', 'atascada', 'e9000000-0000-0000-0000-000000000173', current_date);
    raise exception 'FALLO: dos avisos para la misma tarea y día';
  exception when unique_violation then null;
  end;
  begin
    insert into public.avisos_plan_enviados (dueno, tipo, item_id, fecha_aviso)
    values ('bryan', 'inventado', 'e9000000-0000-0000-0000-000000000173', current_date + 1);
    raise exception 'FALLO: aceptó un tipo inventado';
  exception when check_violation then null;
  end;
  begin
    insert into public.avisos_plan_enviados (dueno, tipo, item_id, fecha_aviso)
    values ('otro', 'atascada', 'e9000000-0000-0000-0000-000000000173', current_date + 1);
    raise exception 'FALLO: aceptó un dueño inventado';
  exception when check_violation then null;
  end;
end $$;

-- Ni el coach autenticado ni anon leen ni escriben
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-000000000171","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform 1 from public.avisos_plan_enviados;
    raise exception 'FALLO: authenticated leyó avisos_plan_enviados';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.avisos_plan_enviados (dueno, tipo, item_id, fecha_aviso)
    values ('bryan', 'atascada', 'e9000000-0000-0000-0000-000000000173', current_date + 2);
    raise exception 'FALLO: authenticated escribió avisos_plan_enviados';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.avisos_plan_enviados;
    raise exception 'FALLO: anon leyó avisos_plan_enviados';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 4 · El registro se va con la tarea
delete from public.avisos_plan_enviados;
insert into public.avisos_plan_enviados (dueno, tipo, item_id, fecha_aviso)
values ('bryan', 'inicio_bloque', 'e9000000-0000-0000-0000-000000000173', current_date);
delete from public.plan_items where id = 'e9000000-0000-0000-0000-000000000173';
do $$
begin
  if exists (select 1 from public.avisos_plan_enviados) then
    raise exception 'FALLO: el aviso sobrevivió a su tarea';
  end if;
end $$;

rollback;
