-- Comprobación de la 0110 (las respuestas del coach a las preguntas de la cadena). Se corre APARTE, en el
-- SQL Editor: ANTES de aplicarla todas dicen NO, y DESPUÉS, SI. Si alguna dice SI antes o NO después, para y avisa.
--
-- Lo que importa: (1) solo el coach y la nutricionista leen y responden, (2) nadie escribe la tabla por la API
-- directo (la única puerta es la función), (3) anon no tiene nada, (4) la función no queda abierta a anon.
-- Las sesiones de verdad corren en el CI: `supabase/test/112-respuestas-coach-cadena.sql`.

select 'la tabla existe, con RLS, y anon no tiene nada' as comprueba,
       case when to_regclass('public.respuestas_coach_cadena') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.respuestas_coach_cadena')) then 'NO'
            when has_table_privilege('anon', 'public.respuestas_coach_cadena', 'select')
              or has_table_privilege('anon', 'public.respuestas_coach_cadena', 'insert')
              or has_table_privilege('anon', 'public.respuestas_coach_cadena', 'update')
              or has_table_privilege('anon', 'public.respuestas_coach_cadena', 'delete') then 'NO'
            else 'SI' end as sale,
       'SI' as tiene_que_dar

union all
select 'authenticated solo lee: no inserta, no actualiza, no borra (la puerta es la función)',
       case when to_regclass('public.respuestas_coach_cadena') is null then 'NO'
            when has_table_privilege('authenticated', 'public.respuestas_coach_cadena', 'insert')
              or has_table_privilege('authenticated', 'public.respuestas_coach_cadena', 'update')
              or has_table_privilege('authenticated', 'public.respuestas_coach_cadena', 'delete') then 'NO'
            when not has_table_privilege('authenticated', 'public.respuestas_coach_cadena', 'select') then 'NO'
            else 'SI' end,
       'SI'

union all
select 'la política de lectura es solo es_coach() o es_nutricionista(), y no hay política de escritura',
       case when to_regclass('public.respuestas_coach_cadena') is null then 'NO'
            when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'respuestas_coach_cadena') <> 1 then 'NO'
            when not exists (select 1 from pg_policies
                              where schemaname = 'public' and tablename = 'respuestas_coach_cadena'
                                and cmd = 'SELECT' and qual like '%es_coach%' and qual like '%es_nutricionista%') then 'NO'
            else 'SI' end,
       'SI'

union all
select 'responder_pregunta_coach existe, es security definer, exige coach o nutricionista y no está abierta a anon',
       case when to_regprocedure('public.responder_pregunta_coach(text,uuid,integer,text,text)') is null then 'NO'
            when not (select p.prosecdef from pg_proc p
                       where p.oid = to_regprocedure('public.responder_pregunta_coach(text,uuid,integer,text,text)')) then 'NO'
            when pg_get_functiondef(to_regprocedure('public.responder_pregunta_coach(text,uuid,integer,text,text)')) not like '%es_coach()%'
              or pg_get_functiondef(to_regprocedure('public.responder_pregunta_coach(text,uuid,integer,text,text)')) not like '%es_nutricionista()%' then 'NO'
            when has_function_privilege('anon', 'public.responder_pregunta_coach(text,uuid,integer,text,text)', 'execute') then 'NO'
            else 'SI' end,
       'SI';
