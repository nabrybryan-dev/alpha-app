-- Investigación de mercadeo interactiva (migración 0103): hallazgos y su hilo de comentarios.
--
-- Lo que se prueba:
--   1. service_role carga hallazgos; un tipo, estado, enlace http o contacto inválidos se rechazan.
--   2. Lee Manuela (responder_mercadeo) y el coach; otra persona del equipo sin la capacidad y un
--      asesorado no ven nada; anon no toca nada.
--   3. Manuela y Bryan comentan por comentar_hallazgo_mercadeo (el autor sale de la sesión, no
--      del texto); un correo o un teléfono no entran; sin la capacidad no se comenta; un
--      hallazgo descartado no admite comentarios; comentar pasa nuevo -> en_discusion.
--   4. Nadie con sesión escribe directo (ni insert, ni update, ni delete).
--   5. El agente (service_role) responde apuntando al comentario y deja el hallazgo «fortalecido»;
--      una persona no puede marcar una respuesta como suya ni como del agente.
--
-- Bloque de UUID propio (a9…/b9…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('a9000000-0000-0000-0000-000000000001', 'mh-asesorado@ejemplo.test'),
  ('b9000000-0000-0000-0000-000000000001', 'mh-manuela@ejemplo.test'),
  ('b9000000-0000-0000-0000-000000000002', 'mh-bryan@ejemplo.test'),
  ('b9000000-0000-0000-0000-000000000003', 'mh-otra@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('a9000000-0000-0000-0000-000000000001', 'Asesorado cualquiera', 'asesorado', 'AC'),
  ('b9000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('b9000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('b9000000-0000-0000-0000-000000000003', 'Otra del equipo', 'nutricionista', 'OE')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('b9000000-0000-0000-0000-000000000001', 'responder_mercadeo')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Carga como servidor
-- ════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.mercadeo_hallazgos (id, codigo, tipo, titulo, resumen, fuente_nombre, fuente_url, fuente_fecha) values
  ('a9111111-0000-0000-0000-000000000001', 'H-01', 'hook', 'Pregunta directa en el primer segundo',
   'Abrir con una pregunta que el espectador contesta en su cabeza retiene mejor los tres primeros segundos.',
   'Cuenta pública de ejemplo', 'https://ejemplo.test/reel/1', '2026-09-29'),
  ('a9111111-0000-0000-0000-000000000002', 'H-02', 'loop', 'Final que repite el inicio',
   'El último cuadro enlaza con el primero para que el video se vea dos veces.', null, null, null),
  ('a9111111-0000-0000-0000-000000000003', 'H-03', 'tendencia', 'Audio en tendencia de ejemplo',
   'Un audio que sube esta semana en videos de entrenamiento.', 'Artículo de ejemplo', null, null);
update public.mercadeo_hallazgos set estado = 'descartado' where codigo = 'H-03';

do $$
begin
  begin
    insert into public.mercadeo_hallazgos (codigo, tipo, titulo, resumen) values ('H-90', 'meme', 'tipo inventado', 'resumen válido aquí');
    raise exception 'FALLO: aceptó un tipo inventado';
  exception when check_violation then null;
  end;
  begin
    update public.mercadeo_hallazgos set estado = 'aprobado' where codigo = 'H-01';
    raise exception 'FALLO: aceptó un estado inventado';
  exception when check_violation then null;
  end;
  begin
    insert into public.mercadeo_hallazgos (codigo, tipo, titulo, resumen, fuente_url)
    values ('H-92', 'hook', 'enlace sin https', 'resumen válido aquí', 'http://ejemplo.test/x');
    raise exception 'FALLO: aceptó un enlace http';
  exception when check_violation then null;
  end;
  begin
    insert into public.mercadeo_hallazgos (codigo, tipo, titulo, resumen)
    values ('H-93', 'hook', 'con contacto', 'escríbele a persona@ejemplo.test para el detalle');
    raise exception 'FALLO: aceptó un correo en el resumen';
  exception when check_violation then null;
  end;
  begin
    insert into public.mercadeo_hallazgos (codigo, tipo, titulo, resumen) values ('X-1', 'hook', 'código malo', 'resumen válido aquí');
    raise exception 'FALLO: aceptó un código inválido';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Quién lee
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.mercadeo_hallazgos) = 3, 'Manuela (con la capacidad) no ve los 3 hallazgos');
reset role;

select pruebas.soy('b9000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.afirmar((select count(*) from public.mercadeo_hallazgos) = 3, 'Bryan (coach) no ve los 3 hallazgos');
reset role;

select pruebas.soy('b9000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar((select count(*) from public.mercadeo_hallazgos) = 0, 'un staff sin la capacidad ve hallazgos');
reset role;

select pruebas.soy('a9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar((select count(*) from public.mercadeo_hallazgos) = 0, 'un asesorado ve hallazgos');
select pruebas.afirmar((select count(*) from public.mercadeo_hallazgo_comentarios) = 0, 'un asesorado ve comentarios');
reset role;

set role anon;
do $$
begin
  begin
    perform 1 from public.mercadeo_hallazgos limit 1;
    raise exception 'FALLO: anon leyó hallazgos';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.mercadeo_hallazgo_comentarios limit 1;
    raise exception 'FALLO: anon leyó comentarios';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.comentar_hallazgo_mercadeo('a9111111-0000-0000-0000-000000000001', 'hola desde anon');
    raise exception 'FALLO: anon comentó';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Comentar
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b9000000-0000-0000-0000-000000000001');
set role authenticated;
do $$
declare
  v_id uuid;
begin
  v_id := public.comentar_hallazgo_mercadeo('a9111111-0000-0000-0000-000000000001', 'Este gancho funciona mejor con una cifra, ¿lo probamos?');
  perform pruebas.afirmar(
    (select autor = 'manuela' and autor_id = 'b9000000-0000-0000-0000-000000000001'
       from public.mercadeo_hallazgo_comentarios where id = v_id),
    'el comentario de Manuela no quedó firmado por ella');
  perform pruebas.afirmar(
    (select estado = 'en_discusion' from public.mercadeo_hallazgos where codigo = 'H-01'),
    'comentar no pasó el hallazgo a en_discusion');
  begin
    perform public.comentar_hallazgo_mercadeo('a9111111-0000-0000-0000-000000000001', 'escríbele a persona@ejemplo.test');
    raise exception 'FALLO: un comentario con un correo se guardó';
  exception when check_violation then null;
  end;
  begin
    perform public.comentar_hallazgo_mercadeo('a9111111-0000-0000-0000-000000000001', 'llámala al 300 123 4567');
    raise exception 'FALLO: un comentario con un teléfono se guardó';
  exception when check_violation then null;
  end;
  begin
    perform public.comentar_hallazgo_mercadeo('a9111111-0000-0000-0000-000000000001', '   ');
    raise exception 'FALLO: un comentario vacío se guardó';
  exception when check_violation then null;
  end;
  begin
    perform public.comentar_hallazgo_mercadeo('a9111111-0000-0000-0000-000000000003', 'esto ya está descartado');
    raise exception 'FALLO: se comentó un hallazgo descartado';
  exception when check_violation then null;
  end;
  begin
    perform public.comentar_hallazgo_mercadeo('a9999999-0000-0000-0000-000000000009', 'no existe');
    raise exception 'FALLO: se comentó un hallazgo inexistente';
  exception when no_data_found then null;
  end;
end $$;
reset role;

select pruebas.soy('b9000000-0000-0000-0000-000000000002');
set role authenticated;
do $$
declare
  v_id uuid;
begin
  v_id := public.comentar_hallazgo_mercadeo('a9111111-0000-0000-0000-000000000002', 'Lo dejamos para el reel de la semana.');
  perform pruebas.afirmar(
    (select autor = 'bryan' from public.mercadeo_hallazgo_comentarios where id = v_id),
    'el comentario de Bryan no quedó firmado como bryan');
end $$;
reset role;

select pruebas.soy('b9000000-0000-0000-0000-000000000003');
set role authenticated;
do $$
begin
  begin
    perform public.comentar_hallazgo_mercadeo('a9111111-0000-0000-0000-000000000001', 'sin permiso');
    raise exception 'FALLO: comentó alguien sin la capacidad';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.soy('a9000000-0000-0000-0000-000000000001');
set role authenticated;
do $$
begin
  begin
    perform public.comentar_hallazgo_mercadeo('a9111111-0000-0000-0000-000000000001', 'soy un asesorado');
    raise exception 'FALLO: comentó un asesorado';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · Nadie con sesión escribe directo
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b9000000-0000-0000-0000-000000000001');
set role authenticated;
do $$
begin
  begin
    insert into public.mercadeo_hallazgo_comentarios (hallazgo_id, autor, autor_id, texto)
    values ('a9111111-0000-0000-0000-000000000001', 'agente', null, 'me hago pasar por el agente');
    raise exception 'FALLO: Manuela insertó un comentario directo';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.mercadeo_hallazgos (codigo, tipo, titulo, resumen) values ('H-80', 'hook', 'directo de Manuela', 'resumen válido aquí');
    raise exception 'FALLO: Manuela insertó un hallazgo';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.mercadeo_hallazgos set estado = 'fortalecido';
    raise exception 'FALLO: Manuela actualizó un hallazgo';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.mercadeo_hallazgo_comentarios;
    raise exception 'FALLO: Manuela borró comentarios';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.soy('b9000000-0000-0000-0000-000000000002');
set role authenticated;
do $$
begin
  begin
    update public.mercadeo_hallazgo_comentarios set texto = 'editado';
    raise exception 'FALLO: Bryan editó un comentario';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · El agente responde
-- ════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
do $$
declare
  v_pregunta uuid;
begin
  select id into v_pregunta from public.mercadeo_hallazgo_comentarios
   where autor = 'manuela' and hallazgo_id = 'a9111111-0000-0000-0000-000000000001';
  insert into public.mercadeo_hallazgo_comentarios (hallazgo_id, autor, autor_id, texto, en_respuesta_a)
  values ('a9111111-0000-0000-0000-000000000001', 'agente', null, 'Lo probé con una cifra en el primer segundo y sube la retención.', v_pregunta);
  update public.mercadeo_hallazgos set estado = 'fortalecido', actualizado_en = now() where codigo = 'H-01';
  begin
    insert into public.mercadeo_hallazgo_comentarios (hallazgo_id, autor, autor_id, texto)
    values ('a9111111-0000-0000-0000-000000000001', 'agente', 'b9000000-0000-0000-0000-000000000001', 'el agente no tiene usuario');
    raise exception 'FALLO: aceptó un comentario del agente con usuario';
  exception when check_violation then null;
  end;
  begin
    insert into public.mercadeo_hallazgo_comentarios (hallazgo_id, autor, autor_id, texto, en_respuesta_a)
    values ('a9111111-0000-0000-0000-000000000001', 'manuela', 'b9000000-0000-0000-0000-000000000001', 'una persona no responde por el agente', v_pregunta);
    raise exception 'FALLO: aceptó una persona con en_respuesta_a';
  exception when check_violation then null;
  end;
end $$;
reset role;

select pruebas.soy('b9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.mercadeo_hallazgo_comentarios where hallazgo_id = 'a9111111-0000-0000-0000-000000000001') = 2
  and (select count(*) from public.mercadeo_hallazgo_comentarios where autor = 'agente' and en_respuesta_a is not null) = 1,
  'Manuela no ve el hilo con la respuesta del agente');
reset role;

rollback;
