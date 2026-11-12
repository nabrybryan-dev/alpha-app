-- 0134: lectura y escritura de check-ins, adherencias y planes nutricionales limitadas a la propia persona, su coach asignado y quien tiene
-- leer_entrenamiento (Bryan y Manuela). Propuesta, NO APLICADA (I-16). CAMBIO DE PERMISOS: aprobada en diseno por Bryan (16-oct).
-- Hallazgo medido (centinela de check-ins, cadena 0001..0133): cualquier coach LEIA Y ESCRIBIA los check-ins y adherencias de cualquier persona
-- (policies ALL 'propio OR es_coach()'); cualquier staff (nutricionista incluida) leia adherencias, planes y la vista checkins_nutricion
-- (peso, hambre, alimentacion) de cualquier persona (es_staff()); planes_escribir_* = cualquier coach.
-- Decisiones de Bryan (16-oct): lectura = propio + coach asignado + leer_entrenamiento (Bryan y Manuela). Para las tablas de NUTRICION
-- (adherencias, planes_nutricionales, vista checkins_nutricion) se anade la capacidad NUEVA leer_nutricion: los nutricionistas que la tengan
-- siguen leyendo la nutricion de todos; sin ella, solo sus asignados. La tabla checkins en bruto NO la incluye. Escritura: SOLO el coach
-- asignado o leer_entrenamiento (sin excepcion para personas sin coach). La capacidad leer_nutricion NO existia en el CHECK de capacidades_staff:
-- se anade aqui (como hizo 0120 con recibir_alerta_puerta) y NO se concede a nadie: es un dato que decide Bryan.
-- Depende de la carga de asignaciones.
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
  v_lista := array(select distinct x from unnest(v_lista || array['leer_nutricion']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  execute format('alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x));
end
$$;

-- Escribir sobre una persona: SOLO su coach asignado o quien tiene leer_entrenamiento.
create function public.es_coach_de(p_persona uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select p_persona is not null
     and (public.es_coach_asignado(p_persona) or public.tiene_capacidad('leer_entrenamiento'));
$$;
revoke all on function public.es_coach_de(uuid) from public, anon;
grant execute on function public.es_coach_de(uuid) to authenticated, service_role;

drop policy if exists checkins_todo_propio on public.checkins;
create policy checkins_todo_propio on public.checkins
  using (usuario_id = (select auth.uid()) or (select public.es_coach_de(usuario_id)))
  with check (usuario_id = (select auth.uid()) or (select public.es_coach_de(usuario_id)));

drop policy if exists adherencias_todo_propio on public.adherencias;
create policy adherencias_todo_propio on public.adherencias
  using (usuario_id = (select auth.uid()) or (select public.es_coach_de(usuario_id)))
  with check (usuario_id = (select auth.uid()) or (select public.es_coach_de(usuario_id)));
drop policy if exists adherencias_lee_staff on public.adherencias;
create policy adherencias_lee_staff on public.adherencias for select
  using ((select public.es_coach_asignado(usuario_id)) or (select public.tiene_capacidad('leer_entrenamiento')) or (select public.tiene_capacidad('leer_nutricion')));

drop policy if exists planes_leer on public.planes_nutricionales;
create policy planes_leer on public.planes_nutricionales for select
  using (usuario_id = (select auth.uid()) or (select public.es_coach_asignado(usuario_id)) or (select public.tiene_capacidad('leer_entrenamiento'))
         or (select public.tiene_capacidad('leer_nutricion')));
drop policy if exists planes_escribir_coach_insertar on public.planes_nutricionales;
create policy planes_escribir_coach_insertar on public.planes_nutricionales for insert
  with check ((select public.es_coach_de(usuario_id)));
drop policy if exists planes_escribir_coach_actualizar on public.planes_nutricionales;
create policy planes_escribir_coach_actualizar on public.planes_nutricionales for update
  using ((select public.es_coach_de(usuario_id))) with check ((select public.es_coach_de(usuario_id)));
drop policy if exists planes_escribir_coach_borrar on public.planes_nutricionales;
create policy planes_escribir_coach_borrar on public.planes_nutricionales for delete
  using ((select public.es_coach_de(usuario_id)));

-- La vista checkins_nutricion (security_invoker) lee de esta funcion: mismo criterio.
create or replace function public.checkins_nutricion_datos()
returns table (
  id             text,
  usuario_id     uuid,
  fecha          date,
  peso_kg        numeric,
  hambre         text,
  alimentacion   text,
  hambre_escala  numeric,
  actualizado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.usuario_id,
    c.fecha,
    (c.datos ->> 'pesoKg')::numeric,
    c.datos ->> 'hambre',
    c.datos ->> 'alimentacion',
    (c.datos ->> 'hambreEscala')::numeric,
    c.actualizado_en
  from public.checkins c
  where c.usuario_id = auth.uid()
     or public.es_coach_asignado(c.usuario_id)
     or public.tiene_capacidad('leer_entrenamiento')
     or public.tiene_capacidad('leer_nutricion');
$$;

commit;
