-- ============================================================================
-- 0075 · La revisión clínica que vence
-- ============================================================================
--
-- Decisión de Bryan del 2026-09-12 (cerebro-alpha, I-30 «riesgo escalonado»): una zona
-- clínica amarilla sin firma YA NO PARA el plan. Se programa, y a la persona se le deja en
-- el chat una pregunta concreta; se vuelve a mirar entre 10 y 15 días (5-7 si el riesgo es
-- alto). Sus palabras: «si pasan diferentes semanas sin esa información, de pronto ya se
-- paran los planes».
--
-- La pregunta ya llega al chat. Lo que faltaba es la FECHA en un sitio que la mesa del
-- sábado lea. No se guarda dentro de `microciclos.datos`: ese blob lo escribe la app desde su
-- propio modelo. Es una tabla propia, que escribe el ④ de cerebro-alpha
-- (`tuberia/sql_pregunta_clinica.py`) en el mismo bloque que el mensaje.
--
-- La mesa exporta la revisión ABIERTA de cada persona con microciclo activo y si la persona
-- ha escrito algo desde que se le preguntó. Qué hacer con eso lo decide
-- `agentes/mesa_del_sabado.py`, no esta función.
--
-- SEGURIDAD: tabla solo staff (patrón de la 0053). `mesa_del_sabado()` sigue siendo de
-- INVOCADOR, no `security definer`: un asesorado que la llame por RPC solo ve lo que su RLS
-- le deja ver, y de esta tabla no ve nada.
--
-- El cuerpo de la función es el de la 0055 con dos añadidos: el CTE `reev` y la clave
-- `reevaluacion`. Nada más se toca.
-- ============================================================================

begin;

create table if not exists public.reevaluaciones_clinicas (
  id             bigint generated always as identity primary key,
  usuario_id     uuid not null references public.usuarios_app(id) on delete cascade,
  microciclo     integer,
  perfil_riesgo  text not null check (perfil_riesgo in ('alto', 'medio', 'bajo')),
  desde          date not null,
  revisar_el     date not null,
  pregunta       text not null check (length(btrim(pregunta)) >= 15),
  motivo         text,
  mensaje_id     text references public.mensajes(id) on delete set null,
  creada_en      timestamptz not null default now(),
  cerrada_en     timestamptz,
  -- La ventana la fija la decisión de Bryan, y la base la hace cumplir: una fecha de
  -- revisión a 40 días no es una revisión, es olvidarla.
  constraint reevaluaciones_clinicas_ventana check (
    (perfil_riesgo = 'alto' and revisar_el - desde between 5 and 7)
    or (perfil_riesgo in ('medio', 'bajo') and revisar_el - desde between 10 and 15)
  )
);

comment on table public.reevaluaciones_clinicas is
  'Revisión clínica pendiente de una persona: qué se le preguntó y cuándo se vuelve a mirar. '
  'Riesgo escalonado (Bryan, 2026-09-12). Solo staff. Una abierta por persona.';

-- Una sola abierta por persona: abrir la siguiente obliga a cerrar la anterior, y así la
-- mesa nunca tiene que elegir entre dos fechas.
create unique index if not exists reevaluaciones_clinicas_una_abierta
  on public.reevaluaciones_clinicas (usuario_id) where cerrada_en is null;

alter table public.reevaluaciones_clinicas enable row level security;

create policy reevaluaciones_clinicas_lee_el_staff on public.reevaluaciones_clinicas
  for select to authenticated using ((select public.es_staff()));

create policy reevaluaciones_clinicas_escribe_el_staff on public.reevaluaciones_clinicas
  for insert to authenticated with check ((select public.es_staff()));

create policy reevaluaciones_clinicas_actualiza_el_staff on public.reevaluaciones_clinicas
  for update to authenticated using ((select public.es_staff()));

create policy reevaluaciones_clinicas_borra_el_staff on public.reevaluaciones_clinicas
  for delete to authenticated using ((select public.es_staff()));

revoke all on public.reevaluaciones_clinicas from anon, public;
grant select, insert, update, delete on public.reevaluaciones_clinicas to authenticated;

create or replace function public.mesa_del_sabado()
returns json language sql stable as $$
  with activos as (
    select u.id, u.nombre, m.numero,
           (m.datos->>'cadenciaDias')::int as cadencia,
           (m.datos->>'fechaInicio')::date as inicio, m.datos
      from public.usuarios_app u
      join public.microciclos m on m.usuario_id = u.id and m.estado = 'activo'
  ),
  cierre as (
    select a.id, count(*) as sesiones,
           count(*) filter (where not (
             case when jsonb_array_length(coalesce(s->'ejercicios','[]'::jsonb)) > 0
                  then not exists (select 1 from jsonb_array_elements(s->'ejercicios') e
                                    where jsonb_array_length(coalesce(e->'series','[]'::jsonb))
                                          < coalesce((e->>'sets')::int, 1))
                  else jsonb_array_length(coalesce(s->'bloquesCardio','[]'::jsonb)) > 0
                       and not exists (select 1 from jsonb_array_elements(coalesce(s->'bloquesCardio','[]'::jsonb)) b
                                        where b->>'hechoEn' is null) end)) as pendientes
      from activos a, jsonb_array_elements(a.datos->'sesiones') s
     group by a.id
  ),
  -- LA VENTANA VA POR FECHA, NUNCA POR `numero` (arreglado en la 0055).
  v as (
    select * from (
      select a.id, m.datos,
             row_number() over (partition by a.id
                                order by (m.datos->>'fechaInicio')::date desc,
                                         m.numero desc) rn
        from activos a join public.microciclos m on m.usuario_id = a.id
    ) t where rn <= 3
  ),
  s3 as (
    select v.id, count(*) as ejercicios,
           count(*) filter (where jsonb_array_length(coalesce(e->'series','[]'::jsonb)) > 0) as con_serie
      from v, jsonb_array_elements(v.datos->'sesiones') s,
           jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
     group by v.id
  ),
  h3 as (
    select v.id, count(*) filter (
        where exists (select 1 from jsonb_array_elements(coalesce(s->'preparacion','[]'::jsonb)) pr
                       where pr->>'hechoEn' is not null)
           or exists (select 1 from jsonb_array_elements(coalesce(s->'bloquesCardio','[]'::jsonb)) b
                       where b->>'hechoEn' is not null)) as huella
      from v, jsonb_array_elements(v.datos->'sesiones') s
     group by v.id
  ),
  k as (
    select a.id, count(distinct c.fecha) as checkins
      from activos a
      left join public.checkins c on c.usuario_id = a.id and c.fecha >= a.inicio - 24
     group by a.id
  ),
  -- LA REVISIÓN CLÍNICA ABIERTA (0075). `respondio` es «la persona ha escrito algo en el
  -- chat desde que se le preguntó», a quien sea: no se lee el contenido, solo que hay algo
  -- que leer antes de decidir.
  reev as (
    select r.usuario_id, r.perfil_riesgo, r.desde, r.revisar_el, r.pregunta,
           exists (select 1 from public.mensajes x
                    where x.de_id = r.usuario_id and x.fecha_iso > r.creada_en) as respondio
      from public.reevaluaciones_clinicas r
     where r.cerrada_en is null
  )
  select coalesce(json_agg(json_build_object(
    'nombre',        a.nombre,
    'microciclo',    a.numero,
    'cadencia',      a.cadencia,
    'inicio',        a.inicio::text,
    'vence',         (a.inicio + a.cadencia)::text,
    'hoy',           current_date::text,
    'sesiones',      c.sesiones,
    'pendientes',    c.pendientes,
    'ejercicios_3m', coalesce(s3.ejercicios, 0),
    'con_serie_3m',  coalesce(s3.con_serie, 0),
    'huella_3m',     coalesce(h3.huella, 0),
    'checkins',      coalesce(k.checkins, 0),
    'reevaluacion',  case when rv.usuario_id is null then null
                          else json_build_object(
                            'perfil',     rv.perfil_riesgo,
                            'desde',      rv.desde::text,
                            'revisar_el', rv.revisar_el::text,
                            'pregunta',   rv.pregunta,
                            'respondio',  rv.respondio) end
  ) order by a.nombre), '[]'::json)
  from activos a
  left join cierre c  on c.id  = a.id
  left join s3        on s3.id = a.id
  left join h3        on h3.id = a.id
  left join k         on k.id  = a.id
  left join reev rv   on rv.usuario_id = a.id;
$$;

revoke execute on function public.mesa_del_sabado() from public, anon;
grant execute on function public.mesa_del_sabado() to authenticated;

commit;

-- Comprobación: su señal en supabase/comprobar-migraciones.sql (la tabla existe con RLS,
-- anon no la lee, y la mesa la menciona).
