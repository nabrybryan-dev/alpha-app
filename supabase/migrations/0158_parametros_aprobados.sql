-- ============================================================================
-- 0158 · La coach aprueba los PARAMETROS de un plan renovado, aparte del plan
-- ============================================================================
--
-- NO ESTA APLICADA. La escribio la rama `app/aprobar-parametros` el 2-nov-2026 y la aplica
-- Bryan, a mano, en el SQL Editor. Sin ella el boton «Aprobar parametros» de la bandeja dice que
-- no pudo guardar y el resto de la bandeja (aprobar o rechazar el plan) sigue igual.
--
-- QUE PEDIDO RESUELVE. Un plan estrategico renovado trae la seccion «10. Parametros para
-- decidir» (`planes_estrategicos.contenido -> 'parametros_para_decidir'`: diez valores como
-- frecuencia, series, deficit o pasos). Bryan decidio (2-nov) un boton propio para aprobarlos,
-- separado del de aprobar el plan: aprobar uno NO aprueba el otro.
--
-- REGLAS DE BRYAN (2-nov), todas en la base y no en la pantalla:
--   1. Firma SOLO la cuenta de coach (`public.es_coach()`: usuarios_app.rol = 'coach'), con su
--      `auth.uid()`. Manuela NO puede, aunque pueda aprobar el plan (decision de Bryan, 2-nov,
--      selector). No hay mapeo a FIRMANTES.json.
--   2. La aprobacion se guarda aqui, en `parametros_aprobados`.
--   3. VENCE si cambia cualquiera de los valores: la RPC solo guarda si lo que se le pasa es
--      IGUAL (jsonb, sin importar el orden de las claves) a lo que el plan trae AHORA; si no,
--      «los valores cambiaron, vuelve a mirar». La pantalla compara lo guardado con lo vigente.
--   4. NO se arrastra a un plan nuevo: la fila cuelga de UNA aprobacion de plan
--      (`plan_renovado_id`, unica). Otro plan renovado = otra fila = otra firma, aunque los
--      valores sean identicos.
--
-- DUDA ABIERTA (no se cambia aqui): el `on conflict do update` sobrescribe firmante y fecha. Si
-- la aprobacion vence y otro coach vuelve a firmar, se pierde quien firmo antes.
--
-- TABLA: sin montos ni datos de personas (solo los diez valores del plan y quien firmo).
-- RLS en este mismo paso. Leer: coach y quien ya puede ver la bandeja. Escribir: SOLO por la
-- RPC; ni authenticated ni anon tienen insert/update/delete, asi que una fila no se edita a mano.
-- ============================================================================

begin;

create table if not exists public.parametros_aprobados (
  id                uuid primary key default gen_random_uuid(),
  -- La aprobacion del plan renovado (`aprobaciones_plan_estrategico`, 0087). Una firma por plan.
  plan_renovado_id  uuid not null unique references public.aprobaciones_plan_estrategico(id) on delete cascade,
  -- La forma aprobada: la seccion sin la clave `aprobacion` (esa la escribe el agente).
  parametros        jsonb not null check (jsonb_typeof(parametros) = 'object'),
  aprobado_por      uuid not null default auth.uid() references public.usuarios_app(id),
  aprobado_en       timestamptz not null default now()
);

comment on table public.parametros_aprobados is
  'Aprobacion de los parametros de un plan renovado (2026-11-02). Una fila por aprobacion de '
  'plan; no se arrastra a otro plan. Se escribe SOLO por aprobar_parametros_plan(); la pantalla '
  'la da por vencida si los parametros del plan ya no son iguales a `parametros`.';

alter table public.parametros_aprobados enable row level security;

drop policy if exists parametros_aprobados_leer on public.parametros_aprobados;
create policy parametros_aprobados_leer on public.parametros_aprobados
  for select to authenticated
  using (
    (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
    or (select public.tiene_capacidad('aprobar_plan_estrategico'))
  );

-- Se quita TODO (incluidos references y trigger, que los privilegios por omision de Supabase
-- pueden dar) y solo despues se concede el select.
revoke all on public.parametros_aprobados from anon, public, authenticated;
grant select on public.parametros_aprobados to authenticated;
grant all on public.parametros_aprobados to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC aprobar_parametros_plan(p_plan_renovado_id, p_parametros)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.aprobar_parametros_plan(p_plan_renovado_id uuid, p_parametros jsonb)
returns public.parametros_aprobados
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quien       uuid := auth.uid();
  -- Cuantos parametros trae la seccion «10. Parametros para decidir». Los nombres no estan
  -- definidos en ningun contrato; se exige la cantidad. Origen: CANTIDAD_DE_PARAMETROS en
  -- src/domain/consolaCoach/parametrosAprobados.ts (si cambia uno, cambia el otro).
  c_cantidad  constant int := 10;
  v_estado    text;
  v_seccion   jsonb;
  v_vigentes  jsonb;
  fila        public.parametros_aprobados%rowtype;
begin
  if quien is null then
    raise exception 'Falta sesión' using errcode = '28000';
  end if;

  if not public.es_coach() then
    raise exception 'Solo la coach puede aprobar parámetros' using errcode = '42501';
  end if;

  if p_parametros is null or jsonb_typeof(p_parametros) <> 'object' then
    raise exception 'Los parámetros deben ser un objeto' using errcode = '22023';
  end if;

  -- Se bloquean la aprobacion del plan Y el plan (a y p) mientras se compara, para que el contenido
  -- no cambie entre la comparacion y el guardado.
  select a.estado, p.contenido -> 'parametros_para_decidir'
    into v_estado, v_seccion
    from public.aprobaciones_plan_estrategico a
    join public.planes_estrategicos p on p.id = a.plan_id
   where a.id = p_plan_renovado_id
   for update of a, p;
  if not found then
    raise exception 'El plan renovado no existe' using errcode = 'P0002';
  end if;

  if v_estado not in ('propuesto', 'espera_bryan') then
    raise exception 'Este plan ya se decidió (estado actual: %)', v_estado using errcode = '22023';
  end if;

  if v_seccion is null or jsonb_typeof(v_seccion) <> 'object' then
    raise exception 'Este plan no trae parámetros para decidir' using errcode = '22023';
  end if;

  v_vigentes := v_seccion - 'aprobacion';
  if (select count(*) from jsonb_object_keys(v_vigentes)) <> c_cantidad then
    raise exception 'El plan no trae los diez parámetros' using errcode = '22023';
  end if;
  if p_parametros is distinct from v_vigentes then
    raise exception 'Los valores cambiaron, vuelve a mirar' using errcode = '22023';
  end if;

  insert into public.parametros_aprobados (plan_renovado_id, parametros, aprobado_por, aprobado_en)
  values (p_plan_renovado_id, v_vigentes, quien, now())
  on conflict (plan_renovado_id) do update
     set parametros = excluded.parametros,
         aprobado_por = excluded.aprobado_por,
         aprobado_en = excluded.aprobado_en
  returning * into fila;

  return fila;
end;
$$;

revoke execute on function public.aprobar_parametros_plan(uuid, jsonb) from public, anon;
grant execute on function public.aprobar_parametros_plan(uuid, jsonb) to authenticated, service_role;

comment on function public.aprobar_parametros_plan(uuid, jsonb) is
  'Guarda la aprobacion de los parametros de un plan renovado PENDIENTE. Exige es_coach() y que la seccion traiga exactamente diez parametros '
  'y que p_parametros sea igual (jsonb) a la seccion parametros_para_decidir del plan sin `aprobacion`. '
  'Firma auth.uid(). Aprobar los parametros NO aprueba el plan.';

commit;
