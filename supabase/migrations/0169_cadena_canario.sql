-- ============================================================================
-- 0169 · El canario diario de la cadena (tuberia/canario_cadena.py), aislado
-- ============================================================================
--
-- Va después de la 0168 (cadena_agentes_sin_cli). Hasta que esta se aplique, el flujo
-- alpha-canario-diario NO se importa (importar-flujos.ps1 sin -ConCanario).
--
-- QUÉ HACE EL CANARIO. Cada día una persona inventada (nombre `PRUEBA-AGENTES-CANARIO …`,
-- correo `prueba-agentes-canario-…@invalid.test`) recibe un primer plan PROPUESTO, se comprueba
-- que el disparador de la 0107 le crea su aprobación, y se borra todo. Estas RPCs solo tocan
-- cuentas con las dos marcas (cadena_es_canario).
--
-- POR QUÉ ESTA VERSIÓN (revisión del 7-nov-2026 contra la base real, pg_get_functiondef):
--
--  1. Regla de ventana. `vencer_primer_plan` (pg_cron cada 15 min) toma toda aprobación
--     `propuesto` con `plazo_hasta <= now()` (por defecto now()+12 h): sin clasificar la manda a
--     `espera_bryan` (a Bryan le llega un primer plan falso) y, clasificada y con la regla
--     encendida, `activar_por_regla_ventana` la ACTIVA (riesgo bajo o medio). Un plan activo ya
--     no se borra (`trg_rechazar_borrado_plan_activo`) y `activaciones_regla_ventana` lo ata con
--     RESTRICT; una aprobación `espera_bryan` tampoco (`proteger_aprobacion_decidida`).
--     Solo pasa si un canario sobrevive a su pasada (borrado que falla), pero entonces es cada día.
--     ARREGLO sin tocar la regla: el canario aleja el plazo de SU aprobación 100 años. Ni
--     `vencer_primer_plan` ni `activar_por_regla_ventana` la ven vencida nunca; para las personas
--     reales nada cambia (no se edita ninguna función de la regla). Subir el plazo es lo único que
--     `proteger_clasificacion_primer_plan` deja hacer (bajarlo no). 100 años y no `infinity`: una
--     resta `plazo_hasta - now()` con infinity da error en Postgres < 17.
--  2. Auditoría de borrados. `trg_registrar_borrado_microciclo` copia cada borrado a
--     `borrados_microciclo`. El borrado del canario deja su motivo (`alpha.motivo_borrado`) y
--     quita en la MISMA transacción las filas que acaba de escribir (solo las de ese usuario,
--     ya comprobado canario): no queda nada que leer como borrado real.
--  3. Consola de Manuela. `primerosPlanesPendientes` (alpha-app src/data/consola/primerosPlanes.ts)
--     lista `propuesto` y `espera_bryan` sin filtrar: el filtro va en la app (ver ENCENDER.md).
--     Mientras tanto el plan del canario vive unos segundos y, con el plazo a 100 años, queda el
--     último de la bandeja (ordena por plazo_hasta).
--
-- PERMISOS. SECURITY DEFINER con search_path fijo, solo service_role (la función cadena-agentes).

begin;

-- Es canario quien tiene el correo reservado Y (si ya tiene fila en la app) el nombre marcado.
-- Sin fila en usuarios_app también cuenta: así se limpia un canario a medio crear.
create or replace function public.cadena_es_canario(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from auth.users a
      left join public.usuarios_app u on u.id = a.id
     where a.id = p_usuario
       and a.email like 'prueba-agentes-canario-%@invalid.test'
       and (u.id is null or u.nombre like 'PRUEBA-AGENTES-CANARIO %')
  );
$$;

create or replace function public.cadena_canario_restos()
returns table (usuario_id uuid, creado_en timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.created_at
    from auth.users a
   where a.email like 'prueba-agentes-canario-%@invalid.test'
     and public.cadena_es_canario(a.id)
   order by a.created_at
   limit 20;
$$;

-- `auditoria`: filas de borrados_microciclo del canario. Se da también cuando ya no existe:
-- el canario comprueba tras borrarse que no dejó rastro.
create or replace function public.cadena_canario_estado(p_usuario uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_auditoria int := (select count(*) from public.borrados_microciclo b
                       where b.usuario_id = p_usuario and b.microciclo_id like 'PRUEBA-AGENTES-CANARIO-%');
begin
  if not exists (select 1 from auth.users where id = p_usuario)
     and not exists (select 1 from public.usuarios_app where id = p_usuario) then
    return jsonb_build_object('existe', false, 'auditoria', v_auditoria);
  end if;
  if not public.cadena_es_canario(p_usuario) then
    raise exception 'cadena_canario_estado: no es un canario' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'existe', true,
    'nombre', (select u.nombre from public.usuarios_app u where u.id = p_usuario),
    'rol', (select u.rol from public.usuarios_app u where u.id = p_usuario),
    'microciclos', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'estado', m.estado,
                                                                 'numero', m.numero) order by m.id), '[]'::jsonb)
                      from public.microciclos m where m.usuario_id = p_usuario),
    'aprobaciones', (select coalesce(jsonb_agg(jsonb_build_object(
                                       'microciclo_id', a.microciclo_id, 'estado', a.estado, 'riesgo', a.riesgo,
                                       'plazo_lejos', a.plazo_hasta > now() + interval '50 years')), '[]'::jsonb)
                       from public.aprobaciones_primer_plan a where a.usuario_id = p_usuario),
    'cuestionarios', (select count(*) from public.cuestionarios c where p_usuario = any(c.asignado_a)),
    'auditoria', v_auditoria
  );
end;
$$;

-- El primer plan PROPUESTO del canario: un microciclo mínimo; el disparador de la 0107 le crea la
-- aprobación, y aquí se le aleja el plazo (punto 1 de la cabecera). Si el disparador no la creó,
-- no se toca nada más: el canario lo dirá («el disparador no creó la aprobación»).
create or replace function public.cadena_canario_proponer(p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := 'PRUEBA-AGENTES-CANARIO-' || left(p_usuario::text, 8) || '-M1';
begin
  if not public.cadena_es_canario(p_usuario)
     or not exists (select 1 from public.usuarios_app where id = p_usuario) then
    raise exception 'cadena_canario_proponer: no es un canario con cuenta en la app' using errcode = '42501';
  end if;
  insert into public.microciclos (id, usuario_id, numero, estado, datos)
  values (v_id, p_usuario, 1, 'propuesto',
          jsonb_build_object('canario', true,
                             'nota', 'Canario diario de la cadena (tuberia/canario_cadena.py); se borra en el acto.'))
  on conflict (id) do nothing;
  update public.aprobaciones_primer_plan a
     set plazo_hasta = greatest(a.plazo_hasta, now() + interval '100 years'), actualizado_en = now()
   where a.microciclo_id = v_id and a.usuario_id = p_usuario and a.estado = 'propuesto';
  return public.cadena_canario_estado(p_usuario);
end;
$$;

-- Borra el canario: sus microciclos primero (con motivo, y sin dejar su copia en
-- borrados_microciclo), sus cuestionarios (asignado_a es uuid[] suelto, sin cascada) y la cuenta
-- ARRIBA (auth.users: la cascada se lleva usuarios_app y lo que cuelga de ella).
-- Un canario con plan ACTIVO no se puede borrar (D-17-79H): se dice claro en vez del error del
-- disparador; con el plazo a 100 años no debería pasar nunca.
create or replace function public.cadena_canario_borrar(p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_micro int;
  v_audit int;
  v_cuest int;
  v_users int;
begin
  if not public.cadena_es_canario(p_usuario) then
    raise exception 'cadena_canario_borrar: no es un canario' using errcode = '42501';
  end if;
  if exists (select 1 from public.microciclos m where m.usuario_id = p_usuario and m.estado = 'activo') then
    raise exception 'cadena_canario_borrar: el canario tiene un plan ACTIVO; lo cierra una persona' using errcode = '55000';
  end if;
  perform set_config('alpha.motivo_borrado', 'canario diario de la cadena (cadena_canario_borrar)', true);
  delete from public.microciclos m where m.usuario_id = p_usuario;
  get diagnostics v_micro = row_count;
  delete from public.borrados_microciclo b where b.usuario_id = p_usuario;  -- ya se sabe canario
  get diagnostics v_audit = row_count;
  delete from public.cuestionarios c
   where p_usuario = any(c.asignado_a)
     and c.id like 'preg-PRUEBA-AGENTES-%';
  get diagnostics v_cuest = row_count;
  delete from auth.users a
   where a.id = p_usuario
     and a.email like 'prueba-agentes-canario-%@invalid.test';
  get diagnostics v_users = row_count;
  perform set_config('alpha.motivo_borrado', '', true);
  return jsonb_build_object('microciclos', v_micro, 'auditoria_limpiada', v_audit,
                            'cuestionarios', v_cuest, 'cuentas', v_users);
end;
$$;

-- ── Permisos: solo service_role ───────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.cadena_es_canario(uuid)',
    'public.cadena_canario_restos()',
    'public.cadena_canario_estado(uuid)',
    'public.cadena_canario_proponer(uuid)',
    'public.cadena_canario_borrar(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;
