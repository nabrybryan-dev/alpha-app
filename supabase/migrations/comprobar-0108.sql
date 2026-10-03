-- Comprobación de la 0108 (los avisos de Praxis al coach). Se corre APARTE, en el SQL Editor:
-- ANTES de aplicarla todas las filas tienen que decir NO, y DESPUÉS, SI. Si alguna dice SI antes de
-- aplicar o NO después, para y avisa.
--
-- Lo que importa aquí no es que la tabla exista: es que guarda una señal de riesgo de salud mental
-- de una persona, así que (1) la persona no puede leerla ni borrarla, (2) nadie puede avisar a nombre
-- de otra, (3) solo el coach y la nutricionista la leen y la marcan atendida, y (4) NO hay dónde guardar la frase.
--
-- Estas señales miran la EXPRESIÓN de las políticas y los privilegios EFECTIVOS por columna, no los
-- nombres. Las pruebas con dos sesiones de verdad están más abajo (y en el CI, que las corre contra un
-- Postgres: `supabase/test/108-praxis-avisos-coach.sql`).

select 'la tabla existe, con RLS, y anon no tiene nada' as comprueba,
       case when to_regclass('public.praxis_avisos_coach') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.praxis_avisos_coach')) then 'NO'
            when has_table_privilege('anon', 'public.praxis_avisos_coach', 'select')
              or has_table_privilege('anon', 'public.praxis_avisos_coach', 'insert')
              or has_table_privilege('anon', 'public.praxis_avisos_coach', 'update')
              or has_table_privilege('anon', 'public.praxis_avisos_coach', 'delete') then 'NO'
            else 'SI' end as sale,
       'SI' as tiene_que_dar

union all
-- No hay dónde guardar una frase: las únicas columnas de texto son origen y nivel, y las dos con lista cerrada.
select 'no hay ninguna columna de texto libre (solo origen y nivel, con lista cerrada)',
       case when to_regclass('public.praxis_avisos_coach') is null then 'NO'
            when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'praxis_avisos_coach'
                     and data_type in ('text', 'character varying', 'json', 'jsonb')) <> 2 then 'NO'
            when (select count(*) from pg_constraint
                   where conrelid = to_regclass('public.praxis_avisos_coach') and contype = 'c'
                     and pg_get_constraintdef(oid) like '%origen%praxis%ingreso%') < 1 then 'NO'
            when (select count(*) from pg_constraint
                   where conrelid = to_regclass('public.praxis_avisos_coach') and contype = 'c'
                     and pg_get_constraintdef(oid) like '%nivel%vida%pareja%nino%cuidado%salud%') < 1 then 'NO'
            else 'SI' end,
       'SI'

union all
-- La persona inserta solo el suyo: la política de insert exige auth.uid().
select 'la persona solo inserta avisos propios (with_check con auth.uid())',
       case when exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'praxis_avisos_coach'
                 and policyname = 'praxis_avisos_insertar_propio' and cmd = 'INSERT'
                 and coalesce(with_check, '') like '%auth.uid()%'
                 and coalesce(with_check, '') like '%usuario_id%')
       then 'SI' else 'NO' end,
       'SI'

union all
-- Leen el coach y la nutricionista (decisión de Bryan, 2-oct): la política de select menciona es_coach() y
-- es_nutricionista() y NO el usuario_id (la dueña no entra por ser dueña).
select 'solo el coach y la nutricionista leen (select con es_coach y es_nutricionista, sin usuario_id)',
       case when exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'praxis_avisos_coach' and cmd = 'SELECT'
                 and coalesce(qual, '') like '%es_coach%'
                 and coalesce(qual, '') like '%es_nutricionista%'
                 and coalesce(qual, '') not like '%usuario_id%')
             and (select count(*) from pg_policies
                   where schemaname = 'public' and tablename = 'praxis_avisos_coach' and cmd = 'SELECT') = 1
       then 'SI' else 'NO' end,
       'SI'

union all
-- Atender: el coach o la nutricionista, solo un pendiente, y a su nombre.
select 'atender es del coach o la nutricionista, sobre un pendiente y a su nombre (update con es_coach y es_nutricionista, atendido_en y atendido_por = auth.uid())',
       case when exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'praxis_avisos_coach'
                 and policyname = 'praxis_avisos_atender_coach' and cmd = 'UPDATE'
                 and coalesce(qual, '') like '%es_coach%'
                 and coalesce(qual, '') like '%es_nutricionista%'
                 and coalesce(qual, '') like '%atendido_en IS NULL%'
                 and coalesce(with_check, '') like '%es_coach%'
                 and coalesce(with_check, '') like '%es_nutricionista%'
                 and coalesce(with_check, '') like '%atendido_por%auth.uid()%')
       then 'SI' else 'NO' end,
       'SI'

union all
-- Privilegios EFECTIVOS por columna: la persona no fija la hora ni el atendido, nadie reescribe de quién es
-- ni el tipo, y nadie borra por la API.
select 'authenticated no decide la hora, no reescribe de quién es ni el tipo, y no borra',
       case when to_regclass('public.praxis_avisos_coach') is null then 'NO'
            when not has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'usuario_id', 'insert')
              or not has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'origen', 'insert')
              or not has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'nivel', 'insert') then 'NO'
            when has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'creado_en', 'insert')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'atendido_en', 'insert')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'atendido_por', 'insert') then 'NO'
            when has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'usuario_id', 'update')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'nivel', 'update')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'origen', 'update')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'creado_en', 'update') then 'NO'
            when not has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'atendido_en', 'update')
              or not has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'atendido_por', 'update') then 'NO'
            when has_table_privilege('authenticated', 'public.praxis_avisos_coach', 'delete') then 'NO'
            else 'SI' end,
       'SI'

union all
-- No se duplica: existe el trigger, su función ve los pendientes de la persona (security definer) y toma el candado.
select 'no se duplica: trigger con candado por persona y sin execute para anon/authenticated',
       case when not exists (select 1 from pg_trigger
                              where tgname = 'trg_praxis_aviso_nace_limpio' and not tgisinternal) then 'NO'
            when to_regprocedure('public.praxis_aviso_nace_limpio()') is null then 'NO'
            when pg_get_functiondef(to_regprocedure('public.praxis_aviso_nace_limpio()')) not like '%pg_advisory_xact_lock%' then 'NO'
            when has_function_privilege('anon', 'public.praxis_aviso_nace_limpio()', 'execute')
              or has_function_privilege('authenticated', 'public.praxis_aviso_nace_limpio()', 'execute') then 'NO'
            else 'SI' end,
       'SI';

-- ============================================================================
-- LAS QUE NO SE PUEDEN COMPROBAR DESDE AQUÍ, Y CÓMO SE HACEN
-- ============================================================================
--
-- Un esquema correcto puede dejar pasar a quien no debe: la política existe y puede estar mal
-- escrita. Estas se hacen con sesiones de verdad (**hay que verlas fallar primero**, antes de
-- aplicar la 0108: dan error porque la tabla no existe).
--
-- 1 · LA PERSONA NO LEE LO SUYO
--     · Con el service role se deja un aviso para un asesorado.
--     · Con la sesión de ESE asesorado:
--         select count(*) from public.praxis_avisos_coach;
--       Tiene que dar 0. (Si da 1, la política de lectura deja entrar a la dueña.)
--
-- 2 · NADIE AVISA A NOMBRE DE OTRO
--     · Con la sesión de un asesorado, insertar con el `usuario_id` de otra persona tiene que
--       fallar con «new row violates row-level security policy».
--
-- 3 · LA NUTRICIONISTA SÍ LOS VE (decisión de Bryan, 2-oct)
--     · Con la sesión de Manuela: `select count(*) …` tiene que dar el total de avisos.
--
-- 4 · SOLO EL COACH Y LA NUTRICIONISTA ATIENDEN, Y A SU NOMBRE
--     · Con la sesión del coach o de Manuela: `update public.praxis_avisos_coach set atendido_en = now(),
--       atendido_por = auth.uid() where id = '<un pendiente>'` toca 1 fila.
--     · El mismo `update` con `atendido_por = '<otro uuid>'` falla (RLS).
--     · Con la sesión de un asesorado, el mismo `update` afecta **0 filas** (no da error:
--       RLS no grita, simplemente no ve la fila).
