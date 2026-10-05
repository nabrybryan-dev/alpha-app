-- Organizador de Bryan y Manuela (migración 0098): plan_items.
--
-- Lo que se prueba:
--   1. El check de capacidades acepta las anteriores MÁS `organizar_plan` y rechaza una inventada.
--   2. Cada dueño crea y edita lo SUYO; nadie inserta con el dueño del otro.
--   3. Lectura: Bryan (coach) ve lo suyo y lo de Manuela; Manuela solo lo suyo; un staff sin la
--      capacidad y un asesorado no ven nada; anon no toca nada.
--   4. Nadie borra; el nivel, el padre y el dueño no se cambian después de crear la fila.
--   5. Reglas de la base: objetivo sin padre, hito bajo objetivo, tarea bajo hito; tarea de
--      50 min como máximo; máximo 3 tareas por día; una sola principal por dueño y día;
--      «hecha» exige hecha_en.
--
-- Bloque de UUID propio (e9…/f9…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
insert into auth.users (id, email) values
  ('e9000000-0000-0000-0000-000000000001', 'pl-asesorado@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000001', 'pl-manuela@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000002', 'pl-bryan@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000003', 'pl-otra@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000004', 'pl-barrido@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('e9000000-0000-0000-0000-000000000001', 'Asesorado cualquiera', 'asesorado', 'AC'),
  ('f9000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('f9000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('f9000000-0000-0000-0000-000000000003', 'Otra del equipo', 'nutricionista', 'OE'),
  ('f9000000-0000-0000-0000-000000000004', 'Barrido de capacidades', 'nutricionista', 'BC')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('f9000000-0000-0000-0000-000000000001', 'organizar_plan')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · El check de capacidades
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  c text;
begin
  foreach c in array array[
    'leer_entrenamiento', 'responder_por_asesorado', 'detener_publicacion', 'reportar_riesgo',
    'autorizar_excepcion', 'firmar_politica', 'aprobar_primer_plan', 'aprobar_plan_estrategico',
    'revisar_creadores', 'firmar_creadores', 'decisiones_compartidas', 'triar_comentarios',
    'responder_mercadeo', 'organizar_plan'
  ] loop
    insert into public.capacidades_staff (usuario_id, capacidad)
    values ('f9000000-0000-0000-0000-000000000004', c);
  end loop;
  begin
    insert into public.capacidades_staff (usuario_id, capacidad)
    values ('f9000000-0000-0000-0000-000000000004', 'capacidad_inventada');
    raise exception 'FALLO: el check de capacidades aceptó una capacidad inventada';
  exception when check_violation then null;
  end;
end $$;
delete from public.capacidades_staff where usuario_id = 'f9000000-0000-0000-0000-000000000004';

-- ─────────────────── Un plan de cada uno, cargado por el servidor ───────────────────
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.plan_items (id, nivel, padre_id, titulo, dueno, palanca, fecha, origen) values
  ('e9111111-0000-0000-0000-00000000000a', 'objetivo', null, 'Objetivo de Bryan', 'bryan', 'A', current_date + 60, 'prueba'),
  ('e9111111-0000-0000-0000-00000000000b', 'objetivo', null, 'Objetivo de Manuela', 'manuela', 'B', current_date + 60, 'prueba');
insert into public.plan_items (id, nivel, padre_id, titulo, dueno, fecha) values
  ('e9111111-0000-0000-0000-0000000000a1', 'hito', 'e9111111-0000-0000-0000-00000000000a', 'Hito de Bryan', 'bryan', current_date),
  ('e9111111-0000-0000-0000-0000000000b1', 'hito', 'e9111111-0000-0000-0000-00000000000b', 'Hito de Manuela', 'manuela', current_date);
insert into public.plan_items (id, nivel, padre_id, titulo, primer_paso, dueno, fecha, estimado_min, prioridad) values
  ('e9111111-0000-0000-0000-000000000a11', 'tarea', 'e9111111-0000-0000-0000-0000000000a1',
   'Tarea de Bryan', 'abrir el tablero y filtrar etapa2', 'bryan', current_date, 45, 'principal'),
  ('e9111111-0000-0000-0000-000000000b11', 'tarea', 'e9111111-0000-0000-0000-0000000000b1',
   'Tarea de Manuela', 'abrir la hoja de preguntas', 'manuela', current_date, 30, 'principal');
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Reglas de la base (como el servidor, sin RLS de por medio)
-- ════════════════════════════════════════════════════════════════════════
set role service_role;
do $$
begin
  -- objetivo con padre / hito sin padre / tarea sin padre
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno)
    values ('objetivo', 'e9111111-0000-0000-0000-00000000000a', 'objetivo con padre', 'bryan');
    raise exception 'FALLO: un objetivo aceptó un padre';
  exception when check_violation then null;
  end;
  begin
    insert into public.plan_items (nivel, titulo, dueno) values ('hito', 'hito sin padre', 'bryan');
    raise exception 'FALLO: un hito sin padre se guardó';
  exception when check_violation then null;
  end;
  begin
    insert into public.plan_items (nivel, titulo, dueno) values ('tarea', 'tarea sin padre', 'bryan');
    raise exception 'FALLO: una tarea sin padre se guardó';
  exception when check_violation then null;
  end;
  -- niveles cruzados: un hito bajo un hito, una tarea bajo un objetivo
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno)
    values ('hito', 'e9111111-0000-0000-0000-0000000000a1', 'hito bajo hito', 'bryan');
    raise exception 'FALLO: un hito colgó de un hito';
  exception when check_violation then null;
  end;
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno)
    values ('tarea', 'e9111111-0000-0000-0000-00000000000a', 'tarea bajo objetivo', 'bryan');
    raise exception 'FALLO: una tarea colgó de un objetivo';
  exception when check_violation then null;
  end;
  -- tarea de más de 50 min
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno, estimado_min)
    values ('tarea', 'e9111111-0000-0000-0000-0000000000a1', 'tarea larga', 'bryan', 51);
    raise exception 'FALLO: una tarea de 51 min se guardó';
  exception when check_violation then null;
  end;
  -- prioridad solo en tareas
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno, prioridad)
    values ('hito', 'e9111111-0000-0000-0000-00000000000a', 'hito con prioridad', 'bryan', 'principal');
    raise exception 'FALLO: un hito llevó prioridad';
  exception when check_violation then null;
  end;
  -- una segunda principal el mismo día del mismo dueño
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno, fecha, estimado_min, prioridad)
    values ('tarea', 'e9111111-0000-0000-0000-0000000000a1', 'otra principal', 'bryan', current_date, 20, 'principal');
    raise exception 'FALLO: dos principales el mismo día';
  exception when unique_violation then null;
  end;
  -- pero Manuela sí tiene la suya el mismo día (ya sembrada arriba) y Bryan otra al día siguiente
  insert into public.plan_items (nivel, padre_id, titulo, dueno, fecha, estimado_min, prioridad)
  values ('tarea', 'e9111111-0000-0000-0000-0000000000a1', 'principal de mañana', 'bryan', current_date + 1, 20, 'principal');
  -- hecha exige hecha_en
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno, estado)
    values ('tarea', 'e9111111-0000-0000-0000-0000000000a1', 'hecha sin hora', 'bryan', 'hecha');
    raise exception 'FALLO: una tarea hecha sin hecha_en se guardó';
  exception when check_violation then null;
  end;
end $$;

-- máximo 3 tareas por día: hoy Bryan ya tiene 1; con 2 pequeñas llega a 3; la cuarta no entra
insert into public.plan_items (nivel, padre_id, titulo, dueno, fecha, estimado_min, prioridad) values
  ('tarea', 'e9111111-0000-0000-0000-0000000000a1', 'pequena 1', 'bryan', current_date, 10, 'pequena'),
  ('tarea', 'e9111111-0000-0000-0000-0000000000a1', 'pequena 2', 'bryan', current_date, 10, 'pequena');
do $$
begin
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno, fecha, estimado_min, prioridad)
    values ('tarea', 'e9111111-0000-0000-0000-0000000000a1', 'pequena 3', 'bryan', current_date, 10, 'pequena');
    raise exception 'FALLO: una cuarta tarea del día se guardó';
  exception when check_violation then null;
  end;
  -- una descartada no cuenta: se puede volver a llenar el cupo sin sumar
  update public.plan_items set estado = 'descartada' where titulo = 'pequena 2';
  insert into public.plan_items (nivel, padre_id, titulo, dueno, fecha, estimado_min, prioridad)
  values ('tarea', 'e9111111-0000-0000-0000-0000000000a1', 'pequena 3', 'bryan', current_date, 10, 'pequena');
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Manuela: ve y edita lo suyo
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(public.plan_dueno_actual() = 'manuela', 'Manuela no se reconoce como dueña manuela');
select pruebas.afirmar(
  (select count(*) from public.plan_items) = 3
  and (select count(*) from public.plan_items where dueno <> 'manuela') = 0,
  'Manuela no ve exactamente lo suyo (objetivo, hito y tarea)'
);

do $$
declare
  n int;
begin
  -- crea lo suyo (mañana, para no chocar con su principal de hoy)
  insert into public.plan_items (nivel, padre_id, titulo, dueno, fecha, estimado_min, prioridad)
  values ('tarea', 'e9111111-0000-0000-0000-0000000000b1', 'Su pequeña', 'manuela', current_date + 1, 15, 'pequena');
  -- no crea con el dueño de Bryan
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno)
    values ('hito', 'e9111111-0000-0000-0000-00000000000b', 'a nombre de Bryan', 'bryan');
    raise exception 'FALLO: Manuela creó una fila con el dueño de Bryan';
  exception when insufficient_privilege then null;
  end;
  -- empieza y termina lo suyo
  update public.plan_items set estado = 'en_curso', iniciada_en = now()
   where id = 'e9111111-0000-0000-0000-000000000b11';
  update public.plan_items set estado = 'hecha', hecha_en = now()
   where id = 'e9111111-0000-0000-0000-000000000b11';
  select count(*) into n from public.plan_items
   where id = 'e9111111-0000-0000-0000-000000000b11' and estado = 'hecha';
  if n <> 1 then raise exception 'FALLO: Manuela no pudo marcar su tarea como hecha'; end if;
  -- no toca lo de Bryan (no lo ve: el update afecta cero filas)
  update public.plan_items set titulo = 'robada' where id = 'e9111111-0000-0000-0000-000000000a11';
  -- no cambia el nivel, el padre ni el dueño de lo suyo (sin privilegio de columna)
  begin
    update public.plan_items set dueno = 'bryan' where id = 'e9111111-0000-0000-0000-000000000b11';
    raise exception 'FALLO: Manuela cambió el dueño de una fila';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.plan_items set nivel = 'hito' where id = 'e9111111-0000-0000-0000-000000000b11';
    raise exception 'FALLO: Manuela cambió el nivel de una fila';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.plan_items set padre_id = 'e9111111-0000-0000-0000-00000000000b' where id = 'e9111111-0000-0000-0000-000000000b11';
    raise exception 'FALLO: Manuela cambió el padre de una fila';
  exception when insufficient_privilege then null;
  end;
  -- no borra
  begin
    delete from public.plan_items where id = 'e9111111-0000-0000-0000-000000000b11';
    raise exception 'FALLO: Manuela borró una fila';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · Bryan: ve todo, edita lo suyo, no lo de Manuela
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f9000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(public.plan_dueno_actual() = 'bryan', 'Bryan no se reconoce como dueño bryan');
select pruebas.afirmar(
  (select count(*) from public.plan_items where dueno = 'manuela') = 4
  and (select count(*) from public.plan_items where dueno = 'bryan') >= 5,
  'Bryan no ve lo suyo y lo de Manuela'
);
select pruebas.afirmar(
  (select titulo from public.plan_items where id = 'e9111111-0000-0000-0000-000000000a11') = 'Tarea de Bryan',
  'la tarea de Bryan cambió sin que él la tocara'
);

do $$
declare
  n int;
begin
  update public.plan_items set estado = 'en_curso', iniciada_en = now()
   where id = 'e9111111-0000-0000-0000-000000000a11';
  -- lo de Manuela: lo ve pero el update no toca ninguna fila
  update public.plan_items set titulo = 'de Bryan ahora' where id = 'e9111111-0000-0000-0000-000000000b11';
  select count(*) into n from public.plan_items where titulo = 'de Bryan ahora';
  if n <> 0 then raise exception 'FALLO: Bryan editó una fila de Manuela'; end if;
  begin
    insert into public.plan_items (nivel, padre_id, titulo, dueno)
    values ('hito', 'e9111111-0000-0000-0000-00000000000b', 'a nombre de Manuela', 'manuela');
    raise exception 'FALLO: Bryan creó una fila con el dueño de Manuela';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.plan_items where dueno = 'bryan';
    raise exception 'FALLO: Bryan borró filas';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Staff sin la capacidad y asesorado: no ven ni escriben; anon, nada
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f9000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(public.plan_dueno_actual() is null, 'una persona sin la capacidad tiene dueño');
select pruebas.afirmar((select count(*) from public.plan_items) = 0, 'el staff sin la capacidad ve plan_items');
do $$
begin
  begin
    insert into public.plan_items (nivel, titulo, dueno) values ('objetivo', 'colado', 'manuela');
    raise exception 'FALLO: el staff sin la capacidad escribió en plan_items';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.soy('e9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.plan_items) = 0, 'un asesorado ve plan_items');
do $$
begin
  begin
    insert into public.plan_items (nivel, titulo, dueno) values ('objetivo', 'colado', 'bryan');
    raise exception 'FALLO: un asesorado escribió en plan_items';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$
begin
  begin
    perform 1 from public.plan_items limit 1;
    raise exception 'FALLO: anon pudo leer plan_items';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.plan_items (nivel, titulo, dueno) values ('objetivo', 'anon', 'bryan');
    raise exception 'FALLO: anon escribió en plan_items';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.plan_dueno_actual();
    raise exception 'FALLO: anon ejecutó plan_dueno_actual';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
