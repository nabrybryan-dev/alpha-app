-- Seudonimo estable para respuestas_preg. No anonimiza valores (texto libre).
begin;

create sequence public.codigos_cadena_numero start with 10;
create table public.codigos_cadena (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  codigo text unique not null check (codigo ~ '^piloto-[0-9]{2,}$'),
  creado_en timestamptz default now()
);
alter table public.codigos_cadena enable row level security;
revoke all on public.codigos_cadena from public, anon, authenticated, service_role;
revoke all on sequence public.codigos_cadena_numero from public, anon, authenticated, service_role;

create function public.cadena_codigo_interno(p_usuario uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_codigo text;
begin
  select c.codigo into v_codigo from public.codigos_cadena c where c.usuario_id = p_usuario;
  if found then return v_codigo; end if;
  -- La secuencia evita colisiones entre personas; el conflicto conserva el codigo
  -- de la primera llamada incluso si dos transacciones crean al mismo usuario.
  insert into public.codigos_cadena as c (usuario_id, codigo)
  values (p_usuario, 'piloto-' || nextval('public.codigos_cadena_numero')::text)
  on conflict (usuario_id) do update set codigo = c.codigo
  returning c.codigo into v_codigo;
  return v_codigo;
end;
$$;
revoke all on function public.cadena_codigo_interno(uuid) from public, anon, authenticated, service_role;

create table public.lecturas_cadena (
  id bigint generated always as identity primary key,
  accion text not null,
  filas int not null check (filas >= 0),
  leido_en timestamptz default now()
);
alter table public.lecturas_cadena enable row level security;
revoke all on public.lecturas_cadena from public, anon, authenticated, service_role;
revoke all on sequence public.lecturas_cadena_id_seq from public, anon, authenticated, service_role;

-- Cambia el tipo de retorno: PostgreSQL exige DROP, dentro de la transaccion.
drop function public.cadena_respuestas_preg();
create function public.cadena_respuestas_preg()
returns table (respuesta_id text, cuestionario_id text, codigo text, fecha_iso timestamptz,
               valores jsonb, pregunta_ref text, solicitud_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_filas int;
begin
  return query
  select r.id, r.cuestionario_id, public.cadena_codigo_interno(r.usuario_id),
         r.fecha_iso, r.valores, r.pregunta_ref, r.solicitud_id
    from (
      select distinct on (r.cuestionario_id)
             r.id, r.cuestionario_id, r.usuario_id, r.fecha_iso, r.valores,
             c.datos->>'ref' as pregunta_ref, c.datos->>'solicitud_id' as solicitud_id
        from public.respuestas r
        join public.cuestionarios c on c.id = r.cuestionario_id
       where r.cuestionario_id like 'preg-%'
         and r.cuestionario_id not like 'preg-viernes-%'
         and r.fecha_iso > now() - interval '60 days'
       order by r.cuestionario_id, r.fecha_iso desc
    ) r
   order by r.cuestionario_id, r.fecha_iso desc;
  get diagnostics v_filas = row_count;
  insert into public.lecturas_cadena (accion, filas) values ('respuestas_preg', v_filas);
end;
$$;
revoke all on function public.cadena_respuestas_preg() from public, anon, authenticated;
grant execute on function public.cadena_respuestas_preg() to service_role;

-- Conserva los filtros de 0168 y el UUID exclusivamente para escribir en la app.
-- VOLATILE: asignar el seudonimo puede insertar en codigos_cadena.
drop function public.cadena_altas_pendientes();
create function public.cadena_altas_pendientes()
returns table (usuario_id text, codigo text, creado_en text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select u.id::text, public.cadena_codigo_interno(u.id), u.creado_en::text
    from public.usuarios_app u
   where u.rol <> 'coach'
     and u.nombre not like 'PRUEBA-AGENTES%'
     and u.nombre <> 'Bryan (prueba)'
     and not exists (select 1 from public.microciclos m where m.usuario_id = u.id)
   order by u.creado_en asc;
$$;
revoke all on function public.cadena_altas_pendientes() from public, anon, authenticated, service_role;
grant execute on function public.cadena_altas_pendientes() to service_role;
-- insertar_cuestionario sigue recibiendo uuid[]: no consume la salida de esta RPC
-- en el contrato del repo. No se agrega resolucion inversa ni se cambia esa guarda.
commit;
