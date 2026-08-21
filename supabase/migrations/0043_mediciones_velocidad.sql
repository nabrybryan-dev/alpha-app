-- 0043 · Las tres tablas de la rama de velocidad
--
-- Implementa `wiki/motor-velocidad/contrato-datos.md`. La fase 2 todavía no ha
-- aprobado, así que esto NO habilita nada en la app: crea el sitio donde caerán
-- las mediciones el día que apruebe. Escribirlo ahora es barato; descubrir el
-- día de la tanda que el esquema no encaja, no.
--
-- Y encajar no encajaba. Al contrastar el contrato contra lo que el código
-- produce de verdad aparecieron TRES desajustes, y dos habrían roto escrituras
-- en produccion:
--
-- ── 1 · `motivo_calidad` no es un valor, es una LISTA ─────────────────────────
--
-- El contrato lo declara `text` con vocabulario cerrado. Pero `calificar()`
-- devuelve un ARRAY: una toma puede fallar por varias razones a la vez, y de
-- hecho las dos tomas reales del 2026-08-20 salieron con cinco motivos cada una
-- («marcador_perdido|angulo|pocas_reps|sin_escala|referencia_torcida»).
--
-- Un `text` con CHECK contra un valor único habría rechazado esas filas. Y
-- guardarlas concatenadas con «|» habría hecho imposible la única consulta que
-- justifica el vocabulario cerrado: contar qué falla más. Aquí es `text[]` con
-- el CHECK aplicado a CADA elemento. Con `unnest` se cuenta; con `@>` se filtra.
--
-- ── 2 · El vocabulario del contrato rechazaría los fallos de hoy ──────────────
--
-- Cuatro motivos que el código emite NO estaban en la lista del contrato, y son
-- justo los de la rama de cuatro marcas, que nació después de escribirlo:
--
--     sin_escala · referencia_torcida · inclinacion_no_medible · pocas_reps
--
-- Otros cuatro estaban en el contrato y no los emite nadie todavía
-- (`contorno_parcial`, `camara_movida`, `rom_implausible`, `contraste`). Esos SE
-- DEJAN: un motivo previsto que nadie escribe no hace daño —ninguna fila lo
-- lleva—, mientras que un motivo emitido y no previsto rechaza la escritura. El
-- CHECK se equivoca por el lado seguro a propósito.
--
-- ── 3 · El umbral de fps del contrato está desfasado ──────────────────────────
--
-- El contrato pide fps >= 30 para `buena`; el código exige >= 50 desde que la
-- campaña de ensayos midió que a 30 fps el error de %PV es de -5,0 puntos,
-- exactamente el umbral de muerte de la rama. Aquí NO se arregla porque aquí no
-- se puede: `calidad` la calcula el navegador y llega ya decidida. Queda anotado
-- para corregir el documento, no el esquema.
--
-- ── Lo que NO entra, y es regla ───────────────────────────────────────────────
--
-- Vídeo no, ni un fotograma, ni en `storage`. El procesamiento ocurre en el
-- navegador y solo salen números.
--
-- Proyecto: sbzmbiwrnvegrticatza (la app). Comprobado antes de escribir: hay dos
-- proyectos Supabase y este es el que toca.

-- ─────────────────────────────────────────────────────────────────────────────
-- Vocabulario cerrado de motivos
-- ─────────────────────────────────────────────────────────────────────────────
-- Se declara una sola vez y lo reusan las tres comprobaciones. Si algún día se
-- añade un motivo al código, este es el único sitio que hay que tocar aquí.

-- Toma el ARRAY entero y no un elemento: un CHECK no admite subconsultas, asi
-- que no se puede hacer `unnest` en la expresion de la restriccion. La funcion
-- hace el unnest por dentro y devuelve un solo booleano.
--
-- Es IMMUTABLE porque un CHECK lo exige. Consecuencia que conviene saber: si
-- algun dia se añade un motivo aqui, Postgres NO revalida las filas ya escritas
-- -no hace falta, ampliar el vocabulario solo puede hacer validas mas filas-.
-- Quitar un motivo si dejaria filas viejas que ya no pasarian el CHECK.
create or replace function public.motivos_calidad_validos(ms text[])
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select ms is null or not exists (
    select 1 from unnest(ms) as m where m not in (
    -- los que emite `calificar()` en analisis.js
    'pocos_fps',              -- la cámara no llegó a la cadencia mínima
    'marcador_perdido',       -- referencia no encontrada en bastantes fotogramas
    'angulo',                 -- referencia girada en el plano de la imagen
    'pocas_reps',             -- menos de tres repeticiones segmentadas
    'sin_escala',             -- no se pudo pasar de píxeles a metros
    'inclinacion_no_medible', -- hubo escala, pero de dos marcadores: no sabe si está torcida
    'referencia_torcida',     -- inclinación por encima del umbral de calidad
    -- los que emite la rama de disco
    'salto_imposible',        -- posición que implicaba una velocidad imposible
    'radio_incoherente',      -- el tamaño detectado se salió de lo esperado
    'sin_segmentar',          -- no se reconoció ninguna repetición
    -- previstos en el contrato, todavía sin emisor. Ver cabecera, punto 2.
    'contorno_parcial',
    'camara_movida',
    'rom_implausible',
    'contraste'
  ));
$$;

comment on function public.motivos_calidad_validos(text[]) is
  'Vocabulario cerrado de motivos de calidad. Cerrado a proposito: sin el no se '
  'puede contar que falla mas, y sin eso el protocolo de encuadre no se mejora.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · mediciones_velocidad — el hecho
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.mediciones_velocidad (
  id            text primary key,
  usuario_id    uuid not null references public.usuarios_app (id) on delete cascade,
  microciclo_id text references public.microciclos (id) on delete set null,
  fecha         date not null,

  -- qué serie fue
  ejercicio_id   text not null,
  ejercicio_nom  text not null,   -- se congela el nombre: los catálogos se renombran
  orden_serie    int  not null,
  carga_kg       numeric(6,2) not null,

  -- lo que decide. TODO puede ser null a proposito: una medicion degradada
  -- sigue valiendo como registro de que el protocolo falló ahí.
  reps_medidas   int,
  v_primera      numeric(5,3),
  v_ultima       numeric(5,3),
  pv_pct         numeric(5,2),    -- LA métrica: es un cociente, así que sobrevive a errores de escala
  ie             numeric(6,3),
  conc_ms_media  int,
  rom_relativo   numeric(5,3),
  compensacion   numeric(5,3),

  -- de qué se fía uno
  tipo_velocidad text not null default 'VM' check (tipo_velocidad in ('VM','VMP')),
  calidad        text not null check (calidad in ('buena','dudosa','descartada')),
  motivos_calidad text[] not null default '{}',
  version_algo   text not null,   -- sin esto no se pueden comparar épocas

  captura        jsonb not null,
  reps           jsonb not null default '[]'::jsonb,
  creado_en      timestamptz not null default now(),

  unique (usuario_id, fecha, ejercicio_id, orden_serie),

  -- Una medicion no buena SIN motivo es la que no se puede arreglar despues:
  -- se sabe que fallo y no por que. El contrato lo exige y aqui se impone.
  --
  -- EL `coalesce` NO ES ADORNO. `array_length('{}', 1)` devuelve NULL, no 0, y un
  -- CHECK que evalua a NULL PASA -solo falla con FALSE-. Sin el, la restriccion
  -- no rechazaba nada: se comprobo insertando ('descartada','{}') y entraba. Es
  -- el fallo que deja pasar exactamente lo que esta restriccion existe para
  -- impedir, y en silencio.
  constraint mediciones_motivo_obligatorio check (
    calidad = 'buena' or coalesce(array_length(motivos_calidad, 1), 0) >= 1
  ),
  -- Y al reves: una medicion buena con motivos es una contradiccion.
  constraint mediciones_buena_sin_motivos check (
    calidad <> 'buena' or coalesce(array_length(motivos_calidad, 1), 0) = 0
  ),
  constraint mediciones_motivos_del_vocabulario check (
    public.motivos_calidad_validos(motivos_calidad)
  ),
  constraint mediciones_captura_es_objeto check (jsonb_typeof(captura) = 'object'),
  constraint mediciones_reps_es_lista     check (jsonb_typeof(reps) = 'array'),
  constraint mediciones_orden_positivo    check (orden_serie >= 1),
  constraint mediciones_carga_no_negativa check (carga_kg >= 0)
);

comment on table public.mediciones_velocidad is
  'Una fila por serie medida. Es el hecho y no se reescribe. Ver '
  'wiki/motor-velocidad/contrato-datos.md';
comment on column public.mediciones_velocidad.pv_pct is
  'Perdida de velocidad en puntos. Es la metrica que decide la dosis y la unica '
  'inmune al error de escala, por ser un cociente.';
comment on column public.mediciones_velocidad.captura is
  'fpsReal medido (NO el pedido), resolucion, reloj usado, escala px/m, '
  'inclinacion de la referencia, fotogramas perdidos, plataforma.';

create index if not exists mediciones_usuario_fecha
  on public.mediciones_velocidad (usuario_id, fecha desc);

-- El indice que importa. La consulta caliente del bucle 2 es «dame la v1 de
-- esta persona, en este ejercicio, con este peso, en mediciones buenas», y corre
-- mientras el asesorado espera entre series.
create index if not exists mediciones_referencia
  on public.mediciones_velocidad (usuario_id, ejercicio_id, carga_kg)
  where calidad = 'buena';

-- Para contar que falla mas sin recorrer la tabla entera.
create index if not exists mediciones_motivos
  on public.mediciones_velocidad using gin (motivos_calidad);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · perfil_carga_velocidad — la referencia
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.perfil_carga_velocidad (
  usuario_id   uuid not null references public.usuarios_app (id) on delete cascade,
  ejercicio_id text not null,
  pendiente    numeric(8,5),   -- v = pendiente * kg + intercepto
  intercepto   numeric(6,3),
  r2           numeric(4,3),
  n_puntos     int not null default 0,
  rango_kg     numrange,       -- fuera de aqui NO se extrapola
  v_1rm_ref    numeric(5,3),   -- solo si esta publicada y verificada
  e1rm_kg      numeric(6,2),   -- derivado; null si no hay v_1rm_ref
  actualizado  timestamptz not null default now(),
  primary key (usuario_id, ejercicio_id),

  -- Sin v_1rm_ref no hay e1rm_kg, y sin e1rm_kg no hay %1RM. Se trabaja con %PV
  -- y con comparacion a la misma carga, que es lo que de verdad decide.
  constraint perfil_e1rm_exige_referencia check (
    e1rm_kg is null or v_1rm_ref is not null
  ),
  constraint perfil_r2_en_rango check (r2 is null or (r2 >= 0 and r2 <= 1)),
  constraint perfil_n_puntos_no_negativo check (n_puntos >= 0)
);

comment on column public.perfil_carga_velocidad.rango_kg is
  'Entre que cargas es valida la recta. Sin este campo, el primer dia que '
  'alguien suba de peso el motor se inventa un %1RM extrapolando.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · estado_del_dia — la decision, auditable
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.estado_del_dia (
  usuario_id   uuid not null references public.usuarios_app (id) on delete cascade,
  fecha        date not null,
  indice       numeric(5,2) not null,
  banda        text not null check (banda in ('verde','ambar','rojo','critico')),
  entradas     jsonb not null,   -- los cuatro componentes, con su valor y su peso
  delta        jsonb not null,   -- que se le hizo al plan: carga, series, RIR
  version_algo text not null,
  creado_en    timestamptz not null default now(),
  primary key (usuario_id, fecha),

  constraint estado_indice_en_rango check (indice >= 0 and indice <= 100),
  constraint estado_entradas_es_objeto check (jsonb_typeof(entradas) = 'object'),
  constraint estado_delta_es_objeto    check (jsonb_typeof(delta) = 'object')
);

comment on table public.estado_del_dia is
  'Una fila por asesorado y dia. `entradas` y `delta` no son adorno: son el '
  'motivo de que la tabla exista. Dentro de tres meses hay que poder leer que '
  'sabia el motor y que decidio con ello, sin reconstruirlo.';

-- Las bandas reutilizan a proposito los nombres de `bandaPrs` para que la señal
-- nueva entre en el motor de ondulacion sin inventar un vocabulario paralelo.

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — el patron de la casa, elegido segun QUIEN PRODUCE el dato
-- ─────────────────────────────────────────────────────────────────────────────
-- `mediciones` las produce el movil del dueño  -> el dueño escribe (patron de `checkins`)
-- `perfil` y `estado` los calcula el sistema   -> el dueño lee, solo el coach escribe (patron de `perfiles`)
--
-- `nutricionista` NO entra: la velocidad de barra no es asunto suyo, y la 0013
-- ya sento el precedente de acotarle el alcance.

alter table public.mediciones_velocidad   enable row level security;
alter table public.perfil_carga_velocidad enable row level security;
alter table public.estado_del_dia         enable row level security;

drop policy if exists mediciones_todo_propio on public.mediciones_velocidad;
create policy mediciones_todo_propio on public.mediciones_velocidad
  for all
  using      (usuario_id = auth.uid() or public.es_coach())
  with check (usuario_id = auth.uid() or public.es_coach());

drop policy if exists perfil_cv_leer on public.perfil_carga_velocidad;
create policy perfil_cv_leer on public.perfil_carga_velocidad
  for select using (usuario_id = auth.uid() or public.es_coach());

drop policy if exists perfil_cv_escribir_coach on public.perfil_carga_velocidad;
create policy perfil_cv_escribir_coach on public.perfil_carga_velocidad
  for all using (public.es_coach()) with check (public.es_coach());

drop policy if exists estado_dia_leer on public.estado_del_dia;
create policy estado_dia_leer on public.estado_del_dia
  for select using (usuario_id = auth.uid() or public.es_coach());

drop policy if exists estado_dia_escribir_coach on public.estado_del_dia;
create policy estado_dia_escribir_coach on public.estado_del_dia
  for all using (public.es_coach()) with check (public.es_coach());

-- NO se revoca `execute` de `motivos_calidad_validos`, y va explicado porque el
-- endurecimiento de la 0038 y la 20260819221329 invita a hacerlo:
--
-- Esa funcion vive DENTRO de un CHECK, y un CHECK se evalua con los permisos de
-- quien inserta. Revocarle el execute a `authenticated` no la protegeria de
-- nada: haria que cualquier INSERT desde el movil fallara con «permission denied
-- for function». Es una funcion de validacion pura -recibe un array de texto,
-- devuelve un booleano, no lee ninguna tabla- asi que no hay superficie que
-- cerrar.
grant execute on function public.motivos_calidad_validos(text[]) to authenticated;
