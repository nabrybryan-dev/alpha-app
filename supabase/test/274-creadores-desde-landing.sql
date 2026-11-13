-- Creadores que llegan por el PRAXIS de la landing (migración 0178).
--
-- Lo que se prueba:
--   1. anon y authenticated NO ejecutan `creadores_landing_registrar` (solo la Edge Function,
--      con service_role). Sin el `revoke … from authenticated`, cualquier sesión metería filas.
--   2. DEDUP CONTRA EL RADAR: un @ que el importador ya tiene como `ig:` no crea una `land:`. El
--      contacto se guarda contra la `ig:`, que conserva su carril, sus métricas y su origen; el
--      evento lleva actor `landing` y carril_anterior = carril_nuevo = su carril vigente.
--   3. Un @ nuevo crea la `land:` en `encuesta`, origen `landing-praxis`, y el contacto NO va
--      en `metricas` sino en `creadores_contactos`, con su valor.
--   4. Sin `mayor_edad = true` no se guarda nada.
--   5. `creadores_contactos`: la lee el coach; un asesorado ve cero filas; anon no la consulta;
--      nadie escribe desde una sesión.
--   6. DECLINA / EXCLUSIÓN (Bryan, 11-nov): `p_declina = true` guarda solo el @, en `descartado`,
--      con `no_contactar = true` y SIN fila en `creadores_contactos` aunque llegue un contacto. Un
--      @ ya marcado `no_contactar` que vuelve a escribir por la landing NO reactiva nada: ni
--      contacto, ni carril, ni metricas — solo un evento de "contacto bloqueado por exclusión".
--
-- Bloque de UUID propio (c8…), datos ficticios. ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
insert into auth.users (id, email) values
  ('c8000000-0000-4000-8000-000000000001', 'cl-asesorado@ejemplo.test'),
  ('c8000000-0000-4000-8000-000000000002', 'cl-coach@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('c8000000-0000-4000-8000-000000000001', 'Asesorado de prueba', 'asesorado', 'AP'),
  ('c8000000-0000-4000-8000-000000000002', 'Coach de prueba', 'coach', 'CP')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- El importador ya tiene a esta persona (service_role, como `subir_creadores.py`).
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.creadores_candidatos (creador_id, usuario_ig, carril, motivos, metricas, fecha_dato)
values ('ig:910000001', 'radar.prueba', 'tambaleando', '["C 1,8"]', '{"seguidores": 800}', '2026-01-01');
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Nadie con sesión ejecuta la función
-- ════════════════════════════════════════════════════════════════════════
set role anon;
do $$
begin
  begin
    perform public.creadores_landing_registrar('intruso.prueba', null, null, null, null, 'correo', 'a@ejemplo.test', true);
    raise exception 'FALLO: anon ejecutó creadores_landing_registrar';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.soy('c8000000-0000-4000-8000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
do $$
begin
  begin
    perform public.creadores_landing_registrar('intruso.prueba', null, null, null, null, 'correo', 'a@ejemplo.test', true);
    raise exception 'FALLO: un asesorado con sesión ejecutó creadores_landing_registrar';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2-4 · Como la Edge Function (service_role)
-- ════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
do $$
declare
  r jsonb;
  c record;
  e record;
begin
  -- 2 · El @ del radar: no se duplica.
  r := public.creadores_landing_registrar('radar.prueba', 'fitness', 'Ciudad', '10k_50k', true, 'correo', 'radar@ejemplo.test', true);
  perform pruebas.afirmar(r ->> 'creador_id' = 'ig:910000001' and (r ->> 'es_nuevo')::boolean = false,
    'un @ que el radar ya tiene no devolvió su fila ig: con es_nuevo = false: ' || r::text);
  perform pruebas.afirmar(not exists (select 1 from public.creadores_candidatos where creador_id = 'land:radar.prueba'),
    'un @ que el radar ya tiene entró DUPLICADO como land:');
  select * into c from public.creadores_candidatos where creador_id = 'ig:910000001';
  perform pruebas.afirmar(c.carril = 'tambaleando' and c.origen = 'importador' and c.metricas = '{"seguidores": 800}'::jsonb
    and c.fecha_dato = '2026-01-01'::timestamptz,
    'el contacto desde la landing pisó carril, origen, métricas o fecha_dato de la fila del importador');
  perform pruebas.afirmar(c.motivos = '["C 1,8", "dejó contacto en la landing"]'::jsonb,
    'la fila del radar no anota que dejó contacto: ' || c.motivos::text);
  perform pruebas.afirmar((select count(*) from public.creadores_contactos
                            where creador_id = 'ig:910000001' and tipo = 'correo' and valor = 'radar@ejemplo.test') = 1,
    'el contacto no quedó guardado contra la fila ig:');
  select * into e from public.creadores_eventos where creador_id = 'ig:910000001' and actor = 'landing';
  perform pruebas.afirmar(e.carril_anterior = 'tambaleando' and e.carril_nuevo = 'tambaleando',
    'el evento de la landing contó un movimiento de carril que no hubo');

  -- 3 · Un @ nuevo.
  r := public.creadores_landing_registrar('nueva.prueba', 'fitness', null, 'menos_10k', false, 'whatsapp', '+570000000', true);
  perform pruebas.afirmar(r ->> 'creador_id' = 'land:nueva.prueba' and (r ->> 'es_nuevo')::boolean,
    'un @ nuevo no creó su fila land:: ' || r::text);
  select * into c from public.creadores_candidatos where creador_id = 'land:nueva.prueba';
  perform pruebas.afirmar(c.carril = 'encuesta' and c.segmento = 'aliado' and c.origen = 'landing-praxis',
    'la fila land: no nació en encuesta / aliado / landing-praxis');
  perform pruebas.afirmar(not (c.metricas ? 'contacto') and not (c.metricas ? 'contacto_tipo'),
    'el contacto se guardó en metricas (la 0090 las quiere sin datos personales)');
  perform pruebas.afirmar((select count(*) from public.creadores_contactos
                            where creador_id = 'land:nueva.prueba' and tipo = 'whatsapp' and valor = '+570000000') = 1,
    'el contacto del @ nuevo no está en creadores_contactos');

  -- 4 · Sin mayor_edad no se guarda nada.
  begin
    perform public.creadores_landing_registrar('menor.prueba', null, null, null, null, 'whatsapp', '+570000001', false);
    raise exception 'FALLO: se aceptó un registro sin mayor_edad';
  exception when sqlstate '22023' then null;
  end;
  perform pruebas.afirmar(not exists (select 1 from public.creadores_candidatos where usuario_ig = 'menor.prueba')
    and not exists (select 1 from public.creadores_contactos where valor = '+570000001'),
    'quedó una fila de quien no confirmó ser mayor de edad');
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Quién lee creadores_contactos
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('c8000000-0000-4000-8000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.creadores_contactos) = 2, 'el coach no ve los contactos de creadores');
do $$
begin
  begin
    insert into public.creadores_contactos (creador_id, tipo, valor) values ('ig:910000001', 'correo', 'x@ejemplo.test');
    raise exception 'FALLO: el coach insertó un contacto desde la sesión';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.creadores_contactos;
    raise exception 'FALLO: el coach borró contactos desde la sesión';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.soy('c8000000-0000-4000-8000-000000000001');
set role authenticated;
select pruebas.afirmar((select count(*) from public.creadores_contactos) = 0, 'un asesorado ve contactos de creadores');
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$
begin
  begin
    perform 1 from public.creadores_contactos limit 1;
    raise exception 'FALLO: anon pudo consultar creadores_contactos';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · Declina / exclusión (service_role, como la Edge Function)
-- ════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
do $$
declare
  r jsonb;
  c record;
begin
  -- 6a · Un @ nuevo que declina: se guarda lo mínimo, carril descartado, no_contactar true.
  r := public.creadores_landing_registrar('declina.prueba', 'fitness', 'Ciudad', '10k_50k', true,
                                           'whatsapp', '+570000099', true, true);
  perform pruebas.afirmar(r ->> 'creador_id' = 'land:declina.prueba' and (r ->> 'no_contactar')::boolean,
    'declina no devolvió no_contactar = true: ' || r::text);
  select * into c from public.creadores_candidatos where creador_id = 'land:declina.prueba';
  perform pruebas.afirmar(c.carril = 'descartado' and c.no_contactar and c.metricas = '{}'::jsonb,
    'un declina nuevo no quedó en descartado / no_contactar / metricas vacía: ' || c::text);
  perform pruebas.afirmar((select count(*) from public.creadores_contactos where creador_id = 'land:declina.prueba') = 0,
    'un declina guardó un contacto (debía ser "lo mínimo", sin contacto)');

  -- 6b · El mismo @ vuelve a escribir por la landing (sin declinar esta vez): no se reactiva.
  -- NOTA sobre el evento: `now()` es fijo para TODA la transacción en Postgres (no avanza entre
  -- sentencias ni con pg_sleep), y este archivo entero corre en una sola transacción para poder
  -- hacer ROLLBACK al final. Por eso el event_id (que usa `extract(epoch from now())`) de 6a y
  -- 6b coincide aquí y el "on conflict do nothing" se come el segundo evento — es el MISMO
  -- mecanismo, documentado arriba, que absorbe un doble envío real del mismo @ en el mismo
  -- segundo; un test en transacciones separadas sí vería las dos filas. Lo que de verdad importa
  -- — que no se reactive nada — se comprueba directo sobre el estado, no sobre el evento.
  r := public.creadores_landing_registrar('declina.prueba', 'otro nicho', 'Otra ciudad', '50k_200k', true,
                                           'correo', 'reintento@ejemplo.test', true, false);
  perform pruebas.afirmar((r ->> 'no_contactar')::boolean,
    'un @ ya excluido no devolvió no_contactar = true en el segundo intento: ' || r::text);
  select * into c from public.creadores_candidatos where creador_id = 'land:declina.prueba';
  perform pruebas.afirmar(c.carril = 'descartado' and c.no_contactar and c.metricas = '{}'::jsonb,
    'un @ excluido cambió de carril o metricas con un contacto nuevo: ' || c::text);
  perform pruebas.afirmar((select count(*) from public.creadores_contactos where creador_id = 'land:declina.prueba') = 0,
    'un @ excluido terminó con un contacto guardado pese a la exclusión');
end $$;
reset role;

rollback;
