-- ¿Algún asesorado tiene marcas de ejecución HEREDADAS de un microciclo anterior?
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE: no crea, no borra
-- y no modifica nada. Se puede ejecutar tantas veces como se quiera.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ EXISTE ESTE ARCHIVO
-- ─────────────────────────────────────────────────────────────────────────────
-- Las cargas de microciclo clonan el microciclo vigente para construir el
-- siguiente. Las de julio de 2026 lo hacían con
--   jsonb_set(s,'{ejercicios}', <ejercicios con series=[]>)
-- que reescribe SOLO `ejercicios`: el resto del objeto sesión pasa literal, y
-- ahí viajan `preparacion[].hechoEn`, `bloquesCardio[].hechoEn` y `testPost`,
-- que son del microciclo VIEJO.
--
-- Dos daños distintos:
--   1. El asesorado abre la semana nueva con el calentamiento ya tildado y el
--      test post ya relleno. Ve una sesión medio hecha que nadie hizo.
--   2. Se envenena la evidencia. Una marca con hora dejaba de probar que
--      alguien estuvo en la sesión, que es justo para lo que sirve.
--
-- El arreglo del molde está en `plantilla-carga-microciclo.sql`
-- (`sesion_en_limpio()`); la limpieza de lo ya cargado, en
-- `_app-limpiar-fosiles.local.sql`.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CÓMO SE DISTINGUE UN FÓSIL DE UNA MARCA REAL
-- ─────────────────────────────────────────────────────────────────────────────
-- Por la fecha: una marca fechada ANTES del `fechaInicio` de su propio
-- microciclo no puede pertenecerle. Es del anterior, y viajó en el clon.
--
-- El `testPost` no se puede fechar: `TestPostSesion` (src/domain/types.ts) solo
-- lleva duracionMin, rpeSesion y prsEntrada. Para ese se usa una pista
-- indirecta — un test en una sesión sin ninguna marca real y sin ninguna serie
-- registrada es un test que nadie pudo llenar. Y si además viene con los tres
-- valores en cero, lo escribió un SQL: es la firma de las cargas que lo
-- construían a mano con `jsonb_build_object('duracionMin',0,...)`.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1 · Resumen por asesorado: ¿quién está sucio? ───────────────────────────
select u.nombre,
       count(*) filter (where d.marcas_fosiles > 0)              as sesiones_con_fosiles,
       sum(d.marcas_fosiles)                                     as marcas_fosiles,
       sum(d.marcas_reales)                                      as marcas_reales,
       count(*) filter (where d.test_sospechoso)                 as tests_heredados,
       count(*) filter (where d.test_en_ceros)                   as tests_en_ceros
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
  cross join lateral jsonb_array_elements(m.datos->'sesiones') s
  cross join lateral (
    select
      (select count(*) from jsonb_array_elements(
              coalesce(s->'preparacion','[]'::jsonb)
           || coalesce(s->'bloquesCardio','[]'::jsonb)) x
        where x->>'hechoEn' is not null
          and (x->>'hechoEn')::timestamptz < (m.datos->>'fechaInicio')::date)
        as marcas_fosiles,
      (select count(*) from jsonb_array_elements(
              coalesce(s->'preparacion','[]'::jsonb)
           || coalesce(s->'bloquesCardio','[]'::jsonb)) x
        where x->>'hechoEn' is not null
          and (x->>'hechoEn')::timestamptz >= (m.datos->>'fechaInicio')::date)
        as marcas_reales,
      (s ? 'testPost'
        and not exists (select 1 from jsonb_array_elements(
                coalesce(s->'preparacion','[]'::jsonb)
             || coalesce(s->'bloquesCardio','[]'::jsonb)) x
              where x->>'hechoEn' is not null
                and (x->>'hechoEn')::timestamptz >= (m.datos->>'fechaInicio')::date)
        and not exists (select 1 from jsonb_array_elements(s->'ejercicios') e
              where jsonb_array_length(e->'series') > 0))
        as test_sospechoso,
      (s ? 'testPost'
        and coalesce((s->'testPost'->>'duracionMin')::numeric,0) = 0
        and coalesce((s->'testPost'->>'rpeSesion')::numeric,0)  = 0
        and coalesce((s->'testPost'->>'prsEntrada')::numeric,0) = 0)
        as test_en_ceros
  ) d
 where u.rol = 'asesorado'
 group by u.nombre
having sum(d.marcas_fosiles) > 0
    or count(*) filter (where d.test_sospechoso) > 0
 order by marcas_fosiles desc, u.nombre;
-- Cero filas  ->  no hay herencia. Es el estado que debe dejar cada carga.


-- ── 2 · Detalle sesión a sesión ─────────────────────────────────────────────
-- Para decidir el paso del `testPost`, que es el único que puede tocar algo
-- real: mira `marcas_reales` y `ejercicios_con_series`. Si alguna de las dos
-- es > 0, alguien estuvo en esa sesión y su test probablemente es suyo.
select u.nombre,
       m.numero,
       m.estado,
       m.datos->>'fechaInicio'                                   as inicio,
       m.actualizado_en,
       (s->>'orden')::int                                        as sesion,
       s->>'nombre'                                              as nombre_sesion,
       (select count(*) from jsonb_array_elements(
               coalesce(s->'preparacion','[]'::jsonb)
            || coalesce(s->'bloquesCardio','[]'::jsonb)) x
         where x->>'hechoEn' is not null
           and (x->>'hechoEn')::timestamptz
               < (m.datos->>'fechaInicio')::date)                as marcas_fosiles,
       (select count(*) from jsonb_array_elements(
               coalesce(s->'preparacion','[]'::jsonb)
            || coalesce(s->'bloquesCardio','[]'::jsonb)) x
         where x->>'hechoEn' is not null
           and (x->>'hechoEn')::timestamptz
               >= (m.datos->>'fechaInicio')::date)               as marcas_reales,
       (select max(x->>'hechoEn') from jsonb_array_elements(
               coalesce(s->'preparacion','[]'::jsonb)
            || coalesce(s->'bloquesCardio','[]'::jsonb)) x
         where x->>'hechoEn' is not null)                        as ultima_marca,
       s->'testPost'                                             as test_post,
       case
         when not (s ? 'testPost') then 'sin test'
         when coalesce((s->'testPost'->>'duracionMin')::numeric,0) = 0
          and coalesce((s->'testPost'->>'rpeSesion')::numeric,0)  = 0
          and coalesce((s->'testPost'->>'prsEntrada')::numeric,0) = 0
           then 'CEROS -> lo escribio SQL'
         else 'con valores'
       end                                                       as firma_test,
       (select count(*) from jsonb_array_elements(s->'ejercicios') e
         where jsonb_array_length(e->'series') > 0)              as ejercicios_con_series
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
  cross join lateral jsonb_array_elements(m.datos->'sesiones') s
 where u.rol = 'asesorado'
   and m.estado <> 'cerrado'
 order by u.nombre, m.numero desc, (s->>'orden')::int;
