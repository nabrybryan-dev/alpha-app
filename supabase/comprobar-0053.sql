-- Comprobación de 0053. Seis señales; las seis tienen que decir OK.
--
-- Se corre CONTRA LA BASE después de aplicar la migración. Las señales 1-4 son de
-- seguridad y estructura —lo que no se puede saber leyendo el código—; la 5 es la
-- que de verdad protege, y la 6 es informativa.
--
-- DOS DE ELLAS SE VIERON EN ROJO A PROPÓSITO el 2026-09-05, que es la condición de
-- la casa para dar un check por bueno:
--
--   · el vocabulario cerrado: `insert ... motivo = 'se_fue_porque_si'` ->
--     ERROR 23514, «violates check constraint motivo_sin_plan_motivo_check».
--   · la señal 5: borrando la fila de una persona sin plan ->
--     «FALLO: 1 sin motivo (Mara Piedrahita)». Restaurada acto seguido.

-- 1 · La tabla existe y tiene RLS encendida.
select 'senal 1 · tabla con RLS' as senal,
       case when (select relrowsecurity from pg_class where oid = 'public.motivo_sin_plan'::regclass)
            then 'OK' else 'FALLO: RLS apagada' end as veredicto;

-- 2 · `anon` NO la puede leer. Es dato interno del coach.
select 'senal 2 · anon no lee' as senal,
       case when has_table_privilege('anon','public.motivo_sin_plan','select')
            then 'FALLO: anon tiene select' else 'OK' end as veredicto;

-- 3 · `authenticated` tiene el grant (la política decide después quién pasa).
select 'senal 3 · authenticated con grant' as senal,
       case when has_table_privilege('authenticated','public.motivo_sin_plan','select')
            then 'OK' else 'FALLO' end as veredicto;

-- 4 · Las cuatro políticas puestas.
select 'senal 4 · politicas' as senal,
       case when count(*) = 4 then 'OK (4)' else 'FALLO: ' || count(*) || ' politicas' end as veredicto
  from pg_policies where schemaname = 'public' and tablename = 'motivo_sin_plan';

-- 5 · LA QUE PROTEGE: nadie sin microciclo activo puede quedarse sin motivo. Si
--     esta se pone roja, la mesa del sábado está a punto de mezclar «inactivo a
--     propósito» con «cortado por no suministrar».
--     Nombra a quién le falta, porque «hay 1» no es accionable.
--
-- ⚠ EL PREDICADO NO ES `rol = 'asesorado'`, Y ASÍ NACIÓ ESTA SEÑAL EL 2026-09-05.
-- Ese mismo día se descubrió por qué está mal: **Manuela Quintero tiene
-- `rol = 'nutricionista'` y es asesorada a la vez** —microciclo activo, 68 % de
-- registro, 7 check-ins—. Con el filtro por rol, el día que se quedara sin plan
-- esta señal habría dicho OK, que es exactamente el falso verde que la señal
-- existe para impedir. Medido con señuelo: simulando que pierde su activo, el
-- predicado viejo NO la caza y el nuevo SÍ.
--
-- El de fondo es que el sistema tiene UN campo de rol, así que «es staff» y «es
-- asesorada» no se pueden decir a la vez. Mientras siga así, la pregunta que sí
-- se puede hacer es: **¿tuvo microciclos alguna vez, o no es staff?**
--
--   · tuvo microciclos  -> fue cliente, da igual su rol (caza a Manuela)
--   · no es staff       -> es un alta que aún no tiene el primero
--                          (`alta_sin_programar`)
--   · staff sin microciclos -> el coach: fuera, y correctamente
--
-- LÍMITE DECLARADO: a un miembro del staff que se dé de alta como asesorado y
-- todavía no tenga su primer microciclo, esto NO lo caza. No se puede, con un
-- solo campo de rol. Se dice aquí en vez de fingir que está cubierto.
select 'senal 5 · nadie sin plan se queda sin motivo' as senal,
       case when c.n = 0 then 'OK'
            else 'FALLO: ' || c.n || ' sin motivo (' || c.quienes || ')' end as veredicto
  from (
    select count(*) as n, coalesce(string_agg(u.nombre, ', '), '') as quienes
      from public.usuarios_app u
     where not exists (select 1 from public.microciclos m
                        where m.usuario_id = u.id and m.estado = 'activo')
       and ( exists (select 1 from public.microciclos m where m.usuario_id = u.id)
             or u.rol not in ('coach', 'nutricionista') )
       and not exists (select 1 from public.motivo_sin_plan s where s.usuario_id = u.id)
  ) c;

-- 6 · Informativa: cuántos hay de cada motivo. No es puerta.
select 'senal 6 · reparto' as senal,
       coalesce((select string_agg(motivo || '=' || n, ' · ' order by motivo)
                   from (select motivo, count(*) n from public.motivo_sin_plan group by 1) t),
                'ninguna fila') as veredicto;
