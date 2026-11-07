-- 0137 · PROPUESTA (NO APLICADA, I-16): el primer plan (0086) bajo la guarda de liberacion (0135).
-- Hallazgo: con 0135, decidir_primer_plan falla (42501) para quien no tenga `liberar_prescripcion` + liberacion vigente, y vencer_primer_plan (cron, sin sesion)
-- NUNCA activa: cada riesgo bajo vencido cae en espera_bryan con "No se pudo publicar al vencer". Prueba: test 95 en rojo con 0135 (verde con 0134) y 245.
-- Esta migracion es la OPCION A: aprobar = liberar esa version; vencer ya no activa (espera a una persona). La OPCION B (conservar el pase automatico por vencimiento)
-- reintroduce una activacion sin persona y es decision de Bryan: no esta implementada.
-- Reaplicar es idempotente (create or replace). Reversa: volver a 0086 (cuerpos originales en esa migracion).
begin;

create or replace function public.decidir_primer_plan(aprobacion_id uuid, decision text, motivo text default null)
returns public.aprobaciones_primer_plan
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  quien        uuid := auth.uid();
  fila         public.aprobaciones_primer_plan%rowtype;
  v_estado_mc  text;
  v_motivo     text := nullif(btrim(coalesce(motivo, '')), '');
begin
  if quien is null then
    raise exception 'Falta sesión' using errcode = '28000';
  end if;

  if not public.tiene_capacidad('aprobar_primer_plan') then
    raise exception 'No tienes permiso para decidir primeros planes' using errcode = '42501';
  end if;

  if decision is null or decision not in ('aprobar', 'rechazar') then
    raise exception 'Decisión desconocida: %', decision using errcode = '22023';
  end if;

  select a.* into fila
    from public.aprobaciones_primer_plan a
   where a.id = aprobacion_id
   for update;
  if not found then
    raise exception 'La aprobación no existe' using errcode = 'P0002';
  end if;

  if fila.estado not in ('propuesto', 'espera_bryan') then
    raise exception 'Este plan ya se decidió (estado actual: %)', fila.estado using errcode = '22023';
  end if;

  if decision = 'rechazar' then
    if v_motivo is null then
      raise exception 'Hace falta un motivo para rechazar' using errcode = '22023';
    end if;
    update public.aprobaciones_primer_plan a
       set estado = 'rechazado', decidido_por = quien, decidido_en = now(),
           motivo = v_motivo, actualizado_en = now()
     where a.id = aprobacion_id
    returning * into fila;
    return fila;
  end if;

  -- Aprobar. Lo clínico (riesgo alto) y lo que ya venció hacia Bryan solo lo aprueba quien
  -- tenga `autorizar_excepcion`.
  if (fila.riesgo = 'alto' or fila.estado = 'espera_bryan')
     and not public.tiene_capacidad('autorizar_excepcion') then
    raise exception 'Este plan lo aprueba Bryan (riesgo %, estado %)', fila.riesgo, fila.estado
      using errcode = '42501';
  end if;

  select m.estado into v_estado_mc from public.microciclos m where m.id = fila.microciclo_id;
  if v_estado_mc is distinct from 'propuesto' then
    raise exception 'El plan propuesto ya no está pendiente (estado del microciclo: %)', v_estado_mc
      using errcode = '22023';
  end if;

  update public.aprobaciones_primer_plan a
     set estado = 'aprobado', decidido_por = quien, decidido_en = now(),
         motivo = v_motivo, actualizado_en = now()
   where a.id = aprobacion_id
  returning * into fila;

  -- 0137: aprobar ES la liberacion humana de ESTA version (guarda de 0135). Quien aprueba debe poder liberar; la huella se toma del contenido
  -- bloqueado en esta misma transaccion. Limite: la consola no manda la huella que vio la persona (propuesta C4: pasarla y compararla).
  if not public.tiene_capacidad('liberar_prescripcion') then
    raise exception 'Aprobar un primer plan exige tambien la capacidad de liberar prescripciones' using errcode = '42501';
  end if;
  insert into public.liberaciones_microciclo (propuesta_id, persona_id, huella, liberado_por)
    select m.id, m.usuario_id, public.huella_microciclo(m.datos), quien from public.microciclos m where m.id = fila.microciclo_id for share of m
  on conflict (propuesta_id, huella) do nothing;
  perform public.activar_microciclo(fila.microciclo_id);

  return fila;
end;
$$;

revoke all on function public.decidir_primer_plan(uuid, text, text) from public, anon;
grant execute on function public.decidir_primer_plan(uuid, text, text) to authenticated, service_role;

create or replace function public.vencer_primer_plan()
returns table (aprobados int, a_bryan int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r           record;
  v_estado_mc text;
  n_aprob     int := 0;
  n_bryan     int := 0;
  v_espera    text;
begin
  for r in
    select a.*
      from public.aprobaciones_primer_plan a
     where a.estado = 'propuesto' and a.plazo_hasta <= now()
     order by a.plazo_hasta
     for update skip locked
  loop
    select m.estado into v_estado_mc from public.microciclos m where m.id = r.microciclo_id;

    v_espera := case
      when r.riesgo = 'alto'  then 'Riesgo alto (clínico): nunca pasa sin Bryan.'
      when r.riesgo = 'medio' then 'Riesgo medio: al vencer el plazo no pasa solo.'
      when cardinality(r.dudas_pendientes) > 0 then
        'Dudas pendientes que frenan la progresión: ' || array_to_string(r.dudas_pendientes, '; ')
      when v_estado_mc is distinct from 'propuesto' then
        'El microciclo ya no está propuesto (estado: ' || coalesce(v_estado_mc, 'no existe') || ').'
      else null
    end;

    -- 0137: la guarda de liberacion (0135) exige que una PERSONA libere cada version. El vencimiento ya no activa solo: un riesgo bajo vencido
    -- sin objeciones espera a quien tenga la capacidad (decision pendiente de Bryan: ver 0137 PROPUESTA, opcion A o B).
    if v_espera is null then
      v_espera := 'Plazo vencido sin objeciones (riesgo bajo, sin dudas): la guarda de liberacion exige que una persona libere esta version.';
    end if;

    update public.aprobaciones_primer_plan
       set estado = 'espera_bryan', motivo_espera = v_espera, actualizado_en = now()
     where id = r.id;
    n_bryan := n_bryan + 1;
  end loop;

  aprobados := n_aprob;
  a_bryan := n_bryan;
  return next;
end;
$$;

revoke all on function public.vencer_primer_plan() from public, anon, authenticated;
grant execute on function public.vencer_primer_plan() to service_role;

commit;
