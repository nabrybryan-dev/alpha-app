-- Praxis: el aviso al coach (0108).
--
-- POR QUÉ ESTA PRUEBA EXISTE. La tabla es nueva, la escribe el ASESORADO desde su sesión (la
-- Edge Function usa el JWT de la persona) y guarda una señal de riesgo de salud mental. El riesgo
-- es el de siempre (CLAUDE.md §4): una política que deje avisar a nombre de otro, que deje a la
-- persona leer o borrar lo que se dijo de ella, o que deje a cualquiera marcar atendido lo que
-- el coach no ha visto. Y uno propio: que la tabla acabe guardando la frase. Se comprueba contra
-- RLS de verdad:
--
--   1. La persona inserta el suyo; la hora la pone la base aunque ella intente mandar otra.
--   2. Nadie avisa a nombre de otra persona.
--   3. Solo caben los tipos y los orígenes de la lista: una frase en `nivel` no entra, y no hay
--      ninguna columna de texto libre donde meterla.
--   4. La persona no lee (ni los suyos), no atiende y no borra.
--   5. Otra asesorada y la nutricionista no ven nada.
--   6. «No se duplica»: el mismo aviso sin atender dentro de la hora no se repite.
--   7. El coach lee todos y marca atendido: solo uno pendiente, solo como él mismo, y no cambia
--      de quién es ni de qué tipo.
--   8. anon no tiene nada.
--
-- Bloque de UUID propio (ab…/bb…/cb…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('ab000000-0000-0000-0000-000000000001', 'aviso-asesorada-1@ejemplo.test'),
  ('ab000000-0000-0000-0000-000000000002', 'aviso-asesorada-2@ejemplo.test'),
  ('bb000000-0000-0000-0000-000000000001', 'aviso-coach@ejemplo.test'),
  ('cb000000-0000-0000-0000-000000000001', 'aviso-nutricionista@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('ab000000-0000-0000-0000-000000000001', 'Asesorada que avisa', 'asesorado', 'A1'),
  ('ab000000-0000-0000-0000-000000000002', 'Otra asesorada', 'asesorado', 'A2'),
  ('bb000000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CO'),
  ('cb000000-0000-0000-0000-000000000001', 'Nutricionista de prueba', 'nutricionista', 'NU')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- ════════════════════════════════════════════════════════════════════════
-- 0 · La tabla no tiene dónde guardar una frase
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'praxis_avisos_coach'
      and data_type in ('text', 'character varying', 'jsonb', 'json')) = 2,
  'la tabla de avisos tiene más columnas de texto que origen y nivel: ¿dónde se guardaría la frase?'
);

-- ════════════════════════════════════════════════════════════════════════
-- 1 · La persona inserta el suyo; la hora no la decide ella
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('ab000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

insert into public.praxis_avisos_coach (usuario_id, origen, nivel) values
  ('ab000000-0000-0000-0000-000000000001', 'praxis', 'vida');

-- No tiene privilegio sobre la hora ni sobre el atendido.
do $$
begin
  begin
    insert into public.praxis_avisos_coach (usuario_id, origen, nivel, creado_en) values
      ('ab000000-0000-0000-0000-000000000001', 'praxis', 'pareja', now() + interval '10 years');
    raise exception 'FALLO: una sesión de usuario pudo fijar la hora del aviso';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.praxis_avisos_coach (usuario_id, origen, nivel, atendido_en, atendido_por) values
      ('ab000000-0000-0000-0000-000000000001', 'praxis', 'pareja', now(), 'bb000000-0000-0000-0000-000000000001');
    raise exception 'FALLO: una sesión de usuario pudo insertar un aviso ya atendido';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Nadie avisa a nombre de otra persona
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.praxis_avisos_coach (usuario_id, origen, nivel) values
      ('ab000000-0000-0000-0000-000000000002', 'praxis', 'vida');
    raise exception 'FALLO: una asesorada dejó un aviso a nombre de otra';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Solo caben los tipos y los orígenes de la lista: una frase no entra
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.praxis_avisos_coach (usuario_id, origen, nivel) values
      ('ab000000-0000-0000-0000-000000000001', 'praxis', 'no puedo mas con todo');
    raise exception 'FALLO: entró una frase en el tipo de señal';
  exception
    when check_violation then null;
  end;
  begin
    insert into public.praxis_avisos_coach (usuario_id, origen, nivel) values
      ('ab000000-0000-0000-0000-000000000001', 'una frase como origen', 'vida');
    raise exception 'FALLO: entró un origen inventado';
  exception
    when check_violation then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · La persona no lee, no atiende y no borra
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach) = 0,
  'la persona lee los avisos que se hicieron sobre ella'
);

update public.praxis_avisos_coach
   set atendido_en = now(), atendido_por = 'ab000000-0000-0000-0000-000000000001';

do $$
begin
  begin
    delete from public.praxis_avisos_coach;
    raise exception 'FALLO: una sesión de usuario tiene privilegio para borrar avisos';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach
    where usuario_id = 'ab000000-0000-0000-0000-000000000001'
      and nivel = 'vida' and origen = 'praxis'
      and atendido_en is null and atendido_por is null
      and creado_en > now() - interval '1 minute' and creado_en <= now()) = 1,
  'el aviso no nació pendiente, con la hora de la base'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Otra asesorada y la nutricionista no ven nada
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('ab000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach) = 0,
  'otra asesorada ve avisos que no son suyos'
);
reset role;

select pruebas.soy('cb000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach) = 0,
  'la nutricionista ve los avisos de riesgo'
);
update public.praxis_avisos_coach
   set atendido_en = now(), atendido_por = 'cb000000-0000-0000-0000-000000000001';
reset role;

select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach where atendido_en is not null) = 0,
  'la nutricionista marcó un aviso como atendido'
);

-- ════════════════════════════════════════════════════════════════════════
-- 6 · No se duplica: el mismo aviso sin atender, dentro de la hora, no se repite
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('ab000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

insert into public.praxis_avisos_coach (usuario_id, origen, nivel) values
  ('ab000000-0000-0000-0000-000000000001', 'praxis', 'vida'),
  ('ab000000-0000-0000-0000-000000000001', 'praxis', 'vida');
-- Otro tipo y otro origen sí son avisos distintos.
insert into public.praxis_avisos_coach (usuario_id, origen, nivel) values
  ('ab000000-0000-0000-0000-000000000001', 'praxis', 'cuidado'),
  ('ab000000-0000-0000-0000-000000000001', 'ingreso', 'vida');

reset role;

select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach where usuario_id = 'ab000000-0000-0000-0000-000000000001') = 3,
  'no quedaron exactamente tres avisos: vida/praxis una sola vez, cuidado/praxis e ingreso/vida'
);

-- ════════════════════════════════════════════════════════════════════════
-- 7 · El coach lee todos y marca atendido
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('bb000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach) = 3,
  'el coach no ve todos los avisos'
);

-- No atiende a nombre de otro.
do $$
begin
  begin
    update public.praxis_avisos_coach
       set atendido_en = now(), atendido_por = 'cb000000-0000-0000-0000-000000000001'
     where nivel = 'cuidado';
    raise exception 'FALLO: el coach marcó un aviso como atendido por otra persona';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- No reescribe de quién es ni qué tipo es.
do $$
begin
  begin
    update public.praxis_avisos_coach set nivel = 'salud';
    raise exception 'FALLO: el coach tiene privilegio para cambiar el tipo de señal';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.praxis_avisos_coach set usuario_id = 'ab000000-0000-0000-0000-000000000002';
    raise exception 'FALLO: el coach tiene privilegio para cambiar de quién es el aviso';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- No lo reabre (atendido_en vacío) ni borra.
do $$
begin
  begin
    update public.praxis_avisos_coach set atendido_en = null, atendido_por = null;
    raise exception 'FALLO: se reabrió un aviso con la política de atender';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  begin
    delete from public.praxis_avisos_coach;
    raise exception 'FALLO: el coach tiene privilegio para borrar avisos';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- Como él mismo, sí; y solo el que se pidió.
update public.praxis_avisos_coach
   set atendido_en = now(), atendido_por = 'bb000000-0000-0000-0000-000000000001'
 where nivel = 'cuidado';

select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach
    where atendido_en is not null and atendido_por = 'bb000000-0000-0000-0000-000000000001') = 1
  and (select count(*) from public.praxis_avisos_coach where atendido_en is null) = 2,
  'el coach no pudo marcar atendido un aviso pendiente, o marcó más de uno'
);

-- Uno ya atendido no se reescribe: el segundo intento no toca ninguna fila.
update public.praxis_avisos_coach
   set atendido_en = now() + interval '1 day', atendido_por = 'bb000000-0000-0000-0000-000000000001'
 where nivel = 'cuidado';

reset role;

select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach
    where nivel = 'cuidado' and atendido_en <= now()) = 1,
  'se reescribió la hora de un aviso que ya estaba atendido'
);

-- Atendido el 'cuidado', un aviso nuevo del mismo tipo ya no se descarta: es una señal nueva.
select pruebas.soy('ab000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
insert into public.praxis_avisos_coach (usuario_id, origen, nivel) values
  ('ab000000-0000-0000-0000-000000000001', 'praxis', 'cuidado');
reset role;

select pruebas.afirmar(
  (select count(*) from public.praxis_avisos_coach
    where nivel = 'cuidado' and origen = 'praxis' and atendido_en is null) = 1,
  'tras atender un aviso, la señal nueva del mismo tipo no quedó pendiente'
);

-- ════════════════════════════════════════════════════════════════════════
-- 8 · anon no tiene nada
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.praxis_avisos_coach', 'select')
  and not has_table_privilege('anon', 'public.praxis_avisos_coach', 'insert')
  and not has_table_privilege('anon', 'public.praxis_avisos_coach', 'update')
  and not has_table_privilege('authenticated', 'public.praxis_avisos_coach', 'delete'),
  'anon tiene algún privilegio sobre los avisos de Praxis, o authenticated puede borrar'
);

rollback;
