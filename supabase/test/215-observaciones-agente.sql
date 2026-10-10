-- Las observaciones del agente (0115).
--
-- POR QUÉ ESTA PRUEBA EXISTE. Bryan fijó la regla (9-oct-2026): «las bases de conocimiento tienen la
-- última palabra; solamente en el tema de seguridad y prescripciones Manuela y yo tenemos la última
-- palabra». Esa regla vive en la base y no en el agente, y una regla que vive en la base se prueba
-- contra la base. Lo que podía fallar sin que nadie lo viera:
--   · que una observación de seguridad o de prescripción se colara como `anotada` (escrita y visible
--     sin firma de nadie);
--   · que una observación sin fuente entrara (nada con qué comprobar en qué se apoya);
--   · que cualquiera con sesión reescribiera lo que dijo el agente, o firmara a nombre de otro;
--   · que la asesorada de quien habla el agente leyera lo que el equipo escribe sobre ella.
-- Las filas se siembran como dueño de la tabla, que es lo que hace el agente con `service_role`
-- (se salta RLS). Después cada sesión corre como `authenticated`, sujeta a las políticas. Se comprueba:
--
--   1. La base RECHAZA seguridad o prescripción en carril `anotada`, una fila sin fuentes (vacía, que
--      no sea arreglo, ausente), un título de más de 140 caracteres, un tema o carril inventados, una
--      fila `pendiente` con firmante y una `firmada` sin hora, y el duplicado de (persona, corrida, título).
--   2. El control positivo de lo anterior: las filas buenas SÍ entran (si no, los rechazos no prueban nada).
--   3. Quien entra a la consola por capacidad (Manuela) lee; el coach lee.
--   4. Una nutricionista SIN la capacidad y la asesorada de quien habla NO leen nada.
--   5. Nadie con sesión inserta, actualiza ni borra directo (ni el coach).
--   6. Firmar: funciona para quien entra a la consola, deja su id, la hora y la nota; no se puede firmar
--      dos veces; la decisión debe ser aceptada o descartada; una que no existe da P0002.
--   7. La asesorada y la nutricionista sin consola no firman (42501).
--   8. anon no tiene nada; authenticated solo lee; la función no es de anon.
--
-- Bloque de UUID propio (f115…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f1150000-0000-0000-0000-000000000001', 'oa-asesorada@ejemplo.test'),
  ('f1150000-0000-0000-0000-000000000002', 'oa-coach@ejemplo.test'),
  ('f1150000-0000-0000-0000-000000000003', 'oa-staff-con-consola@ejemplo.test'),
  ('f1150000-0000-0000-0000-000000000004', 'oa-staff-sin-consola@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f1150000-0000-0000-0000-000000000001', 'Asesorada de las observaciones', 'asesorado', 'AO'),
  ('f1150000-0000-0000-0000-000000000002', 'Coach de las observaciones', 'coach', 'CO'),
  ('f1150000-0000-0000-0000-000000000003', 'Staff con consola', 'nutricionista', 'SC'),
  ('f1150000-0000-0000-0000-000000000004', 'Staff sin consola', 'nutricionista', 'SS')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- …03 es Manuela: nutricionista que entra a la consola por capacidad. …04 es el control negativo:
-- mismo rol, sin la capacidad.
insert into public.capacidades_staff (usuario_id, capacidad) values
  ('f1150000-0000-0000-0000-000000000003', 'leer_entrenamiento')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 1 y 2 · Lo que la BASE rechaza, y el control positivo de que lo bueno entra (como dueño = el agente)
-- ════════════════════════════════════════════════════════════════════════
-- Tres filas buenas: una de seguridad en `para_firma`, una de estilo de vida `anotada`, una de
-- prescripción en `para_firma`. Son las que usan las secciones de abajo.
insert into public.observaciones_agente
  (id, usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id, creado_en)
values
  ('f1150000-0000-0000-0000-0000000000a1', 'f1150000-0000-0000-0000-000000000001',
   'seguridad', 'para_firma', 'Dolor de rodilla al bajar escaleras',
   'Mencionó dolor al bajar escaleras en la llamada del 8 de octubre.',
   '[{"tipo":"dato","ref":"notas_llamada 2026-10-08","cita":"me duele la rodilla al bajar"},
     {"tipo":"base","ref":"wiki/seguridad/dolor-articular.md 2026-09-30","cita":"dolor al bajar escaleras: derivar antes de cargar"}]'::jsonb,
   'agente-de-llamadas', 'corrida-1', now() - interval '2 hours'),
  ('f1150000-0000-0000-0000-0000000000a2', 'f1150000-0000-0000-0000-000000000001',
   'estilo_de_vida', 'anotada', 'Caminar diez minutos después de almorzar',
   'Sugerir una caminata corta tras la comida principal.',
   '[{"tipo":"base","ref":"wiki/estilo-de-vida/caminata-posprandial.md 2026-09-12","cita":"diez minutos bastan para bajar la glucosa"}]'::jsonb,
   'agente-de-llamadas', 'corrida-1', now() - interval '1 hour'),
  ('f1150000-0000-0000-0000-0000000000a3', 'f1150000-0000-0000-0000-000000000001',
   'prescripcion', 'para_firma', 'Bajar el volumen de pierna una semana',
   'Proponer una semana de menos series de pierna.',
   '[{"tipo":"base","ref":"wiki/entrenamiento/descarga.md 2026-09-20","cita":"descargar tras dos semanas de dolor"}]'::jsonb,
   'agente-de-prescripcion', 'corrida-1', now());

select pruebas.afirmar(
  (select count(*) from public.observaciones_agente where usuario_id = 'f1150000-0000-0000-0000-000000000001') = 3
  and (select count(*) from public.observaciones_agente where estado = 'pendiente') = 3,
  'las filas buenas no entraron, o no quedaron pendientes por omisión: los rechazos de abajo no prueban nada'
);

do $$
begin
  -- LA REGLA DEL DUEÑO: seguridad y prescripción no se anotan solas.
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id)
    values ('f1150000-0000-0000-0000-000000000001', 'seguridad', 'anotada', 'Seguridad colada', 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'agente', 'c-1');
    raise exception 'FALLO: la base aceptó una observación de seguridad en el carril anotada';
  exception when check_violation then null; end;
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id)
    values ('f1150000-0000-0000-0000-000000000001', 'prescripcion', 'anotada', 'Prescripción colada', 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'agente', 'c-1');
    raise exception 'FALLO: la base aceptó una prescripción en el carril anotada';
  exception when check_violation then null; end;
  -- Sin fuente no entra: vacía, que no sea arreglo, o sin decirla (el default es vacío).
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', 'Sin fuente', 'x', '[]'::jsonb, 'agente', 'c-2');
    raise exception 'FALLO: la base aceptó una observación con las fuentes vacías';
  exception when check_violation then null; end;
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', 'Fuente objeto', 'x',
            '{"tipo":"base"}'::jsonb, 'agente', 'c-2');
    raise exception 'FALLO: la base aceptó unas fuentes que no son un arreglo';
  exception when check_violation then null; end;
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, agente, corrida_id)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', 'Sin decir fuentes', 'x', 'agente', 'c-2');
    raise exception 'FALLO: la base aceptó una observación sin decir sus fuentes';
  exception when check_violation then null; end;
  -- Título de más de 140 caracteres; tema y carril inventados.
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', repeat('x', 141), 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'agente', 'c-3');
    raise exception 'FALLO: la base aceptó un título de 141 caracteres';
  exception when check_violation then null; end;
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id)
    values ('f1150000-0000-0000-0000-000000000001', 'chisme', 'anotada', 'Tema inventado', 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'agente', 'c-3');
    raise exception 'FALLO: la base aceptó un tema inventado';
  exception when check_violation then null; end;
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'automatica', 'Carril inventado', 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'agente', 'c-3');
    raise exception 'FALLO: la base aceptó un carril inventado';
  exception when check_violation then null; end;
  -- Coherencia de la firma: pendiente con firmante, o firmada sin hora.
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id, firmada_por)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', 'Pendiente con firmante', 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'agente', 'c-4', 'f1150000-0000-0000-0000-000000000003');
    raise exception 'FALLO: la base aceptó una pendiente que ya trae firmante';
  exception when check_violation then null; end;
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id, estado)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', 'Aceptada sin hora', 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'agente', 'c-4', 'aceptada');
    raise exception 'FALLO: la base aceptó una observación firmada sin hora de firma';
  exception when check_violation then null; end;
  -- Reintentar la misma corrida con el mismo título no duplica.
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente, corrida_id)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', 'Caminar diez minutos después de almorzar', 'otra vez',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'agente-de-llamadas', 'corrida-1');
    raise exception 'FALLO: la misma corrida dejó la misma observación dos veces';
  exception when unique_violation then null; end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.observaciones_agente) = 3,
  'alguna fila rechazada de todos modos quedó guardada'
);

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Quien entra a la consola por capacidad (Manuela) lee; luego, firma
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1150000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.observaciones_agente
    where usuario_id = 'f1150000-0000-0000-0000-000000000001') = 3,
  'quien entra a la consola por leer_entrenamiento no lee las observaciones del agente'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Nadie con sesión escribe directo (se prueba aquí con Manuela; abajo, con el coach)
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', 'Escrita a mano', 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'yo');
    raise exception 'FALLO: alguien con sesión insertó una observación directo';
  exception when insufficient_privilege then null; end;
  begin
    update public.observaciones_agente set estado = 'aceptada', firmada_por = 'f1150000-0000-0000-0000-000000000003', firmada_en = now();
    raise exception 'FALLO: alguien con sesión firmó con un update directo';
  exception when insufficient_privilege then null; end;
  begin
    update public.observaciones_agente set texto = 'REESCRITA';
    raise exception 'FALLO: alguien con sesión reescribió el texto del agente';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.observaciones_agente;
    raise exception 'FALLO: alguien con sesión borró observaciones';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · Firmar: deja quién, cuándo y la nota; no se firma dos veces
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  (select estado = 'aceptada'
          and firmada_por = 'f1150000-0000-0000-0000-000000000003'
          and firmada_en > now() - interval '1 minute'
          and nota_de_firma = 'Lo reviso con ella el jueves.'
          and id = 'f1150000-0000-0000-0000-0000000000a1'
     from public.firmar_observacion_agente(
            'f1150000-0000-0000-0000-0000000000a1', 'aceptada', '  Lo reviso con ella el jueves.  ')),
  'firmar no devolvió la fila firmada a nombre de quien firma, con su hora y su nota (sin espacios de sobra)'
);
select pruebas.afirmar(
  (select estado = 'aceptada' and firmada_por = 'f1150000-0000-0000-0000-000000000003'
          and titulo = 'Dolor de rodilla al bajar escaleras'
          and texto like 'Mencionó dolor%' and carril = 'para_firma'
     from public.observaciones_agente where id = 'f1150000-0000-0000-0000-0000000000a1'),
  'la firma no quedó guardada, o tocó el título, el texto o el carril de lo que escribió el agente'
);
select pruebas.afirmar(
  (select count(*) from public.observaciones_agente where estado = 'pendiente') = 2,
  'firmar una observación tocó otras, o no la sacó de las pendientes'
);

do $$
begin
  begin
    perform public.firmar_observacion_agente('f1150000-0000-0000-0000-0000000000a1', 'descartada', 'Cambio de opinión');
    raise exception 'FALLO: se pudo firmar dos veces la misma observación';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.firmar_observacion_agente('f1150000-0000-0000-0000-0000000000a3', 'pendiente');
    raise exception 'FALLO: la decisión «pendiente» pasó por firma';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.firmar_observacion_agente('f1150000-0000-0000-0000-0000000000a3', null);
    raise exception 'FALLO: una decisión vacía pasó por firma';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.firmar_observacion_agente('f1150000-0000-0000-0000-0000000000a3', 'aceptada', repeat('x', 501));
    raise exception 'FALLO: una nota de firma de 501 caracteres pasó';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.firmar_observacion_agente('f1150000-0000-0000-0000-0000000000ff', 'aceptada');
    raise exception 'FALLO: firmó una observación que no existe';
  exception when sqlstate 'P0002' then null; end;
end $$;

-- Lo que falló no firmó: la a3 sigue pendiente y sin firmante.
select pruebas.afirmar(
  (select estado = 'pendiente' and firmada_por is null and firmada_en is null
     from public.observaciones_agente where id = 'f1150000-0000-0000-0000-0000000000a3'),
  'una firma rechazada dejó la observación a medio firmar'
);

-- ════════════════════════════════════════════════════════════════════════
-- Y el coach: lee lo firmado por Manuela, descarta sin nota, y tampoco escribe directo
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f1150000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.observaciones_agente) = 3
  and (select firmada_por from public.observaciones_agente where id = 'f1150000-0000-0000-0000-0000000000a1')
      = 'f1150000-0000-0000-0000-000000000003',
  'el coach no lee las observaciones, o no ve quién firmó la de Manuela'
);
select pruebas.afirmar(
  (select estado = 'descartada' and firmada_por = 'f1150000-0000-0000-0000-000000000002' and nota_de_firma is null
     from public.firmar_observacion_agente('f1150000-0000-0000-0000-0000000000a3', 'descartada', '   ')),
  'el coach no pudo descartar, o una nota de solo espacios no quedó como sin nota'
);
do $$
begin
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', 'Escrita por el coach', 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'yo');
    raise exception 'FALLO: el coach insertó una observación directo';
  exception when insufficient_privilege then null; end;
  begin
    update public.observaciones_agente set texto = 'REESCRITA POR EL COACH';
    raise exception 'FALLO: el coach reescribió el texto del agente';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.observaciones_agente;
    raise exception 'FALLO: el coach borró observaciones';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4 y 7 · Nutricionista SIN la capacidad: ni lee ni firma. La puerta es la capacidad, no el rol.
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f1150000-0000-0000-0000-000000000004');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.observaciones_agente) = 0,
  'una nutricionista sin acceso a la consola lee las observaciones: la puerta volvió a ser el rol y no la capacidad'
);
do $$
begin
  begin
    perform public.firmar_observacion_agente('f1150000-0000-0000-0000-0000000000a2', 'aceptada');
    raise exception 'FALLO: una nutricionista sin acceso a la consola firmó';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4 y 7 · La asesorada de quien habla el agente: ni lo lee ni firma
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f1150000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.observaciones_agente) = 0,
  'una asesorada lee lo que el agente escribió sobre ella'
);
do $$
begin
  begin
    perform public.firmar_observacion_agente('f1150000-0000-0000-0000-0000000000a2', 'aceptada');
    raise exception 'FALLO: una asesorada firmó una observación sobre sí misma';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.observaciones_agente (usuario_id, tema, carril, titulo, texto, fuentes, agente)
    values ('f1150000-0000-0000-0000-000000000001', 'estilo_de_vida', 'anotada', 'Me la escribo yo', 'x',
            '[{"tipo":"base","ref":"r","cita":"c"}]'::jsonb, 'yo');
    raise exception 'FALLO: una asesorada escribió una observación del agente';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 8 · anon no tiene nada; authenticated solo lee; lo firmado y lo pendiente quedó como debía
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.afirmar(
  (select count(*) from public.observaciones_agente) = 3
  and (select count(*) from public.observaciones_agente where estado = 'pendiente') = 1
  and (select count(*) from public.observaciones_agente where texto like 'REESCRITA%') = 0,
  'alguien sin permiso firmó, reescribió o borró observaciones (debían quedar: 1 aceptada, 1 descartada, 1 pendiente)'
);
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.observaciones_agente', 'select')
  and not has_table_privilege('anon', 'public.observaciones_agente', 'insert')
  and not has_table_privilege('anon', 'public.observaciones_agente', 'update')
  and not has_table_privilege('anon', 'public.observaciones_agente', 'delete')
  and not has_table_privilege('anon', 'public.observaciones_agente', 'truncate')
  and not has_function_privilege('anon', 'public.firmar_observacion_agente(uuid,text,text)', 'execute'),
  'anon tiene algún privilegio sobre las observaciones del agente o sobre la función de firma'
);
select pruebas.afirmar(
  has_table_privilege('authenticated', 'public.observaciones_agente', 'select')
  and not has_table_privilege('authenticated', 'public.observaciones_agente', 'insert')
  and not has_table_privilege('authenticated', 'public.observaciones_agente', 'update')
  and not has_table_privilege('authenticated', 'public.observaciones_agente', 'delete')
  and not has_table_privilege('authenticated', 'public.observaciones_agente', 'truncate')
  and has_function_privilege('authenticated', 'public.firmar_observacion_agente(uuid,text,text)', 'execute')
  and has_function_privilege('service_role', 'public.firmar_observacion_agente(uuid,text,text)', 'execute')
  and has_table_privilege('service_role', 'public.observaciones_agente', 'insert'),
  'authenticated tiene de más o de menos (solo lee y firma por la función), o service_role no puede escribir'
);

rollback;
