-- Praxis: la «pregunta en espera» (0105).
--
-- POR QUÉ ESTA PRUEBA EXISTE. La tabla es nueva y la escribe el ASESORADO desde su
-- teléfono, así que el riesgo es el de siempre (CLAUDE.md §4): una política que deje
-- escribir a nombre de otro, o que deje a la dueña contestarse a sí misma. Se comprueba
-- contra RLS de verdad:
--
--   1. La dueña inserta la suya y la lee. Nace `abierta`, con plazo de 24 horas, aunque el
--      navegador intente mandar otra cosa (no tiene privilegio sobre esas columnas).
--   2. Nadie inserta a nombre de otra persona.
--   3. Como mucho 2 abiertas por persona: la tercera se rechaza.
--   4. La dueña no puede responderse ni cambiar su pregunta.
--   5. Otra asesorada no ve nada ajeno.
--   6. La nutricionista ve y responde SOLO las que van a `nutricionista`; el coach, todas.
--   7. Nadie responde a nombre de otra persona (`respondida_por` es quien llama).
--
-- Bloque de UUID propio (a5…/b5…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('a5000000-0000-0000-0000-000000000001', 'praxis-asesorada-1@ejemplo.test'),
  ('a5000000-0000-0000-0000-000000000002', 'praxis-asesorada-2@ejemplo.test'),
  ('b5000000-0000-0000-0000-000000000001', 'praxis-coach@ejemplo.test'),
  ('b5000000-0000-0000-0000-000000000002', 'praxis-nutricionista@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('a5000000-0000-0000-0000-000000000001', 'Asesorada que pregunta', 'asesorado', 'P1'),
  ('a5000000-0000-0000-0000-000000000002', 'Otra asesorada', 'asesorado', 'P2'),
  ('b5000000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CO'),
  ('b5000000-0000-0000-0000-000000000002', 'Nutricionista de prueba', 'nutricionista', 'NU')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · La dueña inserta y lee la suya; nace abierta y con su plazo
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('a5000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

insert into public.praxis_preguntas_en_espera (usuario_id, pregunta, destinatario, que_falto, citas) values
  ('a5000000-0000-0000-0000-000000000001', '¿Por qué bajó la carga del press?', 'coach', 'porque_no_escrito',
   '["M5→M6 · PRESS BANCA · cargaKg"]'::jsonb);

select pruebas.afirmar(
  (select count(*) from public.praxis_preguntas_en_espera
    where usuario_id = 'a5000000-0000-0000-0000-000000000001' and estado = 'abierta'
      and respuesta is null and vence_en > now() + interval '23 hours' and vence_en <= now() + interval '24 hours') = 1,
  'la pregunta no nació abierta, sin respuesta y con plazo de 24 horas'
);

-- El navegador no decide el estado ni el plazo: no tiene privilegio sobre esas columnas.
do $$
begin
  begin
    insert into public.praxis_preguntas_en_espera (usuario_id, pregunta, destinatario, que_falto, estado, respuesta) values
      ('a5000000-0000-0000-0000-000000000001', 'Una que nace contestada', 'coach', 'sin_dato', 'respondida', 'me respondo sola');
    raise exception 'FALLO: una sesión de usuario insertó una pregunta ya respondida';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Nadie inserta a nombre de otra persona
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.praxis_preguntas_en_espera (usuario_id, pregunta, destinatario, que_falto) values
      ('a5000000-0000-0000-0000-000000000002', 'A nombre de otra', 'coach', 'sin_dato');
    raise exception 'FALLO: una asesorada dejó una pregunta a nombre de otra';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Como mucho dos abiertas
-- ════════════════════════════════════════════════════════════════════════
insert into public.praxis_preguntas_en_espera (usuario_id, pregunta, destinatario, que_falto) values
  ('a5000000-0000-0000-0000-000000000001', '¿Puedo cambiar el arroz por pasta?', 'nutricionista', 'cambio_del_plan');

do $$
begin
  begin
    insert into public.praxis_preguntas_en_espera (usuario_id, pregunta, destinatario, que_falto) values
      ('a5000000-0000-0000-0000-000000000001', 'La tercera', 'coach', 'sin_dato');
    raise exception 'FALLO: se aceptó una tercera pregunta abierta';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.praxis_preguntas_en_espera
    where usuario_id = 'a5000000-0000-0000-0000-000000000001') = 2,
  'la dueña no tiene exactamente sus dos preguntas'
);

-- ════════════════════════════════════════════════════════════════════════
-- 4 · La dueña no se responde ni cambia su pregunta
-- ════════════════════════════════════════════════════════════════════════
update public.praxis_preguntas_en_espera
   set estado = 'respondida', respuesta = 'me la contesto yo',
       respondida_por = 'a5000000-0000-0000-0000-000000000001', respondida_en = now()
 where usuario_id = 'a5000000-0000-0000-0000-000000000001';

select pruebas.afirmar(
  (select count(*) from public.praxis_preguntas_en_espera
    where usuario_id = 'a5000000-0000-0000-0000-000000000001' and estado = 'abierta') = 2,
  'la dueña pudo responder su propia pregunta'
);

do $$
begin
  begin
    update public.praxis_preguntas_en_espera set pregunta = 'otra cosa'
      where usuario_id = 'a5000000-0000-0000-0000-000000000001';
    raise exception 'FALLO: una sesión de usuario tiene privilegio para reescribir la pregunta';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    delete from public.praxis_preguntas_en_espera
      where usuario_id = 'a5000000-0000-0000-0000-000000000001';
    raise exception 'FALLO: una sesión de usuario tiene privilegio para borrar preguntas';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Otra asesorada no ve nada ajeno
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('a5000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.praxis_preguntas_en_espera) = 0,
  'otra asesorada ve preguntas que no son suyas'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · La nutricionista: solo las suyas
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b5000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.praxis_preguntas_en_espera) = 1
  and (select count(*) from public.praxis_preguntas_en_espera where destinatario = 'coach') = 0,
  'la nutricionista ve preguntas que no van para ella'
);

-- 7 · No responde a nombre de otra persona.
do $$
begin
  begin
    update public.praxis_preguntas_en_espera
       set estado = 'respondida', respuesta = 'Sí, la misma cantidad en crudo.',
           respondida_por = 'b5000000-0000-0000-0000-000000000001', respondida_en = now()
     where destinatario = 'nutricionista';
    raise exception 'FALLO: la nutricionista respondió a nombre del coach';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

update public.praxis_preguntas_en_espera
   set estado = 'respondida', respuesta = 'Sí, la misma cantidad en crudo.',
       respondida_por = 'b5000000-0000-0000-0000-000000000002', respondida_en = now()
 where destinatario = 'nutricionista';

-- La del coach no la toca.
update public.praxis_preguntas_en_espera
   set estado = 'respondida', respuesta = 'no me toca',
       respondida_por = 'b5000000-0000-0000-0000-000000000002', respondida_en = now()
 where destinatario = 'coach';

reset role;

select pruebas.afirmar(
  (select count(*) from public.praxis_preguntas_en_espera
    where destinatario = 'nutricionista' and estado = 'respondida'
      and respondida_por = 'b5000000-0000-0000-0000-000000000002') = 1,
  'la nutricionista no pudo responder la pregunta que va para ella'
);
select pruebas.afirmar(
  (select count(*) from public.praxis_preguntas_en_espera
    where destinatario = 'coach' and estado = 'abierta') = 1,
  'la nutricionista respondió una pregunta que iba al coach'
);

-- ════════════════════════════════════════════════════════════════════════
-- El coach ve todas y responde la suya; la dueña lee la respuesta y ya puede preguntar otra
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b5000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.praxis_preguntas_en_espera) = 2,
  'el coach no ve todas las preguntas'
);

update public.praxis_preguntas_en_espera
   set estado = 'respondida', respuesta = 'Bajó para volver a la reserva que buscamos.',
       respondida_por = 'b5000000-0000-0000-0000-000000000001', respondida_en = now()
 where destinatario = 'coach';

reset role;

select pruebas.soy('a5000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.praxis_preguntas_en_espera
    where estado = 'respondida' and respuesta is not null) = 2,
  'la dueña no lee las respuestas a sus preguntas'
);
select pruebas.afirmar(
  (select public.praxis_mis_preguntas_abiertas()) = 0,
  'el contador de abiertas no bajó al responderse'
);

insert into public.praxis_preguntas_en_espera (usuario_id, pregunta, destinatario, que_falto) values
  ('a5000000-0000-0000-0000-000000000001', '¿Qué me toca el sábado?', 'coach', 'sin_dato');

reset role;

-- anon no tiene nada.
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.praxis_preguntas_en_espera', 'select')
  and not has_table_privilege('anon', 'public.praxis_preguntas_en_espera', 'insert')
  and not has_function_privilege('anon', 'public.praxis_mis_preguntas_abiertas()', 'execute'),
  'anon tiene algún privilegio sobre la bandeja de preguntas de Praxis'
);

rollback;
