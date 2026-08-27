-- El ranking deja de recalcularse en cada hidratación.
--
-- `ranking_disciplina()` agrega sobre TODOS los asesorados y, para hacerlo,
-- despliega con `jsonb_array_elements` cada sesión, cada ejercicio y cada serie
-- de cada microciclo activo -tres niveles de LATERAL anidados, dos veces: una
-- para contar series y otra para detectar progresión de carga-. Y se ejecuta
-- entero en CADA hidratación: cada 45 s por pestaña abierta
-- (`SessionProvider.tsx:191`).
--
-- El resultado no depende de quién pregunta: es el mismo para todo el mundo,
-- y solo cambia cuando alguien entrena, registra adherencia, hace check-in o
-- pregunta al coach. Recalcularlo por cabeza y por minuto es tirar trabajo.
--
-- ── La trampa que este diseño evita ──────────────────────────────────────────
--
-- Una vista materializada que deja de refrescarse NO da error: da un ranking
-- creíble y viejo. Si mañana falla el cron, o `pg_cron` no llega a activarse,
-- nadie se entera y el equipo compite contra cifras de la semana pasada.
--
-- Por eso la función pública mira un sello de tiempo antes de servir la caché.
-- Si el último refresco tiene más de 30 minutos, calcula en vivo, como hoy.
-- Peor caso: el rendimiento de siempre. Nunca un dato viejo en silencio.

begin;

-- ── 1. El cálculo de verdad, tal cual estaba ─────────────────────────────────
-- Cuerpo idéntico al de la 0005, copiado literal. Pasa a llamarse `_vivo`
-- porque ahora es la fuente de la caché y la red de seguridad, no la puerta.

create or replace function public.ranking_disciplina_vivo()
returns table (
  usuario_id uuid,
  nombre text,
  iniciales text,
  sesiones_completas int,
  dias_cumplidos int,
  checkins int,
  series_registradas int,
  ejercicios_progresados int,
  preguntas int,
  puntos int
)
language sql
stable security definer set search_path = public
as $vivo$
  with asesorados as (
    select id, nombre, avatar_iniciales
    from public.usuarios_app
    where rol = 'asesorado'
  ),
  sesiones as (
    select m.usuario_id,
      count(*) filter (
        where (
          s.value ->> 'tipo' = 'metabolica'
          and jsonb_array_length(coalesce(s.value -> 'bloquesCardio', '[]'::jsonb)) > 0
          and not exists (
            select 1
            from jsonb_array_elements(coalesce(s.value -> 'bloquesCardio', '[]'::jsonb)) b
            where b.value ->> 'hechoEn' is null
          )
        ) or (
          coalesce(s.value ->> 'tipo', 'fuerza') <> 'metabolica'
          and jsonb_array_length(coalesce(s.value -> 'ejercicios', '[]'::jsonb)) > 0
          and not exists (
            select 1
            from jsonb_array_elements(coalesce(s.value -> 'ejercicios', '[]'::jsonb)) e
            where jsonb_array_length(coalesce(e.value -> 'series', '[]'::jsonb))
              < coalesce((e.value ->> 'sets')::int, 1)
          )
        )
      ) as completas
    from public.microciclos m
    cross join lateral jsonb_array_elements(m.datos -> 'sesiones') s
    where m.estado = 'activo'
    group by m.usuario_id
  ),
  series as (
    select m.usuario_id, count(*) as n
    from public.microciclos m
    cross join lateral jsonb_array_elements(m.datos -> 'sesiones') s
    cross join lateral jsonb_array_elements(coalesce(s.value -> 'ejercicios', '[]'::jsonb)) e
    cross join lateral jsonb_array_elements(coalesce(e.value -> 'series', '[]'::jsonb)) sr
    where m.estado = 'activo'
    group by m.usuario_id
  ),
  cargas as (
    select m.usuario_id,
      e.value ->> 'nombre' as ejercicio,
      s.ordinality as sesion_orden,
      max((sr.value ->> 'cargaKg')::numeric) as mejor
    from public.microciclos m
    cross join lateral jsonb_array_elements(m.datos -> 'sesiones') with ordinality s(value, ordinality)
    cross join lateral jsonb_array_elements(coalesce(s.value -> 'ejercicios', '[]'::jsonb)) e
    cross join lateral jsonb_array_elements(coalesce(e.value -> 'series', '[]'::jsonb)) sr
    where m.estado = 'activo'
    group by m.usuario_id, e.value ->> 'nombre', s.ordinality
  ),
  primeras as (
    select distinct on (usuario_id, ejercicio)
      usuario_id, ejercicio, sesion_orden as primera_orden, mejor as primera_carga
    from cargas
    order by usuario_id, ejercicio, sesion_orden
  ),
  progresion as (
    select p.usuario_id, count(*) as n
    from primeras p
    where exists (
      select 1 from cargas c
      where c.usuario_id = p.usuario_id
        and c.ejercicio = p.ejercicio
        and c.sesion_orden > p.primera_orden
        and c.mejor > p.primera_carga
    )
    group by p.usuario_id
  ),
  adherencia as (
    select usuario_id,
      count(*) filter (where estado = 'si') as dias_si,
      count(*) filter (where estado = 'parcial') as dias_parcial
    from public.adherencias
    where fecha >= current_date - 30
    group by usuario_id
  ),
  registro_checkins as (
    select usuario_id, count(*) as n
    from public.checkins
    where fecha >= current_date - 30
    group by usuario_id
  ),
  consultas as (
    select msj.de_id as usuario_id, count(*) as n
    from public.mensajes msj
    join public.usuarios_app coach on coach.id = msj.para_id and coach.rol = 'coach'
    where msj.fecha_iso >= current_date - 30
    group by msj.de_id
  )
  select
    a.id,
    a.nombre,
    a.avatar_iniciales,
    coalesce(s.completas, 0)::int,
    (coalesce(adh.dias_si, 0) + coalesce(adh.dias_parcial, 0))::int,
    coalesce(rc.n, 0)::int,
    coalesce(sr.n, 0)::int,
    coalesce(pr.n, 0)::int,
    coalesce(cq.n, 0)::int,
    (
      coalesce(s.completas, 0) * 3
      + coalesce(adh.dias_si, 0) * 2
      + coalesce(adh.dias_parcial, 0)
      + coalesce(rc.n, 0)
      + coalesce(pr.n, 0) * 4
      + least(coalesce(cq.n, 0), 10)
    )::int as puntos
  from asesorados a
  left join sesiones s on s.usuario_id = a.id
  left join series sr on sr.usuario_id = a.id
  left join progresion pr on pr.usuario_id = a.id
  left join adherencia adh on adh.usuario_id = a.id
  left join registro_checkins rc on rc.usuario_id = a.id
  left join consultas cq on cq.usuario_id = a.id
  order by puntos desc, a.nombre;
$vivo$;

revoke all on function public.ranking_disciplina_vivo() from public;
revoke execute on function public.ranking_disciplina_vivo() from anon, authenticated;

-- ── 2. La caché ──────────────────────────────────────────────────────────────
-- El índice único no es decoración: `refresh ... concurrently` lo exige, y sin
-- `concurrently` el refresco bloquea las lecturas mientras dura.

create materialized view if not exists public.ranking_disciplina_cache as
  select * from public.ranking_disciplina_vivo();

create unique index if not exists ranking_disciplina_cache_usuario
  on public.ranking_disciplina_cache (usuario_id);

-- Una vista materializada NO admite RLS. Como vive en `public`, PostgREST la
-- expondría como tabla: se cierra a mano. Solo se llega por la función, que es
-- `security definer` y por tanto no la afecta este revoke.
revoke all on public.ranking_disciplina_cache from public, anon, authenticated;

-- ── 3. El sello, que es lo que hace honesta a la caché ───────────────────────
-- Una fila y solo una: el `check (id)` con default `true` impide que haya dos.

create table if not exists public.ranking_cache_sello (
  id            boolean primary key default true check (id),
  refrescado_en timestamptz not null default now()
);

insert into public.ranking_cache_sello (id, refrescado_en)
  values (true, now())
  on conflict (id) do update set refrescado_en = now();

revoke all on public.ranking_cache_sello from public, anon, authenticated;

-- ── 4. El refresco ───────────────────────────────────────────────────────────
-- Refresca y sella en el mismo paso. Si el refresco falla, la excepción impide
-- el sello, el sello envejece y la función pública vuelve sola al cálculo en
-- vivo. El fallo se degrada a lentitud, no a mentira.

create or replace function public.refrescar_ranking_cache()
returns void
language plpgsql security definer set search_path = public
as $ref$
begin
  refresh materialized view concurrently public.ranking_disciplina_cache;
  insert into public.ranking_cache_sello (id, refrescado_en)
    values (true, now())
    on conflict (id) do update set refrescado_en = now();
end
$ref$;

revoke all on function public.refrescar_ranking_cache() from public;
revoke execute on function public.refrescar_ranking_cache() from anon, authenticated;

-- ── 5. La puerta ─────────────────────────────────────────────────────────────
-- MISMA firma que antes: la app sigue llamando `sb.rpc('ranking_disciplina')`
-- (`hidratar.ts:319`) sin enterarse de nada.

drop function if exists public.ranking_disciplina();

create function public.ranking_disciplina()
returns table (
  usuario_id uuid,
  nombre text,
  iniciales text,
  sesiones_completas int,
  dias_cumplidos int,
  checkins int,
  series_registradas int,
  ejercicios_progresados int,
  preguntas int,
  puntos int
)
language plpgsql
stable security definer set search_path = public
as $puerta$
begin
  if exists (
    select 1 from public.ranking_cache_sello s
    where s.refrescado_en > now() - interval '30 minutes'
  ) then
    return query
      select c.usuario_id, c.nombre, c.iniciales, c.sesiones_completas,
             c.dias_cumplidos, c.checkins, c.series_registradas,
             c.ejercicios_progresados, c.preguntas, c.puntos
      from public.ranking_disciplina_cache c
      order by c.puntos desc, c.nombre;
  else
    -- Caché vieja o cron caído: se paga el cálculo antes que servir mentiras.
    return query select * from public.ranking_disciplina_vivo();
  end if;
end
$puerta$;

revoke all on function public.ranking_disciplina() from public;
revoke execute on function public.ranking_disciplina() from anon;
grant execute on function public.ranking_disciplina() to authenticated;

commit;

-- ── 6. El cron, aparte y fuera de transacción ────────────────────────────────
-- Va suelto a propósito: si `pg_cron` no estuviera disponible en el proyecto,
-- esto falla y todo lo de arriba sigue en pie. Sin cron el sello envejece a los
-- 30 minutos y la función vuelve al cálculo en vivo: se pierde la mejora, no la
-- corrección.

create extension if not exists pg_cron;

select cron.schedule(
  'refrescar-ranking',
  '*/10 * * * *',
  $cron$select public.refrescar_ranking_cache();$cron$
);

-- ── Comprobación ─────────────────────────────────────────────────────────────
--
-- 1) Que la caché diga lo MISMO que el cálculo en vivo. Debe devolver 0 filas:
--
--   select * from public.ranking_disciplina_vivo()
--   except
--   select usuario_id, nombre, iniciales, sesiones_completas, dias_cumplidos,
--          checkins, series_registradas, ejercicios_progresados, preguntas, puntos
--   from public.ranking_disciplina_cache;
--
-- 2) Que el cron quedó programado:
--
--   select jobname, schedule, active from cron.job where jobname = 'refrescar-ranking';
--
-- 3) Que el sello se mueve. Esperar 10 min y comparar:
--
--   select refrescado_en, now() - refrescado_en as antiguedad
--   from public.ranking_cache_sello;
