-- ============================================================================
-- 0159 · Praxis: los mensajes del equipo, para etiquetar la intención
-- ============================================================================
--
-- SIN APLICAR (3-nov-2026). Se aplica a mano, con el OK de Bryan, ANTES de desplegar la función que la usa. Si
-- faltara, nada se rompe: `praxis-registro` intenta insertar, falla en silencio (deja una línea
-- `praxis-registro: mensaje_equipo` en el log, sin la frase) y la respuesta a la persona sale igual.
-- Comprobarla con su fila en `comprobar-migraciones.sql`.
--
-- QUÉ PEDIDO RESUELVE. Decisión de Bryan (3-nov-2026): la capa de intención de Praxis (CRITERIO-CAPA-INTENCION-
-- 20261103.md, firmado) necesita al menos 60 frases reales etiquetadas por una persona del equipo, y las 25 de
-- `consultas_chat` (hasta el 21-oct, 12 personas) no alcanzan. La cola de dudas (0117) solo guarda lo que el
-- portero no supo contestar; esta tabla guarda cada frase que el EQUIPO le escribe a Praxis, para que Bryan o
-- Manuela le pongan una de las 8 clases por tandas.
--
-- QUÉ GUARDA. La frase completa (hasta 600 caracteres) y la intención que ya etiquetó el registrador (sin llamar
-- a ningún modelo nuevo). Una frase que el filtro de riesgo detiene NO llega aquí: esa señal va por
-- `praxis_avisos_coach` (0108). De asesorados NO se guarda nada hasta que Praxis se abra para ellos (P8).
--
-- QUIÉN PUEDE QUÉ.
--   · INSERTA la función `praxis-registro` con el JWT de la persona del equipo (`es_staff()`, `usuario_id = auth.uid()`),
--     solo las columnas `usuario_id`, `frase` e `intencion_registrador`. Las etiquetas no se pueden fabricar desde fuera.
--   · LEE solo el equipo (`es_staff()`).
--   · Las etiquetas (`clase_propuesta`, `clase_confirmada`, `confirmada_en`) las pone solo service_role, fuera de la app.
--   · Nadie borra ni actualiza con sesión. anon: nada.
-- ============================================================================

begin;

create table if not exists public.praxis_mensajes_equipo (
  id                     uuid primary key default gen_random_uuid(),
  creado_en              timestamptz not null default now(),
  -- Quién escribió (del equipo). Si se borra la cuenta, se borran sus mensajes.
  usuario_id             uuid not null references public.usuarios_app(id) on delete cascade,
  -- La frase completa, tal como la escribió. Solo del equipo.
  frase                  text not null check (length(btrim(frase)) between 1 and 600),
  -- La intención que ya había etiquetado el registrador ('consulta', 'charla', ...). Sin llamar a otro modelo.
  intencion_registrador  text[] not null default '{}' check (cardinality(intencion_registrador) <= 8),
  -- Clase propuesta por Claude y la que confirmó una persona del equipo: 1 saludo, 2 dato/logística, 3 concepto,
  -- 4 duda de ejercicio o plan, 5 dieta, 6 cansancio/queja, 7 salud/riesgo, 8 no se entiende.
  clase_propuesta        smallint check (clase_propuesta between 1 and 8),
  clase_confirmada       smallint check (clase_confirmada between 1 and 8),
  confirmada_en          timestamptz
);

comment on table public.praxis_mensajes_equipo is
  'Mensajes del equipo a Praxis para etiquetar su intención (0159, 2026-11-03): frase completa de coach/nutricionista que pasó el filtro de riesgo, '
  'con la intención del registrador. Nunca guarda frases de asesorados. Inserta praxis-registro con el JWT del equipo; las etiquetas las pone service_role.';

create index if not exists praxis_mensajes_equipo_sin_confirmar
  on public.praxis_mensajes_equipo (creado_en desc) where clase_confirmada is null;

alter table public.praxis_mensajes_equipo enable row level security;

drop policy if exists praxis_mensajes_equipo_leer on public.praxis_mensajes_equipo;
create policy praxis_mensajes_equipo_leer on public.praxis_mensajes_equipo
  for select to authenticated
  using ((select public.es_staff()));

drop policy if exists praxis_mensajes_equipo_insertar on public.praxis_mensajes_equipo;
create policy praxis_mensajes_equipo_insertar on public.praxis_mensajes_equipo
  for insert to authenticated
  with check (
    (select public.es_staff())
    and usuario_id = (select auth.uid())
    and clase_propuesta is null
    and clase_confirmada is null
    and confirmada_en is null
  );

revoke all on public.praxis_mensajes_equipo from anon, public;
revoke all on public.praxis_mensajes_equipo from authenticated;
grant select on public.praxis_mensajes_equipo to authenticated;
grant insert (usuario_id, frase, intencion_registrador) on public.praxis_mensajes_equipo to authenticated;
grant all on public.praxis_mensajes_equipo to service_role;

commit;
