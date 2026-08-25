-- ¿Le está pasando a alguien más lo que le pasó a la tanda del 25-ago?
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE: no crea, no borra
-- y no modifica nada. Se puede ejecutar tantas veces como se quiera.
--
-- Devuelve UNA sola celda con todo dentro, porque el SQL Editor solo enseña el
-- resultado del último statement.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ BUSCA, Y POR QUÉ CADA UNO
-- ─────────────────────────────────────────────────────────────────────────────
-- A · SIN SEMANA        quien tiene un microciclo activo YA VENCIDO.
-- B · POR VENCER        quien vence en los próximos 7 días. Es la lista con la
--                       que hay que contrastar el documento de la próxima tanda
--                       ANTES de escribir el SQL.
-- C · SIN NINGUNO       historial reciente y cero activos: se cerró el anterior
--                       y el nuevo no llegó a insertarse.
-- D · INVISIBLES        quien entrena pero su `rol` no es `asesorado`. Toda
--                       consulta con `where rol = 'asesorado'` los borra del
--                       mapa. Es lo que dejó a una persona fuera de la tanda.
-- E · SESIONES VACÍAS   sesiones con `ejercicios`, `bloquesCardio` Y
--                       `preparacion` los tres en cero. Se miran las TRES: las
--                       de cardio y tabata valen 0 en `ejercicios` por diseño, y
--                       contar solo esa columna da falso positivo en toda sesión
--                       metabólica de la cartera.
-- F · NOMBRES REPETIDOS ejercicios con nombre idéntico dentro del mismo
--                       microciclo. `tmp_cargar_siguiente` empareja POR PREFIJO
--                       DEL NOMBRE y gana la clave más larga, así que una sola
--                       clave los alcanza a todos y les escribe la misma carga.
--                       Cada fila aquí es una trampa esperando a la próxima tanda.
-- G · BRECHA            el hallazgo grande: la carga que dice la frase contra la
--                       que de verdad movieron, en el último microciclo cerrado.
--                       La progresión venía sumando sobre el número prescrito y
--                       nadie comparaba las dos columnas, así que el error se
--                       heredaba y se ampliaba cada microciclo.
--
-- Ninguna consulta filtra por `rol`. A propósito — ver D.
-- ─────────────────────────────────────────────────────────────────────────────

with
activo as (
  select m.id, m.usuario_id, m.numero, m.datos, m.actualizado_en,
         u.nombre, u.rol,
         (m.datos->>'fechaInicio')::date                          as arranco,
         coalesce((m.datos->>'cadenciaDias')::int, 8)             as cadencia,
         (m.datos->>'fechaInicio')::date
           + coalesce((m.datos->>'cadenciaDias')::int, 8)         as vence
    from public.microciclos m
    join public.usuarios_app u on u.id = m.usuario_id
   where m.estado = 'activo' or m.datos->>'estado' = 'activo'
),
-- El último microciclo CERRADO es donde vive el registro: el activo acaba de
-- nacer y sus series están vacías por diseño.
ultimo_cerrado as (
  select distinct on (m.usuario_id)
         m.id, m.usuario_id, m.numero, m.datos, u.nombre
    from public.microciclos m
    join public.usuarios_app u on u.id = m.usuario_id
   where m.estado = 'cerrado' and m.datos->>'estado' = 'cerrado'
   order by m.usuario_id, (m.datos->>'fechaInicio')::date desc, m.numero desc
),
-- G · lo pautado en la frase contra el máximo que registró. El máximo, y no el
-- primero, porque la primera serie suele ser el calentamiento.
brecha as (
  select uc.nombre,
         s.value->>'nombre'                                       as sesion,
         e.value->>'nombre'                                       as ejercicio,
         replace((regexp_match(coalesce(e.value->>'prescripcion',''),
                  '^\s*(\d+(?:[.,]\d+)?)\s*KGS?\y', 'i'))[1], ',', '.')::numeric
                                                                  as pautado,
         (select max((x.value->>'cargaKg')::numeric)
            from jsonb_array_elements(coalesce(e.value->'series','[]'::jsonb)) x
           where x.value->>'cargaKg' ~ '^\d+(\.\d+)?$')           as movio
    from ultimo_cerrado uc,
         jsonb_array_elements(coalesce(uc.datos->'sesiones','[]'::jsonb)) s,
         jsonb_array_elements(coalesce(s.value->'ejercicios','[]'::jsonb)) e
)
select jsonb_pretty(jsonb_build_object(

  'resumen', jsonb_build_object(
    'personas_con_activo',   (select count(*) from activo),
    'A_sin_semana',          (select count(*) from activo where vence <= current_date),
    'C_sin_ninguno',         (select count(*) from (
                                select u.id from public.microciclos m
                                  join public.usuarios_app u on u.id = m.usuario_id
                                 group by u.id
                                having count(*) filter (where m.estado='activo'
                                                          or m.datos->>'estado'='activo') = 0
                                   and max((m.datos->>'fechaInicio')::date) > current_date - 90) t),
    'D_invisibles',          (select count(*) from activo where rol <> 'asesorado'),
    'G_brechas_10pct',       (select count(*) from brecha
                               where pautado is not null and movio is not null and movio > 0
                                 and abs(movio - pautado) / pautado >= 0.10)),

  -- A · TIENE QUE SER LISTA VACÍA
  'A_sin_semana', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nombre', nombre, 'rol', rol, 'micro', id,
             'vencio', vence::text,
             'dias', current_date - vence) order by vence), '[]'::jsonb)
      from activo where vence <= current_date),

  -- B · la lista para la próxima tanda
  'B_por_vencer_7dias', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nombre', nombre, 'rol', rol,
             'micro', id, 'toca_cargar', numero + 1,
             'arranca_el_nuevo', vence::text) order by vence, nombre), '[]'::jsonb)
      from activo where vence between current_date and current_date + 7),

  -- C · TIENE QUE SER LISTA VACÍA
  'C_sin_ninguno', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nombre', t.nombre, 'rol', t.rol,
             'ultimo_arranque', t.ult::text) order by t.ult desc), '[]'::jsonb)
      from (select u.nombre, u.rol, max((m.datos->>'fechaInicio')::date) as ult
              from public.microciclos m
              join public.usuarios_app u on u.id = m.usuario_id
             group by u.id, u.nombre, u.rol
            having count(*) filter (where m.estado='activo'
                                      or m.datos->>'estado'='activo') = 0
               and max((m.datos->>'fechaInicio')::date) > current_date - 90) t),

  -- D · no es un fallo: es la lista de a quién borra un filtro por rol
  'D_invisibles_a_un_filtro_por_rol', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nombre', nombre, 'rol', rol, 'micro', id) order by nombre), '[]'::jsonb)
      from activo where rol <> 'asesorado'),

  -- E · TIENE QUE SER LISTA VACÍA
  'E_sesiones_del_todo_vacias', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nombre', a.nombre, 'micro', a.id,
             'sesion', s.value->>'nombre', 'dia', s.value->>'dia')
           order by a.nombre), '[]'::jsonb)
      from activo a, jsonb_array_elements(coalesce(a.datos->'sesiones','[]'::jsonb)) s
     where jsonb_array_length(coalesce(s.value->'ejercicios','[]'::jsonb)) = 0
       and jsonb_array_length(coalesce(s.value->'bloquesCardio','[]'::jsonb)) = 0
       and jsonb_array_length(coalesce(s.value->'preparacion','[]'::jsonb)) = 0),

  -- F · trampas para la PRÓXIMA carga
  'F_nombres_repetidos', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nombre', t.nombre, 'micro', t.mid,
             'ejercicio', t.ej, 'veces', t.n) order by t.nombre, t.ej), '[]'::jsonb)
      from (select a.nombre, a.id as mid, e.value->>'nombre' as ej, count(*) as n
              from activo a,
                   jsonb_array_elements(coalesce(a.datos->'sesiones','[]'::jsonb)) s,
                   jsonb_array_elements(coalesce(s.value->'ejercicios','[]'::jsonb)) e
             group by 1,2,3 having count(*) > 1) t),

  -- G · las 25 peores. `sentido` dice si la hoja va por encima o por debajo.
  'G_brecha_frase_vs_registro', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nombre', b.nombre, 'ejercicio', b.ejercicio, 'sesion', b.sesion,
             'la_hoja_decia', b.pautado, 'movio', b.movio,
             'desvio_pct', round((b.movio - b.pautado) / b.pautado * 100),
             'sentido', case when b.movio < b.pautado then 'la hoja va POR ENCIMA'
                             else 'la hoja va POR DEBAJO' end)
           order by abs(b.movio - b.pautado) / b.pautado desc), '[]'::jsonb)
      from (select * from brecha
             where pautado is not null and movio is not null and movio > 0
               and abs(movio - pautado) / pautado >= 0.10
             order by abs(movio - pautado) / pautado desc
             limit 25) b)

)) as salida;
