-- Decisiones compartidas Bryan/Manuela (migración 0094).
--
-- Lo que se prueba:
--   1. El check de capacidades acepta las que ya había MÁS `decisiones_compartidas`, y sigue
--      rechazando una inventada (la 0094 lo reescribe leyendo la definición vigente).
--   2. Anotar: el actor sale de auth.uid(); la misma decisión dos veces es UNA fila.
--   3. Quien tiene la capacidad y el coach LEEN (tabla y vista); un asesorado y un staff sin la
--      capacidad NO ven ninguna fila y no pueden anotar; anon no toca nada.
--   4. Nadie escribe directo: insert/update/delete de authenticated fallan.
--   5. Firma: solo la del OTRO; no la propia; una sola vez; rechazar exige motivo; un plazo
--      vencido NUNCA se vuelve firma (queda `vencida`).
--   6. Autoridad: finanzas y las altas de creadores, solo el coach.
--   7. Nunca salud: cifras clínicas, palabras de salud, @ y teléfonos se rechazan; en
--      entrenamiento y nutrición no hay texto libre ni dinero; sin referencia queda `incompleta`.
--   8. Reglas de forma: sujeto con seudónimo, `negocio:` solo con una palanca del área, monto
--      con periodicidad, monto 0 solo si dice «sin costo».
--
-- Bloque de UUID propio (c9…/d9…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
insert into auth.users (id, email) values
  ('c9000000-0000-0000-0000-000000000001', 'dc-asesorado@ejemplo.test'),
  ('d9000000-0000-0000-0000-000000000001', 'dc-manuela@ejemplo.test'),
  ('d9000000-0000-0000-0000-000000000002', 'dc-bryan@ejemplo.test'),
  ('d9000000-0000-0000-0000-000000000003', 'dc-staff-sin@ejemplo.test'),
  ('d9000000-0000-0000-0000-000000000004', 'dc-barrido@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('c9000000-0000-0000-0000-000000000001', 'Asesorado cualquiera', 'asesorado', 'AC'),
  ('d9000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('d9000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('d9000000-0000-0000-0000-000000000003', 'Staff sin registro', 'nutricionista', 'SR'),
  ('d9000000-0000-0000-0000-000000000004', 'Barrido de capacidades', 'nutricionista', 'BC')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('d9000000-0000-0000-0000-000000000001', 'decisiones_compartidas'),
  ('d9000000-0000-0000-0000-000000000003', 'leer_entrenamiento')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · El check de capacidades: las anteriores siguen, la nueva entra, la inventada no
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  c text;
begin
  foreach c in array array[
    'leer_entrenamiento', 'responder_por_asesorado', 'detener_publicacion', 'reportar_riesgo',
    'autorizar_excepcion', 'firmar_politica', 'aprobar_primer_plan', 'aprobar_plan_estrategico',
    'revisar_creadores', 'firmar_creadores', 'decisiones_compartidas'
  ] loop
    insert into public.capacidades_staff (usuario_id, capacidad)
    values ('d9000000-0000-0000-0000-000000000004', c);
  end loop;
  begin
    insert into public.capacidades_staff (usuario_id, capacidad)
    values ('d9000000-0000-0000-0000-000000000004', 'capacidad_inventada');
    raise exception 'FALLO: el check de capacidades aceptó una capacidad inventada';
  exception when check_violation then null;
  end;
end $$;
-- El barrido termina aquí: esa persona no debe quedar como quien firma en las pruebas de abajo.
delete from public.capacidades_staff where usuario_id = 'd9000000-0000-0000-0000-000000000004';

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Bryan (coach) anota; la misma decisión dos veces es una sola
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('d9000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select set_config('pruebas.dec1', public.anotar_decision(
  p_area => 'creadores', p_palanca => 'segmento', p_direccion => 'incluye', p_sujeto => 'negocio:segmento',
  p_resumen => 'Entrenadores que venden coaching: oferta de alquiler',
  p_le_toca_a => 'manuela', p_le_toca_que => 'preparar el mensaje',
  p_firma_de => 'd9000000-0000-0000-0000-000000000001', p_firma_nivel => 'firma',
  p_firma_vence_en => current_date + 3
)::text, false);

select pruebas.afirmar(
  public.anotar_decision(
    p_area => 'creadores', p_palanca => 'segmento', p_direccion => 'incluye', p_sujeto => 'negocio:segmento',
    p_resumen => 'Entrenadores que venden coaching: oferta de alquiler',
    p_firma_de => 'd9000000-0000-0000-0000-000000000001', p_firma_nivel => 'firma',
    p_firma_vence_en => current_date + 3
  )::text = current_setting('pruebas.dec1'),
  'anotar dos veces la misma decisión no devolvió la fila existente'
);
select pruebas.afirmar(
  (select count(*) from public.decisiones where sujeto = 'negocio:segmento' and palanca = 'segmento') = 1,
  'la misma decisión anotada dos veces dejó dos filas'
);
select pruebas.afirmar(
  (select decidido_por from public.decisiones where id = current_setting('pruebas.dec1')::uuid)
    = 'd9000000-0000-0000-0000-000000000002',
  'quien decidió no salió de auth.uid()'
);
select pruebas.afirmar(
  (select estado from public.decisiones_con_estado where id = current_setting('pruebas.dec1')::uuid) = 'propuesta',
  'una decisión con firma pendiente y plazo vigente no está como propuesta'
);

-- ════════════════════════════════════════════════════════════════════════
-- 6 · Autoridad y forma (Bryan)
-- ════════════════════════════════════════════════════════════════════════
-- Finanzas con monto y periodicidad: bien; sin monto queda incompleta con su FALTA.
select set_config('pruebas.dec_fin', public.anotar_decision(
  p_area => 'finanzas', p_palanca => 'pago_equipo', p_direccion => 'inicia', p_sujeto => 'equipo:manuela',
  p_monto_cop => 400000, p_periodicidad => 'mensual', p_vigencia_desde => current_date + 30
)::text, false);
select pruebas.afirmar(
  (select programada from public.decisiones_con_estado where id = current_setting('pruebas.dec_fin')::uuid),
  'una decisión con vigencia futura no sale como programada'
);
select set_config('pruebas.dec_sin_monto', public.anotar_decision(
  p_area => 'finanzas', p_palanca => 'gasto_fijo', p_direccion => 'inicia', p_sujeto => 'negocio:gasto_fijo'
)::text, false);
select pruebas.afirmar(
  (select estado from public.decisiones_con_estado where id = current_setting('pruebas.dec_sin_monto')::uuid) = 'incompleta'
  and 'FALTA: monto' = any (select unnest(faltan) from public.decisiones_con_estado
                             where id = current_setting('pruebas.dec_sin_monto')::uuid),
  'un gasto fijo sin monto no quedó incompleta con «FALTA: monto»'
);

do $$
begin
  begin
    perform public.anotar_decision('finanzas', 'pago_equipo', 'inicia', 'equipo:manuela', p_monto_cop => 0, p_periodicidad => 'mensual');
    raise exception 'FALLO: se aceptó un pago de 0 sin decir «sin costo»';
  exception when check_violation then null;
  end;
  -- Con «sin costo» dicho, el 0 sí entra.
  perform public.anotar_decision('finanzas', 'bono', 'inicia', 'negocio:bono', p_valor => 'sin costo', p_monto_cop => 0, p_periodicidad => 'unica');
  begin
    perform public.anotar_decision('finanzas', 'precio', 'sube', 'negocio:precio', p_monto_cop => 100000);
    raise exception 'FALLO: se aceptó un monto sin periodicidad';
  exception when check_violation then null;
  end;
  begin
    perform public.anotar_decision('creadores', 'segmento', 'incluye', 'negocio:pago_a_x');
    raise exception 'FALLO: se aceptó negocio:<p> con una palanca que no es del área';
  exception when check_violation then null;
  end;
  begin
    perform public.anotar_decision('creadores', 'segmento', 'incluye', 'María López');
    raise exception 'FALLO: se aceptó un nombre real como sujeto';
  exception when check_violation then null;
  end;
  begin
    perform public.anotar_decision('creadores', 'inventada', 'incluye', 'negocio:inventada');
    raise exception 'FALLO: se aceptó una palanca fuera de la lista';
  exception when check_violation then null;
  end;
  begin
    perform public.anotar_decision('creadores', 'segmento', 'incluye', 'negocio:segmento',
      p_firma_de => 'd9000000-0000-0000-0000-000000000002');
    raise exception 'FALLO: se pidió la firma de uno mismo';
  exception when check_violation then null;
  end;
  begin
    perform public.anotar_decision('creadores', 'segmento', 'excluye', 'negocio:segmento',
      p_firma_de => 'd9000000-0000-0000-0000-000000000003');
    raise exception 'FALLO: se pidió la firma de alguien sin acceso al registro';
  exception when check_violation then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7 · Nunca salud (Bryan y Manuela)
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
begin
  foreach t in array array[
    'bajar a 1.900 kcal', 'dolor en la zona lumbar', 'subir 5 kg', '3 series de 10 reps',
    'llamarla al 300 123 4567', 'hablar con @alguien', 'escribir a persona@ejemplo.test',
    'tiene 20 % de grasa', 'cuidar la rodilla'
  ] loop
    begin
      perform public.anotar_decision('creadores', 'plantilla_mensaje', 'cambia', 'negocio:plantilla_mensaje', p_resumen => t);
      raise exception 'FALLO: el resumen «%» pasó las vetadas', t;
    exception when check_violation then null;
    end;
  end loop;
  -- Un texto limpio sí pasa (y «comisión 10 %» no es un porcentaje de grasa: CASO-24).
  perform public.anotar_decision('finanzas', 'comision', 'cambia', 'negocio:comision',
    p_resumen => 'comisión 10 %', p_monto_cop => 100000, p_periodicidad => 'mensual');
end $$;

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Manuela (capacidad) lee; firma solo ella
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('d9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.decisiones where id = current_setting('pruebas.dec1')::uuid) = 1
  and (select count(*) from public.decisiones_con_estado where id = current_setting('pruebas.dec1')::uuid) = 1,
  'quien tiene decisiones_compartidas no ve la decisión'
);
select pruebas.afirmar(
  (select decidido_por_nombre from public.decisiones_con_estado where id = current_setting('pruebas.dec1')::uuid) = 'Bryan de prueba'
  and (select firma_de_nombre from public.decisiones_con_estado where id = current_setting('pruebas.dec1')::uuid) = 'Manuela de prueba',
  'la vista no trae los nombres de quien decidió y de quien firma'
);
select pruebas.afirmar(
  -- Las pruebas 10/20 dejan un coach confirmado en la base (33333333…): se mira solo el bloque d9…,
  -- donde únicamente Bryan es coach; ni Manuela, ni el staff sin registro, ni el barrido aparecen.
  (select array_agg(id order by id) from public.companeros_de_decision() where id::text like 'd9000000-%')
    = array['d9000000-0000-0000-0000-000000000002']::uuid[],
  'a Manuela solo se le ofrece a Bryan como quien firma'
);

-- 6 · Autoridad: ni finanzas ni las altas de creadores son de Manuela
do $$
begin
  begin
    perform public.anotar_decision('finanzas', 'gasto_fijo', 'inicia', 'negocio:gasto_fijo', p_monto_cop => 1, p_periodicidad => 'mensual');
    raise exception 'FALLO: Manuela anotó una decisión de finanzas';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.anotar_decision('creadores', 'incorporacion', 'incluye', 'negocio:incorporacion');
    raise exception 'FALLO: Manuela anotó una incorporación de creadores';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4 · Nadie escribe directo
do $$
begin
  begin
    insert into public.decisiones (decidido_por, area, palanca, direccion, sujeto, idempotencia)
    values ('d9000000-0000-0000-0000-000000000001', 'creadores', 'segmento', 'incluye', 'negocio:segmento', 'directo');
    raise exception 'FALLO: Manuela insertó una decisión sin pasar por anotar_decision';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.decisiones set firma_estado = 'firmada' where id = current_setting('pruebas.dec1')::uuid;
    raise exception 'FALLO: Manuela firmó con un UPDATE directo';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.decisiones where id = current_setting('pruebas.dec1')::uuid;
    raise exception 'FALLO: Manuela borró una decisión';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 7 · En entrenamiento y nutrición no hay texto libre ni dinero; sin referencia queda incompleta
do $$
begin
  begin
    perform public.anotar_decision('nutricion', 'energia', 'sube', 'cli-12', p_valor => 'mucho');
    raise exception 'FALLO: una decisión de nutrición aceptó texto libre en valor';
  exception when check_violation then null;
  end;
  begin
    perform public.anotar_decision('entrenamiento', 'volumen', 'baja', 'cli-12', p_resumen => 'bajar una serie de pierna');
    raise exception 'FALLO: una decisión de entrenamiento aceptó un resumen';
  exception when check_violation then null;
  end;
  begin
    perform public.anotar_decision('nutricion', 'energia', 'sube', 'cli-12', p_le_toca_a => 'manuela', p_le_toca_que => 'revisar su desayuno');
    raise exception 'FALLO: una tarea de nutrición fuera de la lista cerrada';
  exception when check_violation then null;
  end;
end $$;

select set_config('pruebas.dec_clin', public.anotar_decision(
  p_area => 'entrenamiento', p_palanca => 'volumen', p_direccion => 'baja', p_sujeto => 'cli-12',
  p_le_toca_a => 'bryan', p_le_toca_que => 'cuadrar con el plan de nutrición'
)::text, false);
select pruebas.afirmar(
  (select estado from public.decisiones_con_estado where id = current_setting('pruebas.dec_clin')::uuid) = 'incompleta'
  and 'FALTA: referencia al plan en la app' = any (select unnest(faltan) from public.decisiones_con_estado
                                                   where id = current_setting('pruebas.dec_clin')::uuid),
  'una decisión clínica sin referencia al plan no quedó incompleta'
);
select set_config('pruebas.dec_clin_ok', public.anotar_decision(
  p_area => 'nutricion', p_palanca => 'plan_nuevo', p_direccion => 'inicia', p_sujeto => 'cli-13',
  p_referencia_tabla => 'microciclos', p_referencia_id => 'mc-0001'
)::text, false);
select pruebas.afirmar(
  (select estado from public.decisiones_con_estado where id = current_setting('pruebas.dec_clin_ok')::uuid) = 'vigente',
  'una decisión clínica con referencia y sin firma pedida no está vigente'
);

-- 5 · La firma
do $$
begin
  begin
    perform public.firmar_decision(current_setting('pruebas.dec1')::uuid, 'visto');
    raise exception 'FALLO: se aceptó «visto» en una decisión de nivel firma';
  exception when check_violation then null;
  end;
  begin
    perform public.firmar_decision(current_setting('pruebas.dec1')::uuid, 'rechazada');
    raise exception 'FALLO: un rechazo sin motivo se guardó';
  exception when check_violation then null;
  end;
end $$;

select public.firmar_decision(current_setting('pruebas.dec1')::uuid, 'firmada');
select pruebas.afirmar(
  (select estado from public.decisiones_con_estado where id = current_setting('pruebas.dec1')::uuid) = 'vigente'
  and (select firma_estado from public.decisiones where id = current_setting('pruebas.dec1')::uuid) = 'firmada',
  'la firma de Manuela no dejó la decisión vigente'
);
do $$
begin
  begin
    perform public.firmar_decision(current_setting('pruebas.dec1')::uuid, 'rechazada', 'me arrepentí');
    raise exception 'FALLO: una decisión ya firmada se pudo firmar otra vez';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- La firma NO es de quien decidió: Bryan no puede firmar lo suyo.
select pruebas.soy('d9000000-0000-0000-0000-000000000002');
set role authenticated;
select set_config('pruebas.dec2', public.anotar_decision(
  p_area => 'creadores', p_palanca => 'estado_contacto', p_direccion => 'cambia', p_sujeto => 'negocio:estado_contacto',
  p_firma_de => 'd9000000-0000-0000-0000-000000000001', p_firma_nivel => 'firma',
  p_firma_vence_en => current_date + 2
)::text, false);
do $$
begin
  begin
    perform public.firmar_decision(current_setting('pruebas.dec2')::uuid, 'firmada');
    raise exception 'FALLO: Bryan firmó una decisión que él mismo tomó';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Sin plazo, la decisión con firma pendiente queda incompleta (CASO-19), no como propuesta sin fin.
select set_config('pruebas.dec3', public.anotar_decision(
  p_area => 'creadores', p_palanca => 'desempate', p_direccion => 'cambia', p_sujeto => 'negocio:desempate',
  p_firma_de => 'd9000000-0000-0000-0000-000000000001'
)::text, false);
select pruebas.afirmar(
  (select estado from public.decisiones_con_estado where id = current_setting('pruebas.dec3')::uuid) = 'incompleta',
  'una firma pedida sin plazo no quedó incompleta'
);
reset role;

-- Un rechazo con motivo deja la decisión rechazada.
select pruebas.soy('d9000000-0000-0000-0000-000000000001');
set role authenticated;
select public.firmar_decision(current_setting('pruebas.dec2')::uuid, 'rechazada', 'falta el precio');
select pruebas.afirmar(
  (select estado from public.decisiones_con_estado where id = current_setting('pruebas.dec2')::uuid) = 'rechazada'
  and (select firma_motivo from public.decisiones where id = current_setting('pruebas.dec2')::uuid) = 'falta el precio',
  'un rechazo con motivo no dejó la decisión rechazada con su motivo'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5b · El plazo vencido NUNCA se convierte en firma
-- ════════════════════════════════════════════════════════════════════════
-- Se siembra como servidor (como haría el trabajo de vencimiento): pendiente, plazo de ayer.
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.decisiones
  (id, decidido_por, area, palanca, direccion, sujeto, firma_de, firma_nivel, firma_estado, firma_vence_en, idempotencia)
values
  ('d9111111-0000-0000-0000-000000000001', 'd9000000-0000-0000-0000-000000000002', 'creadores', 'tarea_mensaje', 'cambia',
   'negocio:tarea_mensaje', 'd9000000-0000-0000-0000-000000000001', 'firma', 'pendiente', current_date - 1, 'vencida-1');
reset role;

select pruebas.soy('d9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  (select estado from public.decisiones_con_estado where id = 'd9111111-0000-0000-0000-000000000001') = 'vencida',
  'una firma con el plazo vencido no salió como vencida'
);
do $$
begin
  begin
    perform public.firmar_decision('d9111111-0000-0000-0000-000000000001', 'firmada');
    raise exception 'FALLO: se firmó una decisión con el plazo vencido';
  exception when check_violation then null;
  end;
end $$;
select pruebas.afirmar(
  (select estado from public.decisiones_con_estado where id = 'd9111111-0000-0000-0000-000000000001') = 'vencida',
  'un intento de firmar tarde convirtió la vencida en otra cosa'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3b · Coach lee todo; asesorado y staff sin la capacidad, cero filas y sin anotar
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('d9000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.decisiones_con_estado where sujeto like 'negocio:%' or sujeto = 'equipo:manuela') >= 5,
  'el coach no ve las decisiones'
);
reset role;

select pruebas.soy('c9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.decisiones) = 0
  and (select count(*) from public.decisiones_con_estado) = 0
  and (select count(*) from public.companeros_de_decision()) = 0,
  'un asesorado ve decisiones compartidas'
);
do $$
begin
  begin
    perform public.anotar_decision('creadores', 'segmento', 'incluye', 'negocio:segmento');
    raise exception 'FALLO: un asesorado anotó una decisión';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.firmar_decision(current_setting('pruebas.dec3')::uuid, 'firmada');
    raise exception 'FALLO: un asesorado firmó una decisión';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.soy('d9000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.decisiones) = 0 and (select count(*) from public.decisiones_con_estado) = 0,
  'staff con leer_entrenamiento pero sin decisiones_compartidas ve el registro'
);
do $$
begin
  begin
    perform public.anotar_decision('creadores', 'segmento', 'incluye', 'negocio:segmento');
    raise exception 'FALLO: staff sin la capacidad anotó una decisión';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- anon no toca nada
-- ════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$
begin
  begin
    perform 1 from public.decisiones limit 1;
    raise exception 'FALLO: anon pudo consultar decisiones';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.decisiones_con_estado limit 1;
    raise exception 'FALLO: anon pudo consultar decisiones_con_estado';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.anotar_decision('creadores', 'segmento', 'incluye', 'negocio:segmento');
    raise exception 'FALLO: anon anotó una decisión';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
