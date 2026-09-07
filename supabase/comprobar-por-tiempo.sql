-- ============================================================================
-- COMPROBAR · los ejercicios por tiempo van en su unidad
-- ----------------------------------------------------------------------------
-- Se corre DESPUÉS DE CADA CARGA, junto a `comprobar-alineacion.sql`.
-- Tiene que devolver CERO FILAS sobre los microciclos ACTIVOS.
--
-- POR QUÉ EXISTE (2026-09-07)
-- Un ejercicio por tiempo —plancha, Pallof, sentadilla isométrica— lleva el
-- `rango` en segundos («30 seg», «20-30 seg») y la app usa `repsDiana` tal cual:
-- es la cifra de la estación del salón (`estacionesDeLaSerie.ts`), el valor que
-- ofrece el registro (`RegistroSerie.tsx`) y lo que mide el reloj del muro y la
-- duración de la sesión (`relojDelMuro.ts`, `ritmoSesion.ts`). El ⑤ del cerebro
-- los escribía con `repsDiana: 1` y la frase «10KG A 1 REPS; 2 SERIES (RIR 4)»:
-- la persona veía «1» en la estación y leía UNA repetición. Cuatro ejercicios de
-- un M7 llegaron así a producción, y una plancha de otro M4 con la diana bien
-- (25) y la frase «A 25 REPS». El generador de la app ya escribía 30 en la
-- escalera (`rangoReps("30 seg")` → 30); la frase no.
--
-- LA REGLA (I-35 en el cerebro; `esPorTiempo` + `componerPrescripcion` en la app)
-- La diana lleva el número del rango, en la unidad del rango, y la frase dice
-- «A 30 SEG» / «A 2 MIN», nunca «A 1 REPS» ni «A 25 REPS».
--
-- QUÉ DEVUELVE. Una fila por ejercicio con alguna de las dos cosas mal:
--   · `frase_mal`  — la cifra de la frase va en REPS con el rango en tiempo;
--   · `diana_mal`  — la diana cae fuera de los números del rango («30 seg» → 30,
--                    «20-30 seg» → entre 20 y 30).
-- Se arregla en el ⑤ que lo escribió (o a mano en la base, con la palabra del
-- coach): nunca aflojando esta consulta.
-- ============================================================================

with ejercicios as (
  select u.nombre                       as asesorado,
         m.id                           as microciclo,
         s->>'nombre'                   as sesion,
         e->>'nombre'                   as ejercicio,
         e->>'rango'                    as rango,
         e->>'repsDiana'                as diana,
         coalesce(e->>'prescripcion','') as frase
    from microciclos m
    join usuarios_app u on u.id = m.usuario_id,
         jsonb_array_elements(m.datos->'sesiones')  s,
         jsonb_array_elements(s->'ejercicios')      e
   where (m.estado = 'activo' or m.datos->>'estado' = 'activo')
     and e->>'rango' ~* '\y(seg|segundos?|s|min|minutos?)\y'
),
leidos as (
  select *,
         (regexp_match(rango, '(\d+)'))[1]::int                          as tramo_bajo,
         coalesce((regexp_match(rango, '\d+\D+(\d+)'))[1]::int,
                  (regexp_match(rango, '(\d+)'))[1]::int)                as tramo_alto,
         (regexp_match(frase,
            '\yA\s+(\d+)(?:\s*-\s*\d+)?\s*(REPS?|SEGUNDOS?|SEG|MINUTOS?|MIN)\y',
            'i'))[2]                                                     as unidad_frase
    from ejercicios
),
juzgados as (
  select *,
         unidad_frase ~* '^REP'                                          as frase_mal,
         (diana ~ '^\d+$'
          and not diana::int between least(tramo_bajo, tramo_alto)
                                 and greatest(tramo_bajo, tramo_alto))   as diana_mal
    from leidos
)
select asesorado, microciclo, sesion, ejercicio, rango, diana,
       left(frase, 60) as frase,
       case when frase_mal then 'la frase dice REPS con el rango en tiempo' end as frase_mal,
       case when diana_mal then 'la diana no es el número del rango'         end as diana_mal
  from juzgados
 where frase_mal or diana_mal
 order by asesorado, microciclo, sesion, ejercicio;
