-- ¿Quedó alguien FUERA de la última carga de microciclos?
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE: no crea, no borra
-- y no modifica nada. Se puede ejecutar tantas veces como se quiera.
--
-- CORRER DESPUÉS DE CADA TANDA, junto con `comprobar-fosiles.sql`,
-- `comprobar-sesiones.sql` y `comprobar-alineacion.sql`.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ EXISTE ESTE ARCHIVO
-- ─────────────────────────────────────────────────────────────────────────────
-- En la tanda del 2026-08-25 se cargaron 17 microciclos y faltaron DOS personas
-- que sí tenían decisión escrita en el documento de la tanda. Nadie lo vio hasta
-- que una de ellas abrió la app y no encontró semana.
--
-- Las tres comprobaciones que ya existían NO PODÍAN VERLO, y conviene entender
-- por qué: todas verifican INTEGRIDAD de lo que se escribió, ninguna verifica
-- COBERTURA de lo que debía escribirse.
--
--   · «un solo activo por persona»       -> tenían exactamente uno: el viejo.
--   · «columna vs JSON coinciden»        -> coincidían.
--   · «sin series ni testPost heredados» -> no había nada heredado; no se cargó nada.
--
-- Una persona OMITIDA POR COMPLETO pasa las tres con nota. Un microciclo vencido
-- se ve idéntico a uno vigente si nadie mira la FECHA.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA TRAMPA DEL `rol`, que es la otra mitad de la historia
-- ─────────────────────────────────────────────────────────────────────────────
-- Una de las dos es staff: su `rol` en `usuarios_app` no es `asesorado` sino el
-- de su función. Es correcto —lo es— pero significa que
--
--     TODA CONSULTA CON `where rol = 'asesorado'` LA BORRA DEL MAPA.
--
-- Ya se detectó el 2026-08-09 al reconstruir el roster (aparecían 19 personas y
-- ella no estaba, pese a tener microciclo activo) y quedó escrito en el §0 de su
-- plan estratégico. Volvió a morder en la tanda del 25.
--
--   👉 NINGUNA consulta de este archivo filtra por `rol`. A propósito.
--      El criterio de «esta persona entrena» es TENER UN MICROCICLO, no el rol.
--      Si añades un filtro por rol aquí, reintroduces el fallo.
--
-- La solución de fondo es que alguien pueda ser staff y asesorado a la vez.
-- Mientras eso no exista, este archivo es la red.


-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · VENCIDOS · su microciclo activo ya se les acabó
-- ═════════════════════════════════════════════════════════════════════════════
-- TIENE QUE DAR CERO FILAS después de una tanda.
-- Cada fila es una persona que hoy abre la app y ve una semana caducada.
--
-- `cadenciaDias` vive en el JSON del microciclo y vale 8 o 15. Si falta, se
-- asume 8, que es la cadencia por defecto de la cartera.

select u.nombre,
       u.rol,
       m.id                                                       as microciclo,
       m.numero,
       (m.datos->>'fechaInicio')::date                            as arranco,
       coalesce((m.datos->>'cadenciaDias')::int, 8)               as cadencia,
       (m.datos->>'fechaInicio')::date
         + coalesce((m.datos->>'cadenciaDias')::int, 8)           as vencio,
       current_date - ((m.datos->>'fechaInicio')::date
         + coalesce((m.datos->>'cadenciaDias')::int, 8))          as dias_vencido
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
 where (m.estado = 'activo' or m.datos->>'estado' = 'activo')
   and (m.datos->>'fechaInicio')::date
         + coalesce((m.datos->>'cadenciaDias')::int, 8) <= current_date
 order by dias_vencido desc, u.nombre;


-- ═════════════════════════════════════════════════════════════════════════════
-- 1b · LOS QUE VENCEN EN LOS PRÓXIMOS 3 DÍAS · la lista para armar la tanda
-- ═════════════════════════════════════════════════════════════════════════════
-- Esta NO da cero: es la lista de a quién hay que programar, y sirve para
-- CONTRASTARLA con el documento de la tanda antes de escribir el SQL.
--
-- Existe porque §1 llega tarde por definición: el 2026-08-24, con las dos sin
-- cargar y venciendo al día siguiente, §1 devolvía CERO FILAS.
-- Solo ve lo que ya se rompió. Esta avisa mientras todavía se puede arreglar.

select u.nombre,
       u.rol,
       m.id                                                       as microciclo,
       m.numero,
       m.numero + 1                                               as toca_cargar,
       (m.datos->>'fechaInicio')::date
         + coalesce((m.datos->>'cadenciaDias')::int, 8)           as arranca_el_nuevo
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
 where (m.estado = 'activo' or m.datos->>'estado' = 'activo')
   and (m.datos->>'fechaInicio')::date
         + coalesce((m.datos->>'cadenciaDias')::int, 8)
       between current_date and current_date + 3
 order by arranca_el_nuevo, u.nombre;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · SIN NADA · tienen historial pero ningún microciclo activo
-- ═════════════════════════════════════════════════════════════════════════════
-- TIENE QUE DAR CERO FILAS.
-- Es el otro modo de desaparecer: no es que la semana esté vencida, es que no
-- hay ninguna. Pasa cuando una carga cierra el anterior y falla al insertar el
-- nuevo — que es exactamente lo que haría un `raise exception` a mitad de una
-- transacción mal cerrada.
--
-- Si la persona SALIÓ del programa de verdad no debería tener microciclos
-- recientes: por eso solo se listan quienes tuvieron uno en los últimos 90 días.

select u.nombre,
       u.rol,
       max((m.datos->>'fechaInicio')::date)                       as ultimo_arranque,
       count(*)                                                   as microciclos_totales
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
 group by u.id, u.nombre, u.rol
having count(*) filter (where m.estado = 'activo'
                           or m.datos->>'estado' = 'activo') = 0
   and max((m.datos->>'fechaInicio')::date) > current_date - 90
 order by ultimo_arranque desc;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · A QUIÉN TOCÓ LA CARGA QUE ACABAS DE CORRER
-- ═════════════════════════════════════════════════════════════════════════════
-- Esta NO da cero: es la lista para leer con la tanda al lado y CONTAR.
-- Si la tanda decía 19 y aquí salen 17, los dos que faltan son el problema.
--
-- Sube el intervalo si la carga se corrió en varios pasos separados en el
-- tiempo (la del 25 fueron dos archivos con casi una hora entre ellos).

select u.nombre,
       m.id                                                       as microciclo,
       m.numero,
       (m.datos->>'fechaInicio')::date                            as arranca,
       jsonb_array_length(m.datos->'sesiones')                    as sesiones,
       (select coalesce(sum((e->>'sets')::int), 0)
          from jsonb_array_elements(m.datos->'sesiones') s,
               jsonb_array_elements(coalesce(s.value->'ejercicios', '[]'::jsonb)) e)
                                                                  as series,
       m.actualizado_en
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
 where m.actualizado_en > now() - interval '3 hours'
 order by m.actualizado_en;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · SESIONES VACÍAS DENTRO DE UN MICROCICLO ACTIVO
-- ═════════════════════════════════════════════════════════════════════════════
-- No da cero por sí sola: las sesiones de cardio, tabata, metabólico y hábito
-- viven legítimamente con `ejercicios: []` y su contenido en `bloquesCardio`
-- (es justo lo que explica `comprobar-sesiones.sql`).
--
-- Lo que SÍ es un fallo es la fila que sale con LAS TRES columnas en cero: esa
-- sesión existe en el calendario y no tiene absolutamente nada dentro. Es lo que
-- se creyó que había pasado en la tanda del 25 con una sesión metabólica: se
-- contó `ejercicios` y se la dio por inexistente cuando estaba entera.

select u.nombre,
       m.id                                                       as microciclo,
       s.value->>'nombre'                                         as sesion,
       s.value->>'dia'                                            as dia,
       jsonb_array_length(coalesce(s.value->'ejercicios', '[]'::jsonb))     as ejercicios,
       jsonb_array_length(coalesce(s.value->'bloquesCardio', '[]'::jsonb))  as bloques_cardio,
       jsonb_array_length(coalesce(s.value->'preparacion', '[]'::jsonb))    as preparacion
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id,
       jsonb_array_elements(m.datos->'sesiones') s
 where (m.estado = 'activo' or m.datos->>'estado' = 'activo')
   and jsonb_array_length(coalesce(s.value->'ejercicios', '[]'::jsonb)) = 0
 order by u.nombre, (s.value->>'orden')::int;
