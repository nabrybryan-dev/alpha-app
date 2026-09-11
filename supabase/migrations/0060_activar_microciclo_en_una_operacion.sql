-- ============================================================================
-- 0060 · Activar un microciclo es UNA operación, no dos
-- ============================================================================
--
-- QUÉ FALLABA. Activar la propuesta de alguien son hoy dos escrituras sueltas que
-- el cliente encola por separado (`sync.ts`): primero *abrir* la nueva, después
-- *cerrar* la vieja. Ese orden es deliberado y su comentario lo explica — al revés,
-- si la cola se corta entre las dos, el asesorado abre la app **sin programación**—.
-- Pero deja una ventana con DOS microciclos activos, y esa ventana es real: la cola
-- drena de una en una, y entre las dos operaciones cabe una pérdida de señal.
--
-- POR QUÉ AHORA. `R-01` quiere un índice único parcial que impida dos activos por
-- persona. Medido el 2026-09-10: ese índice **se puede crear** (0 personas con dos
-- activos hoy) pero **no se puede vivir con él** mientras activar sea dos pasos,
-- porque un índice único NO SE DIFIERE —Postgres solo difiere restricciones, y una
-- restricción única no puede ser parcial— así que el choque salta en la sentencia,
-- no en el `commit`. Con el índice puesto y este arreglo sin hacer:
--
--   · la carga semanal del coach abortaría para las 24 personas con activo;
--   · desde la app, el *abrir* fallaría, se reintentaría 8 veces (`cola.ts`,
--     `MAX_INTENTOS`), se apartaría, y entonces sí correría el *cerrar*: la persona
--     se quedaría con CERO activos, justo lo que ese comentario evitaba.
--
-- Con esta función, cerrar y abrir ocurren dentro de la misma transacción: no hay
-- instante con dos, ni instante con cero, ni cola a medias que deje un estado raro.
-- Es cambiar la bombona de golpe en vez de aflojar una y luego apretar la otra.
--
-- QUÉ HACE, Y POR QUÉ ES IDEMPOTENTE. Cierra TODOS los activos de esa persona
-- —todos, no uno: si ya había dos, esto lo repara en vez de heredar el estado
-- roto, igual que `mockDb.activarPropuesta`— y deja activo el que se le pide.
--
--   · `propuesto` → se activa. Es el caso normal.
--   · `activo`    → se re-afirma y se cierran los demás. Esto es lo que hace que un
--                   reintento de la cola sea inofensivo: si el servidor ya lo aplicó
--                   y el móvil no llegó a enterarse, la segunda llamada no falla.
--   · `cerrado`   → NO SE TOCA NADA. Reabrir un bloque cerrado no es activar, es
--                   resucitar; y el cliente tampoco lo hace.
--
-- POR QUÉ NO LEVANTA EXCEPCIÓN EN EL CASO `cerrado`. Porque una excepción aquí
-- viaja por la cola: se reintentaría 8 veces y acabaría descartada, y por el camino
-- **la cola se para en el primer fallo** y ese teléfono deja de subir también las
-- series. La misma razón por la que el trigger de la `0021` conserva el estado en
-- silencio en vez de rechazar la escritura entera.
--
-- SEGURIDAD. `security invoker` (el defecto), así que la RLS de `microciclos`
-- sigue mandando: `usuario_id = auth.uid() or es_coach()`. Y el permiso sobre el
-- estado se comprueba igual que en el trigger de la `0021` —`auth.uid()` nulo es
-- contexto de servicio y pasa; una sesión de usuario que no sea staff, no—, para
-- que las dos piezas no digan cosas distintas sobre quién decide el estado.
--
-- Comprobación: `supabase/comprobar-0060.sql`, con su ensayo de verlo morder.
-- ============================================================================

begin;

create or replace function public.activar_microciclo(p_propuesta_id text)
returns void
language plpgsql
as $$
declare
  v_uid    uuid;
  v_estado text;
  v_activos int;
begin
  select usuario_id, estado into v_uid, v_estado
    from public.microciclos
   where id = p_propuesta_id;

  -- Sin fila no hay nada que activar. No es un error del que reintentar sirva.
  if v_uid is null then
    return;
  end if;

  if auth.uid() is not null and not public.es_staff() then
    raise exception 'activar_microciclo: el estado del microciclo lo decide el staff'
      using errcode = '42501';
  end if;

  -- Un bloque cerrado no se reabre. Ver la cabecera: callar aquí es deliberado.
  if v_estado = 'cerrado' then
    return;
  end if;

  -- CERRAR PRIMERO Y ABRIR DESPUÉS, dentro de la misma transacción. El orden
  -- importa para el índice único de `R-01`: al revés habría un instante con dos
  -- activos y la sentencia chocaría. Aquí nadie ve el hueco, porque no hay hueco:
  -- fuera de la transacción las dos cosas ocurren a la vez.
  update public.microciclos
     set estado = 'cerrado',
         datos  = jsonb_set(datos, '{estado}', '"cerrado"')
   where usuario_id = v_uid
     and id <> p_propuesta_id
     and (estado = 'activo' or datos->>'estado' = 'activo');

  -- La columna Y el JSON, siempre las dos. El 2026-08-16 aparecieron 18
  -- microciclos con la columna en `cerrado` y el JSON en `activo`, de 17
  -- asesorados, porque una carga vieja cerró solo la columna.
  update public.microciclos
     set estado = 'activo',
         datos  = jsonb_set(datos, '{estado}', '"activo"')
   where id = p_propuesta_id;

  -- Red de seguridad: después de esto tiene que quedar exactamente uno activo. Si
  -- no, se revienta la transacción entera en vez de dejar el estado roto puesto.
  -- Es la misma que lleva `plantilla-carga-microciclo.sql`.
  select count(*) into v_activos
    from public.microciclos
   where usuario_id = v_uid
     and (estado = 'activo' or datos->>'estado' = 'activo');

  if v_activos <> 1 then
    raise exception 'activar_microciclo: quedaron % activos para el usuario %',
                    v_activos, v_uid;
  end if;
end;
$$;

-- `create function` concede EXECUTE a PUBLIC, y todo lo de `public` queda expuesto
-- como RPC a la clave anónima. Sin este revoke, cualquiera con la anon key podría
-- llamarla; la RLS le pararía las escrituras, pero la puerta estaría abierta.
revoke execute on function public.activar_microciclo(text) from public, anon;
grant  execute on function public.activar_microciclo(text) to authenticated;

comment on function public.activar_microciclo(text) is
  'R-02 · cierra los activos de la persona y abre la propuesta en una sola '
  'transaccion. Sin esto, el indice unico parcial de R-01 no se puede aplicar.';

commit;
