-- ============================================================================
-- 0116 · Praxis: la cola de dudas del equipo (Fase B, pieza 1)
-- ============================================================================
--
-- NO ESTÁ APLICADA. La escribió la rama `praxis/cola-dudas-20261029` el 29-oct-2026 y la aplica Bryan,
-- a mano, en el SQL Editor. Sin ella nada se rompe: `praxis-registro` intenta insertar, falla en silencio
-- (deja una línea `praxis-registro: cola` en el log) y la respuesta a la persona sale igual.
--
-- QUÉ PEDIDO RESUELVE. Decisión de Bryan (28-oct-2026): cuando el portero de fichas no sabe qué ficha
-- contesta una consulta del equipo (sale `ninguna`, «arriba») o duda entre varias (sale `aclarar`), la FRASE
-- COMPLETA se guarda en una cola. Un juez (Haiku) deja anotada la ficha del catálogo que él habría elegido, y
-- el taller (capa 4) reentrena con esa cola solo la capa final del portero. De los asesorados no se guarda
-- nada hasta que Praxis se abra para ellos (P8, Praxis 2).
--
-- QUIÉN PUEDE QUÉ.
--   · INSERTA la función `praxis-registro`, con el JWT de la persona del equipo (rol coach o nutricionista):
--     `es_staff()` y `usuario_id = auth.uid()`. Nunca service_role.
--   · LEE solo el equipo (`es_staff()`).
--   · Nadie actualiza ni borra con sesión. El taller marca `usado_en_taller` con service_role, fuera de la app.
--   · anon: nada.
-- ============================================================================

begin;

create table if not exists public.praxis_cola_dudas (
  id               uuid primary key default gen_random_uuid(),
  creado_en        timestamptz not null default now(),
  -- Quién preguntó (del equipo). Si se borra la cuenta, se borra su cola.
  usuario_id       uuid not null references public.usuarios_app(id) on delete cascade,
  -- La frase completa, tal como la escribió. Solo del equipo.
  frase            text not null check (length(btrim(frase)) between 1 and 600),
  -- Por qué entró: el portero no halló ficha («arriba») o dudó entre varias («aclarar»).
  origen           text not null check (origen in ('arriba', 'aclarar')),
  -- Lo que dijo el portero: { decision, ficha, tres_primeras: [ids] }. Solo ids de ficha.
  portero_fichas   jsonb not null default '{}'::jsonb,
  -- La ficha que eligió el juez del catálogo; null si dijo «ninguna» o si el juez falló.
  ficha_juez       text,
  -- Modelo del juez; null si el juez no respondió (esa fila no sirve al taller).
  modelo_juez      text,
  usado_en_taller  boolean not null default false
);

comment on table public.praxis_cola_dudas is
  'Cola de dudas del equipo para el taller de Praxis (0116, 2026-10-29): frase completa de coach/nutricionista que el portero no resolvió, '
  'con la ficha que eligió el juez. Nunca guarda frases de asesorados. Inserta praxis-registro con el JWT del equipo; el taller marca usado_en_taller con service_role.';

create index if not exists praxis_cola_dudas_pendientes
  on public.praxis_cola_dudas (creado_en desc) where not usado_en_taller;

alter table public.praxis_cola_dudas enable row level security;

drop policy if exists praxis_cola_dudas_leer on public.praxis_cola_dudas;
create policy praxis_cola_dudas_leer on public.praxis_cola_dudas
  for select to authenticated
  using ((select public.es_staff()));

drop policy if exists praxis_cola_dudas_insertar on public.praxis_cola_dudas;
create policy praxis_cola_dudas_insertar on public.praxis_cola_dudas
  for insert to authenticated
  with check (
    (select public.es_staff())
    and usuario_id = (select auth.uid())
    and usado_en_taller = false
  );

revoke all on public.praxis_cola_dudas from anon, public;
revoke all on public.praxis_cola_dudas from authenticated;
grant select, insert on public.praxis_cola_dudas to authenticated;
grant all on public.praxis_cola_dudas to service_role;

commit;
