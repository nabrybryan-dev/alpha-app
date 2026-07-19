-- App Alpha Athletics · Migración 0006 · Rol nutricionista + visibilidad de staff
-- Pegar completo en: Supabase → SQL Editor → New query → Run
--
-- (1) Nuevo rol 'nutricionista' (Manuela): evalúa la nutrición de todo el
--     equipo (adherencias, planes, hidratación y peso de check-ins) pero NO
--     puede escribir datos de otros. Además entrena como asesorada.
-- (2) Arregla el chat de los asesorados: ahora pueden VER las filas del staff
--     (nombre/rol, nada más) para poder escribirle al coach.
-- (3) Asigna roles a alpha+bryan@ (coach) y alpha+manu@ (nutricionista).

alter table public.usuarios_app drop constraint if exists usuarios_app_rol_check;
alter table public.usuarios_app
  add constraint usuarios_app_rol_check check (rol in ('asesorado', 'coach', 'nutricionista'));

create or replace function public.es_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_app
    where id = auth.uid() and rol in ('coach', 'nutricionista')
  );
$$;

-- usuarios: cada quien se ve; TODOS ven al staff (para el chat); staff ve a todos
drop policy if exists usuarios_leer on public.usuarios_app;
create policy usuarios_leer on public.usuarios_app
  for select using (
    id = auth.uid() or public.es_staff() or rol in ('coach', 'nutricionista')
  );

-- adherencias: dueño todo + coach todo (como antes); nutricionista LEE todas
drop policy if exists adherencias_todo_propio on public.adherencias;
create policy adherencias_todo_propio on public.adherencias
  for all using (usuario_id = auth.uid() or public.es_coach())
  with check (usuario_id = auth.uid() or public.es_coach());
drop policy if exists adherencias_lee_staff on public.adherencias;
create policy adherencias_lee_staff on public.adherencias
  for select using (public.es_staff());

-- planes: dueño y staff leen; coach escribe (como antes)
drop policy if exists planes_leer on public.planes_nutricionales;
create policy planes_leer on public.planes_nutricionales
  for select using (usuario_id = auth.uid() or public.es_staff());

-- check-ins: dueño todo + coach todo; nutricionista LEE (peso/hambre/alimentación)
drop policy if exists checkins_todo_propio on public.checkins;
create policy checkins_todo_propio on public.checkins
  for all using (usuario_id = auth.uid() or public.es_coach())
  with check (usuario_id = auth.uid() or public.es_coach());
drop policy if exists checkins_lee_staff on public.checkins;
create policy checkins_lee_staff on public.checkins
  for select using (public.es_staff());

-- hidratación: nutricionista también la lee
drop policy if exists hidratacion_todo_propio on public.hidratacion;
create policy hidratacion_todo_propio on public.hidratacion
  for all using (usuario_id = auth.uid() or public.es_coach())
  with check (usuario_id = auth.uid() or public.es_coach());
drop policy if exists hidratacion_lee_staff on public.hidratacion;
create policy hidratacion_lee_staff on public.hidratacion
  for select using (public.es_staff());

-- ===== Roles de Bryan y Manuela =====
do $bloque$
declare
  v_bryan uuid;
  v_manu uuid;
begin
  select id into v_bryan from auth.users where email = 'alpha+bryan@gmail.com';
  select id into v_manu from auth.users where email = 'alpha+manu@gmail.com';
  if v_bryan is null then raise exception 'No existe la cuenta alpha+bryan@gmail.com'; end if;
  if v_manu is null then raise exception 'No existe la cuenta alpha+manu@gmail.com'; end if;
  update public.usuarios_app set rol = 'coach', nombre = 'Coach Bryan', avatar_iniciales = 'CB' where id = v_bryan;
  update public.usuarios_app set rol = 'nutricionista', nombre = 'Manuela Quintero', avatar_iniciales = 'MQ' where id = v_manu;
end $bloque$;
