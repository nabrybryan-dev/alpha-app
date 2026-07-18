-- App Alpha Athletics · Reparación de usuarios (migración 0006)
-- Problema que corrige: cuentas creadas en Authentication → Users que NO
-- aparecen en la app (ni en la lista de asesorados del coach, ni al entrar
-- ellas mismas, que ven "Tu cuenta existe pero no tiene perfil en la app").
-- Pasa cuando la cuenta se creó antes de instalar el trigger de la
-- migración 0001, o si ese trigger no quedó activo.
-- Es seguro correrla varias veces.

-- 1 · Reinstalar el trigger que crea la fila en usuarios_app al registrarse
create or replace function public.crear_usuario_app()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.usuarios_app (id, nombre, avatar_iniciales)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'nombre', new.email), 2))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_usuario_app();

-- 2 · Rellenar las filas que faltan para cuentas ya existentes
insert into public.usuarios_app (id, nombre, avatar_iniciales)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'nombre', split_part(u.email, '@', 1)),
  upper(left(coalesce(u.raw_user_meta_data ->> 'nombre', u.email), 2))
from auth.users u
where not exists (select 1 from public.usuarios_app a where a.id = u.id)
on conflict (id) do nothing;

-- 3 · Verificación: esta consulta debe listar TODAS las cuentas
-- (coach + cada asesorado). Quien salga aquí con rol 'asesorado'
-- aparece en la lista de asesorados de la app.
select nombre, rol, avatar_iniciales, creado_en
from public.usuarios_app
order by rol desc, nombre;
