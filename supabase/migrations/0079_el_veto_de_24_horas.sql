-- ============================================================================
-- 0079 · El veto de 24 horas
-- ============================================================================
--
-- Decisión del dueño (2026-09-13): «Solo con 24 h de veto». La cadena deja el
-- plan terminado en una bandeja; 24 h después se publica solo si nadie lo paró.
-- Un plan que trae `parada` (zona clínica que lo desactiva) NUNCA se publica
-- solo: queda pendiente hasta acción explícita del coach.
--
-- Qué hay aquí, y por qué junto. Van tres cosas que sueltas se deshacen solas:
--
--   1. La tabla `publicaciones_pendientes` con su RLS (solo staff lee y para,
--      solo service_role inserta; nadie de fuera toca `estado`).
--   2. Dos funciones SECURITY DEFINER idempotentes:
--        · `publicar_pendientes()` — publica las vencidas no paradas y sin
--          parada, en transacción por fila, con la misma limpieza que el molde
--          (`tmp_sesion_en_limpio` / `tmp_*` en `supabase/plantilla-carga-…`):
--          sin `hechoEn`, sin `testPost`, sin `fecha`/`empezadaEn`/`ultimaMarcaEn`,
--          con `series: []`, conservando `escenarios` y `seriesPrescritas`, y con
--          el trigger `trg_sin_estado_en_el_blob` (0066) borrando `estado` del blob.
--          Si al publicar la persona ya tiene un activo distinto del esperado
--          (`id_anterior`), no publica y marca `fallido` con motivo.
--        · `parar_publicacion(id, motivo)` — pasa una fila `pendiente` a `parado`.
--   3. `pg_cron` cada 15 min que llama a `publicar_pendientes()`.
--
-- SEGURIDAD. `create function` concede EXECUTE a PUBLIC y toda función en
-- `public` queda expuesta como RPC a `anon` (GUIA-BRYAN.md §10). Las dos de
-- aquí llevan `revoke … from public, anon` medido contra la 0048/0060.
-- La tabla lleva RLS encendida en el mismo `create table`: sin RLS queda
-- legible con la anon key. Toda auxiliar temporal que se cree para pruebas
-- sigue la misma regla.
--
-- NOMBRE. El número 0079 lo puso el dueño el 14-sep al revisar el PR (main
-- llegaba a 0078). No se
-- renumera.
-- ============================================================================

begin;

-- ── 1 · Tabla bandeja ─────────────────────────────────────────────────────

create table if not exists public.publicaciones_pendientes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.usuarios_app(id) on delete cascade,
  -- id destino, p. ej. m-ana-12 (mismo espacio que microciclos.id)
  microciclo_id text not null,
  -- id del activo que se espera cerrar. Puede ser null si la persona no tiene activo.
  id_anterior   text,
  datos         jsonb not null,
  avisos        jsonb not null default '[]'::jsonb,
  -- Invariante: si trae_parada, NUNCA publica solo. Queda pendiente hasta acción del coach.
  trae_parada   boolean not null default false,
  creado_en     timestamptz not null default now(),
  -- Generada: evita que un INSERT olvide la cuenta atrás.
  publicar_en   timestamptz not null generated always as (creado_en + interval '24 hours') stored,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','parado','publicado','fallido')),
  parado_por    uuid references public.usuarios_app(id),
  motivo        text,
  publicado_en  timestamptz
);

comment on table public.publicaciones_pendientes is
  'Bandeja del veto de 24 h (2026-09-13): la cadena deja el plan terminado y 24 horas despues '
  'se publica solo si nadie lo paro. Un plan con trae_parada nunca se publica solo.';

create index if not exists publicaciones_pendientes_vencidas
  on public.publicaciones_pendientes (estado, publicar_en)
  where estado = 'pendiente';

create index if not exists publicaciones_pendientes_por_usuario
  on public.publicaciones_pendientes (usuario_id);

alter table public.publicaciones_pendientes enable row level security;

-- Solo staff lee. service_role la salta (bypass RLS), así que no necesita policy propia.
drop policy if exists publicaciones_pendientes_lee_staff on public.publicaciones_pendientes;
create policy publicaciones_pendientes_lee_staff on public.publicaciones_pendientes
  for select to authenticated using ((select public.es_staff()));

-- Parar se hace por función SECURITY DEFINER que comprueba es_staff(), no por UPDATE directo.
-- Sin política de UPDATE directa, un UPDATE por API afecta 0 filas.

revoke all on public.publicaciones_pendientes from anon, public;
grant select on public.publicaciones_pendientes to authenticated;
grant all on public.publicaciones_pendientes to service_role;

-- ── Helpers de limpieza (reuso del molde, §1 de plantilla-carga-microciclo.sql) ──
-- Se crean aquí como funciones permanentes con prefijo del veto, no tmp_, para que
-- publicar_pendientes() pueda llamarlos desde el cron sin recrear nada.
-- Si añades un campo de ejecución a Sesion (domain/types.ts), añádelo también aquí.

create or replace function public.veto_sin_marcas(p_items jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce((
    select jsonb_agg((i - 'hechoEn') order by ord)
      from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality as t(i, ord)
  ), '[]'::jsonb);
$fn$;
revoke execute on function public.veto_sin_marcas(jsonb) from public, anon;
grant execute on function public.veto_sin_marcas(jsonb) to authenticated, service_role;

create or replace function public.veto_sesion_en_limpio(p_s jsonb)
returns jsonb language sql immutable as $fn$
  select (
           case when con_cardio ? 'preparacion'
                then jsonb_set(con_cardio, '{preparacion}',
                               public.veto_sin_marcas(con_cardio->'preparacion'))
                else con_cardio
           end
         ) - 'testPost' - 'fecha' - 'empezadaEn' - 'ultimaMarcaEn'
    from (
      select case when p_s ? 'bloquesCardio'
                  then jsonb_set(p_s, '{bloquesCardio}',
                                 public.veto_sin_marcas(p_s->'bloquesCardio'))
                  else p_s
             end
    ) as t(con_cardio);
$fn$;
revoke execute on function public.veto_sesion_en_limpio(jsonb) from public, anon;
grant execute on function public.veto_sesion_en_limpio(jsonb) to authenticated, service_role;

create or replace function public.veto_datos_en_limpio(p_datos jsonb)
returns jsonb language sql immutable as $fn$
  -- Envuelve tmp_sesion_en_limpio sobre cada sesión y resetea series a [].
  -- Conserva escenarios y seriesPrescritas (son prescripción, no ejecución).
  select jsonb_set(
           p_datos - 'estado',
           '{sesiones}',
           coalesce((
             select jsonb_agg(
                      public.veto_sesion_en_limpio(
                        jsonb_set(s, '{ejercicios}', coalesce((
                          select jsonb_agg(jsonb_set(e, '{series}', '[]'::jsonb) order by ord)
                            from jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb))
                                 with ordinality as t(e, ord)
                        ), '[]'::jsonb))
                      ) order by so)
               from jsonb_array_elements(coalesce(p_datos->'sesiones','[]'::jsonb))
                    with ordinality as q(s, so)
           ), '[]'::jsonb)
         );
$fn$;
revoke execute on function public.veto_datos_en_limpio(jsonb) from public, anon;
grant execute on function public.veto_datos_en_limpio(jsonb) to authenticated, service_role;

-- ── 2 · Publicar vencidas ────────────────────────────────────────────────
-- Idempotente y por fila: cada pendiente vencida, no parada y sin trae_parada
-- se publica en su propia transacción lógica (excepción capturada por fila).
-- Si el activo actual ya no es id_anterior, no publica y marca fallido.

create or replace function public.publicar_pendientes()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  v_activo_id text;
  v_activos int;
  v_datos_limpio jsonb;
begin
  for r in
    select * from public.publicaciones_pendientes
     where estado = 'pendiente'
       and trae_parada = false
       and publicar_en <= now()
     order by publicar_en, creado_en
  loop
    begin
      -- Segunda red para trae_parada: si la cadena no lo marcó pero el aviso/dato lo trae.
      -- No se silencia: se deja pendiente (no fallido): es una espera clínica, no un error.
      if r.trae_parada then
        continue;
      end if;
      -- También si avisos menciona parada/clínica: no publicar sola.
      if r.avisos::text ilike '%parada%' then
        continue;
      end if;

      -- ¿Sigue siendo el activo que se esperaba?
      select count(*) into v_activos
        from public.microciclos m
       where m.usuario_id = r.usuario_id and m.estado = 'activo';

      if v_activos > 1 then
        update public.publicaciones_pendientes
           set estado = 'fallido',
               motivo = 'activo distinto: la persona tiene ' || v_activos || ' activos (estado roto)'
         where id = r.id and estado = 'pendiente';
        continue;
      end if;

      if v_activos = 1 then
        select m.id into v_activo_id
          from public.microciclos m
         where m.usuario_id = r.usuario_id and m.estado = 'activo' limit 1;

        -- id_anterior null con activo existente, o id distinto: no publicar
        if r.id_anterior is null or v_activo_id is distinct from r.id_anterior then
          update public.publicaciones_pendientes
             set estado = 'fallido',
                 motivo = 'activo distinto: se esperaba ' || coalesce(r.id_anterior,'<sin activo>')
                          || ' y hay ' || v_activo_id
           where id = r.id and estado = 'pendiente';
          continue;
        end if;
      else -- v_activos = 0
        if r.id_anterior is not null then
          update public.publicaciones_pendientes
             set estado = 'fallido',
                 motivo = 'activo distinto: se esperaba ' || r.id_anterior || ' y no hay activo'
           where id = r.id and estado = 'pendiente';
          continue;
        end if;
      end if;

      -- Limpieza defensiva: reaplica veto_datos_en_limpio por si el JSON vino sin pasar por el molde.
      v_datos_limpio := public.veto_datos_en_limpio(r.datos) || jsonb_build_object('id', r.microciclo_id);

      -- Cerrar antes de abrir (0069: índice único parcial no diferible, mismo orden que activar_microciclo)
      update public.microciclos
         set estado = 'cerrado'
       where usuario_id = r.usuario_id
         and id is distinct from r.microciclo_id
         and estado = 'activo';

      insert into public.microciclos (id, usuario_id, numero, estado, datos, actualizado_en)
      values (r.microciclo_id, r.usuario_id,
              coalesce((r.datos->>'numero')::int, 1),
              'activo', v_datos_limpio, now())
      on conflict (id) do update
         set datos = excluded.datos, estado = 'activo', actualizado_en = now();

      -- Red de seguridad: exactamente uno activo
      select count(*) into v_activos
        from public.microciclos m
       where m.usuario_id = r.usuario_id and m.estado = 'activo';
      if v_activos <> 1 then
        raise exception 'publicar_pendientes: quedaron % activos para %', v_activos, r.usuario_id;
      end if;

      update public.publicaciones_pendientes
         set estado = 'publicado', publicado_en = now()
       where id = r.id and estado = 'pendiente';

    exception when others then
      -- No tumba el resto de la bandeja. Marca fallido con el mensaje del error.
      update public.publicaciones_pendientes
         set estado = 'fallido', motivo = left(SQLERRM, 500)
       where id = r.id and estado = 'pendiente';
    end;
  end loop;
end;
$fn$;

revoke all on function public.publicar_pendientes() from public, anon;
grant execute on function public.publicar_pendientes() to authenticated, service_role;

-- ── 3 · Parar una publicación ────────────────────────────────────────────

create or replace function public.parar_publicacion(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.es_staff() then
    raise exception 'parar_publicacion: solo staff' using errcode = '42501';
  end if;

  update public.publicaciones_pendientes
     set estado = 'parado',
         motivo = nullif(btrim(coalesce(p_motivo,'')), ''),
         parado_por = auth.uid()
   where id = p_id
     and estado = 'pendiente';
end;
$fn$;

revoke all on function public.parar_publicacion(uuid, text) from public, anon;
grant execute on function public.parar_publicacion(uuid, text) to authenticated;

commit;

-- ── 4 · Cron cada 15 min, fuera de transacción (patrón 0048) ──────────────
do $cron_veto$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $q$
      select cron.schedule(
        'publicar-pendientes-cada-15',
        '*/15 * * * *',
        'select public.publicar_pendientes();'
      )
    $q$;
    raise notice 'Veto 24h: cron cada 15 min programado.';
  else
    raise notice 'pg_cron no esta disponible aqui: sin publicacion automatica; la bandeja sigue a mano.';
  end if;
end
$cron_veto$;

-- Comprobación: señales en supabase/comprobar-migraciones.sql (0079)
