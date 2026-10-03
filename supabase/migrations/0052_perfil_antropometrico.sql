-- 0052 · Ocho medidas de palancas en una persistencia aislada.
--
-- No vive dentro de `perfiles.datos`: un upsert antropométrico no puede pisar
-- objetivos, notas ni textos de prescripción. Las ocho columnas NOT NULL hacen
-- imposible guardar una conclusión con un segmento faltante convertido en 0.

begin;

create table if not exists public.perfiles_antropometricos (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  tibia_perone_cm numeric(6,2) not null check (tibia_perone_cm between 20 and 70),
  femur_cm numeric(6,2) not null check (femur_cm between 20 and 75),
  torso_cm numeric(6,2) not null check (torso_cm between 30 and 90),
  antebrazo_cm numeric(6,2) not null check (antebrazo_cm between 15 and 45),
  brazo_cm numeric(6,2) not null check (brazo_cm between 15 and 50),
  ancho_clavicular_cm numeric(6,2) not null check (ancho_clavicular_cm between 20 and 65),
  cintura_cm numeric(6,2) not null check (cintura_cm between 40 and 220),
  caderas_cm numeric(6,2) not null check (caderas_cm between 45 and 240),
  actualizado_en timestamptz not null default now()
);

comment on table public.perfiles_antropometricos is
  'Exactamente ocho medidas de segmentos/puntos transversales para personalizar palancas; aisladas de perfiles.datos.';

alter table public.perfiles_antropometricos enable row level security;

drop policy if exists antropometria_leer on public.perfiles_antropometricos;
create policy antropometria_leer on public.perfiles_antropometricos
  for select using (usuario_id = auth.uid() or public.es_coach());

drop policy if exists antropometria_insertar_propia on public.perfiles_antropometricos;
create policy antropometria_insertar_propia on public.perfiles_antropometricos
  for insert with check (usuario_id = auth.uid() or public.es_coach());

drop policy if exists antropometria_actualizar_propia on public.perfiles_antropometricos;
create policy antropometria_actualizar_propia on public.perfiles_antropometricos
  for update using (usuario_id = auth.uid() or public.es_coach())
  with check (usuario_id = auth.uid() or public.es_coach());

revoke all on table public.perfiles_antropometricos from anon;
grant select, insert, update on table public.perfiles_antropometricos to authenticated;

drop trigger if exists trg_actualizado_en on public.perfiles_antropometricos;
create trigger trg_actualizado_en before update on public.perfiles_antropometricos
  for each row execute function public.marcar_actualizado();

-- La firma incorpora la tabla. Sigue siendo SECURITY INVOKER: cuenta solo lo
-- que RLS deja ver a quien pregunta.
create or replace function public.firma_de_sincronizacion()
returns table (tabla text, filas bigint, ultimo_cambio timestamptz)
language sql
stable
set search_path = public
as $firma$
  select 'adherencias', count(*), max(actualizado_en) from public.adherencias
  union all select 'checkins', count(*), max(actualizado_en) from public.checkins
  union all select 'consultas_chat', count(*), max(actualizado_en) from public.consultas_chat
  union all select 'contenidos', count(*), max(actualizado_en) from public.contenidos
  union all select 'cuestionarios', count(*), max(actualizado_en) from public.cuestionarios
  union all select 'despensa', count(*), max(actualizado_en) from public.despensa
  union all select 'hidratacion', count(*), max(actualizado_en) from public.hidratacion
  union all select 'mensajes', count(*), max(actualizado_en) from public.mensajes
  union all select 'microciclos', count(*), max(actualizado_en) from public.microciclos
  union all select 'perfil_alimentario', count(*), max(actualizado_en) from public.perfil_alimentario
  union all select 'perfil_alimentario_veto', count(*), max(actualizado_en) from public.perfil_alimentario_veto
  union all select 'perfiles', count(*), max(actualizado_en) from public.perfiles
  union all select 'perfiles_antropometricos', count(*), max(actualizado_en) from public.perfiles_antropometricos
  union all select 'planes_nutricionales', count(*), max(actualizado_en) from public.planes_nutricionales
  union all select 'preferencia_estado', count(*), max(actualizado_en) from public.preferencia_estado
  union all select 'premiaciones', count(*), max(actualizado_en) from public.premiaciones
  union all select 'prueba_calibracion', count(*), max(actualizado_en) from public.prueba_calibracion
  union all select 'registro_comida', count(*), max(actualizado_en) from public.registro_comida
  union all select 'registro_item', count(*), max(actualizado_en) from public.registro_item
  union all select 'respuestas', count(*), max(actualizado_en) from public.respuestas
  union all select 'usuarios_app', count(*), max(actualizado_en) from public.usuarios_app
  union all select 'visibilidad_nutricion', count(*), max(actualizado_en) from public.visibilidad_nutricion
  union all select 'checkins_nutricion', count(*), max(actualizado_en) from public.checkins_nutricion
$firma$;

revoke all on function public.firma_de_sincronizacion() from public;
revoke execute on function public.firma_de_sincronizacion() from anon;
grant execute on function public.firma_de_sincronizacion() to authenticated;

commit;
