-- Praxis: la memoria de la charla entre días (0166).
--
-- POR QUÉ ESTA PRUEBA EXISTE. La tabla guarda la charla COMPLETA de cada persona con Praxis: texto libre que puede
-- contar salud. Decisión de Bryan (7-nov-2026, tras el informe del custodio de datos): la leen SOLO él (capacidad
-- `leer_charlas_praxis`) y los agentes (service_role); escriben solo los agentes; el plazo es 30 días desde atendida
-- con tope de 90. Se comprueba contra RLS de verdad:
--
--   1. La persona no lee ni inserta (ni lo suyo): el navegador no escribe turnos ni marcas clínicas.
--   2. El equipo SIN la capacidad (coach y nutricionista) no ve nada ni escribe. Antes leía todo: esta prueba falla
--      si la política vuelve a `es_staff()`.
--   3. Con la capacidad se lee todo; al quitársela, nada (control positivo y negativo de la misma cuenta).
--   4. service_role inserta (también rol 'praxis'); los checks rechazan texto vacío, largo y rol inventado.
--   5. anon no tiene nada; privilegios exactos de tabla y funciones.
--   6. Borrar mi charla: la persona borra solo la suya, aunque otra use el mismo charla_id; sin sesión, se niega.
--   7. Marcar atendida: solo service_role; acorta a 30 días sin pasar el tope de 90; no reinicia el plazo.
--   8. La purga borra lo vencido y deja lo reciente; solo service_role.
--
-- Bloque de UUID propio (c6…/d6…/e6…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('e6000000-0000-0000-0000-000000000001', 'memoria-asesorada-a@ejemplo.test'),
  ('e6000000-0000-0000-0000-000000000002', 'memoria-asesorada-b@ejemplo.test'),
  ('d6000000-0000-0000-0000-000000000001', 'memoria-coach@ejemplo.test'),
  ('d6000000-0000-0000-0000-000000000002', 'memoria-nutricionista@ejemplo.test'),
  ('d6000000-0000-0000-0000-000000000003', 'memoria-lector@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('e6000000-0000-0000-0000-000000000001', 'Asesorada A de prueba', 'asesorado', 'AA'),
  ('e6000000-0000-0000-0000-000000000002', 'Asesorada B de prueba', 'asesorado', 'AB'),
  ('d6000000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CO'),
  ('d6000000-0000-0000-0000-000000000002', 'Nutricionista de prueba', 'nutricionista', 'NU'),
  ('d6000000-0000-0000-0000-000000000003', 'Lector con capacidad de prueba', 'coach', 'LC')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- Solo el lector de prueba tiene la capacidad nueva.
insert into public.capacidades_staff (usuario_id, capacidad) values
  ('d6000000-0000-0000-0000-000000000003', 'leer_charlas_praxis')
on conflict do nothing;

-- Turnos sembrados como dueño (como haría el agente). A: 8 turnos en 6 charlas; B: 1.
insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto, creado_en, borrar_en) values
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000f', 0, 'persona', 'turno viejo de prueba',
     now() - interval '100 days', now() - interval '10 days'),
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000f', 1, 'praxis', 'respuesta vieja de prueba',
     now() - interval '91 days', now() - interval '1 day'),
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000e', 0, 'persona', 'turno de hace 89 dias',
     now() - interval '89 days', now() + interval '1 day'),
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000d', 0, 'persona', 'turno de ayer',
     now() - interval '1 day', now() + interval '89 days'),
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000050', 0, 'persona', 'charla de hace 50 dias',
     now() - interval '50 days', now() + interval '40 days'),
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000080', 0, 'persona', 'charla de hace 80 dias',
     now() - interval '80 days', now() + interval '10 days'),
  ('e6000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 0, 'persona', 'texto inventado de la asesorada B',
     now(), now() + interval '90 days');

-- ════════════════════════════════════════════════════════════════════════
-- 4 · service_role inserta (también la voz de Praxis); los checks siguen
-- ════════════════════════════════════════════════════════════════════════
set role service_role;
insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto) values
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 0, 'persona', 'texto inventado de la asesorada A'),
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 'praxis',  'respuesta inventada para A');

do $$
begin
  begin
    insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto) values
      ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 0, 'persona', 'turno repetido');
    raise exception 'FALLO: entró un turno repetido (mismo usuario, charla y n)';
  exception when unique_violation then null;
  end;
  begin
    insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto) values
      ('e6000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 0, 'sistema', 'rol inventado');
    raise exception 'FALLO: entró un rol fuera de persona/praxis';
  exception when check_violation then null;
  end;
  begin
    insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto) values
      ('e6000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 1, 'persona', '   ');
    raise exception 'FALLO: entró un texto vacío';
  exception when check_violation then null;
  end;
  begin
    insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto) values
      ('e6000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 2, 'persona', repeat('a', 2001));
    raise exception 'FALLO: entró un texto de más de 2000 caracteres';
  exception when check_violation then null;
  end;
end $$;
reset role;

select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos where usuario_id = 'e6000000-0000-0000-0000-000000000001') = 8
  and (select count(*) from public.praxis_charla_turnos where usuario_id = 'e6000000-0000-0000-0000-000000000002') = 1,
  'la siembra no quedó como se esperaba (la prueba no probaría nada)'
);
select pruebas.afirmar(
  (select borrar_en > now() + interval '89 days' from public.praxis_charla_turnos
    where charla_id = 'aaaaaaaa-0000-0000-0000-000000000001' and usuario_id = 'e6000000-0000-0000-0000-000000000001' and n = 0),
  'el plazo por omisión no es de 90 días'
);

-- ════════════════════════════════════════════════════════════════════════
-- 1 · La persona no lee ni escribe por la API (ni lo suyo)
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('e6000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos) = 0,
  'la persona lee turnos de charla (solo Bryan y los agentes deben leer)'
);

do $$
begin
  begin
    insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto) values
      ('e6000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 0, 'praxis', 'turno falso de Praxis');
    raise exception 'FALLO: la persona escribió un turno (podría fingir la voz de Praxis)';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.praxis_charla_turnos set marcado_clinico = false;
    raise exception 'FALLO: una sesión de usuario actualizó turnos';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.praxis_charla_turnos;
    raise exception 'FALLO: una sesión de usuario borró turnos directo';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · El equipo SIN la capacidad no ve nada ni escribe
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('d6000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos) = 0,
  'un coach sin la capacidad leer_charlas_praxis lee las charlas'
);
do $$
begin
  begin
    insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto) values
      ('e6000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 0, 'persona', 'coach a nombre de A');
    raise exception 'FALLO: el coach guardó un turno';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.soy('d6000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos) = 0,
  'la nutricionista sin la capacidad lee las charlas'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Con la capacidad se lee todo; sin ella, nada (misma cuenta)
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('d6000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos) = 9,
  'quien tiene leer_charlas_praxis no lee la charla completa de las dos personas'
);
do $$
begin
  begin
    update public.praxis_charla_turnos set texto = 'editado por el lector';
    raise exception 'FALLO: el lector con capacidad actualizó un turno';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

delete from public.capacidades_staff
 where usuario_id = 'd6000000-0000-0000-0000-000000000003' and capacidad = 'leer_charlas_praxis';
select pruebas.soy('d6000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos) = 0,
  'al quitar la capacidad la cuenta sigue leyendo las charlas'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · anon no tiene nada; privilegios exactos
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.praxis_charla_turnos', 'select')
  and not has_table_privilege('anon', 'public.praxis_charla_turnos', 'insert')
  and not has_table_privilege('authenticated', 'public.praxis_charla_turnos', 'insert')
  and not has_table_privilege('authenticated', 'public.praxis_charla_turnos', 'update')
  and not has_table_privilege('authenticated', 'public.praxis_charla_turnos', 'delete')
  and not has_column_privilege('authenticated', 'public.praxis_charla_turnos', 'rol', 'insert')
  and not has_column_privilege('authenticated', 'public.praxis_charla_turnos', 'marcado_clinico', 'insert')
  and not has_function_privilege('anon', 'public.praxis_borrar_mi_charla(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.praxis_purgar_charlas()', 'execute')
  and not has_function_privilege('authenticated', 'public.praxis_purgar_charlas()', 'execute')
  and not has_function_privilege('anon', 'public.praxis_marcar_charla_atendida(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.praxis_marcar_charla_atendida(uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.praxis_borrar_mi_charla(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.praxis_purgar_charlas()', 'execute')
  and has_function_privilege('service_role', 'public.praxis_marcar_charla_atendida(uuid, uuid)', 'execute'),
  'privilegios de más (o de menos) en la tabla o en sus funciones'
);

set role anon;
do $$
begin
  begin
    perform count(*) from public.praxis_charla_turnos;
    raise exception 'FALLO: anon leyó la tabla de charlas';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · Borrar mi charla: solo la mía, aunque otra persona use el mismo charla_id
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('e6000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  public.praxis_borrar_mi_charla('aaaaaaaa-0000-0000-0000-000000000001') = 1,
  'B no borró exactamente su único turno de esa charla'
);
select pruebas.afirmar(
  public.praxis_borrar_mi_charla('aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'borrar dos veces la misma charla no es idempotente'
);
reset role;

select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos
    where usuario_id = 'e6000000-0000-0000-0000-000000000001'
      and charla_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 2
  and (select count(*) from public.praxis_charla_turnos
        where usuario_id = 'e6000000-0000-0000-0000-000000000002') = 0,
  'borrar-mi-charla de B tocó la charla de A, o no borró la de B'
);

select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$
begin
  begin
    perform public.praxis_borrar_mi_charla('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FALLO: borrar-mi-charla funcionó sin sesión';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 7 · Marcar atendida: 30 días desde ahora, sin pasar el tope de 90, sin reiniciar
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('d6000000-0000-0000-0000-000000000001');
set role authenticated;
do $$
begin
  begin
    perform public.praxis_marcar_charla_atendida('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000050');
    raise exception 'FALLO: una sesión de usuario marcó una charla atendida';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role service_role;
select public.praxis_marcar_charla_atendida('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000050') as m50 \gset
select public.praxis_marcar_charla_atendida('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000080') as m80 \gset
reset role;
select pruebas.afirmar(:m50 = 1 and :m80 = 1, 'marcar atendida no tocó exactamente un turno por charla');

select pruebas.afirmar(
  (select borrar_en between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour'
     and atendida_en is not null
     from public.praxis_charla_turnos where charla_id = 'aaaaaaaa-0000-0000-0000-000000000050'),
  'la charla de hace 50 días no quedó con 30 días desde atendida'
);
select pruebas.afirmar(
  (select borrar_en < now() + interval '11 days'
     from public.praxis_charla_turnos where charla_id = 'aaaaaaaa-0000-0000-0000-000000000080'),
  'marcar atendida alargó el tope de 90 días (la de hace 80 días debía seguir con 10)'
);

-- Volver a marcar no reinicia el plazo: se simula que la atendieron hace 20 días.
update public.praxis_charla_turnos
   set atendida_en = now() - interval '20 days', borrar_en = now() + interval '10 days'
 where charla_id = 'aaaaaaaa-0000-0000-0000-000000000050';
set role service_role;
select public.praxis_marcar_charla_atendida('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000050') as m50b \gset
reset role;
select pruebas.afirmar(
  (select borrar_en < now() + interval '11 days'
     from public.praxis_charla_turnos where charla_id = 'aaaaaaaa-0000-0000-0000-000000000050'),
  'marcar dos veces reinició el plazo de 30 días'
);

-- ════════════════════════════════════════════════════════════════════════
-- 8 · La purga borra lo vencido y deja lo reciente
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos where texto in ('turno viejo de prueba', 'respuesta vieja de prueba')) = 2,
  'las dos filas viejas no estaban antes de purgar (la prueba no probaría nada)'
);

select pruebas.soy('d6000000-0000-0000-0000-000000000001');
set role authenticated;
do $$
begin
  begin
    perform public.praxis_purgar_charlas();
    raise exception 'FALLO: una sesión de usuario ejecutó la purga';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role service_role;
select public.praxis_purgar_charlas() as purga_1 \gset
select public.praxis_purgar_charlas() as purga_2 \gset
reset role;
select pruebas.afirmar(:purga_1 = 2, 'la purga no borró exactamente las 2 filas vencidas');
select pruebas.afirmar(:purga_2 = 0, 'la purga no es idempotente');

select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos where texto like '%vieja de prueba') = 0
  and (select count(*) from public.praxis_charla_turnos where texto in ('turno de hace 89 dias', 'turno de ayer')) = 2
  and (select count(*) from public.praxis_charla_turnos where charla_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 2,
  'la purga borró lo reciente, o dejó lo vencido'
);

rollback;
