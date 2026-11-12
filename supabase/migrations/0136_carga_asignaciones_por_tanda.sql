-- 0136: carga de asignaciones persona-coach POR TANDA, con preimagen y reversa propia (ANTES de M2; pieza 2 de la COLA-4H, casos A1-A7 de C2).
-- Propuesta, NO APLICADA (I-16). Sustituye el `delete ... where cambiado_por is null` (que NO identifica una tanda) por una reversa que solo toca SU tanda.
-- Reglas:
--  * cargar_asignaciones_tanda(lista) es UNA funcion = UNA transaccion: bloquea la tabla en modo exclusivo de escritura (SHARE ROW EXCLUSIVE) antes de comprobar nada,
--    valida TODO antes de insertar (cero efectos parciales), y rechaza si ya hay filas HISTORICAS con cambiado_por nulo y sin tanda (A2) salvo que se pida
--    explicitamente p_con_historia = true; en ese caso solo cierra/reemplaza a las personas de la lista y guarda la PREIMAGEN de lo que cerro (A7).
--  * Cada fila insertada lleva tanda_id; la tanda guarda inventario (huella md5 de las filas insertadas) y preimagen (las filas vigentes que cerro).
--  * revertir_tanda_asignaciones(tanda) bloquea, comprueba que las filas de la tanda siguen EXACTAMENTE como se insertaron (A6: si una se modifico, aborta sin tocar nada),
--    que ninguna otra tanda ni asignacion posterior toco a esas personas, borra SOLO esas filas y reabre solo las filas de la preimagen (A5/A7).
--  * Ambas funciones: solo el rol dueño (SQL Editor) y service_role; ninguna para anon/authenticated. No usan auth.uid(): es una carga administrativa y deja `cambiado_por` en NULL,
--    pero la tanda queda trazada por tanda_id.
begin;

alter table public.asignaciones_coach add column tanda_id uuid;

create table public.tandas_carga_asignaciones (
  tanda_id uuid primary key default gen_random_uuid(),
  creada_en timestamptz not null default clock_timestamp(),
  con_historia boolean not null,
  insertadas integer not null,
  huella_inventario text not null check (huella_inventario ~ '^[0-9a-f]{32}$'),
  preimagen jsonb not null default '[]'::jsonb,
  revertida_en timestamptz
);
alter table public.tandas_carga_asignaciones enable row level security;
revoke all on public.tandas_carga_asignaciones from anon, public, authenticated;
grant all on public.tandas_carga_asignaciones to service_role;

-- Huella canonica de las filas de una tanda (persona, coach, desde, hasta, cambiado_por): detecta cualquier modificacion posterior.
create function public.huella_filas_tanda(p_tanda uuid)
returns text language sql stable security definer set search_path = public
as $$
  select md5(coalesce(string_agg(a.persona_id::text || '|' || a.coach_id::text || '|' || a.asignado_desde::text || '|' || coalesce(a.asignado_hasta::text, '-') || '|' || coalesce(a.cambiado_por::text, '-'),
                                 E'\n' order by a.persona_id, a.asignado_desde), ''))
    from public.asignaciones_coach a where a.tanda_id = p_tanda;
$$;
revoke all on function public.huella_filas_tanda(uuid) from public, anon, authenticated;
grant execute on function public.huella_filas_tanda(uuid) to service_role;

-- p_lista: jsonb array de {"persona_id": "...", "coach_id": "..."}
create function public.cargar_asignaciones_tanda(p_lista jsonb, p_con_historia boolean default false)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tanda uuid := gen_random_uuid();
  v_ahora timestamptz := clock_timestamp();
  v_n integer;
  v_malas text;
  v_pre jsonb;
  v_ins integer;
begin
  -- Exclusion de escritores ANTES de comprobar: no hay ventana entre "esta vacia" e "insertar" (A4).
  lock table public.asignaciones_coach in share row exclusive mode;

  if p_lista is null or jsonb_typeof(p_lista) <> 'array' or jsonb_array_length(p_lista) = 0 then
    raise exception 'la lista debe ser un arreglo no vacio' using errcode = '22023';
  end if;
  create temp table if not exists _lista_tanda (persona_id uuid, coach_id uuid) on commit drop;
  truncate _lista_tanda;
  insert into _lista_tanda (persona_id, coach_id)
    select (e->>'persona_id')::uuid, (e->>'coach_id')::uuid from jsonb_array_elements(p_lista) e;
  get diagnostics v_n = row_count;
  if exists (select 1 from _lista_tanda group by persona_id having count(*) > 1) then
    raise exception 'persona repetida en la lista' using errcode = '22023';
  end if;
  if exists (select 1 from _lista_tanda where persona_id is null or coach_id is null) then
    raise exception 'fila incompleta en la lista' using errcode = '22023';
  end if;

  -- A2: historia con cambiado_por nulo y sin tanda = carga minima aborta salvo modo con historia explicito.
  if not p_con_historia and exists (select 1 from public.asignaciones_coach a where a.cambiado_por is null and a.tanda_id is null) then
    raise exception 'hay filas historicas con cambiado_por nulo: use el modo con historia (p_con_historia = true)' using errcode = '22023';
  end if;
  if not p_con_historia and exists (select 1 from public.asignaciones_coach) then
    raise exception 'la tabla no esta vacia: la carga minima exige tabla vacia (o el modo con historia)' using errcode = '22023';
  end if;

  select string_agg(l.persona_id::text, ', ') into v_malas from _lista_tanda l
    left join public.usuarios_app u on u.id = l.persona_id where u.id is null or u.rol <> 'asesorado';
  if v_malas is not null then
    raise exception 'personas inexistentes o que no son asesorados: %', v_malas using errcode = '22023';
  end if;
  select string_agg(l.coach_id::text, ', ') into v_malas from _lista_tanda l
    left join public.usuarios_app u on u.id = l.coach_id
   where u.id is null or not (u.rol = 'coach' or exists (select 1 from public.capacidades_staff c where c.usuario_id = u.id and c.capacidad = 'puesto_de_coach'));
  if v_malas is not null then
    raise exception 'destinos que no ocupan un puesto de coach: %', v_malas using errcode = '22023';
  end if;
  select string_agg(u.id::text, ', ') into v_malas from public.usuarios_app u
   where u.rol = 'asesorado'
     and not exists (select 1 from _lista_tanda l where l.persona_id = u.id)
     and not exists (select 1 from public.asignaciones_coach x where x.persona_id = u.id and x.asignado_hasta is null);
  if v_malas is not null then
    raise exception 'asesorados que quedarian SIN coach (faltan en la lista): %', v_malas using errcode = '22023';
  end if;

  -- Preimagen: las filas vigentes de las personas de la lista que se cierran (solo modo con historia; en el minimo no hay ninguna).
  select coalesce(jsonb_agg(jsonb_build_object('persona_id', x.persona_id, 'asignado_desde', x.asignado_desde, 'coach_id', x.coach_id)), '[]'::jsonb) into v_pre
    from public.asignaciones_coach x join _lista_tanda l on l.persona_id = x.persona_id
   where x.asignado_hasta is null and x.coach_id <> l.coach_id;
  update public.asignaciones_coach x set asignado_hasta = v_ahora
    from _lista_tanda l where x.persona_id = l.persona_id and x.asignado_hasta is null and x.coach_id <> l.coach_id;

  insert into public.asignaciones_coach (persona_id, coach_id, asignado_desde, cambiado_por, tanda_id)
    select l.persona_id, l.coach_id, v_ahora, null, v_tanda from _lista_tanda l
     where not exists (select 1 from public.asignaciones_coach x where x.persona_id = l.persona_id and x.coach_id = l.coach_id and x.asignado_hasta is null);
  get diagnostics v_ins = row_count;

  insert into public.tandas_carga_asignaciones (tanda_id, con_historia, insertadas, huella_inventario, preimagen)
    values (v_tanda, p_con_historia, v_ins, public.huella_filas_tanda(v_tanda), v_pre);
  return jsonb_build_object('tanda_id', v_tanda, 'insertadas', v_ins, 'cerradas', jsonb_array_length(v_pre),
                            'huella_inventario', public.huella_filas_tanda(v_tanda));
end;
$$;
revoke all on function public.cargar_asignaciones_tanda(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.cargar_asignaciones_tanda(jsonb, boolean) to service_role;

create function public.revertir_tanda_asignaciones(p_tanda uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  t public.tandas_carga_asignaciones;
  v_borradas integer;
  v_reabiertas integer := 0;
  p jsonb;
begin
  lock table public.asignaciones_coach in share row exclusive mode;
  select * into t from public.tandas_carga_asignaciones where tanda_id = p_tanda for update;
  if not found then
    raise exception 'tanda inexistente' using errcode = 'P0002';
  end if;
  if t.revertida_en is not null then
    raise exception 'la tanda ya fue revertida' using errcode = '22023';
  end if;
  -- A6: si cualquier fila de la tanda cambio, no se toca nada.
  if public.huella_filas_tanda(p_tanda) <> t.huella_inventario then
    raise exception 'una fila de la tanda se modifico despues de cargarse: reversa abortada, nada se borro' using errcode = '22023';
  end if;
  -- Ninguna otra tanda ni asignacion posterior a esas personas.
  if exists (select 1 from public.asignaciones_coach x join public.asignaciones_coach m on m.persona_id = x.persona_id
              where m.tanda_id = p_tanda and x.tanda_id is distinct from p_tanda and x.asignado_desde > m.asignado_desde) then
    raise exception 'hay asignaciones posteriores de esas personas: reversa abortada' using errcode = '22023';
  end if;
  delete from public.asignaciones_coach where tanda_id = p_tanda;
  get diagnostics v_borradas = row_count;
  for p in select * from jsonb_array_elements(t.preimagen) loop
    update public.asignaciones_coach set asignado_hasta = null
     where persona_id = (p->>'persona_id')::uuid and asignado_desde = (p->>'asignado_desde')::timestamptz and coach_id = (p->>'coach_id')::uuid;
    v_reabiertas := v_reabiertas + 1;
  end loop;
  update public.tandas_carga_asignaciones set revertida_en = clock_timestamp() where tanda_id = p_tanda;
  return jsonb_build_object('tanda_id', p_tanda, 'borradas', v_borradas, 'reabiertas', v_reabiertas);
end;
$$;
revoke all on function public.revertir_tanda_asignaciones(uuid) from public, anon, authenticated;
grant execute on function public.revertir_tanda_asignaciones(uuid) to service_role;

commit;
