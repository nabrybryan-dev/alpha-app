-- Praxis: la biblioteca de conceptos y su búsqueda (0155).
--
-- POR QUÉ ESTA PRUEBA EXISTE. Las piezas traen citas con rutas internas y son la base de lo que Praxis
-- contesta. Dos riesgos: que un asesorado las lea o busque antes de abrir Praxis, y que Praxis conteste con una
-- pieza que nadie aprobó. Y uno de utilidad: que una pregunta hablada, sin tildes o con palabras de más, no
-- encuentre nada porque la búsqueda exigía todas las palabras. Se comprueba contra RLS de verdad:
--
--   1. Un borrador no se encuentra, aunque coincida palabra por palabra.
--   2. Lo aprobado se encuentra sin tildes, con palabras que sobran y con un error de letras.
--   3. Una pregunta de otro tema no trae nada, y una frase vacía tampoco.
--   4. El tope se respeta y no se puede pedir de más.
--   5. El equipo lee y busca, pero no escribe ni aprueba.
--   6. Un asesorado no lee ni encuentra nada.
--   7. anon no tiene nada.
--
-- Bloque de UUID propio (a5…/b5…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('a5000000-0000-0000-0000-000000000001', 'conceptos-asesorada@ejemplo.test'),
  ('b5000000-0000-0000-0000-000000000001', 'conceptos-coach@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('a5000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AP'),
  ('b5000000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CO')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.praxis_conceptos (id, tema, pregunta, contexto, respuesta, solidez, confianza, estado) values
  ('p-descanso', 'descansos', '¿Cuánto descansar entre series?', 'Descansos largos y cortos.', 'Depende del objetivo y del ejercicio.', 'mixta', 'media', 'aprobada'),
  ('p-rir', 'intensidad-rir-rpe', '¿Qué tan fiable es mi RIR?', 'Precisión al estimar repeticiones en reserva.', 'Mejora con la práctica.', 'estudios', 'alta', 'aprobada'),
  ('p-series', 'series-por-semana', '¿Cuántas series por semana hago?', 'Volumen por grupo muscular.', 'Es un marco, no tu número.', 'mixta', 'media', 'aprobada'),
  ('p-borrador', 'descansos', '¿Cuánto descansar en las superseries secretas?', 'Borrador sin revisar.', 'No debe salir.', 'convencion', 'baja', 'borrador');

-- ════════════════════════════════════════════════════════════════════════
-- 1 a 4 · Lo que encuentra el equipo
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b5000000-0000-0000-0000-000000000001');
set local role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  not exists (select 1 from public.buscar_conceptos('cuanto descansar en las superseries secretas', 20) where id = 'p-borrador'),
  'un borrador salió en la búsqueda'
);
select pruebas.afirmar(
  (select id from public.buscar_conceptos('cuanto descansar entre series') limit 1) = 'p-descanso',
  'sin tildes no encontró la pieza de descansos primero'
);
select pruebas.afirmar(
  (select id from public.buscar_conceptos('oye y entonces por qué tengo que descansar tanto entre las series de hoy') limit 1) = 'p-descanso',
  'con palabras de más no encontró la pieza de descansos primero'
);
select pruebas.afirmar(
  exists (select 1 from public.buscar_conceptos('que tan fiable es mi riir') where id = 'p-rir'),
  'con un error de letras no encontró la pieza del RIR'
);
select pruebas.afirmar(
  not exists (select 1 from public.buscar_conceptos('receta de arepas con queso')),
  'una pregunta de otro tema trajo piezas'
);
select pruebas.afirmar(not exists (select 1 from public.buscar_conceptos('')), 'una frase vacía trajo piezas');
select pruebas.afirmar(not exists (select 1 from public.buscar_conceptos(null)), 'una frase nula trajo piezas');
select pruebas.afirmar(
  (select count(*) from public.buscar_conceptos('series descansar fiable', 1)) = 1
  and (select count(*) from public.buscar_conceptos('series descansar fiable', -3)) = 1,
  'el tope no se respeta'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5 · El equipo lee, pero no escribe ni aprueba
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar((select count(*) from public.praxis_conceptos) = 4, 'el equipo no lee la tabla');
select pruebas.afirmar(
  not has_table_privilege('authenticated', 'public.praxis_conceptos', 'insert')
  and not has_table_privilege('authenticated', 'public.praxis_conceptos', 'update')
  and not has_table_privilege('authenticated', 'public.praxis_conceptos', 'delete'),
  'una sesión puede escribir o aprobar piezas'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5b · Por sentido (0156): solo lo aprobado, con su vector, y el más parecido primero
-- ════════════════════════════════════════════════════════════════════════
reset role;
update public.praxis_conceptos set modelo_vector = 'prueba', vector = (
  select ('[' || string_agg(case when g = (case praxis_conceptos.id when 'p-descanso' then 1 when 'p-rir' then 2 when 'p-series' then 3 else 4 end) then '1' else '0' end, ',') || ']')::extensions.vector
  from generate_series(1, 768) g
);
select pruebas.soy('b5000000-0000-0000-0000-000000000001');
set local role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select id from public.buscar_conceptos_vector((select ('[1' || repeat(',0', 767) || ']')::extensions.vector), 1)) = 'p-descanso',
  'por sentido no salió primero la pieza más parecida'
);
select pruebas.afirmar(
  not exists (select 1 from public.buscar_conceptos_vector((select ('[0,0,0,1' || repeat(',0', 764) || ']')::extensions.vector), 20) where id = 'p-borrador'),
  'un borrador salió por sentido'
);
select pruebas.afirmar(not exists (select 1 from public.buscar_conceptos_vector(null, 5)), 'un vector nulo trajo piezas');

-- ════════════════════════════════════════════════════════════════════════
-- 6 · Un asesorado no ve nada
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('a5000000-0000-0000-0000-000000000001');
set local role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar((select count(*) from public.praxis_conceptos) = 0, 'un asesorado lee la biblioteca');
select pruebas.afirmar(
  not exists (select 1 from public.buscar_conceptos_vector((select ('[1' || repeat(',0', 767) || ']')::extensions.vector), 5)),
  'un asesorado encuentra piezas por sentido'
);
select pruebas.afirmar(
  not exists (select 1 from public.buscar_conceptos('cuanto descansar entre series')),
  'un asesorado encuentra piezas'
);

-- ════════════════════════════════════════════════════════════════════════
-- 7 · anon no tiene nada
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.praxis_conceptos', 'select')
  and not has_function_privilege('anon', 'public.buscar_conceptos(text, integer)', 'execute')
  and not has_function_privilege('anon', 'public.buscar_conceptos_vector(extensions.vector, integer)', 'execute')
  and not has_function_privilege('public', 'public.buscar_conceptos(text, integer)', 'execute'),
  'anon alcanza la biblioteca o su búsqueda'
);

rollback;
