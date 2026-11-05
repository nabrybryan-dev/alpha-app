-- ============================================================================
-- 0162 · Praxis: series y adherencia llenan el libro, y la función de DESHACER
-- ============================================================================
--
-- APLICADA en la base real el 5-nov-2026 con el sí de Bryan, tras pasar la prueba 262 en el CI del PR #424 (las 4 señales de comprobar-migraciones dan SI). Escrita el 5-nov-2026 (pasos D2 y D3 del plano
-- CONEXIONES-OPERATIVAS-PRAXIS-20261104). Nada la llama todavía: la Edge Function `praxis-registro` seguirá
-- usando `fijar_series_ejercicio` y el upsert de adherencia hasta que otro cambio, aparte, pase a estas RPC.
-- La prueba `supabase/test/262-praxis-libro-series-adherencia.sql` corre en el CI sobre base vacía.
-- Necesita la 0161 aplicada (el libro `praxis_registros_aplicados`).
--
-- NÚMERO. 0162 = el siguiente libre. Revisadas el 5-nov las migraciones de todas las ramas locales y remotas
-- (`git ls-tree` sobre cada una de `git branch -a`): ninguna pasa de 0161. Si otra rama toma el 0162 antes de
-- aplicar esta, renumerar esta.
--
-- QUÉ CREA (4 funciones; ninguna tabla nueva ni ningún cambio a una tabla existente).
--   1. `praxis_series_actuales(microciclo, ejercicio)`: ayudante interno, lee las series de UN ejercicio.
--      Sin permiso para `authenticated` ni `anon`: solo la llaman las funciones de abajo.
--   2. `praxis_aplicar_series(mensaje_id, indice, microciclo_id, ejercicio_id, series)`: guarda las series
--      finales de un ejercicio y anota en el libro el `antes` y el `despues`. Una vez por tarjeta.
--   3. `praxis_aplicar_adherencia(mensaje_id, indice, fecha, estado)`: marca si/parcial/no de hoy o ayer
--      (Bogotá) y anota el `antes` (o «no existía»). Una vez por tarjeta.
--   4. `praxis_deshacer(registro_id, mensaje_id, confirmado)`: revierte UN registro del libro.
--
-- ELECCIÓN (la menos invasiva). NO se cambia `fijar_series_ejercicio` ni `fijar_test_post` (0037): la app las
-- usa y su prueba exige que sean `invoker`. `praxis_aplicar_series` las ENVUELVE: valida, lee el `antes`, anota
-- el libro y llama a `fijar_series_ejercicio` por dentro. Así la escritura y la reversión van por la MISMA vía
-- que ya existe. Alternativa descartada: añadir un trigger al microciclo para llenar el libro; habría anotado
-- también lo que escribe la app (no es de Praxis) y tocado una tabla con datos reales. La adherencia no tiene
-- RPC propia (hoy es un upsert directo), así que `praxis_aplicar_adherencia` hace el mismo upsert por
-- `(usuario_id, fecha)` que hace la Edge Function, sin tocar el `comentario` que ya hubiera.
-- Quedan FUERA a propósito: `fijar_test_post` (RPE y duración): el libro de la 0161 no tiene tipo para
-- ello y ampliarlo exige tocar el check de la tabla; va en su propia migración si Bryan lo pide. Agua ya la
-- cubre la 0161; deshacer agua, comida y check-in llega con sus fases (D4/D5): `praxis_deshacer` los rechaza.
--
-- QUIÉN PUEDE QUÉ (mismo molde que la 0161).
--   · Todas son `security definer`, `search_path` fijo, y NO reciben `usuario_id`: toman `auth.uid()`.
--     Sin sesión se niegan. `revoke execute from public, anon`; `grant` a `authenticated` y `service_role`.
--   · Series: el microciclo debe ser de quien llama (aunque sea coach: Praxis registra lo propio). La RLS del
--     microciclo deja al coach escribir en el de otro; esta función NO se lo deja.
--   · Deshacer: solo el DUEÑO del registro. El equipo (`es_staff()`) LEE el libro (política de la 0161) pero
--     no deshace lo ajeno: se le responde igual que si no existiera (no se revela).
--
-- DESHACER, REGLAS (decisión de Bryan, 5-nov: solo el mismo día de Bogotá).
--   1. Hace falta `p_confirmado = true`. La confirmación humana (botón, token de 2 minutos) la maneja la Edge
--      Function; aquí se exige el sí para que ninguna llamada suelta deshaga sin pasar por ella.
--   2. El registro debe ser de quien llama y no estar ya deshecho. Deshacerlo otra vez NO hace nada y no cambia
--      `deshecho_mensaje_id`: devuelve `ya_deshecho = true`.
--   3. `creado_en` debe caer en el MISMO día de Bogotá que hoy (no «24 horas»: 23:59 de ayer ya no vale).
--      Si no, se rechaza con el mensaje «otro dia».
--   4. Revalida contra lo actual: si lo guardado ya no es igual al `despues` del libro (alguien cambió después),
--      NO toca nada y devuelve `deshecho = false, motivo = 'cambio_despues'`.
--   5. Revierte con la misma vía: series -> `fijar_series_ejercicio` con el `antes`; adherencia -> restaura el
--      `antes` o, si no existía, borra la fila (único borrado permitido: el libro prueba que la creó Praxis).
--   6. Marca `deshecho_en = now()` y `deshecho_mensaje_id`. Nunca borra del libro.
--
-- IDEMPOTENCIA. Igual que el agua: se intenta primero la fila del libro por `(usuario_id, mensaje_id, indice)`;
-- si ya estaba, no se escribe nada y se devuelve `ya_aplicado = true`. Libro y dato van en la MISMA transacción.
-- Las series toman bloqueo de fila del microciclo; la adherencia, un bloqueo asesor por `(usuario, fecha)`.
--
-- CÓMO REVERTIRLA (no toca el libro ni los datos ya guardados):
--   begin;
--   drop function if exists public.praxis_deshacer(uuid, text, boolean);
--   drop function if exists public.praxis_aplicar_adherencia(text, int, date, text);
--   drop function if exists public.praxis_aplicar_series(text, int, text, text, jsonb);
--   drop function if exists public.praxis_series_actuales(text, text);
--   commit;
--   Ojo: lo ya anotado en el libro como 'series'/'adherencia' queda sin poder deshacerse desde la base.
--
-- QUÉ DEBE REVISAR BRYAN antes de aplicarla: ver «Para revisión» al final de este archivo.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1 · Ayudante interno: las series de UN ejercicio (null = ese ejercicio no existe en ese microciclo)
-- ---------------------------------------------------------------------------
create or replace function public.praxis_series_actuales(p_microciclo_id text, p_ejercicio_id text)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(e -> 'series', '[]'::jsonb)
    from public.microciclos m,
         lateral jsonb_array_elements(case when jsonb_typeof(m.datos -> 'sesiones') = 'array'
                                           then m.datos -> 'sesiones' else '[]'::jsonb end) s,
         lateral jsonb_array_elements(case when jsonb_typeof(s -> 'ejercicios') = 'array'
                                           then s -> 'ejercicios' else '[]'::jsonb end) e
   where m.id = p_microciclo_id and e ->> 'id' = p_ejercicio_id
   limit 1
$$;

revoke execute on function public.praxis_series_actuales(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2 · Series: guarda y anota
-- ---------------------------------------------------------------------------
create or replace function public.praxis_aplicar_series(
  p_mensaje_id    text,
  p_indice        int,
  p_microciclo_id text,
  p_ejercicio_id  text,
  p_series        jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_mensaje text := btrim(p_mensaje_id);
  v_antes   jsonb;
  v_libro   uuid;
begin
  if v_uid is null then
    raise exception 'praxis_aplicar_series: hace falta una sesion' using errcode = '42501';
  end if;
  if v_mensaje is null or length(v_mensaje) not between 1 and 120 then
    raise exception 'praxis_aplicar_series: mensaje_id invalido' using errcode = '22023';
  end if;
  if p_indice is null or p_indice not between 0 and 11 then
    raise exception 'praxis_aplicar_series: indice invalido' using errcode = '22023';
  end if;
  if p_microciclo_id is null or p_ejercicio_id is null then
    raise exception 'praxis_aplicar_series: faltan microciclo o ejercicio' using errcode = '22023';
  end if;
  if p_series is null or jsonb_typeof(p_series) <> 'array' or jsonb_array_length(p_series) not between 1 and 20 then
    raise exception 'praxis_aplicar_series: las series deben ser una lista de 1 a 20' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_series) e
              where jsonb_typeof(e) <> 'object'
                 or jsonb_typeof(e -> 'orden') is distinct from 'number'
                 or coalesce(e ->> 'orden', '') !~ '^([1-9]|1[0-9]|20)$')
     or (select count(distinct e ->> 'orden') from jsonb_array_elements(p_series) e) <> jsonb_array_length(p_series) then
    raise exception 'praxis_aplicar_series: cada serie necesita un orden entero de 1 a 20, sin repetir' using errcode = '22023';
  end if;

  -- El microciclo debe ser de quien llama; se bloquea la fila para que dos tarjetas no se pisen.
  perform 1 from public.microciclos m
   where m.id = p_microciclo_id and m.usuario_id = v_uid and m.estado = 'activo'
   for update;
  if not found then
    raise exception 'praxis_aplicar_series: ese microciclo no es tuyo, no esta activo o no existe' using errcode = '42501';
  end if;

  v_antes := public.praxis_series_actuales(p_microciclo_id, p_ejercicio_id);
  if v_antes is null then
    raise exception 'praxis_aplicar_series: ese ejercicio no esta en el microciclo' using errcode = '22023';
  end if;

  -- 1) El libro primero: si la tarjeta ya estaba, no se escribe nada.
  insert into public.praxis_registros_aplicados (usuario_id, tipo, mensaje_id, indice, ref, antes, despues)
  values (v_uid, 'series', v_mensaje, p_indice,
          jsonb_build_object('microciclo_id', p_microciclo_id, 'ejercicio_id', p_ejercicio_id),
          jsonb_build_object('series', v_antes),
          jsonb_build_object('series', p_series))
  on conflict (usuario_id, mensaje_id, indice) do nothing
  returning id into v_libro;

  if v_libro is null then
    return jsonb_build_object(
      'ya_aplicado', true,
      'registro_id', (select r.id from public.praxis_registros_aplicados r
                       where r.usuario_id = v_uid and r.mensaje_id = v_mensaje and r.indice = p_indice));
  end if;

  -- 2) La misma vía de escritura que usa la app (0037).
  perform public.fijar_series_ejercicio(p_microciclo_id, p_ejercicio_id, p_series);

  return jsonb_build_object('ya_aplicado', false, 'registro_id', v_libro);
end
$$;

comment on function public.praxis_aplicar_series(text, int, text, text, jsonb) is
  'Guarda las series finales de UN ejercicio del microciclo activo de quien llama, via fijar_series_ejercicio, y anota antes/despues en el libro. Una vez por tarjeta (usuario, mensaje, indice). 0162.';

revoke execute on function public.praxis_aplicar_series(text, int, text, text, jsonb) from public, anon;
grant execute on function public.praxis_aplicar_series(text, int, text, text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3 · Adherencia: guarda y anota
-- ---------------------------------------------------------------------------
create or replace function public.praxis_aplicar_adherencia(
  p_mensaje_id text,
  p_indice     int,
  p_fecha      date,
  p_estado     text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_hoy     date := (now() at time zone 'America/Bogota')::date;
  v_mensaje text := btrim(p_mensaje_id);
  v_id      text;
  v_libro   uuid;
  v_existia boolean;
  v_estado  text;
  v_coment  text;
begin
  if v_uid is null then
    raise exception 'praxis_aplicar_adherencia: hace falta una sesion' using errcode = '42501';
  end if;
  if v_mensaje is null or length(v_mensaje) not between 1 and 120 then
    raise exception 'praxis_aplicar_adherencia: mensaje_id invalido' using errcode = '22023';
  end if;
  if p_indice is null or p_indice not between 0 and 11 then
    raise exception 'praxis_aplicar_adherencia: indice invalido' using errcode = '22023';
  end if;
  if p_estado is null or p_estado not in ('si', 'parcial', 'no') then
    raise exception 'praxis_aplicar_adherencia: el estado debe ser si, parcial o no' using errcode = '22023';
  end if;
  -- Solo hoy o ayer, en hora de Bogotá (espejo de prepararAdherencia en guardado.ts).
  if p_fecha is null or p_fecha not in (v_hoy, v_hoy - 1) then
    raise exception 'praxis_aplicar_adherencia: la adherencia solo se marca de hoy o de ayer' using errcode = '22023';
  end if;

  v_id := 'ad-' || v_uid::text || '-' || p_fecha::text;   -- mismo id que arma guardado.ts
  perform pg_advisory_xact_lock(hashtext(v_id));

  insert into public.praxis_registros_aplicados (usuario_id, tipo, mensaje_id, indice, ref)
  values (v_uid, 'adherencia', v_mensaje, p_indice, jsonb_build_object('fila_id', v_id, 'fecha', p_fecha))
  on conflict (usuario_id, mensaje_id, indice) do nothing
  returning id into v_libro;

  if v_libro is null then
    return jsonb_build_object(
      'ya_aplicado', true,
      'registro_id', (select r.id from public.praxis_registros_aplicados r
                       where r.usuario_id = v_uid and r.mensaje_id = v_mensaje and r.indice = p_indice));
  end if;

  select a.estado, a.comentario into v_estado, v_coment
    from public.adherencias a where a.usuario_id = v_uid and a.fecha = p_fecha;
  v_existia := found;

  -- Una fila por (usuario, fecha); el comentario que ya hubiera no se toca.
  insert into public.adherencias (id, usuario_id, fecha, estado)
  values (v_id, v_uid, p_fecha, p_estado)
  on conflict (usuario_id, fecha) do update set estado = excluded.estado;

  update public.praxis_registros_aplicados
     set antes   = case when v_existia then jsonb_build_object('estado', v_estado, 'comentario', v_coment) end,
         despues = jsonb_build_object('estado', p_estado, 'comentario', v_coment)
   where id = v_libro;

  return jsonb_build_object('ya_aplicado', false, 'registro_id', v_libro, 'fecha', p_fecha);
end
$$;

comment on function public.praxis_aplicar_adherencia(text, int, date, text) is
  'Marca la adherencia (si/parcial/no) de hoy o ayer en hora de Bogota para quien llama y anota antes/despues en el libro. Una vez por tarjeta. 0162.';

revoke execute on function public.praxis_aplicar_adherencia(text, int, date, text) from public, anon;
grant execute on function public.praxis_aplicar_adherencia(text, int, date, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4 · Deshacer
-- ---------------------------------------------------------------------------
create or replace function public.praxis_deshacer(
  p_registro_id uuid,
  p_mensaje_id  text,
  p_confirmado  boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_hoy     date := (now() at time zone 'America/Bogota')::date;
  v_mensaje text := btrim(p_mensaje_id);
  v_reg     public.praxis_registros_aplicados%rowtype;
  v_mc      text;
  v_ej      text;
  v_fecha   date;
  v_estado  text;
  v_coment  text;
  v_hay     boolean;
begin
  if v_uid is null then
    raise exception 'praxis_deshacer: hace falta una sesion' using errcode = '42501';
  end if;
  if v_mensaje is null or length(v_mensaje) not between 1 and 120 then
    raise exception 'praxis_deshacer: mensaje_id invalido' using errcode = '22023';
  end if;
  if p_confirmado is distinct from true then
    raise exception 'praxis_deshacer: hace falta la confirmacion de la persona' using errcode = '22023';
  end if;

  -- Solo el dueño. Si no existe o es de otra persona, el mismo mensaje (no se revela cuál de las dos).
  select * into v_reg from public.praxis_registros_aplicados r
   where r.id = p_registro_id and r.usuario_id = v_uid
   for update;
  if not found then
    raise exception 'praxis_deshacer: ese registro no existe o no es tuyo' using errcode = '42501';
  end if;

  if v_reg.deshecho_en is not null then
    return jsonb_build_object('deshecho', false, 'ya_deshecho', true, 'registro_id', v_reg.id);
  end if;

  if (v_reg.creado_en at time zone 'America/Bogota')::date <> v_hoy then
    raise exception 'praxis_deshacer: ese registro es de otro dia (Bogota); corrigelo con el valor correcto' using errcode = '22023';
  end if;

  if v_reg.tipo = 'series' then
    v_mc := v_reg.ref ->> 'microciclo_id';
    v_ej := v_reg.ref ->> 'ejercicio_id';
    perform 1 from public.microciclos m where m.id = v_mc and m.usuario_id = v_uid for update;
    if not found
       or public.praxis_series_actuales(v_mc, v_ej) is distinct from (v_reg.despues -> 'series') then
      return jsonb_build_object('deshecho', false, 'motivo', 'cambio_despues', 'registro_id', v_reg.id);
    end if;
    perform public.fijar_series_ejercicio(v_mc, v_ej, v_reg.antes -> 'series');

  elsif v_reg.tipo = 'adherencia' then
    v_fecha := (v_reg.ref ->> 'fecha')::date;
    perform pg_advisory_xact_lock(hashtext(v_reg.ref ->> 'fila_id'));
    select a.estado, a.comentario into v_estado, v_coment
      from public.adherencias a where a.usuario_id = v_uid and a.fecha = v_fecha;
    v_hay := found;
    if not v_hay
       or jsonb_build_object('estado', v_estado, 'comentario', v_coment) is distinct from v_reg.despues then
      return jsonb_build_object('deshecho', false, 'motivo', 'cambio_despues', 'registro_id', v_reg.id);
    end if;
    if v_reg.antes is null then
      delete from public.adherencias where usuario_id = v_uid and fecha = v_fecha;
    else
      update public.adherencias
         set estado = v_reg.antes ->> 'estado', comentario = v_reg.antes ->> 'comentario'
       where usuario_id = v_uid and fecha = v_fecha;
    end if;

  else
    raise exception 'praxis_deshacer: el tipo % todavia no se puede deshacer', v_reg.tipo using errcode = '22023';
  end if;

  update public.praxis_registros_aplicados
     set deshecho_en = now(), deshecho_mensaje_id = v_mensaje
   where id = v_reg.id;

  return jsonb_build_object('deshecho', true, 'ya_deshecho', false, 'registro_id', v_reg.id, 'tipo', v_reg.tipo);
end
$$;

comment on function public.praxis_deshacer(uuid, text, boolean) is
  'Revierte UN registro del libro de quien llama, solo el mismo dia de Bogota, con confirmacion, si lo guardado sigue igual al despues; marca deshecho_en y deshecho_mensaje_id. Hoy: series y adherencia. 0162.';

revoke execute on function public.praxis_deshacer(uuid, text, boolean) from public, anon;
grant execute on function public.praxis_deshacer(uuid, text, boolean) to authenticated, service_role;

commit;

-- ============================================================================
-- Para revisión de Bryan
--   1. «Mismo día de Bogotá» se cuenta desde `creado_en` del libro, no desde la fecha del dato: una adherencia
--      de AYER marcada hoy SÍ se puede deshacer hoy; mañana ya no.
--   2. La confirmación aquí es solo el booleano `p_confirmado`; el token de 2 minutos y el botón viven en la
--      Edge Function (D3, aún sin escribir). Si se quiere que la base también verifique el token, hay que
--      decidirlo ahora.
--   3. Series: si entre guardar y deshacer cambió CUALQUIER cosa de las series de ese ejercicio (también la
--      app), no se deshace y se avisa. Es estricto a propósito; mejor no pisar.
--   4. Series exige microciclo propio y `estado = 'activo'`. El coach NO puede guardar series en el microciclo
--      de otra persona por esta vía (por la RPC vieja y la RLS sí podía).
--   5. Fuera: `fijar_test_post` (RPE/duración) no escribe el libro; agua, comida y check-in no se deshacen.
--   6. Deshacer no revierte XP ni rachas (sin medir, pregunta 3 del diseño); queda como estaba decidido.
--   7. Primero la 0161 (ya aplicada); luego correr `comprobar-migraciones.sql`: las señales '0162' deben dar SI.
-- ============================================================================
