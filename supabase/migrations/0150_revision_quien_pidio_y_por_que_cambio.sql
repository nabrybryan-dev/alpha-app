-- 0150: la revisión semanal guarda QUIÉN pidió la corrección y POR QUÉ cambió la versión.
--
-- Decisión de Bryan (29-oct): el semáforo de firma se separa por firmante. Hasta la 0081, pedir una
-- corrección borraba `aprobado_por` y subir la versión borraba la corrección, así que la app no podía
-- saber de quién era una fila corregida ni distinguir una corrección de una republicación técnica.
--
-- Columnas nuevas en videos_semanales (la RLS de la 0068 ya cubre la tabla entera; no se abre ninguna
-- política: el navegador sigue sin escribir aquí, solo `decidir_revision_semanal` y el trigger):
--   correccion_pedida_por  quién pidió la última corrección (se conserva al subir la versión).
--   motivo_version         por qué subió la versión: 'correccion' o 'republicacion_tecnica'.
--                          NULL = no se sabe (filas anteriores a esta migración): NO cuenta como corrección.
--
-- Corte entre los dos motivos (Bryan, 29-oct): la versión nueva es 'correccion' solo si había una
-- corrección pendiente; si no, es 'republicacion_tecnica' y no cuenta para nadie. Si una fila ya
-- corregida se republica después por algo técnico, conserva su motivo y quién pidió la corrección.
--
-- No se aplica sola: se corre aparte. Prueba: supabase/migrations/comprobar-0150.sql.
begin;

alter table public.videos_semanales
  add column if not exists correccion_pedida_por uuid references auth.users(id) on delete set null,
  add column if not exists motivo_version text;

alter table public.videos_semanales
  drop constraint if exists videos_semanales_motivo_version_check,
  add constraint videos_semanales_motivo_version_check
    check (motivo_version is null or (motivo_version in ('correccion', 'republicacion_tecnica') and version > 1));

comment on column public.videos_semanales.correccion_pedida_por is
  'Quién pidió la última corrección. Se conserva al subir la versión para que el semáforo de firma la cuente solo a ese firmante.';
comment on column public.videos_semanales.motivo_version is
  'Por qué subió la versión: correccion (había una pedida) o republicacion_tecnica (otro cambio de archivo). NULL = no se sabe; no cuenta como corrección.';

create or replace function public.versionar_revision_semanal()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.aprobado_en := null;
    new.aprobado_por := null;
    new.correccion_pedida_por := null;
    new.motivo_version := null;
  elsif row(new.path, new.guion, new.tipo, new.publicado_en)
      is distinct from row(old.path, old.guion, old.tipo, old.publicado_en) then
    new.version := old.version + 1;
    new.aprobado_en := null;
    new.aprobado_por := null;
    if old.correccion_solicitada is not null then
      new.motivo_version := 'correccion';
      new.correccion_pedida_por := old.correccion_pedida_por;
    elsif old.motivo_version = 'correccion' then
      -- Ya corregida antes: un cambio técnico posterior no borra quién pidió la corrección.
      new.motivo_version := 'correccion';
      new.correccion_pedida_por := old.correccion_pedida_por;
    else
      new.motivo_version := 'republicacion_tecnica';
      new.correccion_pedida_por := null;
    end if;
    new.correccion_solicitada := null;
  else
    new.version := old.version;
    new.motivo_version := old.motivo_version;
    -- Solo cambia cuando decidir_revision_semanal pide una corrección (queda a nombre de quien la pide
    -- ahora, aunque el texto sea el mismo que ya había), nunca por una edición suelta.
    if not (new.correccion_solicitada is not null and new.correccion_pedida_por is not distinct from auth.uid()) then
      new.correccion_pedida_por := old.correccion_pedida_por;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.decidir_revision_semanal(
  p_usuario uuid, p_semana date, p_version integer, p_aprobar boolean, p_correccion text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  revision public.videos_semanales%rowtype;
begin
  if auth.uid() is null or public.es_coach() is not true then
    raise exception 'Solo el coach puede revisar' using errcode = '42501';
  end if;
  select * into revision from public.videos_semanales
    where usuario_id = p_usuario and semana = p_semana for update;
  if not found or revision.version is distinct from p_version or revision.aprobado_en is not null then
    raise exception 'La revisión cambió. Actualiza la bandeja antes de decidir.' using errcode = '40001';
  end if;
  if p_aprobar is null then
    raise exception 'Falta la decisión';
  end if;
  if p_aprobar then
    if nullif(trim(revision.guion), '') is null or revision.correccion_solicitada is not null then
      raise exception 'Esta revisión necesita corregirse antes de firmar';
    end if;
    if revision.path !~ '^personas/[^/]+/[0-9-]+/[0-9a-f-]{36}\.[a-z0-9]+$' then
      raise exception 'Republica este archivo histórico como una versión nueva antes de firmarlo';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'medios-app' and name = revision.path) then
      raise exception 'El archivo de esta revisión no está disponible';
    end if;
    update public.videos_semanales set aprobado_en = now(), aprobado_por = auth.uid()
      where usuario_id = p_usuario and semana = p_semana;
  else
    if nullif(trim(p_correccion), '') is null or length(p_correccion) > 4000 then
      raise exception 'Escribe la corrección (máximo 4000 caracteres)';
    end if;
    update public.videos_semanales set correccion_solicitada = trim(p_correccion),
      correccion_pedida_por = auth.uid(),
      aprobado_en = null, aprobado_por = null
      where usuario_id = p_usuario and semana = p_semana;
  end if;
end;
$$;
revoke all on function public.decidir_revision_semanal(uuid,date,integer,boolean,text) from public, anon;
grant execute on function public.decidir_revision_semanal(uuid,date,integer,boolean,text) to authenticated;

commit;
