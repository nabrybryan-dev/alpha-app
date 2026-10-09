-- ─────────────────────────────────────────────────────────────────────────────────────────
-- ESTE ARCHIVO LLEGÓ TARDE. La 0112 se aplicó a producción el 9-oct-2026 (versión
-- 20261009043535 en `supabase_migrations.schema_migrations`) SIN que su archivo entrara al
-- repo: el PR #358 llevó el código que lee la tabla y no la migración que la crea. Durante un
-- día, quien reconstruyera la base desde el repo se quedaba sin `notas_llamada`, y ninguna
-- prueba podía ver la tabla. Lo de abajo es, sentencia por sentencia, lo que corrió — copiado
-- de la columna `statements` de esa fila, no reescrito de memoria.
--
-- Y TRAE UN ERROR, QUE SE DEJA A LA VISTA A PROPÓSITO. El comentario de las políticas dice que
-- `es_coach()` «ya cubre a Bryan, a Manuela y a la cuenta de Alfa». Es falso para Manuela: su
-- rol es `nutricionista` y no tiene `puesto_de_coach`, así que la bitácora que se hizo para
-- ella no la podía leer ni escribir. Nadie lo comprobó antes de aplicar. Lo corrige la 0113;
-- aquí no se toca porque esto es el registro de lo que pasó, no de lo que debió pasar.
-- ─────────────────────────────────────────────────────────────────────────────────────────

-- 0112: notas de llamada — bitácora de Manuela (y Bryan) sobre sus llamadas con cada
-- asesorado: fecha, hora, qué se habló y cuándo es la próxima. Staff-only: nunca lo ve
-- el propio asesorado, es la bitácora interna del coach, no un mensaje hacia él.

create table public.notas_llamada (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios_app(id) on delete cascade,
  -- El autor lo pone la base, no quien llama: mismo criterio que `responder_como_staff`
  -- (0083) — nunca se confía en que el cliente diga quién es. `default auth.uid()` más el
  -- `with check` de abajo cierran el hueco en las dos direcciones: ni se omite ni se falsea.
  coach_id uuid not null default auth.uid() references public.usuarios_app(id),
  fecha date not null default current_date,
  hora time,
  conclusiones text not null,
  proxima_reunion text,
  creado_en timestamptz not null default now()
);

comment on table public.notas_llamada is
  'Bitácora de llamadas del coach con cada asesorado (8-oct-2026, pedida por Bryan para Manuela): fecha, hora, conclusiones y próxima reunión. Staff-only, nunca visible para el asesorado.';

create index notas_llamada_usuario_idx on public.notas_llamada (usuario_id, fecha desc, creado_en desc);

alter table public.notas_llamada enable row level security;

-- Mismo criterio que el resto de la consola: `es_coach()` ya cubre a Bryan, a Manuela y a
-- la cuenta de Alfa (ver `capacidades_staff`), no hace falta inventar una capacidad nueva
-- para esto — es la misma puerta que ya abre la ficha del asesorado.
create policy notas_llamada_leer on public.notas_llamada
  for select
  using (es_coach());

create policy notas_llamada_escribir on public.notas_llamada
  for insert
  with check (es_coach() and coach_id = auth.uid());
