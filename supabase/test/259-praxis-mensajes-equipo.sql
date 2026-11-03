-- Praxis: los mensajes del equipo (0159).
--
-- POR QUÉ ESTA PRUEBA EXISTE. La tabla guarda la frase completa que una persona del equipo le escribe a Praxis, para
-- etiquetar su intención. El riesgo es el de siempre (CLAUDE.md §4): que alguien guarde a nombre de otra persona, que un
-- asesorado escriba o lea, o que alguien fabrique las etiquetas desde fuera. Se comprueba contra RLS de verdad:
--
--   1. El coach inserta el suyo (solo usuario_id, frase e intención) y lo lee.
--   2. Nadie inserta a nombre de otra persona.
--   3. Nadie fabrica etiquetas: clase_propuesta, clase_confirmada y confirmada_en no tienen privilegio de insert.
--   4. Una asesorada no puede insertar ni ve nada.
--   5. Nadie actualiza ni borra con sesión; la frase vacía o de más de 600 caracteres se rechaza.
--   6. anon no tiene nada.
--
-- Bloque de UUID propio (d9…/e9…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('e9000000-0000-0000-0000-000000000001', 'mensajes-asesorada@ejemplo.test'),
  ('d9000000-0000-0000-0000-000000000001', 'mensajes-coach@ejemplo.test'),
  ('d9000000-0000-0000-0000-000000000002', 'mensajes-nutricionista@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('e9000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AS'),
  ('d9000000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CO'),
  ('d9000000-0000-0000-0000-000000000002', 'Nutricionista de prueba', 'nutricionista', 'NU')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · El coach inserta el suyo y lo lee
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('d9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

insert into public.praxis_mensajes_equipo (usuario_id, frase, intencion_registrador) values
  ('d9000000-0000-0000-0000-000000000001', 'cuanto descanso entre series de sentadilla', array['consulta']);

select pruebas.afirmar(
  (select count(*) from public.praxis_mensajes_equipo
    where usuario_id = 'd9000000-0000-0000-0000-000000000001' and clase_propuesta is null and clase_confirmada is null) = 1,
  'el coach no pudo guardar ni leer su mensaje, o nació con etiquetas'
);

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Nadie inserta a nombre de otra persona
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.praxis_mensajes_equipo (usuario_id, frase) values
      ('d9000000-0000-0000-0000-000000000002', 'a nombre de la nutricionista');
    raise exception 'FALLO: el coach guardó un mensaje a nombre de otra persona';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Nadie fabrica etiquetas desde fuera
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.praxis_mensajes_equipo (usuario_id, frase, clase_confirmada) values
      ('d9000000-0000-0000-0000-000000000001', 'ya viene etiquetada', 3);
    raise exception 'FALLO: una sesión de usuario insertó un mensaje con la clase ya confirmada';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.praxis_mensajes_equipo (usuario_id, frase, clase_propuesta) values
      ('d9000000-0000-0000-0000-000000000001', 'ya viene propuesta', 3);
    raise exception 'FALLO: una sesión de usuario insertó un mensaje con clase propuesta';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Nadie actualiza ni borra; la frase vacía o larga se rechaza
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    update public.praxis_mensajes_equipo set frase = 'cambiada' where usuario_id = 'd9000000-0000-0000-0000-000000000001';
    raise exception 'FALLO: una sesión de usuario actualizó un mensaje';
  exception
    when insufficient_privilege then null;
  end;
  begin
    delete from public.praxis_mensajes_equipo where usuario_id = 'd9000000-0000-0000-0000-000000000001';
    raise exception 'FALLO: una sesión de usuario borró un mensaje';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.praxis_mensajes_equipo (usuario_id, frase) values ('d9000000-0000-0000-0000-000000000001', '   ');
    raise exception 'FALLO: entró una frase vacía';
  exception
    when check_violation then null;
  end;
  begin
    insert into public.praxis_mensajes_equipo (usuario_id, frase) values ('d9000000-0000-0000-0000-000000000001', repeat('a', 601));
    raise exception 'FALLO: entró una frase de más de 600 caracteres';
  exception
    when check_violation then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · Una asesorada no inserta ni ve nada
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('e9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    insert into public.praxis_mensajes_equipo (usuario_id, frase) values
      ('e9000000-0000-0000-0000-000000000001', 'una asesorada intenta guardar');
    raise exception 'FALLO: una asesorada guardó un mensaje';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.praxis_mensajes_equipo) = 0,
  'una asesorada ve mensajes del equipo'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · anon no tiene nada
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.praxis_mensajes_equipo', 'select')
  and not has_table_privilege('anon', 'public.praxis_mensajes_equipo', 'insert')
  and not has_table_privilege('authenticated', 'public.praxis_mensajes_equipo', 'update')
  and not has_table_privilege('authenticated', 'public.praxis_mensajes_equipo', 'delete'),
  'anon o authenticated tienen privilegios de más sobre los mensajes del equipo'
);

rollback;
