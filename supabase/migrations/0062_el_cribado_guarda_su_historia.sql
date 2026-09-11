-- 0062 · El cribado guarda su historia: nadie pisa a nadie, y manda la más reciente.
--
-- LA DECISIÓN QUE LA MOTIVA (Bryan, 2026-09-10). La 0058 dejó **una ficha por persona**
-- —`usuario_id` era la clave primaria— y `contestar_cribado()` hacía `on conflict do
-- nothing`: si el coach volcaba el expediente y después la persona contestaba desde la
-- app, su respuesta se descartaba. Sobre un cribado clínico eso es al revés de como
-- debería: **quien sabe si empezó una medicación esta semana es ella**, no el expediente
-- de hace un mes. Pero la opción contraria —que la suya pise la del coach— tampoco vale:
-- una respuesta a la ligera borraría el cribado que él hizo con criterio.
--
-- Se eligió la tercera: **se guardan las dos, cada una con su fecha y su procedencia, y
-- la que manda es la más reciente**. El historial de salud deja de ser una foto y pasa a
-- ser una película, que es lo que un cribado necesita para servir de algo: lo que importa
-- casi nunca es el estado, es el CAMBIO de estado.
--
-- SE PUEDE APLICAR SIN MIEDO: la tabla está VACÍA (0 filas medidas el 2026-09-10), así
-- que ningún dato se mueve de sitio. Aplicada sobre una tabla con filas también sería
-- segura —solo añade columnas y cambia qué es la clave—, pero conviene decir cuál era el
-- estado real cuando se escribió.
--
-- ORDEN DE DESPLIEGUE: esta migración va ANTES que el código, como la 0058. Un cliente
-- viejo sigue leyendo `cribado` y viendo lo mismo que antes mientras haya una sola fila
-- por persona; el cliente nuevo lee `cribado_vigente`.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · La tabla deja de tener una fila por persona
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.cribado add column if not exists id uuid not null default gen_random_uuid();

-- `fecha` es un DATE y dos respuestas del mismo día empatarían. `creado_en` es lo que
-- ordena de verdad, y es lo que decide cuál manda cuando alguien corrige a los diez
-- minutos de haber contestado.
alter table public.cribado add column if not exists creado_en timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.cribado'::regclass and conname = 'cribado_pkey'
  ) then
    alter table public.cribado drop constraint cribado_pkey;
  end if;
end
$$;

alter table public.cribado add constraint cribado_pkey primary key (id);

-- El índice por el que se busca SIEMPRE: la última de esta persona.
create index if not exists cribado_por_persona
  on public.cribado (usuario_id, fecha desc, creado_en desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · La vigente, para quien solo quiere «la de ahora»
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `security_invoker` NO es opcional: sin él la vista corre con los permisos de quien la
-- creó y **se salta la RLS de la tabla**, o sea que cualquiera vería el cribado de
-- cualquiera. Es el mismo agujero que la 0008 con las políticas tautológicas, por otra
-- puerta.

create or replace view public.cribado_vigente
with (security_invoker = true) as
select distinct on (usuario_id) *
from public.cribado
order by usuario_id, fecha desc, creado_en desc;

comment on view public.cribado_vigente is
  'La última respuesta de cada persona. La tabla guarda todas: esta vista dice cuál manda.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Contestar deja de descartar
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Antes: `on conflict do nothing` — si había fila, la respuesta se perdía y el cliente ni
-- se enteraba (destripaba el booleano, así que ni el aviso llegaba).
-- Ahora: se inserta SIEMPRE una fila nueva… salvo que sea EXACTAMENTE la misma respuesta
-- del mismo día, que no es un cambio sino un doble toque o una pantalla que se remontó.
-- Esa sí se descarta, y devolver `false` lo dice.

create or replace function public.contestar_cribado(p_cribado jsonb)
returns boolean
language plpgsql
security invoker
set search_path = public
as $contestar$
declare
  quien uuid := auth.uid();
  ya_igual boolean;
begin
  if quien is null then
    raise exception 'Solo con sesión iniciada';
  end if;

  -- Un duplicado exacto del mismo día no es una respuesta nueva.
  select exists (
    select 1 from public.cribado c
    where c.usuario_id = quien
      and c.fecha = coalesce((p_cribado->>'fecha')::date, current_date)
      and c.fuente = 'app'
      and c.diagnostico                  is not distinct from p_cribado->>'diagnostico'
      and c.quien_lo_lleva               is not distinct from p_cribado->>'quien_lo_lleva'
      and c.tratamiento_activo           is not distinct from p_cribado->>'tratamiento_activo'
      and c.medicacion_cronica           is not distinct from p_cribado->>'medicacion_cronica'
      and c.autorizacion_sanitaria       is not distinct from p_cribado->>'autorizacion_sanitaria'
      and c.restricciones_explicitas     is not distinct from p_cribado->>'restricciones_explicitas'
      and c.sintomas_con_esfuerzo        is not distinct from p_cribado->>'sintomas_con_esfuerzo'
      and c.nivel_funcional              is not distinct from p_cribado->>'nivel_funcional'
      and c.que_le_han_dicho_que_no_haga is not distinct from p_cribado->>'que_le_han_dicho_que_no_haga'
      and c.parq_enfermedad_cardiaca     is not distinct from p_cribado->>'parq_enfermedad_cardiaca'
      and c.parq_medicamento_presion     is not distinct from p_cribado->>'parq_medicamento_presion'
      and c.parq_huesos_articulaciones   is not distinct from p_cribado->>'parq_huesos_articulaciones'
  ) into ya_igual;

  if ya_igual then
    return false;
  end if;

  insert into public.cribado (
    usuario_id, fecha, fuente,
    diagnostico, quien_lo_lleva, tratamiento_activo, medicacion_cronica,
    autorizacion_sanitaria, restricciones_explicitas, sintomas_con_esfuerzo,
    nivel_funcional, que_le_han_dicho_que_no_haga,
    parq_enfermedad_cardiaca, parq_medicamento_presion, parq_huesos_articulaciones,
    detalle
  )
  values (
    quien,
    coalesce((p_cribado->>'fecha')::date, current_date),
    'app',
    p_cribado->>'diagnostico', p_cribado->>'quien_lo_lleva',
    p_cribado->>'tratamiento_activo', p_cribado->>'medicacion_cronica',
    p_cribado->>'autorizacion_sanitaria', p_cribado->>'restricciones_explicitas',
    p_cribado->>'sintomas_con_esfuerzo', p_cribado->>'nivel_funcional',
    p_cribado->>'que_le_han_dicho_que_no_haga',
    p_cribado->>'parq_enfermedad_cardiaca', p_cribado->>'parq_medicamento_presion',
    p_cribado->>'parq_huesos_articulaciones',
    coalesce(p_cribado->'detalle', '{}'::jsonb)
  );

  return true;
end;
$contestar$;

-- Las funciones de `public` se exponen como RPC a `anon`: sin este `revoke`, una función
-- que ESCRIBE datos de salud queda al alcance de la clave pública. Mismo agujero que
-- documenta `GUIA-BRYAN.md` §10.
revoke execute on function public.contestar_cribado(jsonb) from public, anon;
grant execute on function public.contestar_cribado(jsonb) to authenticated;

commit;
