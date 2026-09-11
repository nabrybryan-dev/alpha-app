-- 0052 · La sesión lleva fecha
--
-- Medido el 2026-09-04 sobre la cartera entera: de 607 sesiones, el campo `dia`
-- estaba puesto en 312 y **ninguna era una fecha** — son «LUNES», «MARTES»,
-- «JUEVES». `dia` es el hueco de la semana que pidió el plan, no el día en que
-- la persona apareció.
--
-- Sin ese día no se puede emparejar el check-in de una mañana con la sesión de
-- esa tarde, que es el cruce del que vive la ondulación flexible intra-semana
-- (`src/domain/bucleDelDia.ts`, en sombra hasta que una corrida la avale). Hasta
-- hoy el único rastro fechado que dejaba el asesorado era `preparacion[].hechoEn`
-- y solo lo tienen 33 de las 107 sesiones activas: tres de cada cuatro días no
-- se pueden emparejar con nada.
--
-- ESTA FUNCIÓN ES TONTA, COMO SUS TRES HERMANAS DE 0037: el cliente calcula el
-- valor y ella solo lo coloca. Con una regla propia y una sola:
--
--   ESCRIBE UNA VEZ Y NO PISA. Si la sesión ya tiene `fecha`, no se toca. La
--   fecha es «el día en que esto empezó», y eso no cambia porque el jueves se
--   anote una serie que faltaba del martes. Ponerlo en el SQL además de en el
--   cliente no es duplicar la regla: es que la cola de sync reintenta, y un
--   reintento que llegue el jueves no puede reescribir el martes.
--
-- SEGURIDAD. `security invoker` (el defecto), así que manda la RLS de
-- `microciclos`. Y el `revoke` a `public, anon` NO es opcional: el proyecto trae
-- un `alter default privileges ... grant execute on functions to anon`, así que
-- cada función nueva nace ejecutable por la anon key por una vía distinta de
-- PUBLIC. Lo destapó la señal 3 de comprobar-0037.

begin;

create or replace function fijar_fecha_sesion(
  p_microciclo_id text,
  p_sesion_id text,
  p_fecha text
) returns void
language sql
as $$
  update microciclos m
  set datos = jsonb_set(m.datos, '{sesiones}', (
    select coalesce(jsonb_agg(
      case
        when s ->> 'id' = p_sesion_id and (s ->> 'fecha') is null and p_fecha is not null
          then jsonb_set(s, '{fecha}', to_jsonb(p_fecha))
        else s
      end
      order by orden_s
    ), '[]'::jsonb)
    from jsonb_array_elements(m.datos -> 'sesiones') with ordinality as ses(s, orden_s)
  ))
  where m.id = p_microciclo_id;
$$;

revoke execute on function fijar_fecha_sesion(text, text, text) from public, anon;
grant execute on function fijar_fecha_sesion(text, text, text) to authenticated;

commit;

-- Comprobación: supabase/comprobar-0052.sql
