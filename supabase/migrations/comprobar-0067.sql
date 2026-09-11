-- Comprobación de la 0067 (los borradores que esperan firma). Se corre APARTE,
-- después de aplicarla, en el SQL Editor.
--
-- Lo que importa aquí no es que la columna admita dos valores más: es que un
-- borrador NO SE VEA antes de que alguien lo firme, y que cada firmante toque
-- solo los suyos. Con vídeo de por medio —la cara y la voz clonadas de Bryan—
-- un borrador visible antes de tiempo no es un fallo de datos: es Bryan
-- diciéndole a alguien algo que Bryan no ha aprobado que se diga.

select 'el origen admite los cuatro valores' as comprueba,
       case when (
              select pg_get_constraintdef(oid) from pg_constraint
               where conname = 'mensajes_origen_valido'
             ) like '%borrador-coach%borrador-nutri%'
       then 'SI' else 'NO' end as sale,
       'SI' as tiene_que_dar

union all
select 'y rechaza uno inventado',
       case when exists (
              select 1 from pg_constraint
               where conname = 'mensajes_origen_valido'
                 and pg_get_constraintdef(oid) not like '%borrador-jefe%')
       then 'SI' else 'NO' end,
       'SI'

union all
select 'existe es_nutricionista(), separada de es_staff()',
       case when exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'es_nutricionista')
       then 'SI' else 'NO' end,
       'SI'

union all
select 'la lectura esconde los borradores al destinatario',
       case when (
              select qual::text from pg_policies
               where schemaname = 'public' and tablename = 'mensajes' and policyname = 'mensajes_leer'
             ) like '%borrador%'
       then 'SI' else 'NO' end,
       'SI'

union all
select 'existe la política de firmar',
       case when exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'mensajes'
                 and policyname = 'mensajes_firmar_borrador')
       then 'SI' else 'NO' end,
       'SI';

-- ============================================================================
-- LAS DOS QUE NO SE PUEDEN COMPROBAR DESDE AQUÍ, Y CÓMO SE HACEN
-- ============================================================================
--
-- Las de arriba miran el ESQUEMA, y un esquema correcto puede dejar pasar a
-- quien no debe: la política existe y puede estar mal escrita. Estas dos se
-- hacen con dos sesiones de verdad, y **hay que verlas fallar primero** —correr
-- el paso 2 ANTES de aplicar la 0067 tiene que dar 1 fila, y después 0—.
--
-- 1 · EL DESTINATARIO NO VE SU BORRADOR
--     · Con la sesión de un ASESORADO (no service role):
--         select count(*) from public.mensajes
--          where para_id = auth.uid() and origen like 'borrador-%';
--     · Tiene que dar 0 habiendo una fila así puesta con el service role.
--
-- 2 · LA NUTRICIONISTA NO TOCA UN BORRADOR DEL COACH
--     · Se deja un `borrador-coach` con el service role.
--     · Con la sesión de Manuela:
--         update public.mensajes set texto = texto || ' (editado)'
--          where origen = 'borrador-coach';
--     · Tiene que afectar **0 filas**. No da error: RLS no grita, simplemente no
--       ve la fila. Si afecta 1, la política está mal y el aviso no va a llegar
--       por ningún otro sitio.
