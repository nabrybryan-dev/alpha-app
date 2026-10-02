-- ============================================================================
-- 0107 · El alta de un asesorado nuevo, de punta a punta
-- ============================================================================
--
-- Origen: auditoría de conexiones del 2-oct-2026 (puntos 1.5 y A-2). Dos eslabones del
-- alta no estaban conectados:
--
--   1 · NADIE escribía `aprobaciones_primer_plan` (0086): la tabla "la crea la cola",
--       pero la cola no tiene ningún INSERT. Un primer plan `propuesto` se quedaba sin
--       fila de aprobación: `decidir_primer_plan` y `vencer_primer_plan` no tenían nada
--       que decidir, y el plan de un cliente nuevo no llegaba nunca a `activo`.
--   2 · El coach no podía crear la ficha (`perfiles`) de un cliente recién dado de alta.
--
-- QUÉ CAMBIA
--   · `crear_aprobacion_primer_plan()` + trigger sobre `microciclos`: al nacer (o pasar a)
--     `propuesto` el PRIMER microciclo de una persona no coach —sin ningún otro microciclo
--     `activo` ni `cerrado`—, crea su fila de aprobación. Idempotente (`on conflict do
--     nothing`: un microciclo, una fila; y un solo pendiente por persona). Una renovación
--     (la persona ya tuvo plan) NO crea fila: eso es el plan estratégico renovado (0087).
--     No se puede calcular el riesgo desde SQL, así que la fila nace con riesgo `medio`,
--     que por diseño de la 0086 NUNCA pasa sola al vencer el plazo: la aprueba una persona.
--     Quien afine el riesgo (service_role, la cadena) puede actualizar la fila.
--   · `crear_ficha_si_falta(p_usuario)`: el coach crea la ficha mínima de un cliente que
--     aún no la tiene. `security definer` con `search_path` fijo; solo `es_coach()`. El
--     asesorado conserva `registrar_medida` (0057) para su propia ficha. Devuelve true si
--     la creó, false si ya existía.
--
-- NO TOCA la RLS de ninguna tabla ni los privilegios de `aprobaciones_primer_plan`.
--
-- NÚMERO. 0105 y 0106 ya están en `origin/main`; ninguna rama remota trae una 0107.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · La fila de aprobación nace con el primer plan propuesto
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.crear_aprobacion_primer_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado is distinct from 'propuesto' then
    return new;
  end if;

  -- Solo quien no es coach: el alta de la cadena exige "rol distinto de coach" y sin plan.
  if not exists (
    select 1 from public.usuarios_app u where u.id = new.usuario_id and u.rol <> 'coach'
  ) then
    return new;
  end if;

  -- Primer plan = la persona no tiene ningún otro microciclo activo ni cerrado.
  if exists (
    select 1 from public.microciclos m
     where m.usuario_id = new.usuario_id
       and m.id <> new.id
       and m.estado in ('activo', 'cerrado')
  ) then
    return new;
  end if;

  insert into public.aprobaciones_primer_plan (usuario_id, microciclo_id, riesgo, motivo_riesgo)
  values (
    new.usuario_id,
    new.id,
    'medio',
    'Creada al proponerse el primer plan (0107); el riesgo no se evaluó: lo decide una persona.'
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.crear_aprobacion_primer_plan() from public, anon, authenticated;

comment on function public.crear_aprobacion_primer_plan() is
  'Crea la fila de aprobacion del primer plan al proponerse el primer microciclo de una persona '
  'no coach sin plan previo. Idempotente. Riesgo medio por defecto: nunca pasa solo al vencer.';

drop trigger if exists trg_crear_aprobacion_primer_plan on public.microciclos;
create trigger trg_crear_aprobacion_primer_plan
  after insert or update of estado on public.microciclos
  for each row execute function public.crear_aprobacion_primer_plan();

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · El coach crea la ficha de un cliente nuevo
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.crear_ficha_si_falta(p_usuario uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creada int;
begin
  if auth.uid() is null then
    raise exception 'Falta sesión' using errcode = '28000';
  end if;
  if not public.es_coach() then
    raise exception 'Solo el coach crea la ficha de otra persona' using errcode = '42501';
  end if;
  if p_usuario is null
     or not exists (select 1 from public.usuarios_app u where u.id = p_usuario) then
    raise exception 'La persona % no existe', p_usuario using errcode = 'P0002';
  end if;

  -- Misma ficha mínima que deja `registrar_medida` (0057): solo `usuarioId` y `medidas`.
  -- No inventa objetivos ni edad: el resto lo pone el coach.
  insert into public.perfiles (usuario_id, datos)
  values (p_usuario, jsonb_build_object('usuarioId', p_usuario::text, 'medidas', '[]'::jsonb))
  on conflict (usuario_id) do nothing;

  get diagnostics v_creada = row_count;
  return v_creada > 0;
end;
$$;

revoke all on function public.crear_ficha_si_falta(uuid) from public, anon;
grant execute on function public.crear_ficha_si_falta(uuid) to authenticated, service_role;

comment on function public.crear_ficha_si_falta(uuid) is
  'El coach crea la ficha minima (usuarioId + medidas) de un cliente que no la tiene. '
  'security definer, solo es_coach(); true si la creo, false si ya existia.';

commit;

-- Señal: `0107 - alta de punta a punta` en supabase/comprobar-migraciones.sql
