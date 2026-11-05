-- ============================================================================
-- 0161 · Praxis: el libro de lo que se guardó (praxis_registros_aplicados) y la RPC del agua
-- ============================================================================
--
-- APLICADA en la base real el 5-nov-2026, con el sí de Bryan («ve con esto»), después de que la prueba
-- `supabase/test/261-praxis-registros-aplicados.sql` pasara en el CI (PR #424). Comprobarla con su fila en
-- `comprobar-migraciones.sql`. Se aplicó ANTES de desplegar ninguna función que la use: hoy nadie la llama.
--
-- NÚMERO. 0161 = el siguiente libre. Revisadas las migraciones de todas las ramas (remotas y locales) el 5-nov:
-- main llega a 0160; `app/perfil-desde-landing` y `lab/puente-0160` también llegan a 0160; ninguna rama tiene
-- 0161 o más. Si otra rama toma el 0161 antes de aplicar esta, renumerar esta.
--
-- QUÉ CREA.
--   1. `public.praxis_registros_aplicados`: el libro. Una fila por cada tarjeta que Praxis guardó de verdad
--      (agua, comida, check-in, series, adherencia), con el valor `antes` y `despues` para poder deshacer.
--      Clave única `(usuario_id, mensaje_id, indice)`: la misma tarjeta dos veces es UNA fila.
--   2. `public.praxis_aplicar_agua(p_mensaje_id, p_indice, p_delta_ml)`: suma agua del día de HOY en Bogotá,
--      una sola vez por tarjeta, y devuelve el total del día para que la app lo FIJE (no lo sume).
--
-- POR QUÉ. Decisiones de Bryan del 4-nov-2026 (DECISIONES-ENRUTADOR, PLAN-GUARDAR-REGISTROS, DISENO-DESHACER-REAL):
--   · Agua: Praxis escribe en la nube y la app fija el total devuelto. Hoy `registrarHidratacion` suma un delta y
--     no es idempotente (P5): reaplicar la tarjeta duplicaría los mL. El libro lo resuelve.
--   · Deshacer: ventana de 24 h, mismo día local, con confirmación. Sin el `antes` guardado no hay cómo.
--   · Una sola tabla para los tres (y series/adherencia): comida y check-in añadirán sus RPC en migraciones propias.
--
-- QUIÉN PUEDE QUÉ.
--   · LEER: la persona dueña de la fila (`usuario_id = auth.uid()`) y el equipo (`es_staff()`), igual que
--     `hidratacion_lee_staff` (decisión de Bryan, 5-nov-2026). El equipo LEE; no escribe ni deshace en el libro.
--   · ESCRIBIR: nadie con sesión directamente (sin políticas de insert/update/delete y sin privilegios). Solo
--     la función de abajo, `security definer` con `search_path` fijo, que NO recibe `usuario_id`: toma
--     `auth.uid()`. Una persona no puede inventarse filas del libro ni escribir a nombre de otra.
--     (El plan hablaba de RPC `invoker`; con invoker habría que dar insert directo en el libro y cualquiera
--     podría falsificar su `antes`. Es el único cambio de diseño respecto del plan; queda anotado para revisión.)
--   · anon: nada. La función lleva `revoke execute from public, anon` (por defecto `create function` da EXECUTE
--     a PUBLIC y todo lo de `public` queda expuesto como RPC a la anon key).
--   · Sin políticas tautológicas (lección de la 0008): la única política compara la columna con `auth.uid()`.
--
-- LÍMITES DEL AGUA (espejo de `limites.ts`; si cambian allá, cambian aquí).
--   · Cada tarjeta suma entre 1 y 3000 mL. Cero, negativo o más se rechaza.
--   · El día se calcula aquí, en hora de Bogotá (UTC-5), nunca con el reloj del teléfono: 23:30 en Bogotá es
--     el día de Bogotá, no el siguiente en UTC. No hay parámetro de fecha: solo se escribe HOY.
--   · Techo duro del total del día: 10000 mL (rechaza y revierte todo). El aviso a 6000 mL lo da la tarjeta
--     con confirmación, antes de llegar aquí.
--
-- IDEMPOTENCIA. Primero se intenta insertar la fila del libro. Si ya existía `(usuario, mensaje, indice)`, no se
-- suma nada y se devuelve el total actual con `ya_aplicado = true`. Si dos envíos llegan a la vez, el segundo
-- espera la clave única y, al soltarse, no suma. Libro y agua van en la MISMA transacción: o quedan los dos o ninguno.
--
-- CÓMO REVERTIRLA (solo si no hay registros que importen en el libro):
--   begin;
--   drop function if exists public.praxis_aplicar_agua(text, int, int);
--   drop table if exists public.praxis_registros_aplicados;
--   commit;
--   Ojo: borrar el libro pierde el `antes` y deja sin deshacer lo ya guardado. El agua ya sumada en `hidratacion`
--   NO se resta sola; mirar antes: select * from praxis_registros_aplicados where tipo = 'agua'.
--
-- DECIDIDO POR BRYAN (5-nov-2026): techo de 10 L por día; el equipo lee el libro. Queda por confirmar al
-- conectar la app: `mensaje_id` estable entre reintentos de la misma tarjeta (de eso depende no sumar dos veces).
-- `security definer` en vez de invoker (arriba) y `on delete cascade` desde `usuarios_app` (igual que `hidratacion`).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1 · El libro
-- ---------------------------------------------------------------------------
create table if not exists public.praxis_registros_aplicados (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null references public.usuarios_app (id) on delete cascade,
  -- Qué se guardó. Las ramas de comida y check-in llegan en sus propias migraciones.
  tipo                 text not null check (tipo in ('agua', 'comida', 'checkin', 'series', 'adherencia')),
  -- De qué tarjeta viene: el mensaje de la conversación y el lugar de la tarjeta dentro de él (0, 1, 2...).
  mensaje_id           text not null check (length(btrim(mensaje_id)) between 1 and 120),
  indice               int  not null default 0 check (indice between 0 and 11),
  -- A qué fila apunta (agua: {"fila_id": "hid-<uid>-<fecha>", "fecha": "2026-11-05", "delta_ml": 250}).
  ref                  jsonb not null default '{}'::jsonb check (jsonb_typeof(ref) = 'object'),
  -- El valor de antes y de después (agua: {"ml": 600} y {"ml": 850}). `antes` nulo = no existía la fila.
  antes                jsonb,
  despues              jsonb,
  creado_en            timestamptz not null default now(),
  deshecho_en          timestamptz,
  deshecho_mensaje_id  text check (deshecho_mensaje_id is null or length(btrim(deshecho_mensaje_id)) between 1 and 120),
  constraint praxis_registros_aplicados_tarjeta_unica unique (usuario_id, mensaje_id, indice),
  constraint praxis_registros_aplicados_deshecho_coherente
    check ((deshecho_en is null) = (deshecho_mensaje_id is null))
);

comment on table public.praxis_registros_aplicados is
  'Libro de lo que Praxis guardó de verdad (0161, 2026-11-05): una fila por tarjeta, con antes/despues para deshacer. '
  'Clave unica (usuario_id, mensaje_id, indice) = idempotencia. Solo lo escriben las funciones praxis_* (security definer, auth.uid()); '
  'Lee la persona lo suyo y el equipo (es_staff) todo; nadie escribe directo.';

create index if not exists praxis_registros_aplicados_recientes
  on public.praxis_registros_aplicados (usuario_id, creado_en desc);

alter table public.praxis_registros_aplicados enable row level security;

drop policy if exists praxis_registros_aplicados_leer_propio on public.praxis_registros_aplicados;
create policy praxis_registros_aplicados_leer_propio on public.praxis_registros_aplicados
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists praxis_registros_aplicados_lee_staff on public.praxis_registros_aplicados;
create policy praxis_registros_aplicados_lee_staff on public.praxis_registros_aplicados
  for select to authenticated
  using ((select public.es_staff()));

revoke all on public.praxis_registros_aplicados from anon, public;
revoke all on public.praxis_registros_aplicados from authenticated;
grant select on public.praxis_registros_aplicados to authenticated;
grant all on public.praxis_registros_aplicados to service_role;

-- ---------------------------------------------------------------------------
-- 2 · RPC del agua
-- ---------------------------------------------------------------------------
create or replace function public.praxis_aplicar_agua(
  p_mensaje_id text,
  p_indice     int,
  p_delta_ml   int
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_fecha   date := (now() at time zone 'America/Bogota')::date;
  v_mensaje text := btrim(p_mensaje_id);
  v_fila_id text;
  v_libro   uuid;
  v_total   int;
  v_nueva   boolean;
begin
  if v_uid is null then
    raise exception 'praxis_aplicar_agua: hace falta una sesion' using errcode = '42501';
  end if;
  if v_mensaje is null or length(v_mensaje) not between 1 and 120 then
    raise exception 'praxis_aplicar_agua: mensaje_id invalido' using errcode = '22023';
  end if;
  if p_indice is null or p_indice not between 0 and 11 then
    raise exception 'praxis_aplicar_agua: indice invalido' using errcode = '22023';
  end if;
  if p_delta_ml is null or p_delta_ml not between 1 and 3000 then
    raise exception 'praxis_aplicar_agua: la tarjeta debe sumar entre 1 y 3000 ml' using errcode = '22023';
  end if;

  v_fila_id := 'hid-' || v_uid::text || '-' || v_fecha::text;   -- mismo id que usa la app (sync.ts)

  -- 1) El libro primero: si la tarjeta ya estaba, no se suma nada.
  insert into public.praxis_registros_aplicados (usuario_id, tipo, mensaje_id, indice, ref)
  values (v_uid, 'agua', v_mensaje, p_indice,
          jsonb_build_object('fila_id', v_fila_id, 'fecha', v_fecha, 'delta_ml', p_delta_ml))
  on conflict (usuario_id, mensaje_id, indice) do nothing
  returning id into v_libro;

  if v_libro is null then
    select h.ml into v_total
      from public.hidratacion h
     where h.usuario_id = v_uid and h.fecha = v_fecha;
    return jsonb_build_object(
      'ya_aplicado', true,
      'registro_id', (select r.id from public.praxis_registros_aplicados r
                       where r.usuario_id = v_uid and r.mensaje_id = v_mensaje and r.indice = p_indice),
      'fecha', v_fecha,
      'total_ml', coalesce(v_total, 0)
    );
  end if;

  -- 2) El agua del día: una fila por (usuario, fecha); se suma el delta.
  insert into public.hidratacion (id, usuario_id, fecha, ml)
  values (v_fila_id, v_uid, v_fecha, p_delta_ml)
  on conflict (usuario_id, fecha)
  do update set ml = public.hidratacion.ml + excluded.ml, actualizado_en = now()
  returning ml, (xmax = 0) into v_total, v_nueva;

  if v_total > 10000 then
    raise exception 'praxis_aplicar_agua: el total del dia pasaria de 10000 ml' using errcode = '22023';
  end if;

  -- 3) Lo que había antes y lo que quedó, para poder deshacer (antes nulo = la fila no existía).
  update public.praxis_registros_aplicados
     set antes   = case when v_nueva then null else jsonb_build_object('ml', v_total - p_delta_ml) end,
         despues = jsonb_build_object('ml', v_total)
   where id = v_libro;

  return jsonb_build_object('ya_aplicado', false, 'registro_id', v_libro, 'fecha', v_fecha, 'total_ml', v_total);
end
$$;

comment on function public.praxis_aplicar_agua(text, int, int) is
  'Suma agua de HOY (Bogota) una sola vez por tarjeta (usuario, mensaje, indice). Usa auth.uid(); no recibe usuario_id. Devuelve total_ml del dia para que la app lo fije. 0161.';

revoke execute on function public.praxis_aplicar_agua(text, int, int) from public, anon;
grant execute on function public.praxis_aplicar_agua(text, int, int) to authenticated, service_role;

commit;
