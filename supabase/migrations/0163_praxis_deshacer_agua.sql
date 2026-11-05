-- ============================================================================
-- 0163 · Praxis: `praxis_deshacer` también deshace el AGUA
-- ============================================================================
--
-- SIN APLICAR, espera visto bueno de Bryan. Escrita el 5-nov-2026 (paso D4 del plano
-- CONEXIONES-OPERATIVAS-PRAXIS-20261104). La prueba `supabase/test/263-praxis-deshacer-agua.sql` corre en el CI
-- sobre base vacía. Necesita la 0161 y la 0162 (ya aplicadas en la base real; NO se editan).
--
-- NÚMERO. 0163 = el siguiente libre. Revisadas el 5-nov las migraciones de TODAS las ramas locales y remotas
-- (`git fetch`; `git ls-tree -r --name-only <rama> -- supabase/migrations` sobre cada una de `git branch -a`,
-- 365 refs): ninguna pasa de 0162. Si otra rama toma el 0163 antes de aplicar esta, renumerar esta.
--
-- QUÉ CAMBIA. Una sola cosa: `create or replace function public.praxis_deshacer(uuid, text, boolean)` con una
-- rama nueva `agua`. La firma, el tipo de retorno, `security definer`, `search_path` y los permisos son los de
-- la 0162; las ramas `series` y `adherencia` quedan IDÉNTICAS. Ninguna tabla ni dato se toca al aplicarla.
--
-- REGLAS DE LA RAMA `agua` (las mismas del resto: solo lo propio, mismo día de Bogotá desde `creado_en`,
-- con `p_confirmado = true`, dos veces = una; todo eso ya lo hace el tronco de la función, antes de la rama).
--   · Revalida: el total de la fila de `hidratacion` de esa fecha debe ser EXACTAMENTE el `despues.ml` del
--     libro. Si ya es otro (otra tarjeta, la app, o la fila desapareció) NO toca nada y devuelve
--     `deshecho = false, motivo = 'cambio_despues'`. Es estricto a propósito: restar solo el delta sería
--     «mover» el total de una persona que ya sumó después; mejor no pisar.
--   · Revierte FIJANDO el total al `antes.ml` (no restando): igual de exacto cuando el total coincide y
--     inmune a redondeos. Nunca puede pasar de 10000 mL porque solo baja (el `antes` es ≤ el `despues` ≤ 10000;
--     igual se valida que el `antes` esté entre 0 y 10000).
--   · `antes` nulo (la fila del día no existía; la creó esta tarjeta): se deja el día en 0 mL y la FILA SE
--     QUEDA. Se eligió 0 y no borrar porque (a) la app lee `hidratacion` por `(usuario, fecha)` con
--     `ml ?? 0` (`hidratar.ts`), así que 0 y «sin fila» se ven igual en pantalla; (b) el sync de la app
--     SUBE su total local con upsert: si se borra la fila en la nube y la app aún tiene el valor viejo en el
--     teléfono, lo vuelve a subir y el agua «revive»; con una fila en 0 el siguiente baja el 0 y la app
--     lo muestra bien; (c) la tabla tiene `check (ml >= 0)`, así que 0 es válido; (d) es el único caso donde el
--     borrado de adherencia sí es seguro (nadie más guarda una fila ahí); en el agua la app también escribe
--     la misma fila, y borrar una fila compartida es más arriesgado que ponerla a 0.
--
-- CÓMO REVERTIRLA (vuelve a la definición de la 0162; lo ya deshecho en el libro no se rehace):
--   Pegar de nuevo, tal cual, el bloque «4 · Deshacer» de `0162_praxis_libro_series_adherencia_y_deshacer.sql`
--   (el `create or replace function public.praxis_deshacer` + su `comment` + `revoke`/`grant`). Con eso el
--   agua vuelve a rechazarse con «el tipo agua todavia no se puede deshacer». No hace falta `drop`.
--
-- QUÉ DEBE REVISAR BRYAN antes de aplicarla: ver «Para revisión» al final de este archivo.
-- ============================================================================

begin;

create or replace function public.praxis_deshacer(
  p_registro_id uuid,
  p_mensaje_id  text,
  p_confirmado  boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_hoy     date := (now() at time zone 'America/Bogota')::date;
  v_mensaje text := btrim(p_mensaje_id);
  v_reg     public.praxis_registros_aplicados%rowtype;
  v_mc      text;
  v_ej      text;
  v_fecha   date;
  v_estado  text;
  v_coment  text;
  v_hay     boolean;
  v_ml      int;
  v_antes_ml int;
begin
  if v_uid is null then
    raise exception 'praxis_deshacer: hace falta una sesion' using errcode = '42501';
  end if;
  if v_mensaje is null or length(v_mensaje) not between 1 and 120 then
    raise exception 'praxis_deshacer: mensaje_id invalido' using errcode = '22023';
  end if;
  if p_confirmado is distinct from true then
    raise exception 'praxis_deshacer: hace falta la confirmacion de la persona' using errcode = '22023';
  end if;

  -- Solo el dueño. Si no existe o es de otra persona, el mismo mensaje (no se revela cuál de las dos).
  select * into v_reg from public.praxis_registros_aplicados r
   where r.id = p_registro_id and r.usuario_id = v_uid
   for update;
  if not found then
    raise exception 'praxis_deshacer: ese registro no existe o no es tuyo' using errcode = '42501';
  end if;

  if v_reg.deshecho_en is not null then
    return jsonb_build_object('deshecho', false, 'ya_deshecho', true, 'registro_id', v_reg.id);
  end if;

  if (v_reg.creado_en at time zone 'America/Bogota')::date <> v_hoy then
    raise exception 'praxis_deshacer: ese registro es de otro dia (Bogota); corrigelo con el valor correcto' using errcode = '22023';
  end if;

  if v_reg.tipo = 'series' then
    v_mc := v_reg.ref ->> 'microciclo_id';
    v_ej := v_reg.ref ->> 'ejercicio_id';
    perform 1 from public.microciclos m where m.id = v_mc and m.usuario_id = v_uid for update;
    if not found
       or public.praxis_series_actuales(v_mc, v_ej) is distinct from (v_reg.despues -> 'series') then
      return jsonb_build_object('deshecho', false, 'motivo', 'cambio_despues', 'registro_id', v_reg.id);
    end if;
    perform public.fijar_series_ejercicio(v_mc, v_ej, v_reg.antes -> 'series');

  elsif v_reg.tipo = 'adherencia' then
    v_fecha := (v_reg.ref ->> 'fecha')::date;
    perform pg_advisory_xact_lock(hashtext(v_reg.ref ->> 'fila_id'));
    select a.estado, a.comentario into v_estado, v_coment
      from public.adherencias a where a.usuario_id = v_uid and a.fecha = v_fecha;
    v_hay := found;
    if not v_hay
       or jsonb_build_object('estado', v_estado, 'comentario', v_coment) is distinct from v_reg.despues then
      return jsonb_build_object('deshecho', false, 'motivo', 'cambio_despues', 'registro_id', v_reg.id);
    end if;
    if v_reg.antes is null then
      delete from public.adherencias where usuario_id = v_uid and fecha = v_fecha;
    else
      update public.adherencias
         set estado = v_reg.antes ->> 'estado', comentario = v_reg.antes ->> 'comentario'
       where usuario_id = v_uid and fecha = v_fecha;
    end if;

  elsif v_reg.tipo = 'agua' then
    -- Agua (0163). La fila del dia se toca con bloqueo de fila; el total de hoy debe seguir siendo el `despues`.
    select h.ml into v_ml from public.hidratacion h
     where h.usuario_id = v_uid and h.fecha = (v_reg.ref ->> 'fecha')::date
     for update;
    v_hay := found;
    if not v_hay or v_ml is distinct from (v_reg.despues ->> 'ml')::int then
      return jsonb_build_object('deshecho', false, 'motivo', 'cambio_despues', 'registro_id', v_reg.id);
    end if;
    -- `antes` nulo = la fila no existia: el dia vuelve a 0 (la fila queda; ver cabecera). Nunca pasa de 10000.
    v_antes_ml := coalesce((v_reg.antes ->> 'ml')::int, 0);
    if v_antes_ml not between 0 and 10000 then
      raise exception 'praxis_deshacer: el antes del agua no es valido' using errcode = '22023';
    end if;
    update public.hidratacion
       set ml = v_antes_ml, actualizado_en = now()
     where usuario_id = v_uid and fecha = (v_reg.ref ->> 'fecha')::date;

  else
    raise exception 'praxis_deshacer: el tipo % todavia no se puede deshacer', v_reg.tipo using errcode = '22023';
  end if;

  update public.praxis_registros_aplicados
     set deshecho_en = now(), deshecho_mensaje_id = v_mensaje
   where id = v_reg.id;

  return jsonb_build_object('deshecho', true, 'ya_deshecho', false, 'registro_id', v_reg.id, 'tipo', v_reg.tipo);
end
$$;

comment on function public.praxis_deshacer(uuid, text, boolean) is
  'Revierte UN registro del libro de quien llama, solo el mismo dia de Bogota, con confirmacion, si lo guardado sigue igual al despues; marca deshecho_en y deshecho_mensaje_id. Series, adherencia (0162) y agua (0163).';

revoke execute on function public.praxis_deshacer(uuid, text, boolean) from public, anon;
grant execute on function public.praxis_deshacer(uuid, text, boolean) to authenticated, service_role;

commit;

-- ============================================================================
-- Para revisión de Bryan
--   1. Agua sin fila previa: se deja el día en 0 mL con la fila viva (no se borra). Razón arriba. Si prefiere
--      borrar la fila, es un `delete` en vez del `update` de la rama `agua`.
--   2. Si el total del día ya no es el que dejó la tarjeta (sumó otra después, o la app lo cambió), NO se deshace
--      y se avisa `cambio_despues`. Consecuencia: «deshaz lo del agua» sobre una tarjeta vieja del día, con otra
--      encima, se rechaza; hay que deshacer primero la más reciente.
--   3. Mismo día de Bogotá contado desde `creado_en` (decisión de Bryan, 5-nov). Techo de 10000 mL: no aplica al
--      deshacer (solo baja).
--   4. La Edge Function `praxis-registro` y la pantalla NO se tocaron: hoy filtran series y adherencia
--      (ver el informe del paso D4). Hasta cambiarlos, esta rama no se alcanza desde el chat.
--   5. Aplicar: pegar este archivo en el SQL Editor; luego `comprobar-migraciones.sql`: la señal '0163' debe dar SI.
-- ============================================================================
