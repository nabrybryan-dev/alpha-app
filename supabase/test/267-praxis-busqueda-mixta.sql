-- Praxis: búsqueda mixta, palabras + sentido con fusión por rango recíproco (0172).
--
-- POR QUÉ ESTA PRUEBA EXISTE. La función nueva junta dos listas. Riesgos: que un borrador salga, que un asesorado
-- encuentre piezas, que una sola de las dos listas tape a la otra, y que un vector nulo o una frase vacía rompan
-- la búsqueda. Se comprueba contra RLS de verdad:
--
--   1. Un borrador no sale, ni por palabras ni por sentido.
--   2. Palabras sin sentido (vector nulo): encuentra por palabras. Sentido sin palabras (frase vacía): por sentido.
--   3. Si las dos listas ponen alta una pieza, gana a la que solo una lista pone alta.
--   4. El tope se respeta; un k nulo o cero no rompe; frase y vector nulos no traen nada.
--   5. Un asesorado no encuentra nada. anon no tiene la función.
--
-- Bloque de UUID propio (a7…/b7…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('a7000000-0000-0000-0000-000000000001', 'mixta-asesorada@ejemplo.test'),
  ('b7000000-0000-0000-0000-000000000001', 'mixta-coach@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('a7000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AP'),
  ('b7000000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CO')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.praxis_conceptos (id, tema, pregunta, contexto, respuesta, solidez, confianza, estado) values
  ('p-descanso', 'descansos', '¿Cuánto descansar entre series?', 'Descansos largos y cortos.', 'Depende del objetivo y del ejercicio.', 'mixta', 'media', 'aprobada'),
  ('p-rir', 'intensidad-rir-rpe', '¿Qué tan fiable es mi RIR?', 'Precisión al estimar repeticiones en reserva.', 'Mejora con la práctica.', 'estudios', 'alta', 'aprobada'),
  ('p-series', 'series-por-semana', '¿Cuántas series por semana hago?', 'Volumen por grupo muscular.', 'Es un marco, no tu número.', 'mixta', 'media', 'aprobada'),
  ('p-borrador', 'descansos', '¿Cuánto descansar en las superseries secretas?', 'Borrador sin revisar.', 'No debe salir.', 'convencion', 'baja', 'borrador');

-- Un vector por pieza (base canónica): descanso = eje 1, rir = eje 2, series = eje 3, borrador = eje 4.
update public.praxis_conceptos set modelo_vector = 'prueba', vector = (
  select ('[' || string_agg(case when g = (case praxis_conceptos.id when 'p-descanso' then 1 when 'p-rir' then 2 when 'p-series' then 3 else 4 end) then '1' else '0' end, ',') || ']')::extensions.vector
  from generate_series(1, 768) g
);

select pruebas.soy('b7000000-0000-0000-0000-000000000001');
set local role authenticated;
select pruebas.exigir_rls();

-- 1 · borrador
select pruebas.afirmar(
  not exists (select 1 from public.buscar_conceptos_mixta('cuanto descansar en las superseries secretas', ('[0,0,0,1' || repeat(',0', 764) || ']')::extensions.vector, 20) where id = 'p-borrador'),
  'un borrador salió en la búsqueda mixta'
);

-- 2 · cada lista sola
select pruebas.afirmar(
  (select id from public.buscar_conceptos_mixta('que tan fiable es mi riir', null, 1)) = 'p-rir',
  'sin vector no encontró por palabras la pieza del RIR'
);
select pruebas.afirmar(
  (select id from public.buscar_conceptos_mixta('', ('[0,1' || repeat(',0', 766) || ']')::extensions.vector, 1)) = 'p-rir',
  'sin frase no encontró por sentido la pieza del RIR'
);

-- 3 · acuerdo de las dos listas: palabras señalan descanso; el vector señala descanso y series a medias
select pruebas.afirmar(
  (select id from public.buscar_conceptos_mixta('cuanto descansar entre series', ('[0.7,0,0.7' || repeat(',0', 765) || ']')::extensions.vector, 1)) = 'p-descanso',
  'la pieza que palabras y sentido ponen alto no ganó a la que solo una lista pone'
);
select pruebas.afirmar(
  (select lugar_palabras from public.buscar_conceptos_mixta('cuanto descansar entre series', ('[1' || repeat(',0', 767) || ']')::extensions.vector, 1)) = 1
  and (select lugar_sentido from public.buscar_conceptos_mixta('cuanto descansar entre series', ('[1' || repeat(',0', 767) || ']')::extensions.vector, 1)) = 1,
  'no informó el lugar en cada lista'
);

-- 4 · tope, k, nulos
select pruebas.afirmar(
  (select count(*) from public.buscar_conceptos_mixta('series descansar fiable', ('[1' || repeat(',0', 767) || ']')::extensions.vector, 1)) = 1
  and (select count(*) from public.buscar_conceptos_mixta('series descansar fiable', ('[1' || repeat(',0', 767) || ']')::extensions.vector, -3)) = 1
  and (select count(*) from public.buscar_conceptos_mixta('series descansar fiable', ('[1' || repeat(',0', 767) || ']')::extensions.vector, 99)) <= 20,
  'el tope no se respeta'
);
select pruebas.afirmar(
  exists (select 1 from public.buscar_conceptos_mixta('cuanto descansar entre series', null, 5, 0))
  and exists (select 1 from public.buscar_conceptos_mixta('cuanto descansar entre series', null, 5, null)),
  'un k nulo o cero rompió la búsqueda'
);
select pruebas.afirmar(not exists (select 1 from public.buscar_conceptos_mixta(null, null, 5)), 'frase y vector nulos trajeron piezas');

-- 5 · asesorado y anon
reset role;
select pruebas.soy('a7000000-0000-0000-0000-000000000001');
set local role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  not exists (select 1 from public.buscar_conceptos_mixta('cuanto descansar entre series', ('[1' || repeat(',0', 767) || ']')::extensions.vector, 5)),
  'un asesorado encuentra piezas por la búsqueda mixta'
);
reset role;
select pruebas.afirmar(
  not has_function_privilege('anon', 'public.buscar_conceptos_mixta(text, extensions.vector, integer, integer)', 'execute')
  and not has_function_privilege('public', 'public.buscar_conceptos_mixta(text, extensions.vector, integer, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.buscar_conceptos_mixta(text, extensions.vector, integer, integer)', 'execute'),
  'anon o público alcanzan la búsqueda mixta, o el equipo no'
);

rollback;
