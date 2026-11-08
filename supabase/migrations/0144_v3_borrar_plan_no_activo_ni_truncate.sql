-- 0144 v3 (R12) · PROPUESTA (NO APLICADA, I-16; CAMBIO DE PERMISOS: requiere visto bueno de Bryan y revisor independiente). Decisiones D-17-64H, D-17-76H y D-17-79H (22-oct).
-- NUEVO v3: (1) D-17-79H: un plan ACTIVO no se borra con NINGUN rol de sesion, tampoco service_role (excepcion puntual a D-17-72H solo en este punto): disparador BEFORE DELETE 42501.
--           (2) hallazgo del revisor 13: se revoca TRUNCATE sobre microciclos a PUBLIC, anon, authenticated y service_role (TRUNCATE evadia el registro de borrados).
-- service_role sigue pudiendo borrar planes NO activos (queda registrado, sin autor). Para borrar un activo hay que CERRARLO primero (update estado = 'cerrado').
-- CONSECUENCIAS NO MEDIDAS: (a) la limpieza de la tuberia de pruebas (borrado en cascada desde auth.users) FALLA si el perfil tiene un plan activo: cerrar antes;
--   (b) el dueno de la base tambien queda frenado por el disparador, salvo que lo deshabilite (DISABLE TRIGGER) o use session_replication_role = replica; el dueno conserva TRUNCATE (no se le revoca);
--   (c) motivo forjable por GUC alpha.motivo_borrado: nivel bajo, sin cambios; (d) en v3 la regla de borrar_microciclo y el disparador se solapan (defensa en profundidad): el mutante que quita solo uno sobrevive a proposito.
-- Resto igual a v2 (R11). Se aplica DESPUES de 0135, 0138, 0141 (y 0142/0143).
-- Reversa: drop trigger trg_rechazar_borrado_plan_activo; drop function rechazar_borrado_plan_activo(); grant truncate on public.microciclos a anon, authenticated, service_role (por defecto de Supabase);
--   luego la reversa de v2: drop trigger/funciones/tabla; create policy microciclos_borrar_coach on public.microciclos for delete using (public.es_coach()); grant delete on public.microciclos to anon, authenticated;
begin;

create table public.borrados_microciclo (
  id bigint generated always as identity primary key,
  microciclo_id text not null,
  usuario_id uuid,
  numero integer,
  estado text,
  huella text,
  fila jsonb not null,
  borrado_por uuid,
  rol_sesion text not null,
  motivo text,
  borrado_en timestamptz not null default clock_timestamp()
);
alter table public.borrados_microciclo enable row level security;
revoke all on public.borrados_microciclo from public, anon, authenticated, service_role;
grant select on public.borrados_microciclo to service_role;

create function public.registrar_borrado_microciclo()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.borrados_microciclo (microciclo_id, usuario_id, numero, estado, huella, fila, borrado_por, rol_sesion, motivo)
  values (old.id, old.usuario_id, old.numero, old.estado, public.huella_microciclo(old.datos), to_jsonb(old), auth.uid(),
          coalesce(nullif(current_setting('role', true), 'none'), session_user::text), nullif(current_setting('alpha.motivo_borrado', true), ''));
  return null;
end;
$$;
revoke all on function public.registrar_borrado_microciclo() from public, anon, authenticated, service_role;
create trigger trg_registrar_borrado_microciclo after delete on public.microciclos for each row execute function public.registrar_borrado_microciclo();

create function public.borrar_microciclo(p_id text, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_usuario uuid;
  v_estado text;
begin
  if auth.uid() is null then
    raise exception 'borrar_microciclo: se requiere sesion' using errcode = '42501';
  end if;
  if not public.es_coach() then
    raise exception 'borrar_microciclo: solo el coach borra un microciclo' using errcode = '42501';
  end if;
  if p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'borrar_microciclo: hace falta un motivo' using errcode = '22023';
  end if;
  select usuario_id, estado into v_usuario, v_estado from public.microciclos where id = p_id for update;
  if not found then
    raise exception 'borrar_microciclo: el microciclo no existe' using errcode = 'P0002';
  end if;
  if v_estado = 'activo' then
    raise exception 'borrar_microciclo: un plan activo solo se cierra, no se borra (D-17-76H)' using errcode = '42501';
  end if;
  perform set_config('alpha.motivo_borrado', btrim(p_motivo), true);
  delete from public.microciclos where id = p_id;
  perform set_config('alpha.motivo_borrado', '', true);
  return jsonb_build_object('microciclo_id', p_id, 'usuario_id', v_usuario, 'estado', v_estado, 'borrado_por', auth.uid());
end;
$$;
revoke all on function public.borrar_microciclo(text, text) from public, anon;
grant execute on function public.borrar_microciclo(text, text) to authenticated;

drop policy microciclos_borrar_coach on public.microciclos;
revoke delete on public.microciclos from anon, authenticated;
-- v3 (hallazgo del revisor 13): TRUNCATE no dispara el registro de borrados y Supabase lo concede por defecto: se revoca a todos los roles de sesion.
revoke truncate on public.microciclos from public, anon, authenticated, service_role;
-- v3 (D-17-79H): un plan activo no se borra con NINGUN rol de sesion, tampoco service_role. Disparador BEFORE DELETE (el AFTER DELETE de registro no llega a correr).
create function public.rechazar_borrado_plan_activo()
returns trigger language plpgsql set search_path = public
as $$
begin
  if old.estado = 'activo' then
    raise exception 'un plan activo solo se cierra, no se borra (D-17-79H)' using errcode = '42501';
  end if;
  return old;
end;
$$;
revoke all on function public.rechazar_borrado_plan_activo() from public, anon, authenticated, service_role;
create trigger trg_rechazar_borrado_plan_activo before delete on public.microciclos for each row execute function public.rechazar_borrado_plan_activo();

commit;
