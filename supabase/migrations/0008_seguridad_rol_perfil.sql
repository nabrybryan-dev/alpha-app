-- ============ 0008: CIERRES DE SEGURIDAD ============
-- Hallazgos de la auditoría 2026-07-19:
--
-- 1) CRÍTICO — usuarios_editar_propio tenía "with check (... and rol = rol)":
--    la condición compara la columna consigo misma y siempre es verdadera, así
--    que cualquier asesorado autenticado podía ejecutar
--      update usuarios_app set rol = 'coach' where id = auth.uid()
--    y con es_coach() en true leer y escribir los datos de TODOS los clientes.
--    El candado real pasa a ser un trigger (más fiable que una subconsulta
--    autorreferente en WITH CHECK).
--
-- 2) ALTO — perfiles permitía al asesorado reescribir el JSON completo de su
--    perfil (objetivos, volumen, somatotipo…), no solo sus medidas. La app
--    solo toca perfil.medidas; el trigger lo hace obligatorio en el servidor.
--
-- Recordatorio operativo (manual, fuera de SQL): verificar en el dashboard que
-- Authentication → Sign In/Up → "Allow new users to sign up" esté DESACTIVADO.

-- ---------- 1) Nadie cambia roles salvo el coach ----------

create or replace function public.proteger_rol()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.rol is distinct from old.rol then
    -- auth.uid() nulo = contexto de servicio/migración (sin sesión de usuario)
    if auth.uid() is not null and not public.es_coach() then
      raise exception 'No estás autorizado para cambiar roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_rol on public.usuarios_app;
create trigger trg_proteger_rol
  before update on public.usuarios_app
  for each row execute function public.proteger_rol();

-- La política queda solo con la condición de fila (el rol lo fija el trigger).
drop policy if exists usuarios_editar_propio on public.usuarios_app;
create policy usuarios_editar_propio on public.usuarios_app
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- 2) El asesorado solo modifica sus medidas ----------

create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.es_coach() then
    return new;
  end if;
  -- El resto del JSON (todo menos 'medidas') debe quedar idéntico.
  if tg_op = 'UPDATE'
     and (new.datos - 'medidas') is distinct from (old.datos - 'medidas') then
    raise exception 'Solo puedes actualizar tus medidas';
  end if;
  if tg_op = 'INSERT' and (new.datos - 'medidas') <> '{}'::jsonb then
    raise exception 'Solo puedes registrar tus medidas';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_perfil on public.perfiles;
create trigger trg_proteger_perfil
  before insert or update on public.perfiles
  for each row execute function public.proteger_perfil();
