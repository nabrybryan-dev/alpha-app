-- ============================================================================
-- COMPROBAR · ¿le falta al microciclo nuevo alguna sesión que tenía el viejo?
-- ----------------------------------------------------------------------------
-- Se corre DESPUÉS DE CADA CARGA, con las otras tres.
-- La columna `veredicto` tiene que decir OK en todas las filas.
--
-- POR QUÉ EXISTE, Y POR QUÉ NO BASTABA CON LAS QUE HABÍA
-- `comprobar-sesiones.sql` caza sesiones **nulas** — la firma del incidente del
-- 2026-08-09, donde `jsonb_agg` de cero filas devolvió NULL y seis microciclos
-- se quedaron con un `null` dentro del array, en la posición de una sesión real
-- (migración 0034). Pero una sesión que **ya no está** no deja hueco, y ninguna
-- de las tres comprobaciones obligatorias la ve: el array es válido, las
-- sesiones que quedan son correctas, las frases están alineadas. Todo en verde,
-- y la persona abre la semana con una sesión menos.
--
-- EL CASO QUE LO PROVOCÓ (2026-08-24)
-- Juliana Garcia salió de una carga con 4 sesiones viniendo de 5. La que faltaba
-- era `CARDIO HIIT + ZONA 2`: **cero ejercicios**. Y es exactamente la misma
-- sesión de la misma persona que ya se había perdido el 2026-08-09. Dos veces,
-- la misma, y las dos con cargas que no salieron de la plantilla.
--
-- LAS SESIONES SIN `ejercicios` SON LAS FRÁGILES, SIEMPRE
-- Cardio, tabata, metabólico, hábito. Son las que revienta el `jsonb_agg` de
-- cero filas y las que se caen de un script escrito a mano, porque son las que
-- no se ven al revisar «los ejercicios de la semana». Por eso esta consulta las
-- marca aunque no falte ninguna: son el sitio donde hay que mirar primero.
--
-- DISTINGUE PERDIDA DE RENOMBRADO, Y ESO ES LA MITAD DEL VALOR
-- La primera version marcaba «MIRAR» a seis personas que no tenian nada que
-- mirar: Karin, Laura, Lina, Mara, Tatiana y Tapasco habian **renombrado** sus
-- sesiones, no perdido ninguna — mismo numero antes y despues. Una alerta que
-- grita en el caso normal se acaba ignorando, y entonces no esta el dia que
-- importa. Ahora hay tres veredictos:
--
--   PERDIDA    · bajo el numero de sesiones. Esto es lo que hay que mirar.
--   FRAGIL     · el numero cuadra, pero hay MENOS sesiones sin ejercicios que
--                antes. Es la firma exacta del fallo: la de cardio se cayo y
--                otra ocupo su sitio. Es lo que le paso a Juliana.
--   RENOMBRADO · cambiaron nombres y las cuentas cuadran. Informativo.
--
-- El contador de sesiones sin ejercicios es el detector fino. Lina paso de
-- `CARDIO TABATA` a `MOTOR AEROBICO + MOVILIDAD` y sigue teniendo la suya: eso
-- es un renombrado sano. Juliana paso de 2 a 1: eso era una perdida.
--
-- UNA BAJADA DE SESIONES PUEDE SER DELIBERADA
-- Un recorte decidido por el coach es legítimo — a Juan Camilo Gutiérrez se le
-- bajó de 5 a 1 a propósito el 2026-08-24. Esto no distingue una decisión de un
-- accidente y no debe intentarlo: lo que hace es **obligar a que alguien lo
-- mire**. Si la bajada es deliberada, se anota en el log y se sigue.
--
-- EL EMPAREJAMIENTO ES POR NOMBRE DE SESIÓN
-- El `id` va prefijado por microciclo y cambia en cada carga, así que no sirve
-- para comparar entre semanas. Si una sesión se renombra, saldrá aquí como una
-- que falta y otra que sobra: eso también merece una mirada.
-- ============================================================================

with mc as (
  -- `jsonb_array_elements` sobre algo que no es array aborta la consulta entera,
  -- y un LATERAL se evalúa antes del WHERE. Se filtra aquí.
  select m.id, m.usuario_id, m.numero, m.estado, m.datos
    from public.microciclos m
   where jsonb_typeof(m.datos->'sesiones') = 'array'
),
par as (
  -- El activo de cada persona contra el de número inmediatamente inferior.
  -- Sin filtro de `rol`: el rol decide a quién se le PROGRAMA, no qué datos
  -- existen. Filtrar por `rol = 'asesorado'` borra del mapa a quien es staff y
  -- entrena — ya mordió tres veces con la misma persona.
  select u.nombre                                  as asesorado,
         act.id                                    as microciclo,
         act.numero,
         ant.numero                                as numero_anterior,
         jsonb_array_length(ant.datos->'sesiones') as sesiones_antes,
         jsonb_array_length(act.datos->'sesiones') as sesiones_ahora,
         act.datos                                 as d_act,
         ant.datos                                 as d_ant
    from mc act
    join public.usuarios_app u on u.id = act.usuario_id
    join mc ant
      on ant.usuario_id = act.usuario_id
     and ant.numero = (select max(m2.numero) from mc m2
                        where m2.usuario_id = act.usuario_id
                          and m2.numero < act.numero)
   where act.estado = 'activo'
)
select p.asesorado,
       p.microciclo,
       'M' || p.numero_anterior || ' -> M' || p.numero          as salto,
       p.sesiones_antes || ' -> ' || p.sesiones_ahora           as sesiones,

       -- Lo que estaba y ya no está.
       coalesce((
         select string_agg(a->>'nombre' || case
                  when jsonb_array_length(coalesce(a->'ejercicios','[]'::jsonb)) = 0
                  then '  [SIN EJERCICIOS · la clase de sesion que siempre se pierde]'
                  else '' end, ' | ')
           from jsonb_array_elements(p.d_ant->'sesiones') a
          where not exists (
            select 1 from jsonb_array_elements(p.d_act->'sesiones') b
             where upper(trim(coalesce(b->>'nombre',''))) =
                   upper(trim(coalesce(a->>'nombre',''))))
       ), '-')                                                  as se_perdieron,

       -- Y lo que aparece nuevo, que puede ser un renombrado.
       coalesce((
         select string_agg(b->>'nombre', ' | ')
           from jsonb_array_elements(p.d_act->'sesiones') b
          where not exists (
            select 1 from jsonb_array_elements(p.d_ant->'sesiones') a
             where upper(trim(coalesce(a->>'nombre',''))) =
                   upper(trim(coalesce(b->>'nombre',''))))
       ), '-')                                                  as entraron_nuevas,

       -- Las frágiles que SÍ sobrevivieron, para saber dónde mirar.
       (select count(*) from jsonb_array_elements(p.d_act->'sesiones') b
         where jsonb_array_length(coalesce(b->'ejercicios','[]'::jsonb)) = 0)
                                                                as sin_ejercicios_ahora,

       -- Sesiones sin ejercicios ANTES. Si ahora hay menos, se cayo una de
       -- cardio y otra ocupo su sitio sin que el numero total lo delate.
       (select count(*) from jsonb_array_elements(p.d_ant->'sesiones') a
         where jsonb_array_length(coalesce(a->'ejercicios','[]'::jsonb)) = 0)
                                                                as sin_ejercicios_antes,

       case
         when p.sesiones_ahora < p.sesiones_antes
           then 'PERDIDA · bajo de ' || p.sesiones_antes || ' a ' || p.sesiones_ahora
         when (select count(*) from jsonb_array_elements(p.d_act->'sesiones') b
                where jsonb_array_length(coalesce(b->'ejercicios','[]'::jsonb)) = 0)
            < (select count(*) from jsonb_array_elements(p.d_ant->'sesiones') a
                where jsonb_array_length(coalesce(a->'ejercicios','[]'::jsonb)) = 0)
           then 'FRAGIL · hay menos sesiones sin ejercicios que antes'
         when exists (
           select 1 from jsonb_array_elements(p.d_ant->'sesiones') a
            where not exists (
              select 1 from jsonb_array_elements(p.d_act->'sesiones') b
               where upper(trim(coalesce(b->>'nombre',''))) =
                     upper(trim(coalesce(a->>'nombre',''))))
         ) then 'RENOMBRADO · las cuentas cuadran, informativo'
         else 'OK'
       end                                                      as veredicto

  from par p
 order by case
            when p.sesiones_ahora < p.sesiones_antes then 0
            when (select count(*) from jsonb_array_elements(p.d_act->'sesiones') b
                   where jsonb_array_length(coalesce(b->'ejercicios','[]'::jsonb)) = 0)
               < (select count(*) from jsonb_array_elements(p.d_ant->'sesiones') a
                   where jsonb_array_length(coalesce(a->'ejercicios','[]'::jsonb)) = 0)
              then 1
            else 2
          end,
          p.asesorado;
