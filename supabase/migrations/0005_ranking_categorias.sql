-- App Alpha Athletics · Migración 0005 · Ranking multi-categoría del equipo
-- Pegar completo en: Supabase → SQL Editor → New query → Run
-- (Reemplaza a la función de la migración 0004.)
--
-- Añade al ranking: series registradas (cargas colocadas), ejercicios con
-- progresión de carga y preguntas al coach. Sigue devolviendo SOLO
-- cumplimiento y rendimiento agregados: nunca estados de ánimo, cargas
-- concretas, notas ni datos personales. Mismo criterio que
-- src/domain/ranking.ts en la app.

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
language sql
stable security definer set search_path = public
as $$
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
$$;

revoke all on function public.ranking_disciplina() from public;
-- Supabase otorga execute a anon por privilegios por defecto: hay que
-- revocarlo explícito para que solo usuarios con sesión vean el ranking.
revoke execute on function public.ranking_disciplina() from anon;
grant execute on function public.ranking_disciplina() to authenticated;
