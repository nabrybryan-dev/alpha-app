-- ============================================================================
-- 0170 · El interruptor de la regla de ventana, en la consola: leer su estado y apagarla
-- ============================================================================
--
-- Va después de la 0141 (regla de ventana) y la 0143 (encender_regla_ventana con registro).
-- NO enciende nada: la regla sigue como esté (hoy, apagada). Solo añade lo que la consola
-- necesita para enseñar el interruptor con verdad:
--
--   · estado_regla_ventana()        cualquier staff: si está encendida y el ÚLTIMO cambio
--                                    (encendida/apagada, quién, cuándo, nota). Las tablas
--                                    `regla_ventana_primer_plan` y `cambios_regla_ventana` no
--                                    son legibles desde `authenticated` (0141/0143) y así siguen.
--   · apagar_regla_ventana(p_nota)  la pareja de `encender_regla_ventana`, con la MISMA puerta
--                                    (sesión + staff + capacidad `encender_regla_ventana`). La
--                                    0143 dejaba el apagado solo al SQL Editor.
--
-- QUÉ HACE LA REGLA (leído de la base con pg_get_functiondef el 7-nov-2026; esta migración
-- no toca `vencer_primer_plan` ni `activar_por_regla_ventana`): cuando vence el plazo de un
-- primer plan `propuesto` sin que nadie lo firme, se activa solo si TODO esto se cumple:
-- riesgo bajo o medio, clasificado por el sistema, sin dudas pendientes, sin «requiere
-- revisión», el microciclo sigue propuesto y su contenido es el mismo que se clasificó (huella).
-- Riesgo alto nunca pasa solo. Lo que no cumple va a `espera_bryan` con su motivo.
--
-- El cambio queda anotado por el disparador de la 0143 (`cambios_regla_ventana`), igual que
-- el encendido: la nota viaja en `alpha.nota_regla`.
--
-- Reversa: drop function public.estado_regla_ventana(); drop function public.apagar_regla_ventana(text);

begin;

create or replace function public.estado_regla_ventana()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_regla public.regla_ventana_primer_plan;
  v_cambio jsonb;
begin
  if auth.uid() is null then
    raise exception 'estado_regla_ventana: se requiere sesion' using errcode = '42501';
  end if;
  if not public.es_staff() then
    raise exception 'estado_regla_ventana: solo el staff' using errcode = '42501';
  end if;
  select * into v_regla from public.regla_ventana_primer_plan limit 1;
  select jsonb_build_object(
           'activa_despues', c.activa_despues,
           'hecho_por', c.hecho_por,
           'hecho_por_nombre', u.nombre,
           'hecho_en', c.hecho_en,
           'nota', c.nota)
    into v_cambio
    from public.cambios_regla_ventana c
    left join public.usuarios_app u on u.id = c.hecho_por
   order by c.hecho_en desc, c.id desc
   limit 1;
  return jsonb_build_object(
    'activa', coalesce(v_regla.activa, false),
    'actualizada_en', v_regla.actualizada_en,
    'ultimo_cambio', v_cambio);
end;
$$;

create or replace function public.apagar_regla_ventana(p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_antes boolean;
begin
  if v_uid is null then
    raise exception 'apagar_regla_ventana: se requiere sesion' using errcode = '42501';
  end if;
  if not public.es_staff() then
    raise exception 'apagar_regla_ventana: solo el staff' using errcode = '42501';
  end if;
  if not public.tiene_capacidad('encender_regla_ventana') then
    raise exception 'apagar_regla_ventana: falta la capacidad de encender/apagar' using errcode = '42501';
  end if;
  select activa into v_antes from public.regla_ventana_primer_plan;
  perform set_config('alpha.nota_regla', coalesce(left(p_nota, 500), ''), true);
  update public.regla_ventana_primer_plan set activa = false, actualizada_en = clock_timestamp() where id;
  return jsonb_build_object('activa_antes', v_antes, 'activa', false, 'por', v_uid, 'en', clock_timestamp());
end;
$$;

revoke all on function public.estado_regla_ventana() from public, anon;
revoke all on function public.apagar_regla_ventana(text) from public, anon;
grant execute on function public.estado_regla_ventana() to authenticated, service_role;
grant execute on function public.apagar_regla_ventana(text) to authenticated, service_role;

commit;
