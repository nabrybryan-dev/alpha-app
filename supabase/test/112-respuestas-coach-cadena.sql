-- Las respuestas del coach a las preguntas de la cadena (0110).
--
-- POR QUÉ ESTA PRUEBA EXISTE. La respuesta del coach viaja a la entrada del ① y del ② y puede cambiar el
-- volumen de una persona. El riesgo: que un asesorado escriba "como coach", que la respuesta se atribuya a
-- otro, o que se pueda escribir la tabla sin pasar por la función. Se comprueba contra RLS de verdad:
--
--   1. El coach responde; queda su id, su nombre y la hora de la base.
--   2. La nutricionista (Manuela) también responde y lee.
--   3. Un asesorado ni responde (42501) ni lee.
--   4. Contestar de nuevo corrige la respuesta pero no cambia de quién ni de qué era la pregunta.
--   5. Entradas inválidas (id que no es de la cadena, respuesta vacía, paso 9, persona inexistente) se rechazan.
--   6. Nadie escribe ni borra la tabla directo (ni el coach); anon no tiene nada.
--
-- Bloque de UUID propio (ad…/bd…/cd…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('ad000000-0000-0000-0000-000000000001', 'rc-asesorada@ejemplo.test'),
  ('bd000000-0000-0000-0000-000000000001', 'rc-coach@ejemplo.test'),
  ('cd000000-0000-0000-0000-000000000001', 'rc-nutricionista@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('ad000000-0000-0000-0000-000000000001', 'Asesorada de la pregunta', 'asesorado', 'AP'),
  ('bd000000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CO'),
  ('cd000000-0000-0000-0000-000000000001', 'Nutricionista de prueba', 'nutricionista', 'NU')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · El coach responde; la base pone quién y cuándo
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('bd000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select public.responder_pregunta_coach(
  'cp-0123456789abcdef', 'ad000000-0000-0000-0000-000000000001', 2,
  '¿Con qué volumen vuelve tras la descarga?', 'B · 25 series');

select pruebas.afirmar(
  (select count(*) from public.respuestas_coach_cadena where id_pregunta = 'cp-0123456789abcdef') = 1,
  'el coach no pudo responder o no puede leer su respuesta'
);
select pruebas.afirmar(
  (select respondido_por = 'bd000000-0000-0000-0000-000000000001' and quien = 'Coach de prueba'
          and respondido_en > now() - interval '1 minute'
     from public.respuestas_coach_cadena where id_pregunta = 'cp-0123456789abcdef'),
  'la respuesta no quedó a nombre de quien llama, con la hora de la base'
);

-- ════════════════════════════════════════════════════════════════════════
-- 4 · Contestar de nuevo corrige la respuesta; no cambia de quién ni de qué era
-- ════════════════════════════════════════════════════════════════════════
select public.responder_pregunta_coach(
  'cp-0123456789abcdef', 'bd000000-0000-0000-0000-000000000001', 4,
  'OTRO TEXTO', 'A · 45 series');
select pruebas.afirmar(
  (select respuesta = 'A · 45 series' and usuario_id = 'ad000000-0000-0000-0000-000000000001'
          and paso = 2 and texto like '¿Con qué volumen%'
     from public.respuestas_coach_cadena where id_pregunta = 'cp-0123456789abcdef'),
  'contestar otra vez cambió de quién, del paso o del texto de la pregunta (o no corrigió la respuesta)'
);
select pruebas.afirmar(
  (select count(*) from public.respuestas_coach_cadena) = 1,
  'contestar la misma pregunta dos veces dejó dos filas'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Entradas inválidas
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    perform public.responder_pregunta_coach('no-es-cp', 'ad000000-0000-0000-0000-000000000001', 2, 'x', 'y');
    raise exception 'FALLO: aceptó un id que no es de la cadena';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.responder_pregunta_coach('cp-aaaaaaaaaaaaaaaa', 'ad000000-0000-0000-0000-000000000001', 2, 'x', '   ');
    raise exception 'FALLO: aceptó una respuesta vacía';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.responder_pregunta_coach('cp-aaaaaaaaaaaaaaaa', 'ad000000-0000-0000-0000-000000000001', 9, 'x', 'y');
    raise exception 'FALLO: aceptó el paso 9';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.responder_pregunta_coach('cp-aaaaaaaaaaaaaaaa', 'ad000000-0000-0000-0000-0000000000ff', 2, 'x', 'y');
    raise exception 'FALLO: aceptó una persona que no existe';
  exception when sqlstate 'P0002' then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · Ni el coach escribe la tabla directo
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.respuestas_coach_cadena (id_pregunta, usuario_id, paso, texto, respuesta, quien)
    values ('cp-bbbbbbbbbbbbbbbb', 'ad000000-0000-0000-0000-000000000001', 1, 'x', 'y', 'yo');
    raise exception 'FALLO: el coach pudo insertar directo en la tabla';
  exception when insufficient_privilege then null; end;
  begin
    update public.respuestas_coach_cadena set respuesta = 'otra';
    raise exception 'FALLO: el coach pudo actualizar directo la tabla';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.respuestas_coach_cadena;
    raise exception 'FALLO: el coach pudo borrar directo la tabla';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Un asesorado: ni responde ni lee
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('ad000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.respuestas_coach_cadena) = 0,
  'un asesorado lee las respuestas del coach'
);
do $$
begin
  begin
    perform public.responder_pregunta_coach('cp-cccccccccccccccc', 'ad000000-0000-0000-0000-000000000001', 2, 'x', 'me autorizo');
    raise exception 'FALLO: un asesorado respondió como coach';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · La nutricionista responde y lee
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('cd000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select public.responder_pregunta_coach(
  'cp-dddddddddddddddd', 'ad000000-0000-0000-0000-000000000001', 1, '¿Qué fue lo de salud?', 'Una gripe; sigue igual.');
select pruebas.afirmar(
  (select count(*) from public.respuestas_coach_cadena) = 2
  and (select quien from public.respuestas_coach_cadena where id_pregunta = 'cp-dddddddddddddddd') = 'Nutricionista de prueba',
  'la nutricionista no pudo responder o leer, o quedó a nombre de otro'
);

-- ════════════════════════════════════════════════════════════════════════
-- 6b · anon no tiene nada
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.respuestas_coach_cadena', 'select')
  and not has_table_privilege('anon', 'public.respuestas_coach_cadena', 'insert')
  and not has_function_privilege('anon', 'public.responder_pregunta_coach(text,uuid,integer,text,text)', 'execute'),
  'anon tiene algún privilegio sobre las respuestas del coach'
);

rollback;
