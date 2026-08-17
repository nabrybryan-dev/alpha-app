-- 0037 · Escrituras quirúrgicas de microciclo
--
-- El asesorado dejaba de subir el blob entero de su microciclo cada vez que
-- registraba una serie. Eso pisó la migración 0036 el mismo día que se aplicó:
-- `m-jacobo-2` volvió entero a la taxonomía vieja porque el móvil de Jacobo
-- subió su copia local, con las categorías de antes, encima de la migrada.
--
-- PostgREST no sabe escribir dentro de un JSONB, así que para tocar una rama de
-- `microciclos.datos` sin mandar el resto hace falta que el servidor haga el
-- `jsonb_set`. Estas tres funciones son eso y nada más.
--
-- SON TONTAS A PROPÓSITO. El cliente calcula el valor y ellas solo lo colocan.
-- `marcarParte` es un interruptor que además materializa la plantilla de
-- calentamiento si falta, y `registrarSerie` reemplaza por `orden` y reordena:
-- repetir esas reglas en SQL sería tenerlas escritas dos veces, y dos copias de
-- una regla divergen. Que es justo el fallo que esto arregla.
--
-- SEGURIDAD. Las tres son `security invoker` (el defecto), así que la RLS de
-- `microciclos` sigue mandando: `usuario_id = auth.uid() or es_coach()`. Nadie
-- toca lo que no es suyo por llamar a una función. Y llevan su `revoke`, porque
-- `create function` concede EXECUTE a PUBLIC y todo lo de `public` queda
-- expuesto como RPC a la anon key.
--
-- Ver `docs/specs/2026-08-15-subir-solo-lo-que-cambia.md`.

begin;

-- Las series de UN ejercicio, dejando el resto del microciclo intacto.
create or replace function fijar_series_ejercicio(
  p_microciclo_id text,
  p_ejercicio_id text,
  p_series jsonb
) returns void
language sql
as $$
  update microciclos m
  set datos = jsonb_set(m.datos, '{sesiones}', (
    select coalesce(jsonb_agg(
      case
        when jsonb_typeof(s -> 'ejercicios') = 'array' then jsonb_set(s, '{ejercicios}', (
          select coalesce(jsonb_agg(
            case when e ->> 'id' = p_ejercicio_id
              then jsonb_set(e, '{series}', coalesce(p_series, '[]'::jsonb))
              else e
            end
            order by orden_e
          ), '[]'::jsonb)
          from jsonb_array_elements(s -> 'ejercicios') with ordinality as ejs(e, orden_e)
        ))
        else s
      end
      order by orden_s
    ), '[]'::jsonb)
    from jsonb_array_elements(m.datos -> 'sesiones') with ordinality as ses(s, orden_s)
  ))
  where m.id = p_microciclo_id;
$$;

-- El test posterior de UNA sesión.
create or replace function fijar_test_post(
  p_microciclo_id text,
  p_sesion_id text,
  p_test jsonb
) returns void
language sql
as $$
  update microciclos m
  set datos = jsonb_set(m.datos, '{sesiones}', (
    select coalesce(jsonb_agg(
      case when s ->> 'id' = p_sesion_id
        then jsonb_set(s, '{testPost}', coalesce(p_test, 'null'::jsonb))
        else s
      end
      order by orden_s
    ), '[]'::jsonb)
    from jsonb_array_elements(m.datos -> 'sesiones') with ordinality as ses(s, orden_s)
  ))
  where m.id = p_microciclo_id;
$$;

-- El calentamiento y el cardio de UNA sesión.
--
-- Un `null` en cualquiera de los dos significa «esta sesión no tiene esa clave»,
-- no «bórrala a la fuerza»: por eso se quita la clave en vez de escribir null.
-- La diferencia importa porque `marcarParte` materializa `preparacion` desde una
-- plantilla, y una sesión de cardio no tiene `preparacion` en absoluto.
create or replace function fijar_preparacion_sesion(
  p_microciclo_id text,
  p_sesion_id text,
  p_preparacion jsonb,
  p_bloques_cardio jsonb
) returns void
language sql
as $$
  update microciclos m
  set datos = jsonb_set(m.datos, '{sesiones}', (
    select coalesce(jsonb_agg(
      case when s ->> 'id' = p_sesion_id
        then (
          case when p_bloques_cardio is null
            then (case when p_preparacion is null then s - 'preparacion'
                       else jsonb_set(s, '{preparacion}', p_preparacion) end) - 'bloquesCardio'
            else jsonb_set(
                   case when p_preparacion is null then s - 'preparacion'
                        else jsonb_set(s, '{preparacion}', p_preparacion) end,
                   '{bloquesCardio}', p_bloques_cardio)
          end
        )
        else s
      end
      order by orden_s
    ), '[]'::jsonb)
    from jsonb_array_elements(m.datos -> 'sesiones') with ordinality as ses(s, orden_s)
  ))
  where m.id = p_microciclo_id;
$$;

-- OJO: revocar solo a `public` NO basta en Supabase. El proyecto trae
--   alter default privileges in schema public grant execute on functions to anon
-- así que cada función nueva nace ejecutable por la anon key por una vía distinta
-- de PUBLIC, y el revoke a public no la toca. Lo destapó la señal 3 de
-- comprobar-0037 nada más aplicar esta migración.
revoke execute on function fijar_series_ejercicio(text, text, jsonb) from public, anon;
revoke execute on function fijar_test_post(text, text, jsonb) from public, anon;
revoke execute on function fijar_preparacion_sesion(text, text, jsonb, jsonb) from public, anon;

grant execute on function fijar_series_ejercicio(text, text, jsonb) to authenticated;
grant execute on function fijar_test_post(text, text, jsonb) to authenticated;
grant execute on function fijar_preparacion_sesion(text, text, jsonb, jsonb) to authenticated;

commit;

-- Comprobación: las tres existen, ninguna la puede llamar `anon`, y ninguna es
-- `security definer` (si lo fuera, se saltaría la RLS y cualquiera podría
-- escribir en el microciclo de otro).
--   supabase/comprobar-0037.sql
