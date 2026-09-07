-- Comprobación de 0054. Cinco señales; las cinco tienen que decir OK.
--
-- SOLO LEE. Se corre después de aplicar la migración.
--
-- La señal 5 es la que de verdad importa y es la razón de que esta función
-- exista con el predicado que tiene: **Manuela Quintero tiene
-- `rol = 'nutricionista'` y es asesorada a la vez**. Una versión anterior de esta
-- consulta filtraba por rol y la borraba del resultado — la mesa del sábado
-- habría perdido a una persona real todas las semanas, en silencio. Una señal
-- que solo contara filas no lo habría visto: 20 personas parecen 20 personas.

-- 1 · Existe y NO es `security definer` (si lo fuera se saltaría la RLS).
select 'senal 1 · existe y es invoker' as senal,
       case when count(*) = 1 then 'OK' else 'FALLO: ' || count(*) || ' definiciones' end as veredicto
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'mesa_del_sabado' and p.prosecdef = false;

-- 2 · `anon` NO la puede ejecutar.
select 'senal 2 · anon no la ejecuta' as senal,
       case when has_function_privilege('anon', 'public.mesa_del_sabado()', 'execute')
            then 'FALLO: anon puede' else 'OK' end as veredicto;

-- 3 · `authenticated` sí (después manda la RLS de las tablas).
select 'senal 3 · authenticated si' as senal,
       case when has_function_privilege('authenticated', 'public.mesa_del_sabado()', 'execute')
            then 'OK' else 'FALLO' end as veredicto;

-- 4 · Devuelve tantas personas como microciclos activos hay. No un número fijo:
--     un alta nueva no puede hacer gritar esta señal.
select 'senal 4 · una fila por microciclo activo' as senal,
       case when json_array_length(public.mesa_del_sabado())
                 = (select count(*) from public.microciclos where estado = 'activo')
            then 'OK (' || json_array_length(public.mesa_del_sabado()) || ')'
            else 'FALLO: ' || json_array_length(public.mesa_del_sabado()) || ' filas para '
                 || (select count(*) from public.microciclos where estado = 'activo')
                 || ' microciclos activos' end as veredicto;

-- 5 · LA QUE PROTEGE: nadie con microciclo activo se queda fuera por su rol.
--     Se comprueba contra el caso real que lo destapó.
select 'senal 5 · el rol no borra a nadie' as senal,
       case when c.n = 0 then 'OK'
            else 'FALLO: ' || c.n || ' con activo y fuera de la mesa (' || c.quienes || ')' end as veredicto
  from (
    select count(*) as n, coalesce(string_agg(u.nombre, ', '), '') as quienes
      from public.usuarios_app u
     where exists (select 1 from public.microciclos m
                    where m.usuario_id = u.id and m.estado = 'activo')
       and public.mesa_del_sabado()::text not like '%' || u.nombre || '%'
  ) c;
