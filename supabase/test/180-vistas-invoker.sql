-- Vistas con security_invoker (migración 0100).
--
-- Lo que se prueba, por rol (asesorado, Manuela con capacidad, Bryan coach, staff sin la
-- capacidad, anon):
--   1. Las dos vistas están en `security_invoker = on` (lo que pide el advisor).
--   2. mis_comentarios: cada quien ve SOLO los suyos (también el coach y quien tría, como
--      antes) y sin campos internos; la tabla directa sigue cerrada al asesorado; anon no lee.
--   3. decisiones_con_estado: Bryan y Manuela (capacidad) ven las mismas filas que la tabla,
--      con los nombres de quien decidió y de quien firma; el staff sin la capacidad y el
--      asesorado ven cero; anon no lee.
--   4. mis_comentarios_datos() no la ejecuta anon.
--
-- Bloque de UUID propio (ea…/fa…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
insert into auth.users (id, email) values
  ('ea000000-0000-0000-0000-000000000001', 'vi-asesorado-a@ejemplo.test'),
  ('ea000000-0000-0000-0000-000000000002', 'vi-asesorado-b@ejemplo.test'),
  ('fa000000-0000-0000-0000-000000000001', 'vi-manuela@ejemplo.test'),
  ('fa000000-0000-0000-0000-000000000002', 'vi-bryan@ejemplo.test'),
  ('fa000000-0000-0000-0000-000000000003', 'vi-staff-sin@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('ea000000-0000-0000-0000-000000000001', 'Asesorado A', 'asesorado', 'AA'),
  ('ea000000-0000-0000-0000-000000000002', 'Asesorado B', 'asesorado', 'AB'),
  ('fa000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('fa000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('fa000000-0000-0000-0000-000000000003', 'Staff sin permisos', 'nutricionista', 'SP')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('fa000000-0000-0000-0000-000000000001', 'decisiones_compartidas'),
  ('fa000000-0000-0000-0000-000000000001', 'triar_comentarios')
on conflict do nothing;

-- Comentarios sembrados a mano (dueño de la tabla): 2 de A, 1 de B, 1 de Manuela, 1 de Bryan.
insert into public.comentarios_app (usuario_id, rol_autor, tipo, pantalla, texto, texto_saneado) values
  ('ea000000-0000-0000-0000-000000000001', 'asesorado', 'falla', '/hoy', 'A uno', 'A uno'),
  ('ea000000-0000-0000-0000-000000000001', 'asesorado', 'idea', '/hoy', 'A dos', 'A dos'),
  ('ea000000-0000-0000-0000-000000000002', 'asesorado', 'falla', '/hoy', 'B uno', 'B uno'),
  ('fa000000-0000-0000-0000-000000000001', 'equipo', 'idea', '/coach', 'Manuela uno', 'Manuela uno'),
  ('fa000000-0000-0000-0000-000000000002', 'coach', 'idea', '/coach', 'Bryan uno', 'Bryan uno');

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Las dos vistas son invoker
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  (select coalesce(c.reloptions @> array['security_invoker=on'], false)
     from pg_class c where c.oid = 'public.mis_comentarios'::regclass)
  and (select coalesce(c.reloptions @> array['security_invoker=on'], false)
         from pg_class c where c.oid = 'public.decisiones_con_estado'::regclass),
  'mis_comentarios o decisiones_con_estado no quedó con security_invoker = on'
);

-- Decisiones: Bryan anota una con firma de Manuela y otra sin firma.
select pruebas.soy('fa000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select public.anotar_decision(
  p_area => 'creadores', p_palanca => 'segmento', p_direccion => 'incluye', p_sujeto => 'negocio:segmento',
  p_resumen => 'Vistas invoker: con firma',
  p_firma_de => 'fa000000-0000-0000-0000-000000000001', p_firma_nivel => 'firma',
  p_firma_vence_en => current_date + 3
);
select public.anotar_decision(
  p_area => 'creadores', p_palanca => 'plantilla_mensaje', p_direccion => 'cambia', p_sujeto => 'negocio:plantilla_mensaje',
  p_resumen => 'Vistas invoker: sin firma'
);

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Bryan (coach)
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  (select count(*) from public.mis_comentarios) = 1
  and (select texto from public.mis_comentarios) = 'Bryan uno',
  'Bryan no ve solo su comentario por mis_comentarios'
);
select pruebas.afirmar(
  (select count(*) from public.comentarios_app) = 5,
  'Bryan (coach) no lee toda la tabla de comentarios'
);
select pruebas.afirmar(
  (select count(*) from public.decisiones_con_estado) = (select count(*) from public.decisiones)
  and (select count(*) from public.decisiones_con_estado) >= 2,
  'Bryan no ve por la vista las mismas decisiones que en la tabla'
);
select pruebas.afirmar(
  (select decidido_por_nombre from public.decisiones_con_estado where resumen = 'Vistas invoker: con firma') = 'Bryan de prueba'
  and (select firma_de_nombre from public.decisiones_con_estado where resumen = 'Vistas invoker: con firma') = 'Manuela de prueba'
  and (select estado from public.decisiones_con_estado where resumen = 'Vistas invoker: con firma') = 'propuesta',
  'la vista invoker no trae nombres o estado para Bryan'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Manuela (equipo con decisiones_compartidas y triar_comentarios)
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('fa000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.mis_comentarios) = 1
  and (select texto from public.mis_comentarios) = 'Manuela uno',
  'Manuela no ve solo el suyo por mis_comentarios (aunque tría todo)'
);
select pruebas.afirmar(
  (select count(*) from public.decisiones_con_estado) = (select count(*) from public.decisiones)
  and (select count(*) from public.decisiones_con_estado) >= 2,
  'Manuela no ve por la vista las mismas decisiones que en la tabla'
);
select pruebas.afirmar(
  (select decidido_por_nombre from public.decisiones_con_estado where resumen = 'Vistas invoker: con firma') = 'Bryan de prueba'
  and (select firma_de_nombre from public.decisiones_con_estado where resumen = 'Vistas invoker: con firma') = 'Manuela de prueba',
  'Manuela no ve los nombres de quien decidió y de quien firma'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · Staff sin capacidad: nada ajeno en comentarios, nada en decisiones
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('fa000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.mis_comentarios) = 0
  and (select count(*) from public.decisiones_con_estado) = 0,
  'un staff sin capacidades ve comentarios ajenos o decisiones'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Asesorados A y B: solo lo suyo, sin campos internos; sin decisiones; tabla cerrada
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('ea000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.mis_comentarios) = 2
  and (select count(*) from public.mis_comentarios where texto in ('A uno', 'A dos')) = 2,
  'A no ve exactamente sus dos comentarios'
);
select pruebas.afirmar(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'mis_comentarios'
      and column_name in ('contrato_id', 'triado_por', 'texto_saneado', 'usuario_id', 'cerrado_por')) = 0,
  'la vista mis_comentarios trae campos internos del triaje'
);
select pruebas.afirmar(
  (select count(*) from public.comentarios_app) = 0,
  'un asesorado lee la tabla comentarios_app directa'
);
select pruebas.afirmar(
  (select count(*) from public.decisiones_con_estado) = 0,
  'un asesorado ve decisiones'
);
reset role;

select pruebas.soy('ea000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.mis_comentarios) = 1
  and (select texto from public.mis_comentarios) = 'B uno',
  'B no ve solo el suyo'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · anon no toca nada
-- ════════════════════════════════════════════════════════════════════════
set role anon;
do $$
begin
  begin
    perform 1 from public.mis_comentarios limit 1;
    raise exception 'FALLO: anon pudo leer mis_comentarios';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.decisiones_con_estado limit 1;
    raise exception 'FALLO: anon pudo leer decisiones_con_estado';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.mis_comentarios_datos();
    raise exception 'FALLO: anon pudo ejecutar mis_comentarios_datos()';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;

\echo 'OK · vistas con security_invoker (0100)'
