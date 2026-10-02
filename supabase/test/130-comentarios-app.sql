-- Comentarios de la app (migración 0095).
--
-- Lo que se prueba:
--   1. El check de capacidades acepta las anteriores MÁS `triar_comentarios` y rechaza una inventada.
--   2. Un asesorado envía un comentario y ve SOLO los suyos (vista `mis_comentarios`), sin
--      campos internos; el de otro asesorado no se ve; la tabla directa no le da nada.
--   3. El envío pone el autor (auth.uid()) y el rol; tapa correos y teléfonos; guarda solo la
--      ruta (sin `?` ni `#`); un texto vacío o un tipo inventado se rechaza; tope de 10 al día.
--   4. Nadie escribe directo: insert/update/delete de authenticated fallan (también el coach).
--   5. El coach y quien tiene `triar_comentarios` leen todo; el estado solo se mueve por
--      `mover_comentario`: nuevo → en_contrato (con contrato) → arreglado; CERRAR es solo del
--      coach; un arreglado no vuelve; el check de la tabla exige cierre y contrato.
--   6. anon no toca nada; staff sin la capacidad solo ve lo suyo.
--   7. La purga del texto crudo es solo del servidor.
--
-- Bloque de UUID propio (e9…/f9…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
insert into auth.users (id, email) values
  ('e9000000-0000-0000-0000-000000000001', 'co-asesorado-a@ejemplo.test'),
  ('e9000000-0000-0000-0000-000000000002', 'co-asesorado-b@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000001', 'co-manuela@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000002', 'co-bryan@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000003', 'co-triador@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000004', 'co-barrido@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('e9000000-0000-0000-0000-000000000001', 'Asesorado A', 'asesorado', 'AA'),
  ('e9000000-0000-0000-0000-000000000002', 'Asesorado B', 'asesorado', 'AB'),
  ('f9000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('f9000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('f9000000-0000-0000-0000-000000000003', 'Triador de prueba', 'nutricionista', 'TP'),
  ('f9000000-0000-0000-0000-000000000004', 'Barrido de capacidades', 'nutricionista', 'BC')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- Solo el triador tiene la capacidad; Manuela es equipo sin ella.
insert into public.capacidades_staff (usuario_id, capacidad) values
  ('f9000000-0000-0000-0000-000000000003', 'triar_comentarios')
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
    'revisar_creadores', 'firmar_creadores', 'triar_comentarios'
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

-- ════════════════════════════════════════════════════════════════════════
-- 2 y 3 · Asesorado A envía
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('e9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select set_config('pruebas.c1', public.enviar_comentario(
  'falla', '/entrenar/sesion/abc-123?token=secreto#parte', 'El cronómetro se reinicia. Escríbeme a persona@ejemplo.test o al 300 123 4567', 'v1'
)::text, false);

select pruebas.afirmar(
  (select count(*) from public.mis_comentarios) = 1
  and (select pantalla from public.mis_comentarios) = '/entrenar/sesion/abc-123'
  and (select estado from public.mis_comentarios) = 'nuevo'
  and (select tipo from public.mis_comentarios) = 'falla',
  'el comentario no llegó con su pantalla sin query ni fragmento y en estado nuevo'
);
select pruebas.afirmar(
  (select texto from public.mis_comentarios) not like '%persona@ejemplo.test%'
  and (select texto from public.mis_comentarios) not like '%300 123 4567%'
  and (select texto from public.mis_comentarios) like '%[correo]%'
  and (select texto from public.mis_comentarios) like '%[teléfono]%',
  'el comentario guardó un correo o un teléfono sin taparlo'
);
select pruebas.afirmar(
  (select column_name from information_schema.columns
    where table_name = 'mis_comentarios' and column_name = 'contrato_id') is null,
  'quien comentó ve el campo interno contrato_id'
);
do $$
begin
  begin
    perform 1 from public.comentarios_app limit 1;
    -- Con RLS solo el coach/triador ven filas: un asesorado lee la tabla pero no ve nada.
    if (select count(*) from public.comentarios_app) <> 0 then
      raise exception 'FALLO: un asesorado leyó filas de comentarios_app directamente';
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.enviar_comentario('inventado', '/hoy', 'texto');
    raise exception 'FALLO: se aceptó un tipo de comentario inventado';
  exception when check_violation then null;
  end;
  begin
    perform public.enviar_comentario('idea', '/hoy', '   ');
    raise exception 'FALLO: se aceptó un comentario vacío';
  exception when check_violation then null;
  end;
end $$;
-- Una ruta que no parece ruta se guarda como «desconocida»; el texto largo se acota a 500.
select public.enviar_comentario('no_entiendo', 'javascript:alert(1)', repeat('x', 900));
select pruebas.afirmar(
  (select pantalla from public.mis_comentarios order by id desc limit 1) = 'desconocida'
  and (select char_length(texto) from public.mis_comentarios order by id desc limit 1) = 500,
  'una pantalla rara no quedó «desconocida» o el texto largo no se acotó a 500'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- Asesorado B no ve los de A
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('e9000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.mis_comentarios) = 0
  and (select count(*) from public.comentarios_app) = 0,
  'un asesorado ve los comentarios de otro'
);
select public.enviar_comentario('idea', '/hoy', 'Me gustaría ver el RIR de la semana pasada');
select pruebas.afirmar((select count(*) from public.mis_comentarios) = 1, 'B no ve solo el suyo');
-- Tope de 10 al día: ya lleva 1; 9 más entran y la décima primera no.
do $$
begin
  for i in 1..9 loop
    perform public.enviar_comentario('idea', '/hoy', 'comentario ' || i);
  end loop;
  begin
    perform public.enviar_comentario('idea', '/hoy', 'uno de más');
    raise exception 'FALLO: pasó el comentario 11 del día';
  exception when sqlstate 'P0001' then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- Manuela (equipo sin la capacidad): comenta como equipo, ve solo lo suyo
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f9000000-0000-0000-0000-000000000001');
set role authenticated;
select public.enviar_comentario('idea', '/estrategia', 'Falta un botón para reintentar');
select pruebas.afirmar(
  (select count(*) from public.mis_comentarios) = 1 and (select count(*) from public.comentarios_app) = 0,
  'staff sin triar_comentarios ve comentarios que no son suyos'
);
do $$
begin
  begin
    perform public.mover_comentario(1, 'en_contrato', 'CT-20260928-1');
    raise exception 'FALLO: staff sin la capacidad movió un comentario';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pruebas.afirmar(
  (select rol_autor from public.comentarios_app where texto = 'Falta un botón para reintentar') = 'equipo'
  and (select rol_autor from public.comentarios_app where usuario_id = 'e9000000-0000-0000-0000-000000000001' limit 1) = 'asesorado',
  'el rol del autor no se calculó bien (equipo / asesorado)'
);

-- ════════════════════════════════════════════════════════════════════════
-- 4 · Nadie escribe directo (ni el coach)
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f9000000-0000-0000-0000-000000000002');
set role authenticated;
do $$
begin
  begin
    insert into public.comentarios_app (rol_autor, tipo, texto) values ('coach', 'idea', 'directo');
    raise exception 'FALLO: el coach insertó un comentario sin pasar por enviar_comentario';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.comentarios_app set estado = 'arreglado';
    raise exception 'FALLO: el coach cambió el estado con un UPDATE directo';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.comentarios_app;
    raise exception 'FALLO: el coach borró comentarios';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · El coach lee todo y mueve el estado
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar((select count(*) from public.comentarios_app) >= 13, 'el coach no ve todos los comentarios');

do $$
declare
  v_id bigint := current_setting('pruebas.c1')::bigint;
begin
  begin
    perform public.mover_comentario(v_id, 'en_contrato');
    raise exception 'FALLO: pasó a contrato sin número de contrato';
  exception when check_violation then null;
  end;
  begin
    perform public.mover_comentario(v_id, 'arreglado');
    raise exception 'FALLO: un comentario nuevo se dio por arreglado sin pasar por contrato';
  exception when check_violation then null;
  end;
  begin
    perform public.mover_comentario(v_id, 'en_contrato', 'contrato uno');
    raise exception 'FALLO: se aceptó un contrato sin la forma CT-AAAAMMDD-n';
  exception when check_violation then null;
  end;
  perform public.mover_comentario(v_id, 'en_contrato', 'CT-20260928-1', 'El cronómetro se reinicia al bloquear el celular');
  begin
    perform public.mover_comentario(v_id, 'en_contrato', 'CT-20260928-2');
    raise exception 'FALLO: un comentario ya en contrato volvió a pasar a contrato';
  exception when check_violation then null;
  end;
end $$;
select pruebas.afirmar(
  (select estado from public.comentarios_app where id = current_setting('pruebas.c1')::bigint) = 'en_contrato'
  and (select contrato_id from public.comentarios_app where id = current_setting('pruebas.c1')::bigint) = 'CT-20260928-1'
  and (select triado_por from public.comentarios_app where id = current_setting('pruebas.c1')::bigint) = 'f9000000-0000-0000-0000-000000000002',
  'pasar a contrato no dejó contrato ni quién trió'
);
select public.mover_comentario(current_setting('pruebas.c1')::bigint, 'arreglado');
select pruebas.afirmar(
  (select estado from public.comentarios_app where id = current_setting('pruebas.c1')::bigint) = 'arreglado'
  and (select cerrado_por from public.comentarios_app where id = current_setting('pruebas.c1')::bigint) = 'f9000000-0000-0000-0000-000000000002'
  and (select cerrado_en from public.comentarios_app where id = current_setting('pruebas.c1')::bigint) is not null,
  'cerrar no dejó quién cierra ni cuándo'
);
do $$
begin
  begin
    perform public.mover_comentario(current_setting('pruebas.c1')::bigint, 'en_contrato', 'CT-20260928-3');
    raise exception 'FALLO: un comentario arreglado volvió a contrato';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- Lo que ve quien comentó cambia de estado, y solo eso.
select pruebas.soy('e9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  (select estado from public.mis_comentarios where id = current_setting('pruebas.c1')::bigint) = 'arreglado',
  'quien comentó no ve su comentario como arreglado'
);
reset role;

-- El triador (capacidad) lee todo y puede pasar a contrato, pero NO cerrar.
select pruebas.soy('f9000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar((select count(*) from public.comentarios_app) >= 13, 'quien tiene triar_comentarios no ve todo');
select public.mover_comentario(
  (select id from public.comentarios_app where texto = 'Falta un botón para reintentar'), 'en_contrato', 'CT-20260928-4');
do $$
begin
  begin
    perform public.mover_comentario(
      (select id from public.comentarios_app where texto = 'Falta un botón para reintentar'), 'arreglado');
    raise exception 'FALLO: quien tría cerró un comentario (cerrar es solo del coach)';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- La tabla misma se defiende: arreglado sin cierre o en contrato sin contrato no entran.
do $$
begin
  begin
    update public.comentarios_app set estado = 'arreglado', contrato_id = 'CT-20260928-9' where pantalla = 'desconocida' and usuario_id = 'e9000000-0000-0000-0000-000000000001';
    raise exception 'FALLO: la tabla aceptó arreglado sin quién cierra';
  exception when check_violation then null;
  end;
  begin
    update public.comentarios_app set estado = 'en_contrato' where pantalla = 'desconocida' and usuario_id = 'e9000000-0000-0000-0000-000000000001';
    raise exception 'FALLO: la tabla aceptó en_contrato sin contrato';
  exception when check_violation then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7 · La purga del texto crudo es solo del servidor
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f9000000-0000-0000-0000-000000000002');
set role authenticated;
do $$
begin
  begin
    perform public.purgar_texto_comentarios(1);
    raise exception 'FALLO: una sesión autenticada purgó el texto';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
update public.comentarios_app set creado_en = now() - interval '40 days' where texto like 'comentario %';
set role service_role;
select pruebas.afirmar(public.purgar_texto_comentarios(30) = 9, 'la purga no borró el texto de los 9 comentarios viejos');
reset role;
select pruebas.afirmar(
  (select count(*) from public.comentarios_app where texto is null) = 9
  and (select count(*) from public.comentarios_app where texto is not null) >= 4,
  'la purga tocó más de lo que debía'
);

-- ════════════════════════════════════════════════════════════════════════
-- 6 · anon no toca nada
-- ════════════════════════════════════════════════════════════════════════
set role anon;
do $$
begin
  begin
    perform 1 from public.comentarios_app limit 1;
    raise exception 'FALLO: anon pudo leer comentarios_app';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.mis_comentarios limit 1;
    raise exception 'FALLO: anon pudo leer mis_comentarios';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.enviar_comentario('idea', '/hoy', 'anon');
    raise exception 'FALLO: anon envió un comentario';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
