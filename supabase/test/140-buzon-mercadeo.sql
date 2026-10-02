-- Buzón de mercadeo de Manuela (migración 0096).
--
-- Lo que se prueba:
--   1. El check de capacidades acepta las anteriores MÁS `responder_mercadeo` y rechaza una inventada.
--   2. Manuela lee SUS preguntas y sus referencias; otra persona del equipo (y un asesorado) no
--      ven ninguna; el coach ve todas; anon no toca nada.
--   3. Manuela responde por `responder_buzon_mercadeo`, una sola vez, antes de que venza, solo
--      lo suyo y solo con la capacidad; la respuesta no admite correos, @ ni teléfonos; las
--      referencias solo son https con nota y se normalizan sin `?` ni `www.`.
--   4. Nadie escribe directo (ni Manuela ni el coach): insert/update/delete fallan.
--   5. La regla la mueve solo el coach; `vigente` pide 3 referencias de reel/carrusel/historia
--      distintas, fija caducidad a 60 días y su código R-xx; una regla retirada no vuelve; una
--      pregunta de solo contexto no genera regla.
--
-- Bloque de UUID propio (a8…/b8…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
insert into auth.users (id, email) values
  ('a8000000-0000-0000-0000-000000000001', 'mk-asesorado@ejemplo.test'),
  ('b8000000-0000-0000-0000-000000000001', 'mk-manuela@ejemplo.test'),
  ('b8000000-0000-0000-0000-000000000002', 'mk-bryan@ejemplo.test'),
  ('b8000000-0000-0000-0000-000000000003', 'mk-otra@ejemplo.test'),
  ('b8000000-0000-0000-0000-000000000004', 'mk-barrido@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('a8000000-0000-0000-0000-000000000001', 'Asesorado cualquiera', 'asesorado', 'AC'),
  ('b8000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('b8000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('b8000000-0000-0000-0000-000000000003', 'Otra del equipo', 'nutricionista', 'OE'),
  ('b8000000-0000-0000-0000-000000000004', 'Barrido de capacidades', 'nutricionista', 'BC')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('b8000000-0000-0000-0000-000000000001', 'responder_mercadeo')
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
    'revisar_creadores', 'firmar_creadores', 'responder_mercadeo'
  ] loop
    insert into public.capacidades_staff (usuario_id, capacidad)
    values ('b8000000-0000-0000-0000-000000000004', c);
  end loop;
  begin
    insert into public.capacidades_staff (usuario_id, capacidad)
    values ('b8000000-0000-0000-0000-000000000004', 'capacidad_inventada');
    raise exception 'FALLO: el check de capacidades aceptó una capacidad inventada';
  exception when check_violation then null;
  end;
end $$;
delete from public.capacidades_staff where usuario_id = 'b8000000-0000-0000-0000-000000000004';

-- ─────────────────── Preguntas: las carga el servidor ───────────────────
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.mercadeo_preguntas (id, codigo, texto, tema, destinataria_id, vence_en) values
  ('a8111111-0000-0000-0000-000000000001', 'P-01', '¿Qué creador colombiano corta mejor el ritmo en los primeros 2 segundos?', 'corte',
   'b8000000-0000-0000-0000-000000000001', current_date + 5),
  ('a8111111-0000-0000-0000-000000000002', 'P-02', '¿Qué te dijo el último creador sobre el brief del reto?', 'brief',
   'b8000000-0000-0000-0000-000000000001', current_date + 5),
  ('a8111111-0000-0000-0000-000000000003', 'P-03', '¿Qué gancho de humor te parece más creíble para el público?', 'gancho',
   'b8000000-0000-0000-0000-000000000001', current_date - 1),
  ('a8111111-0000-0000-0000-000000000004', 'S-01', '¿Cómo describirías el estilo de la marca a un creador nuevo?', 'formato',
   'b8000000-0000-0000-0000-000000000003', current_date + 5);
update public.mercadeo_preguntas set uso = 'solo_contexto' where codigo = 'P-02';

do $$
begin
  begin
    insert into public.mercadeo_preguntas (codigo, texto, tema, destinataria_id)
    values ('X-1', 'una pregunta con código malo', 'gancho', 'b8000000-0000-0000-0000-000000000001');
    raise exception 'FALLO: se aceptó un código de pregunta inválido';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Manuela responde
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b8000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

-- 2 · ve las suyas (3), no la de la otra persona
select pruebas.afirmar(
  (select count(*) from public.mercadeo_preguntas) = 3
  and (select count(*) from public.mercadeo_preguntas where codigo = 'S-01') = 0,
  'Manuela no ve exactamente sus tres preguntas'
);

do $$
begin
  -- Respuesta con datos de contacto: no entra.
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000001', 'Escríbele a persona@ejemplo.test');
    raise exception 'FALLO: una respuesta con un correo se guardó';
  exception when check_violation then null;
  end;
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000001', 'llámala al 300 123 4567');
    raise exception 'FALLO: una respuesta con un teléfono se guardó';
  exception when check_violation then null;
  end;
  -- Una referencia http (no https), o sin nota, no entra; y nada queda a medias.
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000001', 'Buen corte',
      '[{"tipo":"reel","url":"http://ejemplo.test/reel/1","nota":"corta en el segundo 1"}]'::jsonb);
    raise exception 'FALLO: se aceptó una referencia http';
  exception when check_violation then null;
  end;
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000001', 'Buen corte',
      '[{"tipo":"reel","url":"https://ejemplo.test/reel/1","nota":"x"}]'::jsonb);
    raise exception 'FALLO: se aceptó una referencia sin nota';
  exception when check_violation then null;
  end;
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000001', 'Buen corte',
      '[{"tipo":"inventado","url":"https://ejemplo.test/reel/1","nota":"corta en el segundo 1"}]'::jsonb);
    raise exception 'FALLO: se aceptó un tipo de referencia inventado';
  exception when check_violation then null;
  end;
  -- Caducada: no se responde.
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000003', 'tarde');
    raise exception 'FALLO: se respondió una pregunta caducada';
  exception when check_violation then null;
  end;
  -- La de otra persona no es suya.
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000004', 'ajena');
    raise exception 'FALLO: Manuela respondió la pregunta de otra persona';
  exception when insufficient_privilege then null;
  end;
end $$;
select pruebas.afirmar(
  (select count(*) from public.mercadeo_preguntas where estado = 'respondida') = 0
  and (select count(*) from public.mercadeo_referencias) = 0,
  'un intento rechazado dejó una respuesta o referencias a medias'
);

-- La buena: 3 referencias distintas (una repite el reel con otra forma de la URL) + un curso.
select public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000001',
  'Cortan al segundo 1 con texto en pantalla.',
  '[{"tipo":"reel","url":"https://www.Instagram.com/reel/AbC123/?igsh=xyz","nota":"corte al segundo 1 con texto"},
    {"tipo":"reel","url":"https://instagram.com/reel/DeF456/","nota":"gancho de humor en el segundo 2"},
    {"tipo":"carrusel","url":"https://instagram.com/p/GhI789/#uno","nota":"lámina 2 con la promesa"},
    {"tipo":"curso","url":"https://ejemplo.test/curso/ritmo","nota":"módulo 3, ritmo de cortes"}]'::jsonb);
select pruebas.afirmar(
  (select estado from public.mercadeo_preguntas where codigo = 'P-01') = 'respondida'
  and (select respondida_por from public.mercadeo_preguntas where codigo = 'P-01') = 'b8000000-0000-0000-0000-000000000001'
  and (select count(*) from public.mercadeo_referencias) = 4
  and (select url_normalizada from public.mercadeo_referencias where orden = 1) = 'https://instagram.com/reel/AbC123'
  and (select url_normalizada from public.mercadeo_referencias where orden = 3) = 'https://instagram.com/p/GhI789',
  'la respuesta no quedó con su autora y sus referencias normalizadas'
);
do $$
begin
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000001', 'otra vez');
    raise exception 'FALLO: una pregunta se respondió dos veces';
  exception when check_violation then null;
  end;
end $$;
-- La de solo contexto se responde, pero no genera regla (abajo, con el coach).
select public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000002', 'Dijo que quiere el brief más corto.');

-- 4 · Nadie escribe directo, tampoco Manuela con lo suyo
do $$
begin
  begin
    insert into public.mercadeo_preguntas (codigo, texto, tema, destinataria_id)
    values ('P-99', 'una pregunta puesta a mano', 'gancho', 'b8000000-0000-0000-0000-000000000001');
    raise exception 'FALLO: Manuela insertó una pregunta directo';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.mercadeo_preguntas set regla_estado = 'vigente' where codigo = 'P-01';
    raise exception 'FALLO: Manuela puso vigente una regla con un UPDATE';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.mercadeo_referencias;
    raise exception 'FALLO: Manuela borró referencias';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000001', 'vigente', 'Cortar al segundo 1');
    raise exception 'FALLO: Manuela aprobó su propia regla';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · El coach mueve la regla
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b8000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.afirmar((select count(*) from public.mercadeo_preguntas) = 4, 'el coach no ve todas las preguntas');

do $$
begin
  -- Solo 2 enlaces DISTINTOS de reel/carrusel/historia cuentan hasta que llegue el tercero.
  begin
    perform public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000003', 'propuesta', 'Sin respuesta no hay regla');
    raise exception 'FALLO: hay regla sobre una pregunta sin respuesta';
  exception when check_violation then null;
  end;
  begin
    perform public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000002', 'propuesta', 'Brief más corto para el reto');
    raise exception 'FALLO: una pregunta de solo contexto generó regla';
  exception when check_violation then null;
  end;
  begin
    perform public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000001', 'suspendida', 'Cortar al segundo 1');
    raise exception 'FALLO: una regla sin regla pasó directo a suspendida';
  exception when check_violation then null;
  end;
  begin
    perform public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000001', 'vigente');
    raise exception 'FALLO: una regla sin enunciado pasó a vigente';
  exception when check_violation then null;
  end;
  begin
    perform public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000001', 'vigente', 'Cortar con @creador');
    raise exception 'FALLO: un enunciado con @ se aceptó';
  exception when check_violation then null;
  end;
end $$;

select public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000001', 'propuesta', 'Cortar al segundo 1 con texto en pantalla');
select pruebas.afirmar(
  (select regla_estado from public.mercadeo_preguntas where codigo = 'P-01') = 'propuesta'
  and (select regla_codigo from public.mercadeo_preguntas where codigo = 'P-01') ~ '^R-[0-9]{2,}$',
  'la regla propuesta no tiene su código R-xx'
);
select pruebas.afirmar(
  (select regla_aprobada_por from public.mercadeo_preguntas where codigo = 'P-01') is null
  and (select regla_revisar_antes_de from public.mercadeo_preguntas where codigo = 'P-01') is null,
  'una regla propuesta ya trae firma o caducidad'
);

-- Con 3 enlaces distintos (dos reels + un carrusel) pasa; el curso no cuenta.
select public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000001', 'vigente');
select pruebas.afirmar(
  (select regla_estado from public.mercadeo_preguntas where codigo = 'P-01') = 'vigente'
  and (select regla_aprobada_por from public.mercadeo_preguntas where codigo = 'P-01') = 'b8000000-0000-0000-0000-000000000002'
  and (select regla_vigente_desde from public.mercadeo_preguntas where codigo = 'P-01') = current_date
  and (select regla_revisar_antes_de from public.mercadeo_preguntas where codigo = 'P-01') = current_date + 60,
  'vigente no dejó firma del coach ni caducidad a 60 días'
);
select public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000001', 'retirada');
do $$
begin
  begin
    perform public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000001', 'vigente');
    raise exception 'FALLO: una regla retirada volvió a vigente';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- «Vigente» con solo 2 enlaces distintos no pasa: se prueba sobre una pregunta nueva.
set role service_role;
insert into public.mercadeo_preguntas
  (id, codigo, texto, tema, destinataria_id, estado, respuesta, respondida_por, respondida_en)
values ('a8111111-0000-0000-0000-000000000005', 'P-05', '¿Qué formato de reel te gusta más para el reto?', 'formato',
        'b8000000-0000-0000-0000-000000000001', 'respondida', 'El reel corto.',
        'b8000000-0000-0000-0000-000000000001', now());
insert into public.mercadeo_referencias (pregunta_id, orden, tipo, url, url_normalizada, nota) values
  ('a8111111-0000-0000-0000-000000000005', 1, 'reel', 'https://instagram.com/reel/Uno/', 'https://instagram.com/reel/Uno', 'formato corto uno'),
  ('a8111111-0000-0000-0000-000000000005', 2, 'reel', 'https://instagram.com/reel/Uno/?x=1', 'https://instagram.com/reel/Uno', 'el mismo enlace otra vez'),
  ('a8111111-0000-0000-0000-000000000005', 3, 'reel', 'https://instagram.com/reel/Dos/', 'https://instagram.com/reel/Dos', 'formato corto dos');
reset role;

select pruebas.soy('b8000000-0000-0000-0000-000000000002');
set role authenticated;
do $$
begin
  begin
    perform public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000005', 'vigente', 'Reel corto para el reto');
    raise exception 'FALLO: una regla pasó a vigente con solo 2 enlaces distintos';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- La tabla misma se defiende: vigente sin firma o con caducidad distinta de 60 días no entra.
do $$
begin
  begin
    update public.mercadeo_preguntas
       set regla_estado = 'vigente', regla_codigo = 'R-98', regla_enunciado = 'Reel corto para el reto'
     where codigo = 'P-05';
    raise exception 'FALLO: la tabla aceptó una regla vigente sin firma';
  exception when check_violation then null;
  end;
  begin
    update public.mercadeo_preguntas
       set regla_estado = 'vigente', regla_codigo = 'R-98', regla_enunciado = 'Reel corto para el reto',
           regla_aprobada_por = 'b8000000-0000-0000-0000-000000000002', regla_aprobada_en = now(),
           regla_vigente_desde = current_date, regla_revisar_antes_de = current_date + 90
     where codigo = 'P-05';
    raise exception 'FALLO: la tabla aceptó una caducidad distinta de 60 días';
  exception when check_violation then null;
  end;
  begin
    update public.mercadeo_preguntas
       set regla_estado = 'propuesta', regla_codigo = 'R-97', regla_enunciado = 'Reel corto para el reto',
           regla_aprobada_por = 'b8000000-0000-0000-0000-000000000001'
     where codigo = 'P-05';
    raise exception 'FALLO: quien respondió aprobó su propia regla';
  exception when check_violation then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 2b · Otra persona del equipo y un asesorado: cero filas; anon: nada
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b8000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.mercadeo_preguntas) = 1
  and (select count(*) from public.mercadeo_referencias) = 0,
  'otra persona del equipo ve preguntas o referencias de Manuela'
);
do $$
begin
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000004', 'sin capacidad');
    raise exception 'FALLO: quien no tiene responder_mercadeo respondió el buzón';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.soy('a8000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.mercadeo_preguntas) = 0 and (select count(*) from public.mercadeo_referencias) = 0,
  'un asesorado ve el buzón de mercadeo'
);
do $$
begin
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000001', 'un asesorado');
    raise exception 'FALLO: un asesorado respondió el buzón';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.mover_regla_mercadeo('a8111111-0000-0000-0000-000000000001', 'retirada');
    raise exception 'FALLO: un asesorado movió una regla';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$
begin
  begin
    perform 1 from public.mercadeo_preguntas limit 1;
    raise exception 'FALLO: anon pudo leer mercadeo_preguntas';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.mercadeo_referencias limit 1;
    raise exception 'FALLO: anon pudo leer mercadeo_referencias';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.responder_buzon_mercadeo('a8111111-0000-0000-0000-000000000001', 'anon');
    raise exception 'FALLO: anon respondió el buzón';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
