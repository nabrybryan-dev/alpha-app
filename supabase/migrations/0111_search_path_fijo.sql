-- ============================================================================
-- 0111 · Siete funciones de `public` reciben su `search_path` fijo
-- ============================================================================
--
-- QUÉ RESUELVE. El asesor de seguridad de Supabase marca «function_search_path_mutable» desde el
-- 30-sep. Una función sin `set search_path` resuelve los nombres sin esquema con la ruta de QUIEN
-- LA LLAMA. Si alguien puede crear objetos en un esquema que vaya antes en esa ruta, puede
-- suplantar una tabla o una función que la nuestra usa. Las `security definer` del repo ya
-- llevaban ruta fija (`GUIA-BRYAN.md` §10); quedaban estas siete, todas `security invoker`:
--
--   activar_microciclo(text)                              0060
--   fijar_fecha_sesion(text, text, text)                  0052
--   fijar_preparacion_sesion(text, text, jsonb, jsonb)    0037
--   fijar_series_ejercicio(text, text, jsonb)             0037
--   fijar_test_post(text, text, jsonb)                    0037
--   mesa_del_sabado()                                     0054 / 0055 / 0075
--   sin_estado_en_el_blob()  (trigger)                    0066
--
-- POR QUÉ `public` Y NO ''. Ninguna usa nada de fuera de `public` sin nombrarlo: las referencias
-- a otros esquemas ya van completas (`auth.uid()`), y las funciones del sistema (`now()`,
-- `jsonb_*`) viven en `pg_catalog`, que se busca siempre. Comprobado el 4-oct leyendo el cuerpo
-- de las siete en una base con las 110 migraciones. Con `public` se comportan igual que hoy para
-- cualquier llamador normal; solo dejan de poder ser engañadas.
--
-- NO CAMBIA NINGÚN PERMISO NI NINGÚN CUERPO: solo la ruta. `alter function … set` no toca el
-- `grant` ni el `security invoker`.
--
-- TOLERANTE A LO QUE HAYA EN PRODUCCIÓN. El panel contaba 4 funciones; el repo, 7. Las migraciones
-- se aplican a mano, así que alguna puede no existir allí. La que no exista se salta y se avisa
-- con un NOTICE, en vez de abortar todo.
--
-- CÓMO COMPROBARLO. Tras aplicarla: `comprobar-migraciones.sql`, fila «0111 - …», en SI. En el
-- panel de Supabase, Advisors → Security: el aviso «Function Search Path Mutable» debe desaparecer
-- para estas funciones. La prueba `supabase/test/213-search-path-fijo.sql` lo exige en el CI.
--
-- APLICACIÓN. Se aplica a mano en el SQL Editor, con la casilla de Bryan (D-2). No la necesita
-- ningún código: se puede aplicar antes o después de fusionar el PR.
-- ============================================================================

begin;

do $$
declare
  f text;
  funciones text[] := array[
    'public.activar_microciclo(text)',
    'public.fijar_fecha_sesion(text, text, text)',
    'public.fijar_preparacion_sesion(text, text, jsonb, jsonb)',
    'public.fijar_series_ejercicio(text, text, jsonb)',
    'public.fijar_test_post(text, text, jsonb)',
    'public.mesa_del_sabado()',
    'public.sin_estado_en_el_blob()'
  ];
begin
  foreach f in array funciones loop
    if to_regprocedure(f) is null then
      raise notice '0111: % no existe en esta base; se salta', f;
    else
      execute format('alter function %s set search_path = public', f);
    end if;
  end loop;
end $$;

commit;
