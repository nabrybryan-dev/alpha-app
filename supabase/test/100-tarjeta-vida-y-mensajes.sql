-- Estilo de vida: la tarjeta semanal y la bandeja de mensajes (0088).
--
-- POR QUÉ ESTA PRUEBA EXISTE. Las dos tablas son nuevas, así que no hay un incidente
-- histórico que reproducir. El riesgo es el que ya documenta CLAUDE.md §4 —RLS
-- tautológica o política olvidada— aplicado a dos superficies con reglas de acceso
-- opuestas: una donde el ASESORADO escribe (`tarjetas_vida`) y otra donde NADIE con
-- sesión de usuario escribe (`mensajes_vida`, solo `service_role`). Se comprueba contra
-- RLS de verdad, no contra el código del cliente:
--
--   1. tarjetas_vida: el dueño inserta y lee la suya; nadie inserta a nombre de otro;
--      dos tarjetas de la misma persona y semana chocan (unique); sin política de
--      update, una tarjeta ya respondida no se puede pisar desde el navegador; quien
--      tiene `leer_entrenamiento` lee todas, quien no, ninguna ajena.
--   2. mensajes_vida: nadie con sesión de usuario inserta (ni el dueño, ni quien tiene
--      leer_entrenamiento); el dueño solo lee lo que ya toca enviarse y no está
--      detenido; un mensaje futuro o detenido no aparece aunque sea suyo; un mensaje
--      ajeno no aparece aunque ya toque y no esté detenido.
--
-- Bloque de UUID propio (98/99-…) para no chocar con la semilla de otros archivos.
-- Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla mínima ───────────────────
-- 98..1 = asesorada dueña de su tarjeta y sus mensajes.
-- 98..2 = otra asesorada, para probar aislamiento (nunca ve lo de la primera).
-- 99..1 = staff CON leer_entrenamiento (equivalente de Manuela).
-- 99..2 = staff SIN ninguna capacidad (control negativo).
insert into auth.users (id, email) values
  ('98888888-0000-0000-0000-000000000001', 'vida-asesorada-1@ejemplo.test'),
  ('98888888-0000-0000-0000-000000000002', 'vida-asesorada-2@ejemplo.test'),
  ('99999999-0000-0000-0000-000000000001', 'vida-staff-con-capacidad@ejemplo.test'),
  ('99999999-0000-0000-0000-000000000002', 'vida-staff-sin-capacidad@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('98888888-0000-0000-0000-000000000001', 'Asesorada de la tarjeta', 'asesorado', 'A1'),
  ('98888888-0000-0000-0000-000000000002', 'Otra asesorada', 'asesorado', 'A2'),
  ('99999999-0000-0000-0000-000000000001', 'Staff con capacidad', 'nutricionista', 'SC'),
  ('99999999-0000-0000-0000-000000000002', 'Staff sin capacidad', 'nutricionista', 'SS')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('99999999-0000-0000-0000-000000000001', 'leer_entrenamiento')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · tarjetas_vida — el dueño inserta y lee la suya
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('98888888-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

insert into public.tarjetas_vida (usuario_id, semana_inicio, respuestas) values
  ('98888888-0000-0000-0000-000000000001', '2026-09-21',
   '{"V1": 1, "V2": 4, "V6": 5, "V7": 4}'::jsonb);

select pruebas.afirmar(
  (select count(*) from public.tarjetas_vida
    where usuario_id = '98888888-0000-0000-0000-000000000001' and semana_inicio = '2026-09-21') = 1,
  'la asesorada no pudo leer la tarjeta que acaba de insertar'
);

-- Nadie inserta a nombre de otra persona: RLS deniega por el `with check`, no por un
-- error de aplicación que dependa de que el cliente se porte bien.
do $$
begin
  begin
    insert into public.tarjetas_vida (usuario_id, semana_inicio, respuestas) values
      ('98888888-0000-0000-0000-000000000002', '2026-09-21', '{"V1": 1}'::jsonb);
    raise exception 'FALLO: una asesorada insertó la tarjeta de otra';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.tarjetas_vida
    where usuario_id = '98888888-0000-0000-0000-000000000002') = 0,
  'quedó insertada una tarjeta a nombre de otra persona'
);

-- Dos tarjetas de la misma persona y semana chocan: es un conflicto de aplicación, no
-- dos hechos distintos (la migración lo declara `unique (usuario_id, semana_inicio)`).
do $$
begin
  begin
    insert into public.tarjetas_vida (usuario_id, semana_inicio, respuestas) values
      ('98888888-0000-0000-0000-000000000001', '2026-09-21', '{"V1": 2}'::jsonb);
    raise exception 'FALLO: se aceptó una segunda tarjeta de la misma persona y semana';
  exception
    when unique_violation then null;
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- Sin política de update: una tarjeta ya respondida no se pisa desde el navegador. La
-- sentencia no falla — RLS sin política de UPDATE simplemente no encuentra filas que
-- tocar— así que lo que se comprueba es que el CONTENIDO no cambió.
update public.tarjetas_vida set respuestas = '{"V1": 99}'::jsonb
  where usuario_id = '98888888-0000-0000-0000-000000000001' and semana_inicio = '2026-09-21';

select pruebas.afirmar(
  (select respuestas from public.tarjetas_vida
    where usuario_id = '98888888-0000-0000-0000-000000000001' and semana_inicio = '2026-09-21')
    = '{"V1": 1, "V2": 4, "V6": 5, "V7": 4}'::jsonb,
  'la tarjeta se pudo actualizar desde una sesión de usuario: no debería haber política de UPDATE'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · tarjetas_vida — aislamiento y lectura por capacidad
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('98888888-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.tarjetas_vida
    where usuario_id = '98888888-0000-0000-0000-000000000001') = 0,
  'otra asesorada ve la tarjeta que no es suya'
);

reset role;

select pruebas.soy('99999999-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.tarjetas_vida
    where usuario_id = '98888888-0000-0000-0000-000000000001') = 0,
  'staff SIN leer_entrenamiento ve una tarjeta ajena'
);

reset role;

select pruebas.soy('99999999-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

-- Control positivo: si esto fallara, el bloque negativo de arriba no probaría que la
-- política filtra — probaría que no hay datos.
select pruebas.afirmar(
  (select count(*) from public.tarjetas_vida
    where usuario_id = '98888888-0000-0000-0000-000000000001') = 1,
  'staff CON leer_entrenamiento no ve la tarjeta (falso negativo: revisa la semilla)'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · mensajes_vida — solo service_role escribe
-- ════════════════════════════════════════════════════════════════════════
-- Se insertan como dueño de la tabla (mismo nivel que service_role, que bypassa RLS):
-- es el único que escribe esta proyección.

insert into public.mensajes_vida (usuario_id, texto, tipo, enviar_despues_de, detenido_en) values
  -- Ya toca enviarse y no está detenido: el único que la asesorada 1 debería poder leer.
  ('98888888-0000-0000-0000-000000000001', 'Esta semana prueba salir 10 min antes de las 10am.',
   'prescripcion_vida', now() - interval '1 hour', null),
  -- Todavía no toca: enviar_despues_de en el futuro.
  ('98888888-0000-0000-0000-000000000001', 'Mensaje que aún no toca enviarse.',
   'prescripcion_vida', now() + interval '1 hour', null),
  -- Ya tocaba, pero Bryan lo detuvo: no debe verse aunque el tiempo ya pasó.
  ('98888888-0000-0000-0000-000000000001', 'Mensaje detenido por Bryan.',
   'prescripcion_vida', now() - interval '1 hour', now()),
  -- La línea de ayuda: mismo asesorado, otro tipo, también vigente.
  ('98888888-0000-0000-0000-000000000001', 'Si necesitas hablar con alguien, Línea 106.',
   'ayuda_animo', now() - interval '1 minute', null),
  -- De otra persona: nunca debe verlo la asesorada 1.
  ('98888888-0000-0000-0000-000000000002', 'Mensaje de la otra asesorada.',
   'prescripcion_vida', now() - interval '1 hour', null);

-- Nadie con sesión de usuario inserta — ni siquiera el propio dueño, ni el staff con
-- leer_entrenamiento (esa capacidad es de LECTURA de entrenamiento, no de escribir la
-- cola de mensajes).
select pruebas.soy('98888888-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    insert into public.mensajes_vida (usuario_id, texto, tipo, enviar_despues_de) values
      ('98888888-0000-0000-0000-000000000001', 'intento de la propia asesorada',
       'prescripcion_vida', now());
    raise exception 'FALLO: la asesorada insertó su propio mensaje de vida';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- La asesorada 1 lee exactamente los dos que ya tocan y no están detenidos: ni el
-- futuro, ni el detenido, ni el de la otra persona.
select pruebas.afirmar(
  (select count(*) from public.mensajes_vida
    where usuario_id = '98888888-0000-0000-0000-000000000001') = 2,
  'la asesorada no ve exactamente sus dos mensajes vigentes'
);
select pruebas.afirmar(
  (select count(*) from public.mensajes_vida where texto = 'Mensaje que aún no toca enviarse.') = 0,
  'un mensaje futuro (enviar_despues_de en el futuro) se pudo leer antes de tiempo'
);
select pruebas.afirmar(
  (select count(*) from public.mensajes_vida where texto = 'Mensaje detenido por Bryan.') = 0,
  'un mensaje detenido se pudo leer'
);
select pruebas.afirmar(
  (select count(*) from public.mensajes_vida where texto = 'Mensaje de la otra asesorada.') = 0,
  'una asesorada leyó el mensaje de otra persona'
);

reset role;

select pruebas.soy('99999999-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    insert into public.mensajes_vida (usuario_id, texto, tipo, enviar_despues_de) values
      ('98888888-0000-0000-0000-000000000001', 'intento del staff con capacidad',
       'prescripcion_vida', now());
    raise exception 'FALLO: el staff con leer_entrenamiento insertó un mensaje de vida';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- Y tampoco lee los mensajes ajenos: `leer_entrenamiento` no está en la política de
-- `mensajes_vida` — es una bandeja personal, no una proyección de la consola.
select pruebas.afirmar(
  (select count(*) from public.mensajes_vida
    where usuario_id = '98888888-0000-0000-0000-000000000001') = 0,
  'el staff con leer_entrenamiento leyó mensajes de vida ajenos'
);

reset role;

rollback;

\echo 'OK · tarjeta semanal y mensajes de estilo de vida (0088)'
