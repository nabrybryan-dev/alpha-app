-- 0066 · El estado deja de vivir en dos sitios: se queda solo en la columna.
--
-- QUE ARREGLA. `microciclos.estado` (columna) y `microciclos.datos->>'estado'` (el blob)
-- guardaban el mismo dato. Dos fuentes de verdad no se sincronizan por disciplina:
-- divergen en silencio. El caso que lo obliga esta contado en `src/data/nube/hidratar.ts`
-- —un asesorado sin señal reabre con su cola un microciclo que el coach ya cerro— y la
-- 0021 ya blindo la columna. Esto retira la copia.
--
-- POR QUE LAS TRES PIEZAS VAN EN LA MISMA TRANSACCION. Por separado se deshacen solas:
--
--   1. `activar_microciclo` ESCRIBIA el estado en el blob (`jsonb_set`) en el cierre y en
--      la apertura. Limpiar sin tocarla deja la llave de vuelta en dos filas en la
--      siguiente activacion.
--   2. La limpieza de las filas que ya la llevan.
--   3. Un guardian que la quita en cada escritura. Sin el, basta UNA app vieja cacheada
--      en el movil de alguien —que las hay: el service worker no siempre se actualiza—
--      para volver a meterla, y nadie se entera.
--
-- COMPROBADO ANTES DE ESCRIBIR ESTO, contra la base real (2026-09-10):
--   · 155 filas, las 155 con la llave en el blob, y CERO en desacuerdo con la columna.
--     La copia es fiel, asi que no se pierde ningun dato al quitarla.
--   · La columna es NOT NULL y no tiene ni un nulo, asi que el `?? datos.estado` de
--     `microciclosDe()` no puede dispararse: nunca va a faltar el estado en pantalla.
--   · Ningun indice ni vista se apoya en `datos->>'estado'`.
--   · `mesa_del_sabado` y `ranking_disciplina_vivo` filtran por `m.estado` (la columna).
--     No se tocan.
--   · Los dos triggers de la tabla (`trg_actualizado_en`, `trg_proteger_estado_microciclo`)
--     no escriben en el blob.
--
-- COMO SE DESHACE, si hiciera falta: la columna manda y es fiel, asi que
--     update public.microciclos set datos = datos || jsonb_build_object('estado', estado);
-- reconstruye la llave exactamente como estaba. Antes hay que quitar el trigger de abajo,
-- que si no la vuelve a borrar.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · La activacion deja de escribir —y de leer— el blob
-- ─────────────────────────────────────────────────────────────────────────────
-- Se va tambien el `or datos->>'estado' = 'activo'` de los dos `where`. Era el cinturon
-- de la epoca en que el blob podia ir por delante; ahora es lo contrario: mantenerlo
-- haria que una fila con la llave residual —la que meteria una app vieja— se colase en
-- el recuento de activos y reventara la red de seguridad por un dato que ya no manda.
create or replace function public.activar_microciclo(p_propuesta_id text)
returns void
language plpgsql
as $function$
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

  -- Un bloque cerrado no se reabre.
  if v_estado = 'cerrado' then
    return;
  end if;

  -- CERRAR PRIMERO Y ABRIR DESPUES, dentro de la misma transaccion.
  update public.microciclos
     set estado = 'cerrado'
   where usuario_id = v_uid
     and id <> p_propuesta_id
     and estado = 'activo';

  update public.microciclos
     set estado = 'activo'
   where id = p_propuesta_id;

  -- Red de seguridad: despues de esto tiene que quedar exactamente uno activo.
  select count(*) into v_activos
    from public.microciclos
   where usuario_id = v_uid
     and estado = 'activo';

  if v_activos <> 1 then
    raise exception 'activar_microciclo: quedaron % activos para el usuario %',
                    v_activos, v_uid;
  end if;
end;
$function$;

-- Los permisos se re-declaran identicos a los que ya tenia (medidos: postgres, authenticated
-- y service_role, sin `public` ni `anon`). `create or replace` los conserva, asi que esto no
-- cambia nada en esta base; esta escrito para que una base creada desde cero salga igual.
revoke all on function public.activar_microciclo(text) from public, anon;
grant execute on function public.activar_microciclo(text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · El guardian: la llave no vuelve a entrar, la escriba quien la escriba
-- ─────────────────────────────────────────────────────────────────────────────
-- Va ANTES de la limpieza a proposito. Si fuera al reves, una escritura que entrara
-- entre los dos pasos dejaria la llave puesta y la migracion saldria verde mintiendo.
create or replace function public.sin_estado_en_el_blob()
returns trigger
language plpgsql
as $$
begin
  if jsonb_exists(new.datos, 'estado') then
    new.datos := new.datos - 'estado';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sin_estado_en_el_blob on public.microciclos;
create trigger trg_sin_estado_en_el_blob
  before insert or update on public.microciclos
  for each row execute function public.sin_estado_en_el_blob();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Las filas que ya la llevan
-- ─────────────────────────────────────────────────────────────────────────────
update public.microciclos
   set datos = datos - 'estado'
 where jsonb_exists(datos, 'estado');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · No se da por buena: se comprueba aqui dentro
-- ─────────────────────────────────────────────────────────────────────────────
-- Si algo de lo de arriba no hizo lo que dice, esta transaccion no llega a confirmarse.
do $$
declare
  v_sucias int;
  v_sin_columna int;
begin
  select count(*) into v_sucias
    from public.microciclos where jsonb_exists(datos, 'estado');
  if v_sucias <> 0 then
    raise exception '0066: quedan % filas con estado dentro del blob', v_sucias;
  end if;

  select count(*) into v_sin_columna
    from public.microciclos where estado is null;
  if v_sin_columna <> 0 then
    raise exception '0066: % filas se quedaron sin estado en la columna', v_sin_columna;
  end if;
end;
$$;
