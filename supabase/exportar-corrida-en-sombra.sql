-- Exporta lo que la CORRIDA EN SOMBRA necesita, y nada más.
--
--   SOLO LECTURA. Ni un insert, ni un update, ni un delete.
--
-- QUÉ ES ESTO. El supuesto del 2026-08-25 (§7.1) pide correr el bucle del día
-- «en sombra» un microciclo entero: que calcule el escenario que habría pisado
-- cada día, sin enseñárselo a nadie, y comparar después. Todo lo que ese cruce
-- necesita ya está guardado, así que la sombra **se reproduce sobre la historia**
-- en vez de esperar una semana. Esta consulta saca la historia.
--
-- CÓMO SE USA
--   1. Pegar en el SQL Editor de Supabase y ejecutar.
--   2. Guardar el resultado (una sola celda JSON) en un archivo FUERA del repo.
--      Lleva el entrenamiento real de personas reales: no entra en git (§4 del
--      CLAUDE.md). El script aborta si le apuntas dentro de un árbol git.
--   3. `npx vite-node scripts/corrida-en-sombra.mjs <ese archivo>`
--
-- QUÉ SE LLEVA Y QUÉ NO. Va lo que leen `rendimientoDelDia` y `contextoDelDia`,
-- reducido al hueso: **ni nombres de personas, ni notas, ni prescripciones en
-- prosa, ni medidas**. El nombre de la sesión se recorta a 20 caracteres porque
-- la regla del martes se apoya en los grupos, no en el título. El identificador
-- de cada persona es su `usuario_id` y no se cruza aquí con `usuarios_app`.
--
-- POR QUÉ TANTO `~ '^-?[0-9.]+$'`. Porque el campo `rir` de una serie guarda a
-- veces texto —hay al menos una serie real con «Isometría» dentro—, y un
-- `::numeric` a pelo revienta la consulta entera. Lo que no es número se deja
-- en null, que es lo que significa: «esa serie no declaró RIR».

with base as (
  select m.usuario_id, m.numero, m.estado, ses
    from public.microciclos m
    join public.usuarios_app u on u.id = m.usuario_id
    cross join lateral jsonb_array_elements(m.datos->'sesiones') ses
   -- Fuera los perfiles de prueba de la tubería y el del coach. NO se filtra por
   -- `rol`: la lección del 2026-08-24 es que el rol decide a quién se le PROGRAMA,
   -- no qué datos existen — la nutricionista entrena y sus datos cuentan.
   where u.nombre not like 'PRUEBA-AGENTES%'
     and u.nombre <> 'Bryan (prueba)'
     and u.rol <> 'coach'
),
sesiones as (
  select usuario_id, numero, estado,
    jsonb_build_object(
      'orden',  case when (ses->>'orden') ~ '^[0-9]+$' then (ses->>'orden')::int else 0 end,
      'nombre', left(ses->>'nombre', 20),
      -- El día: el campo si existe (desde el PR #199), y si no la PRIMERA marca
      -- de preparación, que era el único rastro fechado que dejaba el asesorado.
      'fecha',  coalesce(ses->>'fecha', (
                  select left(min(p->>'hechoEn'), 10)
                    from jsonb_array_elements(coalesce(ses->'preparacion','[]'::jsonb)) p
                   where p->>'hechoEn' is not null)),
      'fechaDelCampo', (ses->>'fecha') is not null,
      -- El PRS del test posterior NO necesita fecha: va dentro de la sesión.
      'prsEntrada', case when (ses->'testPost'->>'prsEntrada') ~ '^-?[0-9.]+$'
                         then (ses->'testPost'->>'prsEntrada')::numeric end,
      'ejercicios', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',          e->>'id',
          'categoria',   e->>'categoria',
          'rirObjetivo', e->'rirObjetivo',
          'sets',        case when (e->>'sets') ~ '^[0-9]+$' then (e->>'sets')::int else 0 end,
          'cargaKg',     case when (e->>'cargaKg') ~ '^-?[0-9.]+$' then (e->>'cargaKg')::numeric end,
          -- La carga pautada de un ondulado es la media de sus series prescritas:
          -- es exactamente lo que hace `rendimientoDelDia`.
          'cargaPautadaOndulada', (
            select round(avg((sp->>'cargaKg')::numeric), 3)
              from jsonb_array_elements(coalesce(e->'seriesPrescritas','[]'::jsonb)) sp
             where (sp->>'cargaKg') ~ '^-?[0-9.]+$'),
          'escenarios',  e->'escenarios',
          'series', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'cargaKg', case when (s2->>'cargaKg') ~ '^-?[0-9.]+$' then (s2->>'cargaKg')::numeric else 0 end,
                     'rir',     case when (s2->>'rir') ~ '^-?[0-9.]+$' then (s2->>'rir')::numeric end)
                     order by case when (s2->>'orden') ~ '^[0-9]+$' then (s2->>'orden')::int else 0 end)
              from jsonb_array_elements(coalesce(e->'series','[]'::jsonb)) s2), '[]'::jsonb)))
          from jsonb_array_elements(coalesce(ses->'ejercicios','[]'::jsonb)) e), '[]'::jsonb)
    ) as sesion
    from base
),
micros as (
  select usuario_id, numero, estado,
         jsonb_agg(sesion order by (sesion->>'orden')::int) as sesiones
    from sesiones group by usuario_id, numero, estado
),
gente as (
  select m.usuario_id,
         jsonb_agg(jsonb_build_object('numero', m.numero, 'estado', m.estado,
                                      'sesiones', m.sesiones)
                   order by m.numero) as microciclos,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'fecha',        c.fecha,
                    'horasSueno',   c.datos->'horasSueno',
                    'calidadSueno', c.datos->>'calidadSueno',
                    'estres',       c.datos->>'estres',
                    'cansancio',    c.datos->>'cansancio',
                    'motivacion',   c.datos->>'motivacion')
                  order by c.fecha)
             from public.checkins c
            where c.usuario_id = m.usuario_id), '[]'::jsonb) as checkins
    from micros m group by m.usuario_id
)
-- Sin `jsonb_pretty`: la sangria triplica el tamano y el script lo parsea igual.
select (jsonb_build_object(
         'generadoEn', to_char(now() at time zone 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI'),
         'gente', jsonb_agg(jsonb_build_object(
                    'usuarioId',   usuario_id,
                    'microciclos', microciclos,
                    'checkins',    checkins))
       ))::text as export_corrida_en_sombra
  from gente;
