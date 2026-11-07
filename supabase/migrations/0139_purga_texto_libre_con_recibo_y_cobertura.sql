-- 0139: Plan B de la purga del texto libre de las alertas de la puerta (casos P1-P7 de C2). PROPUESTA, NO APLICADA (I-16).
-- Problema: 0128 trae la funcion de purga pero NADIE la ejecuta (no hay cron aqui) y un contador en cero no prueba nada. Este plan B no promete un scheduler:
--   1. ejecutar_purga_texto_libre(operador): UNICA via de purga para service_role; reloj SOLO del servidor; deja un RECIBO (hora, version, operador, conteos antes/despues y control positivo).
--   2. estado_cobertura_purga(max_retraso): VERIFICADA solo con recibo reciente, resultado verificado y cero vencidos fisicamente presentes; si no, NO_VERIFICADA con el motivo.
--      Un job registrado no cuenta: lo que cuenta es el recibo y lo que hay en la tabla. Si el cron o el host alterno se retira, el recibo envejece y el estado cae a NO_VERIFICADA.
--   3. texto_vigente_alerta_puerta(alerta) / texto_vigente_por_ingreso(ingreso): la lectura niega el texto vencido por reloj del servidor aunque la limpieza fisica se retrase (inaccesible != suprimido).
--   4. se quita a service_role la purga con reloj arbitrario (purgar_texto_libre_alerta_puerta(timestamptz)): quien purga es ejecutar_purga_texto_libre.
-- Reversa: ver reversa-0116-0139. No borra texto ni recibos de otras migraciones.
begin;

create table public.purgas_texto_libre (
  id uuid primary key default gen_random_uuid(),
  ejecutada_en timestamptz not null default clock_timestamp(),
  version text not null,
  operador text not null check (length(btrim(operador)) > 0),
  rol_bd text not null default current_user,
  vencidos_antes integer not null,
  borrados integer not null,
  vencidos_despues integer not null,
  vigentes_antes integer not null,
  vigentes_despues integer not null,
  resultado text not null check (resultado in ('VERIFICADA', 'FALLO_PARCIAL', 'CONTROL_POSITIVO_FALLIDO'))
);
alter table public.purgas_texto_libre enable row level security;
revoke all on public.purgas_texto_libre from anon, public, authenticated;
grant select on public.purgas_texto_libre to service_role;

-- Fuente UNICA de "vencido": el mismo predicado que usa purgar_texto_libre_alerta_puerta en 0129 (atendida con retencion cumplida, tope absoluto con alerta,
-- o texto sin alerta con retencion cumplida). Si 0129 cambia la purga, esta funcion y la purga deben cambiar juntas.
create function public.texto_libre_vencido(t public.texto_libre_alerta_puerta, p_ahora timestamptz)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    (t.alerta_id is not null and exists (select 1 from public.cola_alerta_puerta c
                                          where c.alerta_id = t.alerta_id and c.estado = 'ATENDIDA' and c.retener_hasta <= p_ahora))
    or (t.alerta_id is not null and t.tope_hasta <= p_ahora)
    or (t.alerta_id is null and t.retener_hasta <= p_ahora), false);
$$;
revoke all on function public.texto_libre_vencido(public.texto_libre_alerta_puerta, timestamptz) from public, anon, authenticated;

create function public.contar_texto_libre_alerta_puerta(p_ahora timestamptz, p_vencido boolean)
returns integer language sql stable security definer set search_path = public
as $$
  select count(*)::integer from public.texto_libre_alerta_puerta t
   where t.contenido is not null and public.texto_libre_vencido(t, p_ahora) = p_vencido;
$$;
revoke all on function public.contar_texto_libre_alerta_puerta(timestamptz, boolean) from public, anon, authenticated;

create function public.ejecutar_purga_texto_libre(p_operador text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_ahora timestamptz := clock_timestamp();
  v_va integer; v_vig_a integer; v_b integer; v_vd integer; v_vig_d integer; v_res text;
begin
  if p_operador is null or length(btrim(p_operador)) = 0 then
    raise exception 'ejecutar_purga_texto_libre: se exige el nombre del operador o del job' using errcode = '22023';
  end if;
  v_va := public.contar_texto_libre_alerta_puerta(v_ahora, true);
  v_vig_a := public.contar_texto_libre_alerta_puerta(v_ahora, false);
  v_b := public.purgar_texto_libre_alerta_puerta(v_ahora);
  v_vd := public.contar_texto_libre_alerta_puerta(v_ahora, true);
  v_vig_d := public.contar_texto_libre_alerta_puerta(v_ahora, false);
  v_res := case
    when v_vig_d <> v_vig_a then 'CONTROL_POSITIVO_FALLIDO'
    when v_vd <> 0 or v_b <> v_va then 'FALLO_PARCIAL'
    else 'VERIFICADA' end;
  insert into public.purgas_texto_libre (version, operador, vencidos_antes, borrados, vencidos_despues, vigentes_antes, vigentes_despues, resultado)
  values ('purga-v1/0139', btrim(p_operador), v_va, v_b, v_vd, v_vig_a, v_vig_d, v_res);
  return jsonb_build_object('resultado', v_res, 'vencidos_antes', v_va, 'borrados', v_b, 'vencidos_despues', v_vd,
                            'vigentes_antes', v_vig_a, 'vigentes_despues', v_vig_d, 'version', 'purga-v1/0139');
end;
$$;
revoke all on function public.ejecutar_purga_texto_libre(text) from public, anon, authenticated;
grant execute on function public.ejecutar_purga_texto_libre(text) to service_role;

create function public.estado_cobertura_purga(p_max_retraso interval default interval '24 hours')
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_ahora timestamptz := clock_timestamp();
  r public.purgas_texto_libre;
  v_pend integer := public.contar_texto_libre_alerta_puerta(clock_timestamp(), true);
  v_motivo text;
begin
  select * into r from public.purgas_texto_libre order by ejecutada_en desc, id limit 1;
  v_motivo := case
    when r.id is null then 'sin_recibo'
    when r.resultado <> 'VERIFICADA' then 'ultimo_recibo_' || lower(r.resultado)
    when r.ejecutada_en < v_ahora - p_max_retraso then 'recibo_viejo'
    when v_pend > 0 then 'vencidos_pendientes'
    else null end;
  return jsonb_build_object('estado', case when v_motivo is null then 'VERIFICADA' else 'NO_VERIFICADA' end,
                            'motivo', v_motivo, 'vencidos_presentes', v_pend,
                            'ultima_ejecucion', r.ejecutada_en, 'ultimo_resultado', r.resultado, 'version', r.version);
end;
$$;
revoke all on function public.estado_cobertura_purga(interval) from public, anon, authenticated;
grant execute on function public.estado_cobertura_purga(interval) to service_role;

create function public.texto_vigente_alerta_puerta(p_alerta uuid)
returns text language sql stable security definer set search_path = public
as $$
  select t.contenido from public.texto_libre_alerta_puerta t
   where t.alerta_id = p_alerta and t.contenido is not null and not public.texto_libre_vencido(t, clock_timestamp());
$$;
revoke all on function public.texto_vigente_alerta_puerta(uuid) from public, anon, authenticated;
grant execute on function public.texto_vigente_alerta_puerta(uuid) to service_role;

-- Texto sin alerta (canal privado antes de que exista la alerta): se lee por su ingreso_id con la misma regla.
create function public.texto_vigente_por_ingreso(p_ingreso uuid)
returns text language sql stable security definer set search_path = public
as $$
  select t.contenido from public.texto_libre_alerta_puerta t
   where t.ingreso_id = p_ingreso and t.contenido is not null and not public.texto_libre_vencido(t, clock_timestamp());
$$;
revoke all on function public.texto_vigente_por_ingreso(uuid) from public, anon, authenticated;
grant execute on function public.texto_vigente_por_ingreso(uuid) to service_role;

-- La purga con reloj arbitrario deja de estar al alcance de service_role: un parametro de tiempo adulterado borraria texto vigente.
revoke execute on function public.purgar_texto_libre_alerta_puerta(timestamptz) from service_role;

commit;
