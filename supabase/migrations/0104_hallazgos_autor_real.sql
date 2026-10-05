-- ============================================================================
-- 0104 · Los comentarios de hallazgos guardan quién comentó de verdad
-- ============================================================================
--
-- Corrige un hueco de la 0103 (NO se edita la 0103: ya está aplicada). En
-- `comentar_hallazgo_mercadeo()` quien comenta con `responder_mercadeo` sin ser coach quedaba
-- con `autor = 'manuela'`, aunque fuera otra persona del equipo con esa capacidad. El
-- `autor_id` (auth.uid()) ya guardaba quién era, pero lo que se LEE decía «Manuela».
--
-- Arreglo: una columna `autor_nombre` con el nombre real de staff (usuarios_app.nombre) que la
-- función rellena siempre, además de `autor_id`. `autor` sigue siendo el papel
-- (manuela / bryan / agente) para no romper a la app; quien muestre el hilo debe preferir
-- `autor_nombre` cuando exista. El agente (service_role) no tiene nombre de staff: queda null.
--
-- SIN APLICAR: la aplica Bryan. La app todavía no lee `autor_nombre`, así que aplicarla no
-- rompe nada. Reversible: la columna es nueva y nullable.
-- ============================================================================

begin;

alter table public.mercadeo_hallazgo_comentarios
  add column if not exists autor_nombre text check (char_length(btrim(autor_nombre)) between 1 and 120);

comment on column public.mercadeo_hallazgo_comentarios.autor_nombre is
  'Nombre real de quien comentó (usuarios_app.nombre al momento de comentar, 0104). Null en las respuestas del agente.';

-- Los comentarios ya escritos: se rellena con el nombre actual de su autor_id.
update public.mercadeo_hallazgo_comentarios c
   set autor_nombre = nullif(btrim(u.nombre), '')
  from public.usuarios_app u
 where c.autor_id = u.id and c.autor_nombre is null;

create or replace function public.comentar_hallazgo_mercadeo(p_hallazgo_id uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo     uuid := auth.uid();
  h        public.mercadeo_hallazgos%rowtype;
  v_autor  text;
  v_nombre text;
  v_id     uuid;
begin
  if v_yo is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if public.es_coach() then
    v_autor := 'bryan';
  elsif public.tiene_capacidad('responder_mercadeo') then
    v_autor := 'manuela';
  else
    raise exception 'no puedes comentar la investigación de mercadeo' using errcode = '42501';
  end if;
  -- El autor real: su nombre de staff. Si no tiene, el papel con el que comenta.
  select nullif(btrim(nombre), '') into v_nombre from public.usuarios_app where id = v_yo;
  v_nombre := coalesce(v_nombre, case v_autor when 'bryan' then 'Bryan' else 'Equipo de mercadeo' end);

  select * into h from public.mercadeo_hallazgos where id = p_hallazgo_id for update;
  if not found then
    raise exception 'ese hallazgo no existe' using errcode = 'P0002';
  end if;
  if h.estado = 'descartado' then
    raise exception 'ese hallazgo está descartado: ya no admite comentarios' using errcode = '23514';
  end if;

  insert into public.mercadeo_hallazgo_comentarios (hallazgo_id, autor, autor_id, autor_nombre, texto)
  values (p_hallazgo_id, v_autor, v_yo, v_nombre, btrim(coalesce(p_texto, '')))
  returning id into v_id;

  if h.estado in ('nuevo', 'fortalecido') then
    update public.mercadeo_hallazgos set estado = 'en_discusion', actualizado_en = now() where id = p_hallazgo_id;
  end if;
  return v_id;
end
$$;
revoke all on function public.comentar_hallazgo_mercadeo(uuid, text) from public, anon;
grant execute on function public.comentar_hallazgo_mercadeo(uuid, text) to authenticated, service_role;

commit;
