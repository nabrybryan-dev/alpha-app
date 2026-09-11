-- 0057 · El asesorado estrena su ficha: su medida la mete el servidor.
--
-- QUÉ FALLABA (medido el 2026-09-06 en la base real: 3 asesorados activos de 24 sin
-- ficha, y por tanto sin poder registrar una sola medida desde su cuenta).
-- `proteger_perfil` (0008, y la 0056 lo conserva) deja al asesorado escribir solo sus
-- medidas, y en un INSERT exige que el blob no lleve NADA más que `medidas`. Pero la
-- app, cuando alguien sin ficha registra su primera medida, fabrica la ficha entera
-- con valores por defecto (`objetivos: ''`, `edad: 0`…) y la sube completa; como el
-- blob lleva al menos `usuarioId`, ningún asesorado ha podido crear jamás su propia
-- fila. La cola reintenta tres veces y lo descarta en silencio: la medida se ve en su
-- móvil y no existe en la nube, y en el servidor no queda rastro.
--
-- QUÉ CAMBIA.
-- 1. Una función `registrar_medida(p_medida)` que hace lo que la app hacía a mano con
--    el blob entero: crea la ficha si no existe —solo `usuarioId` y `medidas`— y, si
--    existe, sustituye la medida de la misma fecha y deja las medidas ordenadas por
--    fecha. Es `security invoker`: la RLS de `perfiles` sigue mandando (0007: cada
--    cual su fila), y a quién se le escribe sale de `auth.uid()`, no de un parámetro:
--    no hay forma de meterle una medida a otra persona.
-- 2. `proteger_perfil` admite ese INSERT: el blob puede llevar `usuarioId` además de
--    `medidas`, siempre que sea el suyo. Todo lo demás sigue igual: el UPDATE solo
--    puede tocar `medidas`, y el sexo lo indica el coach (0056).
--
-- ORDEN DE DESPLIEGUE: va ANTES que el código, como la 0056. Un cliente viejo que siga
-- subiendo el blob entero se comporta como hoy (rechazado si no tiene ficha, aceptado
-- si la tiene); un cliente nuevo contra una base sin esta migración llamaría a una
-- función inexistente y la cola descartaría la medida. Por eso va primero.

begin;

create or replace function registrar_medida(p_medida jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  quien uuid := auth.uid();
begin
  if quien is null then
    raise exception 'Solo con sesión iniciada';
  end if;
  if jsonb_typeof(p_medida) is distinct from 'object' or coalesce(p_medida ->> 'fecha', '') = '' then
    raise exception 'La medida necesita fecha';
  end if;

  insert into public.perfiles (usuario_id, datos)
  values (quien, jsonb_build_object('usuarioId', quien::text, 'medidas', jsonb_build_array(p_medida)))
  on conflict (usuario_id) do update
    set datos = jsonb_set(
      perfiles.datos,
      '{medidas}',
      (
        select coalesce(jsonb_agg(m order by m ->> 'fecha'), '[]'::jsonb)
        from (
          select m
          from jsonb_array_elements(coalesce(perfiles.datos -> 'medidas', '[]'::jsonb)) m
          where m ->> 'fecha' is distinct from p_medida ->> 'fecha'
          union all
          select p_medida
        ) medidas(m)
      )
    );
end;
$$;

-- `create function` concede EXECUTE a PUBLIC (y `anon` es miembro): se quita y se da
-- solo a quien tiene sesión. Misma regla que la 0037 y que GUIA-BRYAN.md §10.
revoke execute on function registrar_medida(jsonb) from public, anon;
grant execute on function registrar_medida(jsonb) to authenticated;

comment on function registrar_medida(jsonb) is
  'La medida del asesorado, metida por el servidor: crea su ficha si no existe y sustituye la de la misma fecha. security invoker: la RLS manda.';

create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- auth.uid() nulo = contexto de servicio/migración (sin sesión de usuario)
  if auth.uid() is null or public.es_coach() then
    return new;
  end if;
  -- El resto del JSON (todo menos 'medidas') debe quedar idéntico. (0008)
  if tg_op = 'UPDATE'
     and (new.datos - 'medidas') is distinct from (old.datos - 'medidas') then
    raise exception 'Solo puedes actualizar tus medidas';
  end if;
  -- Al estrenar la ficha, el blob puede llevar su propio `usuarioId` y nada más. (0057)
  if tg_op = 'INSERT'
     and ((new.datos - 'medidas' - 'usuarioId') <> '{}'::jsonb
          or ((new.datos ? 'usuarioId') and new.datos ->> 'usuarioId' is distinct from auth.uid()::text)) then
    raise exception 'Solo puedes registrar tus medidas';
  end if;
  -- El sexo lo indica el coach. Vive fuera del blob, así que se mira aparte. (0056)
  if tg_op = 'UPDATE' and new.sexo is distinct from old.sexo then
    raise exception 'Solo el coach puede indicar el sexo';
  end if;
  if tg_op = 'INSERT' and new.sexo is not null then
    raise exception 'Solo el coach puede indicar el sexo';
  end if;
  return new;
end;
$$;

commit;

-- Señal: `0057 - el asesorado estrena su ficha` en supabase/comprobar-migraciones.sql
