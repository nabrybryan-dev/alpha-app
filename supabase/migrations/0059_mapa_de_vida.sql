-- 0059 · El mapa de vida: cómo vive el asesorado, no cómo durmió hoy.
--
-- QUÉ ES. La encuesta que le pregunta al asesorado sus palancas circadianas de
-- fondo -si le da el sol al despertar, cuándo come, a qué hora entrena, cuánta
-- cafeína toma, cómo es su estrés- para que un mensaje le llegue cuando le
-- sirve a él, no a la hora que nos venga bien a nosotros. Contrato completo en
-- `src/domain/mapaDeVida/contrato.md`.
--
-- POR QUÉ TABLA NUEVA Y NO REUSAR `respuestas`. Se evaluó primero: `respuestas`
-- (0019) ya guarda cualquier encuesta en un jsonb, sin migración por pregunta.
-- Pero `respuestas.cuestionario_id references public.cuestionarios (id)`, y
-- `cuestionarios.asignado_a` es un `uuid[]` que el coach llena a mano por
-- persona -pensado para encuestas puntuales, no para algo que le toca a TODA
-- la cartera-. Mantener esa lista al día en cada alta/baja no aporta nada
-- aquí, así que se abre una tabla propia, mínima: una fila por asesorado.
--
-- POR QUÉ NO HACE FALTA MIGRACIÓN POR PREGUNTA. Las respuestas viajan enteras
-- dentro de `valores jsonb` -mismo patrón que `perfil_alimentario.respuestas`
-- (0019) y que `checkins.datos` (0001)-. Añadir una séptima pregunta a
-- `src/domain/mapaDeVida/preguntas.ts` no vuelve a tocar SQL: solo esta
-- migración de ESQUEMA (la tabla en sí) fue necesaria, no una de datos.

begin;

create table if not exists public.mapa_de_vida_respuestas (
  usuario_id uuid primary key references public.usuarios_app (id) on delete cascade,
  valores jsonb not null,
  respondido_en timestamptz not null default now()
);

comment on table public.mapa_de_vida_respuestas is
  'El mapa de vida: cómo vive el asesorado. Una fila por persona; valores en crudo, sin columna por pregunta.';
comment on column public.mapa_de_vida_respuestas.valores is
  'Clave = id de PreguntaMapaDeVida, valor = lo que respondió. Fuente de verdad; sin proyección aparte.';

alter table public.mapa_de_vida_respuestas enable row level security;

-- Mismo patrón que perfiles/checkins: cada cual lee y escribe lo suyo, el
-- coach lee todo para poder decidir el recado. El coach NO escribe: esta
-- encuesta la contesta el asesorado, nunca en su nombre.
create policy mapa_de_vida_leer on public.mapa_de_vida_respuestas
  for select using (usuario_id = auth.uid() or public.es_coach());

create policy mapa_de_vida_escribir_propia on public.mapa_de_vida_respuestas
  for insert with check (usuario_id = auth.uid());

create policy mapa_de_vida_actualizar_propia on public.mapa_de_vida_respuestas
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

commit;
