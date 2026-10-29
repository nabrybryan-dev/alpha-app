-- Comprobación de la 0150 (quién pidió la corrección y por qué cambió la versión). Se corre APARTE, en el
-- SQL Editor: ANTES de aplicarla todas dicen NO, y DESPUÉS, SI. Si alguna dice SI antes o NO después, para y avisa.

select 'las dos columnas existen' as comprueba,
       case when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'videos_semanales'
                     and column_name in ('correccion_pedida_por', 'motivo_version')) = 2 then 'SI' else 'NO' end as sale,
       'SI' as tiene_que_dar

union all
select 'motivo_version solo admite correccion o republicacion_tecnica (o NULL), y solo con version > 1',
       case when exists (select 1 from pg_constraint
                          where conrelid = 'public.videos_semanales'::regclass
                            and conname = 'videos_semanales_motivo_version_check'
                            and pg_get_constraintdef(oid) like '%republicacion_tecnica%'
                            and pg_get_constraintdef(oid) like '%version > 1%') then 'SI' else 'NO' end,
       'SI'

union all
select 'la tabla sigue con RLS y anon no lee ni escribe',
       case when not (select relrowsecurity from pg_class where oid = 'public.videos_semanales'::regclass) then 'NO'
            when has_table_privilege('anon', 'public.videos_semanales', 'select')
              or has_table_privilege('anon', 'public.videos_semanales', 'insert')
              or has_table_privilege('anon', 'public.videos_semanales', 'update') then 'NO'
            else 'SI' end,
       'SI'

union all
select 'decidir_revision_semanal guarda quién pidió la corrección y no queda abierta a anon',
       case when to_regprocedure('public.decidir_revision_semanal(uuid,date,integer,boolean,text)') is null then 'NO'
            when pg_get_functiondef('public.decidir_revision_semanal(uuid,date,integer,boolean,text)'::regprocedure) not like '%correccion_pedida_por = auth.uid()%' then 'NO'
            when has_function_privilege('anon', 'public.decidir_revision_semanal(uuid,date,integer,boolean,text)', 'execute') then 'NO'
            else 'SI' end,
       'SI'

union all
select 'el trigger distingue correccion de republicacion_tecnica',
       case when to_regprocedure('public.versionar_revision_semanal()') is null then 'NO'
            when pg_get_functiondef('public.versionar_revision_semanal()'::regprocedure) like '%republicacion_tecnica%'
             and pg_get_functiondef('public.versionar_revision_semanal()'::regprocedure) like '%''correccion''%' then 'SI'
            else 'NO' end,
       'SI';
