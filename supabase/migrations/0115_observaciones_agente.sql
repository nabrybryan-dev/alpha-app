-- ============================================================================
-- 0115 · Las observaciones del agente: dónde viven y cómo se firman
-- ============================================================================
--
-- NO ESTÁ APLICADA. La escribió la rama `feat/observaciones-del-agente` el 9-oct-2026 y la aplica
-- Bryan, a mano, en el SQL Editor. Sin ella nada se rompe: la tarjeta «Observaciones del agente» de la
-- ficha dice que no pudo cargar y ofrece reintentar.
--
-- QUÉ PEDIDO RESUELVE. Bryan quiere que agentes de IA evalúen las notas de llamada y las prescripciones
-- de cada asesorado, dejen sus observaciones y sus recomendaciones de estilo de vida en la consola donde
-- trabaja Manuela, y que cada una cite la base de conocimiento en que se apoya. Su regla, tal cual:
--
--     «las bases de conocimiento tienen la última palabra; solamente en el tema de seguridad y
--      prescripciones Manuela y yo tenemos la última palabra»
--
-- De ahí DOS carriles:
--   · `anotada`    — la observación se apoya en la base de conocimiento y queda escrita sin pedir permiso.
--   · `para_firma` — todo lo que toque seguridad (dolor, medicación, cribado, señales de alarma) o proponga
--                    cambiar una prescripción (entrenamiento o comida) queda PENDIENTE hasta que una persona
--                    del equipo la acepte o la descarte.
--
-- POR QUÉ EL CARRIL VIVE EN LA BASE Y NO EN EL AGENTE. La regla del dueño no puede depender de que el agente
-- se acuerde de ella en cada corrida: un modelo se equivoca, cambia de versión o recibe un prompt distinto, y
-- una observación de seguridad colada como `anotada` quedaría escrita y a la vista sin que nadie la firmara.
-- Por eso un CHECK obliga a que `tema in ('seguridad','prescripcion')` vaya SIEMPRE en `para_firma`: el agente
-- puede equivocarse de carril, pero la base rechaza la fila (y el agente se entera del error al escribir).
-- Lo mismo con las fuentes: una observación sin fuente no entra, porque la base de conocimiento es la que
-- tiene la última palabra y sin cita no hay con qué comprobar en qué se apoya.
--
-- QUÉ GUARDA. UNA fila por observación. `fuentes` es un arreglo jsonb NO vacío de
-- `{ "tipo": "base"|"dato", "ref": "<ruta de la wiki o tabla y fecha>", "cita": "<frase corta>" }`: `base` es
-- la base de conocimiento, `dato` es un dato del propio asesorado. La base solo comprueba que sea un arreglo y
-- que no esté vacío; la forma de cada elemento la cuida quien escribe (el agente) y la lee la consola.
-- `unique (usuario_id, corrida_id, titulo)` impide que reintentar una corrida deje la misma observación dos
-- veces (con `corrida_id` null no hay unicidad: sin corrida no hay con qué agrupar).
--
-- QUIÉN PUEDE QUÉ.
--   · LEEN quienes entran a la consola: `es_coach()` o la capacidad `leer_entrenamiento` (la misma puerta
--     de la 0113 y de la 0083: la base y la pantalla dicen lo mismo). La asesorada de quien habla NO la lee:
--     es interno del equipo.
--   · NADIE con sesión inserta, actualiza ni borra: lo escribe el agente, que corre fuera de la app, con
--     `service_role`.
--   · La FIRMA no es un `update` directo, es la función `firmar_observacion_agente`: así quien firma
--     (`auth.uid()`) y la hora los pone la base, y nadie puede reescribir el título, el texto, las fuentes
--     o el carril de lo que el agente dijo, ni firmar a nombre de otro.
--   · anon: nada.
--
-- SEGURIDAD, la regla de siempre (`GUIA-BRYAN.md` §10): RLS en el mismo paso que el `create table`,
-- `revoke all from anon, public, authenticated` antes de conceder nada, y la función `security definer` con
-- `search_path` fijo y sin `execute` para `public` ni `anon`.
--
-- CÓMO COMPROBAR (después de aplicar): la fila 0115 de `supabase/comprobar-migraciones.sql` dice SI (ANTES de
-- aplicar, NO). El CI corre las sesiones de verdad: `supabase/test/215-observaciones-agente.sql`.
-- ============================================================================

begin;

create table if not exists public.observaciones_agente (
  id            uuid primary key default gen_random_uuid(),
  -- De quién habla la observación. Si se borra a la persona se borra lo que se escribió sobre ella.
  usuario_id    uuid not null references public.usuarios_app(id) on delete cascade,
  creado_en     timestamptz not null default now(),
  tema          text not null
                  check (tema in ('nota_de_llamada', 'prescripcion', 'estilo_de_vida', 'seguridad', 'nutricion')),
  carril        text not null check (carril in ('anotada', 'para_firma')),
  titulo        text not null check (length(btrim(titulo)) between 1 and 140),
  texto         text not null check (length(btrim(texto)) > 0),
  -- Sin fuente no entra. `case` y no `and`: `jsonb_array_length` lanza error con algo que no es arreglo, y SQL
  -- no garantiza el orden en que evalúa los dos lados de un `and`.
  fuentes       jsonb not null default '[]'::jsonb
                  check (case when jsonb_typeof(fuentes) = 'array' then jsonb_array_length(fuentes) > 0 else false end),
  -- Nombre del agente que la escribió, y la corrida (para agrupar y no duplicar).
  agente        text not null check (length(btrim(agente)) > 0),
  corrida_id    text,
  -- La firma. Quién y cuándo los pone `firmar_observacion_agente`, nunca el cliente.
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'descartada')),
  -- `on delete set null`: si se borra la cuenta de quien firmó, la firma sigue valiendo (queda su hora).
  firmada_por   uuid references public.usuarios_app(id) on delete set null,
  firmada_en    timestamptz,
  nota_de_firma text check (nota_de_firma is null or length(nota_de_firma) <= 500),

  unique (usuario_id, corrida_id, titulo),

  -- LA REGLA DEL DUEÑO: seguridad y prescripción nunca se anotan solas.
  constraint observaciones_agente_seguridad_y_prescripcion_se_firman
    check (tema not in ('seguridad', 'prescripcion') or carril = 'para_firma'),

  -- Coherencia de la firma: pendiente = sin hora ni firmante; firmada = con hora. El firmante NO se exige en
  -- la segunda parte porque `firmada_por` pasa a null si se borra esa cuenta (`on delete set null`).
  constraint observaciones_agente_firma_coherente
    check (
      (estado = 'pendiente' and firmada_por is null and firmada_en is null)
      or (estado <> 'pendiente' and firmada_en is not null)
    )
);

comment on table public.observaciones_agente is
  'Observaciones y recomendaciones que un agente de IA deja sobre un asesorado, cada una con las fuentes en que se apoya (0115, 2026-10-09). '
  'Carril `anotada` (base de conocimiento, sin permiso) o `para_firma` (seguridad y prescripciones: las firma una persona del equipo). '
  'Solo las escribe el agente con service_role; la firma va por firmar_observacion_agente. El asesorado nunca las ve.';

create index if not exists observaciones_agente_por_persona
  on public.observaciones_agente (usuario_id, creado_en desc);

alter table public.observaciones_agente enable row level security;

drop policy if exists observaciones_agente_leer on public.observaciones_agente;
create policy observaciones_agente_leer on public.observaciones_agente
  for select to authenticated
  using (
    (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

-- Sin política de insert/update/delete: lo escribe el agente (service_role, que se salta RLS) y la única
-- puerta para quien tiene sesión es la función de abajo.
revoke all on public.observaciones_agente from anon, public;
revoke all on public.observaciones_agente from authenticated;
grant select on public.observaciones_agente to authenticated;
grant all on public.observaciones_agente to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- La firma: quien entra a la consola acepta o descarta lo que sigue pendiente.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.firmar_observacion_agente(
  p_id       uuid,
  p_decision text,
  p_nota     text default null
)
returns public.observaciones_agente
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_nota  text := nullif(btrim(p_nota), '');
  v_fila  public.observaciones_agente;
begin
  -- La misma puerta que la lectura: quien no puede ver la observación tampoco la firma.
  if v_actor is null
     or not (public.es_coach() or public.tiene_capacidad('leer_entrenamiento')) then
    raise exception 'solo quien entra a la consola firma las observaciones del agente'
      using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('aceptada', 'descartada') then
    raise exception 'la decisión es «aceptada» o «descartada»' using errcode = '22023';
  end if;
  if v_nota is not null and length(v_nota) > 500 then
    raise exception 'la nota de la firma va de 1 a 500 caracteres' using errcode = '22023';
  end if;

  -- `for update`: si dos personas firman a la vez, la segunda espera y luego ve que ya no está pendiente.
  select * into v_fila from public.observaciones_agente where id = p_id for update;
  if not found then
    raise exception 'la observación no existe' using errcode = 'P0002';
  end if;
  if v_fila.estado <> 'pendiente' then
    raise exception 'la observación ya está firmada' using errcode = '22023';
  end if;

  update public.observaciones_agente
     set estado        = p_decision,
         firmada_por   = v_actor,
         firmada_en    = now(),
         nota_de_firma = v_nota
   where id = p_id
   returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.firmar_observacion_agente(uuid, text, text) from public, anon;
grant execute on function public.firmar_observacion_agente(uuid, text, text) to authenticated, service_role;

commit;
