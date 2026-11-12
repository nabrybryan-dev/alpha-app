-- ============================================================================
-- 0178 · Tablero de creadores: segundo camino de entrada desde la landing (PRAXIS)
-- ============================================================================
--
-- SIN APLICAR. Escrita el 11-nov-2026. Revisar `list_migrations` / `schema_migrations` justo
-- antes de aplicarla: este repo numera las migraciones a mano y puede haber choques, como pasó
-- con la 0176 (nació como 0175 y tuvo que renumerarse porque otra rama ya tenía ese número).
--
-- PARA QUÉ. Hoy `creadores_candidatos` (0090) solo la llena el importador de casa
-- (`bola-de-nieve/tablero/subir_creadores.py`), que descubre creadores en Instagram y entra con
-- `creador_id = 'ig:<id numérico>'`. La landing pública va a tener su propio PRAXIS
-- (agente conversacional) para que un creador se postule solo; cuando complete ese formulario
-- conversado, la Edge Function `creadores-landing` de este repo lo mete en el MISMO tablero,
-- con `origen = 'landing-praxis'`, para que el coach lo vea junto a los que trae el radar — sin
-- tocar ni una línea del importador existente.
--
-- QUÉ CAMBIA.
--   1. `creadores_candidatos.creador_id`: el check solo aceptaba `ig:<dígitos>`. Un creador que
--      llega por la landing no tiene ese id numérico — solo tenemos el @ que escribió en el
--      chat —, así que se acepta TAMBIÉN `land:<usuario_ig>`.
--   2. `creadores_candidatos.origen`: columna nueva, aditiva, con default `'importador'`. El
--      importador no manda esta columna y el default la cubre: no se rompe nada de lo que ya
--      corre. Solo las filas que entran por `creadores_landing_registrar` llevan
--      `'landing-praxis'`.
--   3. `creadores_eventos.actor`: se añade `'landing'` a la lista cerrada, para que el evento de
--      alta por este camino tenga un actor propio y distinguible de `'importador'`.
--   4. `creadores_landing_registrar(...)`: la única puerta de escritura para este camino (SQL
--      libre: cero — la Edge Function solo llama RPC, igual que `cadena-agentes`). Un @ nuevo
--      entra en el carril `'encuesta'` (= "Encuesta de ingreso"); un @ que ya existe NO se
--      duplica ni se pisa: se anota el contacto nuevo en `motivos` y ya. La función exige
--      `mayor_edad = true`: es la última línea de defensa, porque el candado real de edad vive
--      también en la Edge Function, antes de llegar aquí.
--
-- QUIÉN PUEDE QUÉ. `creadores_landing_registrar` es `security definer`, sin política de RLS
-- nueva que abrir: se ejecuta con los privilegios de quien la define, y solo `service_role`
-- tiene `EXECUTE` — igual que `puede_ver_creadores()` en la 0090. Nadie con sesión de navegador
-- (`anon` ni `authenticated`) puede llamarla; solo la Edge Function, con la service role key.
-- El `revoke` nombra a `authenticated` a propósito: en Supabase los privilegios por defecto de
-- `public` dan EXECUTE de cada función nueva a anon, authenticated y service_role DIRECTAMENTE,
-- no vía PUBLIC; revocar solo `from public, anon` dejaría a cualquier asesorado con sesión
-- metiendo filas en el tablero.
--
-- EL EVENTO. `event_id = 'land:<usuario_ig>:<epoch en segundos>'`; si el mismo @ llega dos veces
-- en el mismo segundo (doble envío), el segundo evento se descarta (`on conflict do nothing`) en
-- vez de devolver un 500. En un contacto nuevo, `carril_anterior` y `carril_nuevo` llevan el
-- carril VIGENTE del candidato (hoy siempre `encuesta`, porque solo esta función escribe filas
-- `land:`), para que la historia no cuente un movimiento que no hubo.
--
-- LIMITACIÓN CONOCIDA. Si el radar ya tiene a esa persona como `ig:<id>`, aquí entra otra fila
-- `land:<usuario_ig>`: sin el id numérico no hay forma segura de unirlas. Se ven las dos en el
-- tablero, con `origen` distinto.
--
-- CÓMO REVERTIRLA:
--   begin;
--   revoke all on function public.creadores_landing_registrar(text, text, text, text, boolean, text, text, boolean) from service_role;
--   drop function if exists public.creadores_landing_registrar(text, text, text, text, boolean, text, text, boolean);
--   alter table public.creadores_eventos
--     drop constraint creadores_eventos_actor_check,
--     add constraint creadores_eventos_actor_check
--       check (actor in ('radar', 'claude', 'astra', 'bryan', 'manuela', 'importador'));
--   alter table public.creadores_candidatos drop column origen;
--   alter table public.creadores_candidatos
--     drop constraint creadores_candidatos_creador_id_check,
--     add constraint creadores_candidatos_creador_id_check check (creador_id ~ '^ig:[0-9]+$');
--   commit;
--   (Se pierden las filas con creador_id 'land:…' porque dejan de cumplir el check viejo: borrar
--   esas filas a mano ANTES de revertir si la tabla ya tiene alguna.)
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Relaja el check de creador_id: también 'land:<usuario_ig>'
-- ────────────────────────────────────────────────────────────────────────────
-- El nombre del constraint se busca por catálogo (patrón de la 0090 con
-- capacidades_staff_capacidad_check), para no asumirlo.
do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
    from pg_constraint
   where conrelid = 'public.creadores_candidatos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%creador_id%'
   limit 1;
  if v_nombre is not null then
    execute format('alter table public.creadores_candidatos drop constraint %I', v_nombre);
  end if;
end
$$;

alter table public.creadores_candidatos
  add constraint creadores_candidatos_creador_id_check
  check (creador_id ~ '^(ig:[0-9]+|land:[a-z0-9._]{1,30})$');

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Columna origen — de dónde entró el candidato (aditiva)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.creadores_candidatos
  add column if not exists origen text not null default 'importador'
    check (origen in ('importador', 'landing-praxis'));

comment on column public.creadores_candidatos.origen is
  'Camino de entrada: importador (radar de casa, 0090) o landing-praxis (0178, formulario '
  'conversado en la landing pública). Aditiva: el importador no la manda y el default la cubre.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · creadores_eventos.actor: se añade 'landing'
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
    from pg_constraint
   where conrelid = 'public.creadores_eventos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%actor%'
   limit 1;
  if v_nombre is not null then
    execute format('alter table public.creadores_eventos drop constraint %I', v_nombre);
  end if;
end
$$;

alter table public.creadores_eventos
  add constraint creadores_eventos_actor_check
  check (actor in ('radar', 'claude', 'astra', 'bryan', 'manuela', 'importador', 'landing'));

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · creadores_landing_registrar — única puerta de escritura para este camino
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.creadores_landing_registrar(
  p_usuario_ig text,
  p_nicho text,
  p_ciudad text,
  p_rango_seguidores text,
  p_ya_crea_contenido boolean,
  p_contacto_tipo text,
  p_contacto text,
  p_mayor_edad boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       text;
  v_existia  boolean;
  v_carril   text;
  v_evento   text;
begin
  -- Última línea de defensa: el candado real de edad vive en la Edge Function, antes de
  -- llegar aquí. Esta función nunca guarda a quien no confirmó ser mayor de edad.
  if p_mayor_edad is not true then
    raise exception 'mayor_edad requerido' using errcode = '22023';
  end if;

  if p_usuario_ig is null or p_usuario_ig !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'usuario_ig inválido' using errcode = '22023';
  end if;

  if p_contacto_tipo is null or p_contacto_tipo not in ('whatsapp', 'correo') then
    raise exception 'contacto_tipo inválido' using errcode = '22023';
  end if;

  v_id := 'land:' || p_usuario_ig;
  -- El carril VIGENTE, no uno supuesto: si alguien ya lo movió (p. ej. a microprueba), el evento
  -- de un contacto nuevo no puede contar que está en encuesta.
  select c.carril into v_carril from public.creadores_candidatos c where c.creador_id = v_id;
  v_existia := found;

  insert into public.creadores_candidatos (
    creador_id, usuario_ig, segmento, carril, motivos, metricas, fecha_dato, fecha_recepcion, origen
  )
  values (
    v_id, p_usuario_ig, 'aliado', 'encuesta',
    jsonb_build_array('interesado vía PRAXIS de la landing'),
    jsonb_build_object(
      'nicho', p_nicho,
      'ciudad', p_ciudad,
      'rango_seguidores', p_rango_seguidores,
      'ya_crea_contenido', p_ya_crea_contenido,
      'contacto_tipo', p_contacto_tipo,
      'contacto', p_contacto
    ),
    now(), now(), 'landing-praxis'
  )
  on conflict (creador_id) do update
    set actualizado_en = now(),
        -- Nunca pisa carril, fecha_dato ni los datos de la primera vez: un @ que ya existe no se
        -- duplica, solo se anota que volvió a dejar un contacto.
        motivos = public.creadores_candidatos.motivos
                  || jsonb_build_array('nuevo contacto desde landing: ' || p_contacto_tipo);

  v_evento := case when v_existia then 'nuevo contacto desde landing' else 'alta desde landing' end;

  insert into public.creadores_eventos (
    event_id, creador_id, carril_anterior, carril_nuevo, motivo, actor, fecha_dato
  )
  values (
    'land:' || p_usuario_ig || ':' || extract(epoch from now())::bigint,
    v_id,
    case when v_existia then v_carril else null end,
    coalesce(v_carril, 'encuesta'),
    v_evento,
    'landing',
    now()
  )
  -- El event_id va al segundo: un doble envío del mismo @ en el mismo segundo no es un 500,
  -- es el mismo evento (el contacto ya quedó anotado en motivos).
  on conflict (event_id) do nothing;

  return jsonb_build_object('creador_id', v_id, 'es_nuevo', not v_existia);
end
$$;

comment on function public.creadores_landing_registrar(text, text, text, text, boolean, text, text, boolean) is
  'Alta o nuevo contacto de un creador llegado por el PRAXIS de la landing (0178). Un @ nuevo '
  'entra en el carril encuesta; uno que ya existe no se duplica, solo anota el contacto nuevo. '
  'Única puerta de escritura para este camino; la llama solo la Edge Function creadores-landing.';

revoke all on function public.creadores_landing_registrar(text, text, text, text, boolean, text, text, boolean) from public, anon, authenticated;
grant execute on function public.creadores_landing_registrar(text, text, text, text, boolean, text, text, boolean) to service_role;

commit;
