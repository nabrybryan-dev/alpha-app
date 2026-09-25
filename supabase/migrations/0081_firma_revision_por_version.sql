begin;

alter table public.videos_semanales
  add column if not exists version integer not null default 1,
  add column if not exists aprobado_por uuid references auth.users(id),
  add column if not exists correccion_solicitada text;

create or replace function public.versionar_revision_semanal()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.aprobado_en := null;
    new.aprobado_por := null;
  elsif row(new.path, new.guion, new.tipo, new.publicado_en)
      is distinct from row(old.path, old.guion, old.tipo, old.publicado_en) then
    new.version := old.version + 1;
    new.aprobado_en := null;
    new.aprobado_por := null;
    new.correccion_solicitada := null;
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;
revoke all on function public.versionar_revision_semanal() from public, anon, authenticated;
create trigger versionar_revision_semanal
  before insert or update on public.videos_semanales
  for each row execute function public.versionar_revision_semanal();

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
      aprobado_en = null, aprobado_por = null
      where usuario_id = p_usuario and semana = p_semana;
  end if;
end;
$$;
revoke all on function public.decidir_revision_semanal(uuid,date,integer,boolean,text) from public, anon;
grant execute on function public.decidir_revision_semanal(uuid,date,integer,boolean,text) to authenticated;
commit;
