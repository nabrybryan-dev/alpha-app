-- 0145 v4 · PROPUESTA R16 (v3 + D-17-88H: firmas de una sola escritura, sin TRUNCATE, aviso al reabrir). Texto de v3: PROPUESTA R15 (NO APLICADA, I-16; CAMBIO DE PERMISOS Y DE COMPORTAMIENTO: requiere visto bueno de Bryan y revisor independiente). Numero PROPUESTO: confirmar que nadie lo reclamo.
-- Base: af1417f9 (0001-0141) + 0142 + 0143 + 0144 v3. No edita ninguna migracion existente: reemplaza con CREATE OR REPLACE el cuerpo del disparador de 0141 (enlazado por nombre).
-- v3 (R15, D-17-87H, 22-oct): suma N1b = una aprobacion de primer plan YA DECIDIDA (estado distinto de 'propuesto') no se borra con ningun rol (service_role incluido) mientras exista su microciclo,
--   y una aprobacion nueva insertada por una sesion (authenticated, anon, service_role) solo nace en estado 'propuesto' con decidido_por, decidido_en y motivo vacios.
--   Cierra el delete+insert con firma falsa que el revisor 14 midio sobre v2 (variante X3). Excepcion puntual a D-17-72H solo en este punto.
--   LIMITE: el borrado EN CASCADA de un microciclo (borrar_microciclo de 0144, que deja registro) sigue pudiendo retirar su aprobacion: la regla se aplica mientras el microciclo exista.
--   LIMITE: el dueno de la base puede deshabilitar el disparador (DISABLE TRIGGER) o usar session_replication_role = replica; no se impide, como en 0144.
-- v2 (D-17-82H, 22-oct): SIN el bloqueo de escribir contenido o dueno en planes activos (antes N3). No se aplica en el piloto porque rompe las anotaciones normales de la app
--   (sync.ts: fijar_series_ejercicio, fijar_preparacion_sesion, fijar_test_post) y a rellenar-carga. Tampoco hay puerta ni tabla de rellenos (D-17-78H queda reemplazada).
--   El cuerpo del disparador de 0138 NO se toca.
-- Corrige SOLO N1, N2 y N6 (sonda 252-c6r2 de C6). Aceptados sin corregir: el bloqueo de planes activos (D-17-82H), N4 y N5 (D-17-72H).
-- N1 (ALTO)  una sesion (authenticated, anon, service_role) ya no cambia `estado` de una aprobacion de primer plan; solo lo mueven decidir_primer_plan, vencer_primer_plan y activar_por_regla_ventana (definer).
-- N2 (ALTO)  en INSERT de sesion, creado_en lo pone el servidor (now()) y el minimo de 12 h se compara con now(). now() y no clock_timestamp(): el DEFAULT de plazo_hasta es now() + 12 h en la misma transaccion.
--            Consecuencia aceptada: en una transaccion larga now() es la hora de INICIO de la transaccion.
-- N6 (MEDIO) usuario_id y microciclo_id de una aprobacion son inmutables para sesiones.
-- v4 (R16, D-17-88H, 22-oct): (1) decidido_por, decidido_en y motivo se escriben UNA SOLA VEZ: una vez no nulos, NINGUN rol (service_role y dueno incluidos) los cambia; una sesion tampoco los escribe nunca (solo decidir_primer_plan, definer, la primera vez).
--   (2) se revoca TRUNCATE sobre aprobaciones_primer_plan (y la tabla de reaperturas) a public, anon, authenticated y service_role.
--   (3) reabrir (borrar un plan no activo con aprobacion RECHAZADA y recrearlo: la aprobacion renace propuesta) queda PERMITIDO, pero deja registro (reaperturas_primer_plan) y un AVISO en alertas_coach (tipo primer_plan_reabierto), visible al coach.
--   LIMITE (3): el aviso es una fila en la consola del coach (alertas_coach); NO hay envio real (mensaje/correo/WhatsApp): queda para despues. El aviso salta por PERSONA: con un rechazo retirado sin consumir, la siguiente aprobacion nueva de esa persona avisa (puede sobrar un aviso; no deberia faltar).
--   LIMITE (3): si ya hay un aviso abierto de este tipo para esa persona y semana, no se crea otro (indice unico de alertas_coach); el registro reaperturas_primer_plan si queda siempre.
--   LIMITE: el dueno de la base puede deshabilitar los disparadores o hacer TRUNCATE (es el dueno).
--   Esta migracion redefine alertas_coach_tipo_check con los tipos de 0116/0121/0125 mas 'primer_plan_reabierto': si otra migracion posterior toca ese check, hay que sumar el tipo alli.
begin;

-- ---------------------------------------------------------------- N1, N2, N6
create or replace function public.proteger_clasificacion_primer_plan()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon', 'service_role') then
    if tg_op = 'INSERT' then
      new.creado_en := now();  -- N2: la hora de creacion la pone el servidor, no el cliente
      if new.estado is distinct from 'propuesto' or new.decidido_por is not null or new.decidido_en is not null or new.motivo is not null then  -- N1b
        raise exception 'una aprobacion de primer plan nueva nace propuesta y sin decision' using errcode = '42501';
      end if;
      if new.clasificado_en is not null or new.clasificado_por is not null or new.requiere_revision = false or new.huella_clasificada is not null then
        raise exception 'la clasificacion del primer plan solo la fija clasificar_primer_plan' using errcode = '42501';
      end if;
      if new.plazo_hasta < now() + interval '12 hours' then  -- N2
        raise exception 'el plazo de un primer plan es de al menos 12 horas desde su creacion' using errcode = '42501';
      end if;
    elsif new.riesgo is distinct from old.riesgo or new.requiere_revision is distinct from old.requiere_revision
          or new.dudas_pendientes is distinct from old.dudas_pendientes
          or new.clasificado_en is distinct from old.clasificado_en or new.clasificado_por is distinct from old.clasificado_por
          or new.huella_clasificada is distinct from old.huella_clasificada or new.creado_en is distinct from old.creado_en then
      raise exception 'la clasificacion del primer plan solo la fija clasificar_primer_plan' using errcode = '42501';
    elsif new.estado is distinct from old.estado then  -- N1
      raise exception 'el estado de una aprobacion de primer plan solo lo cambian las funciones de decision' using errcode = '42501';
    elsif new.usuario_id is distinct from old.usuario_id or new.microciclo_id is distinct from old.microciclo_id then  -- N6
      raise exception 'una aprobacion de primer plan no cambia de persona ni de microciclo' using errcode = '42501';
    elsif new.decidido_por is distinct from old.decidido_por or new.decidido_en is distinct from old.decidido_en or new.motivo is distinct from old.motivo then  -- V4-1
      raise exception 'las firmas de una aprobacion solo las escribe decidir_primer_plan' using errcode = '42501';
    elsif new.plazo_hasta < old.plazo_hasta then
      raise exception 'el plazo de un primer plan no se acorta' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- tabla de reaperturas (registro) y tipo de aviso
create table public.reaperturas_primer_plan (
  id bigint generated always as identity primary key,
  usuario_id uuid not null,
  microciclo_id_retirado text not null,
  retirada_decidido_por uuid,
  retirada_decidido_en timestamptz,
  retirada_motivo text,
  retirada_en timestamptz not null default clock_timestamp(),
  reabierta_en timestamptz,
  microciclo_id_nuevo text,
  aprobacion_id_nueva uuid,
  aviso_en timestamptz
);
alter table public.reaperturas_primer_plan enable row level security;
revoke all on public.reaperturas_primer_plan from public, anon, authenticated, service_role;
grant select on public.reaperturas_primer_plan to service_role;

alter table public.alertas_coach drop constraint if exists alertas_coach_tipo_check;
alter table public.alertas_coach add constraint alertas_coach_tipo_check
  check (tipo in ('no_programar', 'parada_cardiaca', 'parada_paso3', 'bloqueado_paso4',
                  'tachado', 'agotado', 'pausada', 'orden_detener', 'propuesta_zona',
                  'registro_faltante', 'piso_agudo', 'sin_plan_semana_entrante', 'regla_vencida', 'primer_plan_reabierto'));

-- ---------------------------------------------------------------- N1b: una aprobacion decidida no se borra (V4-3: si era RECHAZADA y se retira en cascada, queda anotada para avisar si renace)
create function public.proteger_aprobacion_decidida()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- Aplica a TODO rol (tambien service_role y el dueno). Si el microciclo ya no existe, es el borrado en cascada de borrar_microciclo (0144, con registro): se deja pasar.
  if old.estado is distinct from 'propuesto' then
    if exists (select 1 from public.microciclos m where m.id = old.microciclo_id) then
      raise exception 'una aprobacion de primer plan ya decidida no se borra' using errcode = '42501';
    end if;
    if old.estado = 'rechazado' then
      insert into public.reaperturas_primer_plan (usuario_id, microciclo_id_retirado, retirada_decidido_por, retirada_decidido_en, retirada_motivo)
      values (old.usuario_id, old.microciclo_id, old.decidido_por, old.decidido_en, old.motivo);
    end if;
  end if;
  return old;
end;
$$;
revoke all on function public.proteger_aprobacion_decidida() from public, anon, authenticated, service_role;
create trigger trg_proteger_aprobacion_decidida
  before delete on public.aprobaciones_primer_plan
  for each row execute function public.proteger_aprobacion_decidida();

-- ---------------------------------------------------------------- V4-1: firmas de una sola escritura, para TODO rol
create function public.proteger_firma_aprobacion()
returns trigger language plpgsql set search_path = public
as $$
begin
  if (old.decidido_por is not null and new.decidido_por is distinct from old.decidido_por)
     or (old.decidido_en is not null and new.decidido_en is distinct from old.decidido_en)
     or (old.motivo is not null and new.motivo is distinct from old.motivo) then
    raise exception 'la firma de una aprobacion (decidido_por, decidido_en, motivo) se escribe una sola vez' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_firma_aprobacion() from public, anon, authenticated, service_role;
create trigger trg_proteger_firma_aprobacion
  before update on public.aprobaciones_primer_plan
  for each row execute function public.proteger_firma_aprobacion();

-- ---------------------------------------------------------------- V4-3: aviso a Bryan cuando renace una aprobacion tras un rechazo retirado
create function public.avisar_primer_plan_reabierto()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_n integer;
  v_aviso integer;
begin
  update public.reaperturas_primer_plan r
     set reabierta_en = clock_timestamp(), microciclo_id_nuevo = new.microciclo_id, aprobacion_id_nueva = new.id
   where r.usuario_id = new.usuario_id and r.reabierta_en is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.alertas_coach (usuario_id, semana_inicio, tipo, exige_firma, razon, propuesta, acciones_permitidas)
    values (new.usuario_id, date_trunc('week', current_date)::date, 'primer_plan_reabierto', false,
            'Primer plan reabierto: una aprobacion rechazada renacio propuesta al recrear el plan',
            'Revisar quien recreo el plan y por que (registro: reaperturas_primer_plan).',
            array['mantener_y_preguntar']::text[])
    on conflict do nothing;
    get diagnostics v_aviso = row_count;
    if v_aviso > 0 then
      update public.reaperturas_primer_plan r set aviso_en = clock_timestamp() where r.aprobacion_id_nueva = new.id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.avisar_primer_plan_reabierto() from public, anon, authenticated, service_role;
create trigger trg_avisar_primer_plan_reabierto
  after insert on public.aprobaciones_primer_plan
  for each row execute function public.avisar_primer_plan_reabierto();

-- ---------------------------------------------------------------- V4-2: sin TRUNCATE para nadie con sesion
revoke truncate on public.aprobaciones_primer_plan from public, anon, authenticated, service_role;
revoke truncate on public.reaperturas_primer_plan from public, anon, authenticated, service_role;

commit;
-- REVERSA de 0145 v4 (propuesta, NO ejecutada): drop de trg_avisar_primer_plan_reabierto, trg_proteger_firma_aprobacion, sus funciones y la tabla reaperturas_primer_plan; restaurar el check de alertas_coach de 0125; volver al cuerpo v3. Reversa de v3 (propuesta, NO ejecutada): begin; drop trigger trg_proteger_aprobacion_decidida on public.aprobaciones_primer_plan; drop function public.proteger_aprobacion_decidida(); create or replace function public.proteger_clasificacion_primer_plan() ... cuerpo de 0141 (af1417f9); commit;
