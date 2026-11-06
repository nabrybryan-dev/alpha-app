-- 0165 · Solicitudes de derechos del titular: una constancia que no se borra con la cuenta.
--
-- POR QUÉ. La pantalla /yo/derechos guarda la solicitud como un mensaje al coach.
-- Pero `mensajes` borra en cascada cuando se borra la cuenta (0001), y entonces se
-- pierde la prueba de que la persona pidió, por ejemplo, que la borraran. Bryan
-- fijó guardar cada solicitud y su respuesta 2 años después de responderla
-- (D-17-164H, propuesta que valida el abogado).
--
-- QUÉ HACE.
--   · Tabla propia, SIN llave foránea a usuarios_app a propósito: si la cuenta se
--     borra, la constancia queda (solo con los identificadores, sin nombre).
--   · La persona crea la suya, dirigida a su coach VIGENTE (asignaciones_coach,
--     0119), y la lee. No la cambia ni la borra.
--   · Su coach, y quien tenga leer_entrenamiento (Bryan y Manuela), la leen y la
--     responden. Al responder solo se tocan las columnas de respuesta.
--   · Nadie la borra por la app. La borra la purga: el detalle escrito (texto
--     libre) a los 30 días de respondida o a los 90 sin responder, como el resto
--     del texto libre; la fila entera, 2 años después de respondida.
--
-- NO HACE. No cambia la pantalla (sigue escribiendo en mensajes hasta que se
-- conecte aquí) ni programa la purga en pg_cron: las dos cosas, con orden de Bryan.
--
-- NO APLICADA. Escrita el 6-nov-2026 por orden de Bryan. La aplica Bryan con
-- orden escrita.

create table if not exists public.solicitudes_derechos (
  id             uuid primary key default gen_random_uuid(),
  -- Sin llave foránea a propósito (ver arriba).
  persona_id     uuid not null,
  coach_id       uuid not null,
  derecho        text not null check (derecho in
                   ('conocer', 'actualizar_rectificar', 'prueba_autorizacion', 'revocar', 'supresion')),
  detalle        text check (detalle is null or char_length(detalle) between 1 and 500),
  creada_en      timestamptz not null default now(),
  respondida_en  timestamptz,
  respondida_por uuid,
  respuesta      text check (respuesta is null or char_length(respuesta) between 1 and 1000),
  constraint solicitudes_derechos_respuesta_completa
    check ((respondida_en is null) = (respondida_por is null))
);

create index if not exists solicitudes_derechos_persona on public.solicitudes_derechos (persona_id, creada_en desc);
create index if not exists solicitudes_derechos_coach on public.solicitudes_derechos (coach_id, creada_en desc);

alter table public.solicitudes_derechos enable row level security;

revoke all on public.solicitudes_derechos from public, anon, authenticated;
grant select, insert on public.solicitudes_derechos to authenticated;
-- Responder toca solo estas tres columnas: quién pidió qué no se puede reescribir.
grant update (respondida_en, respondida_por, respuesta) on public.solicitudes_derechos to authenticated;
grant all on public.solicitudes_derechos to service_role;

drop policy if exists solicitudes_derechos_crear on public.solicitudes_derechos;
create policy solicitudes_derechos_crear on public.solicitudes_derechos
  for insert to authenticated
  with check (
    persona_id = (select auth.uid())
    and respondida_en is null and respondida_por is null and respuesta is null
    and coach_id = (
      select a.coach_id from public.asignaciones_coach a
      where a.persona_id = (select auth.uid()) and a.asignado_hasta is null
    )
  );

drop policy if exists solicitudes_derechos_leer on public.solicitudes_derechos;
create policy solicitudes_derechos_leer on public.solicitudes_derechos
  for select to authenticated
  using (
    persona_id = (select auth.uid())
    or coach_id = (select auth.uid())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

drop policy if exists solicitudes_derechos_responder on public.solicitudes_derechos;
create policy solicitudes_derechos_responder on public.solicitudes_derechos
  for update to authenticated
  using (
    coach_id = (select auth.uid())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  )
  with check (
    respondida_por = (select auth.uid())
    and respondida_en is not null
    and (coach_id = (select auth.uid()) or (select public.tiene_capacidad('leer_entrenamiento')))
  );

-- Sin política de borrado: por la app no se borra.

create or replace function public.purgar_solicitudes_derechos(p_ahora timestamptz default clock_timestamp())
returns table (detalles_borrados int, filas_borradas int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_detalles int;
  v_filas int;
begin
  update public.solicitudes_derechos
     set detalle = null
   where detalle is not null
     and ((respondida_en is not null and respondida_en < p_ahora - interval '30 days')
       or (respondida_en is null and creada_en < p_ahora - interval '90 days'));
  get diagnostics v_detalles = row_count;

  delete from public.solicitudes_derechos
   where respondida_en is not null and respondida_en < p_ahora - interval '2 years';
  get diagnostics v_filas = row_count;

  return query select v_detalles, v_filas;
end;
$$;

revoke all on function public.purgar_solicitudes_derechos(timestamptz) from public, anon, authenticated;
grant execute on function public.purgar_solicitudes_derechos(timestamptz) to service_role;

comment on table public.solicitudes_derechos is
  '0165: constancia de solicitudes de derechos del titular; sobrevive al borrado de la cuenta; 2 años tras responder (D-17-164H).';

-- DESHACER:
--   drop function if exists public.purgar_solicitudes_derechos(timestamptz);
--   drop table if exists public.solicitudes_derechos;
