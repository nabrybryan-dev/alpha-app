-- ============================================================================
-- 0164 · La cadena de n8n sin la CLI: RPCs acotadas para la función `cadena-agentes`
-- ============================================================================
--
-- POR QUÉ (7-nov-2026). Los flujos del ASUS leían y escribían la base de la app con
-- `supabase db query --linked --project-ref sbzmbiwrnvegrticatza`. Se cayó tres veces:
-- contraseña rotada (oct), sesión de la CLI vencida y `LegacyDbConfigIpv6Error` (la red del
-- ASUS perdió IPv6). La cola de la landing ya salió de eso con una Edge Function detrás de una
-- clave (`cola-agentes`). Esto es lo mismo para la app: la función `cadena-agentes` llama a
-- estas RPCs con service_role y NO acepta SQL: cada acción es una de estas funciones.
--
-- INVENTARIO (los tres nodos `executeCommand` con `supabase db query` de los cuatro flujos,
-- leídos del n8n del ASUS el 7-nov-2026; alpha-cola-landing ya no usa la CLI):
--   alpha-alta-nueva · «Buscar altas nunca procesadas»  -> cadena_altas_pendientes()
--   alpha-respuesta  · «Buscar respuestas preg-*»       -> cadena_respuestas_preg()
--   alpha-pregunta   · «Insertar cuestionario»          -> cadena_insertar_cuestionario(...)
-- Las tres consultas se copian TAL CUAL (mismos filtros, mismo orden, mismo `on conflict`).
--
-- (El canario diario va en una migración aparte, cuando quede aislado de la consola de
-- Manuela, de la regla de ventana y de la auditoría de borrados.)
-- Y el canario diario (tuberia/canario_cadena.py), que solo puede tocar cuentas que lleven
-- a la vez el nombre `PRUEBA-AGENTES-CANARIO …` y el correo `prueba-agentes-canario-…@invalid.test`
-- (dominio reservado: no entrega correo nunca):
--   cadena_canario_restos() · cadena_canario_estado(uuid) · cadena_canario_proponer(uuid)
--   cadena_canario_borrar(uuid)
--
-- PERMISOS. Todas SECURITY DEFINER con search_path fijo, sin `public`, `anon` ni
-- `authenticated`: solo service_role (la función). Con la clave de la función no se puede leer
-- a una persona real por estas RPCs: las de canario rechazan a quien no es canario.
--
-- NUMERO. Sin número a propósito (regla 1.1 del CLAUDE.md: el número de alpha-app se pregunta).
-- El 7-nov-2026 el último de alpha-app/origin/main era 0162; Bryan elige el número al copiarla.

begin;

-- ── 0 · Salud: la función llega a la base ─────────────────────────────────
create or replace function public.cadena_salud()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('ok', true, 'ahora', now());
$$;

-- ── 1 · alpha-alta-nueva: altas nunca procesadas ──────────────────────────
create or replace function public.cadena_altas_pendientes()
returns table (usuario_id text, creado_en text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id::text as usuario_id, u.creado_en::text as creado_en
    from public.usuarios_app u
   where u.rol <> 'coach'
     and u.nombre not like 'PRUEBA-AGENTES%'
     and u.nombre <> 'Bryan (prueba)'
     and not exists (select 1 from public.microciclos m where m.usuario_id = u.id)
   order by u.creado_en asc;
$$;

-- ── 2 · alpha-respuesta: la última respuesta de cada cuestionario preg-* ──
create or replace function public.cadena_respuestas_preg()
returns table (respuesta_id text, cuestionario_id text, usuario_id uuid, fecha_iso timestamptz,
               valores jsonb, pregunta_ref text, solicitud_id text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct on (r.cuestionario_id)
         r.id as respuesta_id, r.cuestionario_id, r.usuario_id, r.fecha_iso, r.valores,
         c.datos->>'ref' as pregunta_ref,
         c.datos->>'solicitud_id' as solicitud_id
    from public.respuestas r
    join public.cuestionarios c on c.id = r.cuestionario_id
   where r.cuestionario_id like 'preg-%'
     and r.cuestionario_id not like 'preg-viernes-%'
     -- Solo lo reciente: antes salía todo el histórico (con datos de salud) en cada vuelta.
     -- 60 días cubren una respuesta tardía; lo ya procesado lo filtra el registro de la cinta.
     and r.fecha_iso > now() - interval '60 days'
   order by r.cuestionario_id, r.fecha_iso desc;
$$;

-- ── 3 · alpha-pregunta: insertar el cuestionario (si ya existe, no se pisa) ─
create or replace function public.cadena_insertar_cuestionario(p_id text, p_datos jsonb, p_asignado uuid[])
returns table (id text, confirmado_en text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if p_id is null or p_id !~ '^preg-' or length(p_id) > 200 then
    raise exception 'cadena_insertar_cuestionario: id no admitido' using errcode = '22023';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'cadena_insertar_cuestionario: datos no es un objeto' using errcode = '22023';
  end if;
  if p_asignado is null or cardinality(p_asignado) not between 1 and 20
     or array_position(p_asignado, null) is not null then
    raise exception 'cadena_insertar_cuestionario: asignado_a no admitido' using errcode = '22023';
  end if;

  -- Igual que el INSERT del nodo: on conflict no toca `datos` (devuelve la fila y sigue).
  return query
  insert into public.cuestionarios as c (id, datos, asignado_a)
  values (p_id, p_datos, p_asignado)
  on conflict (id) do update set id = excluded.id
  returning c.id,
            to_char(now() at time zone 'UTC', 'YYYY-MM-DD') || 'T'
              || to_char(now() at time zone 'UTC', 'HH24:MI:SS.US') || 'Z';
end;
$$;

-- ── 4 · Permisos: solo service_role ───────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.cadena_salud()',
    'public.cadena_altas_pendientes()',
    'public.cadena_respuestas_preg()',
    'public.cadena_insertar_cuestionario(text, jsonb, uuid[])'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;
