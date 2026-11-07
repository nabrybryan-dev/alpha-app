-- Praxis: la memoria de la charla entre días (0166).
--
-- POR QUÉ ESTA PRUEBA EXISTE. La tabla guarda la charla COMPLETA de cada persona con Praxis, es decir, texto libre
-- que puede contar salud. El riesgo es el de siempre (CLAUDE.md §4): que una persona lea la charla de otra, que
-- guarde a nombre de otra, que anon vea algo, o que la purga borre lo que no toca. Se comprueba contra RLS de verdad:
--
--   1. Cada persona inserta lo suyo (sin mandar usuario_id: lo pone auth.uid()) y lo lee.
--   2. Aislamiento: la persona B no ve nada de la A, ni por charla_id ni por conteo.
--   3. Nadie inserta a nombre de otra persona (ni mandando usuario_id ni mandando borrar_en).
--   4. El equipo (coach y nutricionista) lee todo, pero no inserta a nombre de otra ni actualiza ni borra.
--   5. Nadie actualiza ni borra directo con sesión; el texto vacío o de más de 2000 se rechaza.
--   6. anon no tiene nada; la purga y borrar-mi-charla no se pueden llamar con anon.
--   7. Borrar mi charla: borra solo la mía, no la de otra persona con el mismo charla_id.
--   8. La purga borra lo de más de 90 días y no lo reciente; solo la puede llamar service_role.
--
-- Bloque de UUID propio (c6…/d6…/e6…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('e6000000-0000-0000-0000-000000000001', 'memoria-asesorada-a@ejemplo.test'),
  ('e6000000-0000-0000-0000-000000000002', 'memoria-asesorada-b@ejemplo.test'),
  ('d6000000-0000-0000-0000-000000000001', 'memoria-coach@ejemplo.test'),
  ('d6000000-0000-0000-0000-000000000002', 'memoria-nutricionista@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('e6000000-0000-0000-0000-000000000001', 'Asesorada A de prueba', 'asesorado', 'AA'),
  ('e6000000-0000-0000-0000-000000000002', 'Asesorada B de prueba', 'asesorado', 'AB'),
  ('d6000000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CO'),
  ('d6000000-0000-0000-0000-000000000002', 'Nutricionista de prueba', 'nutricionista', 'NU')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- Filas antiguas y recientes sembradas como dueño (para la purga). A nombre de la asesorada A.
insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto, creado_en, borrar_en) values
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000f', 0, 'persona', 'turno viejo de prueba',
     now() - interval '100 days', now() - interval '10 days'),
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000f', 1, 'praxis', 'respuesta vieja de prueba',
     now() - interval '91 days', now() - interval '1 day'),
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000e', 0, 'persona', 'turno de hace 89 dias',
     now() - interval '89 days', now() + interval '1 day'),
  ('e6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000d', 0, 'persona', 'turno de ayer',
     now() - interval '1 day', now() + interval '89 days');

-- ════════════════════════════════════════════════════════════════════════
-- 1 · La persona A inserta lo suyo sin mandar usuario_id y lo lee
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('e6000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

insert into public.praxis_charla_turnos (charla_id, n, rol, texto) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 0, 'persona', 'texto inventado de la asesorada A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'praxis',  'respuesta inventada para A');

select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos
    where charla_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and usuario_id = 'e6000000-0000-0000-0000-000000000001'
      and borrar_en > now() + interval '89 days') = 2,
  'A no pudo guardar o leer su charla, o el plazo por omisión no es de 90 días'
);

-- Orden repetido en la misma charla: rechazado por la clave única.
do $$
begin
  begin
    insert into public.praxis_charla_turnos (charla_id, n, rol, texto) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 0, 'persona', 'turno repetido');
    raise exception 'FALLO: entró un turno repetido (mismo usuario, charla y n)';
  exception
    when unique_violation then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Aislamiento: B no ve nada de A. Y B guarda lo suyo con el mismo charla_id sin chocar.
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('e6000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos) = 0,
  'B ve turnos de charla que no son suyos'
);

insert into public.praxis_charla_turnos (charla_id, n, rol, texto) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 0, 'persona', 'texto inventado de la asesorada B');

select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos) = 1
  and (select count(*) from public.praxis_charla_turnos where texto like '%asesorada A%') = 0,
  'B no ve exactamente lo suyo, o ve lo de A'
);

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Nadie inserta a nombre de otra persona ni fija su propio borrado
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto) values
      ('e6000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 0, 'persona', 'a nombre de A');
    raise exception 'FALLO: B guardó un turno a nombre de A';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.praxis_charla_turnos (charla_id, n, rol, texto, borrar_en) values
      ('bbbbbbbb-0000-0000-0000-000000000001', 0, 'persona', 'con plazo eterno', now() + interval '10 years');
    raise exception 'FALLO: una persona fijó su propio borrar_en';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.praxis_charla_turnos (charla_id, n, rol, texto) values
      ('bbbbbbbb-0000-0000-0000-000000000001', 0, 'sistema', 'rol inventado');
    raise exception 'FALLO: entró un rol fuera de persona/praxis';
  exception
    when check_violation then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Nadie actualiza ni borra directo; texto vacío o largo se rechaza
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    update public.praxis_charla_turnos set texto = 'cambiado';
    raise exception 'FALLO: una sesión de usuario actualizó un turno';
  exception
    when insufficient_privilege then null;
  end;
  begin
    delete from public.praxis_charla_turnos;
    raise exception 'FALLO: una sesión de usuario borró un turno directo';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.praxis_charla_turnos (charla_id, n, rol, texto) values
      ('bbbbbbbb-0000-0000-0000-000000000001', 1, 'persona', '   ');
    raise exception 'FALLO: entró un texto vacío';
  exception
    when check_violation then null;
  end;
  begin
    insert into public.praxis_charla_turnos (charla_id, n, rol, texto) values
      ('bbbbbbbb-0000-0000-0000-000000000001', 2, 'persona', repeat('a', 2001));
    raise exception 'FALLO: entró un texto de más de 2000 caracteres';
  exception
    when check_violation then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · El equipo lee todo y no escribe a nombre de otra persona
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('d6000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos where usuario_id = 'e6000000-0000-0000-0000-000000000001') = 6
  and (select count(*) from public.praxis_charla_turnos where usuario_id = 'e6000000-0000-0000-0000-000000000002') = 1,
  'el coach no ve la charla completa de las dos personas'
);

do $$
begin
  begin
    insert into public.praxis_charla_turnos (usuario_id, charla_id, n, rol, texto) values
      ('e6000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 0, 'persona', 'coach a nombre de A');
    raise exception 'FALLO: el coach guardó un turno a nombre de una asesorada';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.praxis_charla_turnos set texto = 'editado por el coach';
    raise exception 'FALLO: el coach actualizó un turno';
  exception
    when insufficient_privilege then null;
  end;
  begin
    delete from public.praxis_charla_turnos;
    raise exception 'FALLO: el coach borró turnos directo';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
select pruebas.soy('d6000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos) = 7,
  'la nutricionista no lee la charla completa'
);

-- ════════════════════════════════════════════════════════════════════════
-- 6 · anon no tiene nada y no puede llamar a las funciones
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.praxis_charla_turnos', 'select')
  and not has_table_privilege('anon', 'public.praxis_charla_turnos', 'insert')
  and not has_table_privilege('authenticated', 'public.praxis_charla_turnos', 'update')
  and not has_table_privilege('authenticated', 'public.praxis_charla_turnos', 'delete')
  and not has_column_privilege('authenticated', 'public.praxis_charla_turnos', 'usuario_id', 'insert')
  and not has_column_privilege('authenticated', 'public.praxis_charla_turnos', 'borrar_en', 'insert')
  and not has_function_privilege('anon', 'public.praxis_borrar_mi_charla(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.praxis_purgar_charlas()', 'execute')
  and not has_function_privilege('authenticated', 'public.praxis_purgar_charlas()', 'execute')
  and has_function_privilege('authenticated', 'public.praxis_borrar_mi_charla(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.praxis_purgar_charlas()', 'execute'),
  'privilegios de más (o de menos) en la tabla o en sus funciones'
);

set role anon;
do $$
begin
  begin
    perform count(*) from public.praxis_charla_turnos;
    raise exception 'FALLO: anon leyó la tabla de charlas';
  exception
    when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 7 · Borrar mi charla: solo la mía, aunque otra persona use el mismo charla_id
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

-- Sin sesión (auth.uid() nulo) la función se niega.
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$
begin
  begin
    perform public.praxis_borrar_mi_charla('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FALLO: borrar-mi-charla funcionó sin sesión';
  exception
    when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 8 · La purga borra lo vencido y deja lo reciente
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  (select count(*) from public.praxis_charla_turnos where texto in ('turno viejo de prueba', 'respuesta vieja de prueba')) = 2,
  'las dos filas viejas no estaban antes de purgar (la prueba no probaría nada)'
);

-- Ni una persona ni el equipo pueden llamarla.
select pruebas.soy('d6000000-0000-0000-0000-000000000001');
set role authenticated;
do $$
begin
  begin
    perform public.praxis_purgar_charlas();
    raise exception 'FALLO: una sesión de usuario ejecutó la purga';
  exception
    when insufficient_privilege then null;
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
