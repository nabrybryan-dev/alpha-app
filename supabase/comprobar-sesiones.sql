-- ¿Alguna sesión quedó rota o vacía después de una carga?
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE: no crea, no borra
-- y no modifica nada. Se puede ejecutar tantas veces como se quiera.
--
-- CORRER DESPUÉS DE CADA CARGA, junto con `comprobar-fosiles.sql`. Las dos
-- miran cosas distintas: aquella busca ejecución heredada, esta busca sesiones
-- que dejaron de existir o que no se pueden pintar.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ EXISTE ESTE ARCHIVO
-- ─────────────────────────────────────────────────────────────────────────────
-- El 2026-08-09 una carga escribió un `null` dentro del array `sesiones` de
-- SEIS microciclos activos, en la posición exacta donde iba una sesión real.
-- Siete sesiones perdidas. La primera en notarlo fue Manuela, que abrió su
-- semana y se encontró "Esta sección no se pudo mostrar / Reintentar".
--
-- LA CAUSA, y es una trampa de SQL que merece saberse:
--
--     jsonb_agg  DE CERO FILAS DEVUELVE SQL NULL, NO UN ARRAY VACÍO.
--
-- Un clonador que haga
--     jsonb_set(s, '{ejercicios}', (select jsonb_agg(...) from ... ))
-- sin envolver ese subselect en `coalesce(..., '[]'::jsonb)` recibe NULL cuando
-- la sesión no tiene ejercicios. Y `jsonb_set` con cualquier argumento NULL
-- devuelve NULL: se pierde la sesión ENTERA, no solo sus ejercicios. Después el
-- `jsonb_agg` de fuera la vuelve a meter en el array como un `null` de JSON.
--
-- POR QUÉ SE LLEVÓ JUSTO ESAS SIETE. Todas tenían `ejercicios: []`. Son las de
-- cardio, tabata, metabólico y hábito: las que no llevan ejercicios de sala. El
-- fallo era invisible para cualquiera que probara con una sesión normal.
--
-- `plantilla-carga-microciclo.sql` SÍ lleva ese coalesce y no produce el fallo
-- -se comprobó corriendo su lógica contra las siete sesiones perdidas-. La
-- carga que rompió esto no salió de la plantilla. Si escribes una carga a mano,
-- este archivo es tu red.
--
-- La recuperación de aquellas siete está en `migrations/0034_recuperar_sesiones_nulas.sql`.


-- ── 1 · Lo que rompe la pantalla ────────────────────────────────────────────
-- Cero filas es el estado correcto. Cualquier fila aquí es una sección que un
-- asesorado no puede abrir.
with sesiones as (
  select u.nombre, u.rol, m.numero, m.estado, m.actualizado_en,
         e.o - 1 as posicion, e.value as s
    from public.microciclos m
    join public.usuarios_app u on u.id = m.usuario_id
    cross join lateral jsonb_array_elements(m.datos -> 'sesiones') with ordinality as e(value, o)
)
select nombre, numero, estado, posicion, actualizado_en, motivo
  from (
    select nombre, numero, estado, posicion, actualizado_en,
           case
             when jsonb_typeof(s) <> 'object'          then 'la sesion es ' || jsonb_typeof(s) || ', no un objeto'
             when not (s ? 'id')                       then 'sesion sin id'
             when not (s ? 'nombre') and not (s ? 'dia') then 'sesion sin nombre ni dia'
             when s ? 'ejercicios' and jsonb_typeof(s -> 'ejercicios') <> 'array'
                                                       then 'ejercicios no es un array'
             when exists (select 1 from jsonb_array_elements(coalesce(s -> 'ejercicios', '[]'::jsonb)) x
                           where jsonb_typeof(x) <> 'object')     then 'hay un ejercicio nulo'
             when exists (select 1 from jsonb_array_elements(coalesce(s -> 'bloquesCardio', '[]'::jsonb)) x
                           where jsonb_typeof(x) <> 'object')     then 'hay un bloque de cardio nulo'
             when exists (select 1 from jsonb_array_elements(coalesce(s -> 'preparacion', '[]'::jsonb)) x
                           where jsonb_typeof(x) <> 'object')     then 'hay un item de preparacion nulo'
           end as motivo
      from sesiones
  ) t
 where motivo is not null
 order by actualizado_en desc, nombre, posicion;


-- ── 2 · El microciclo entero ────────────────────────────────────────────────
select u.nombre, m.numero, m.estado, m.actualizado_en,
       case
         when jsonb_typeof(m.datos -> 'sesiones') is distinct from 'array' then 'sesiones no es un array'
         when jsonb_array_length(m.datos -> 'sesiones') = 0                then 'microciclo sin ninguna sesion'
         when not (m.datos ? 'fechaInicio')                                then 'sin fechaInicio'
       end as motivo
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
 where jsonb_typeof(m.datos -> 'sesiones') is distinct from 'array'
    or jsonb_array_length(m.datos -> 'sesiones') = 0
    or not (m.datos ? 'fechaInicio')
 order by m.actualizado_en desc;


-- ── 3 · Comparación con el microciclo anterior ──────────────────────────────
-- No es un error por sí solo -un bloque nuevo puede cambiar de estructura- pero
-- una carga que clona NO debería cambiar el número de sesiones. Si esta consulta
-- devuelve algo justo después de una carga, míralo antes de repartir la semana.
select u.nombre,
       ant.numero as microciclo_anterior, jsonb_array_length(ant.datos -> 'sesiones') as sesiones_antes,
       m.numero   as microciclo_nuevo,    jsonb_array_length(m.datos -> 'sesiones')   as sesiones_ahora,
       m.actualizado_en
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
  join public.microciclos ant
    on ant.usuario_id = m.usuario_id
   and ant.numero = (select max(m2.numero) from public.microciclos m2
                      where m2.usuario_id = m.usuario_id and m2.numero < m.numero)
 where jsonb_array_length(m.datos -> 'sesiones') <> jsonb_array_length(ant.datos -> 'sesiones')
 order by m.actualizado_en desc, u.nombre;
