-- 0065 · Los días que una persona puede entrenar, dichos por ella y con nombre.
--
-- EL DATO QUE NADIE TENÍA (medido el 2026-09-10): los 27 perfiles con el campo
-- `diasEntrenamiento` guardan un NÚMERO —cuántos días por semana— y ninguno guarda
-- CUÁLES. Son dos hechos distintos que llevaban semanas compartiendo un nombre, y esta
-- casa ya sabe cómo acaba eso. Aquí nace el segundo, en su propia clave del blob:
-- `diasDisponibles`, una lista de nombres de día. El número no se toca.
--
-- POR QUÉ IMPORTA: el invariante I-38 del cerebro solo acepta un día que la persona haya
-- DECLARADO —encontrar «lunes» en su expediente no es que pueda los lunes—, y sin este
-- campo la cadena se detiene a preguntárselo a cada uno en su primera corrida. Que lo
-- diga en el formulario de salud, una vez, es lo que evita 27 paradas de pago.
--
-- QUIÉN LO ESCRIBE. La persona, desde su app. Y como el trigger `proteger_perfil` (0008,
-- 0057) solo le deja tocar `medidas` del blob, sigue el mismo patrón que la 0057 con la
-- medida: NO sube el blob entero —lo rechazaría—, llama a una función `security invoker`
-- que escribe SOLO esa clave, para quien tiene la sesión iniciada (`auth.uid()`, no un
-- parámetro: no hay forma de escribirle los días a otra persona), y el trigger admite esa
-- clave además de `medidas`. Todo lo demás del perfil sigue siendo del coach.
--
-- ORDEN DE DESPLIEGUE: va ANTES que el código, como la 0057. Un cliente viejo no llama a
-- nada nuevo; un cliente nuevo contra una base sin esto llamaría a una función que no
-- existe y la cola descartaría los días — por eso va primero.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · La función que escribe SOLO los días, y solo los propios
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.registrar_dias_disponibles(p_dias jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $dias$
declare
  quien uuid := auth.uid();
  raros int;
  distintos int;
begin
  if quien is null then
    raise exception 'Solo con sesión iniciada';
  end if;
  if jsonb_typeof(p_dias) is distinct from 'array' then
    raise exception 'Los días van en una lista';
  end if;
  if jsonb_array_length(p_dias) = 0 then
    raise exception 'Al menos un día';
  end if;

  -- Vocabulario CERRADO, el mismo del cerebro y de la app: un «lunes» en minúscula o
  -- un «L» no son un día, son una traducción pendiente, y aquí no se traduce.
  select count(*) into raros
  from jsonb_array_elements_text(p_dias) d
  where d not in ('LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO');
  if raros > 0 then
    raise exception 'Día desconocido: solo LUNES…DOMINGO, en mayúsculas y con tilde';
  end if;

  select count(distinct d) into distintos from jsonb_array_elements_text(p_dias) d;
  if distintos <> jsonb_array_length(p_dias) then
    raise exception 'Día repetido';
  end if;

  insert into public.perfiles (usuario_id, datos)
  values (quien, jsonb_build_object('usuarioId', quien::text, 'diasDisponibles', p_dias))
  on conflict (usuario_id) do update
    set datos = jsonb_set(perfiles.datos, '{diasDisponibles}', p_dias, true);
end;
$dias$;

-- `create function` concede EXECUTE a PUBLIC y todo lo de `public` se expone como RPC a
-- `anon`: sin este revoke, la clave pública podría escribir perfiles.
revoke execute on function public.registrar_dias_disponibles(jsonb) from public, anon;
grant execute on function public.registrar_dias_disponibles(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · El trigger admite esa clave, y NADA más cambia
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Copia literal de la 0057 con una sola diferencia: `diasDisponibles` se resta junto a
-- `medidas` en la comparación. El sexo sigue siendo del coach; el resto del blob también.

create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.es_coach() then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (new.datos - 'medidas' - 'diasDisponibles')
         is distinct from (old.datos - 'medidas' - 'diasDisponibles') then
    raise exception 'Solo puedes actualizar tus medidas y tus días';
  end if;

  if tg_op = 'INSERT'
     and ((new.datos - 'medidas' - 'diasDisponibles' - 'usuarioId') <> '{}'::jsonb
          or ((new.datos ? 'usuarioId') and new.datos ->> 'usuarioId' is distinct from auth.uid()::text)) then
    raise exception 'Solo puedes registrar tus medidas y tus días';
  end if;

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
