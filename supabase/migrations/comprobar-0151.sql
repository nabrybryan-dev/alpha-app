-- Comprobación de la 0151 (guiones de llamada). Se corre APARTE, en el SQL Editor del proyecto de la APP.
-- ANTES de aplicarla, todas dicen NO; DESPUÉS, todas dicen SI. Para y avisa si alguna da SI antes o NO después.
-- La prueba con la cuenta de Manuela (que ella VE filas) está en la cabecera de la 0151.

select 'la tabla existe con sus columnas' as comprueba,
       case when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'guiones_llamada'
                     and column_name in ('id', 'usuario_id', 'origen', 'guion', 'dia_preferido',
                                         'franja_preferida', 'version', 'creado_en')) = 8 then 'SI' else 'NO' end as sale,
       'SI' as tiene_que_dar

union all
select 'una sola versión por persona (unique usuario_id, version)',
       case when exists (select 1 from pg_constraint
                          where conrelid = to_regclass('public.guiones_llamada')
                            and contype = 'u'
                            and pg_get_constraintdef(oid) = 'UNIQUE (usuario_id, version)') then 'SI' else 'NO' end,
       'SI'

union all
select 'RLS activa y la única política es de lectura, con la puerta de la consola (0113)',
       case when to_regclass('public.guiones_llamada') is null then 'NO'
            when not (select relrowsecurity from pg_class where oid = to_regclass('public.guiones_llamada')) then 'NO'
            when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'guiones_llamada') <> 1 then 'NO'
            when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'guiones_llamada'
                           and (cmd <> 'SELECT' or not (roles = array['authenticated']::name[])
                                or qual not like '%es_coach()%' or qual not like '%leer_entrenamiento%'
                                or qual like '%es_staff%')) then 'NO'
            else 'SI' end,
       'SI'

union all
select 'authenticated solo lee; anon no tiene nada',
       case when to_regclass('public.guiones_llamada') is null then 'NO'
            when has_table_privilege('anon', 'public.guiones_llamada', 'select, insert, update, delete') then 'NO'
            when not has_table_privilege('authenticated', 'public.guiones_llamada', 'select') then 'NO'
            when has_table_privilege('authenticated', 'public.guiones_llamada', 'insert, update, delete, truncate') then 'NO'
            else 'SI' end,
       'SI';
