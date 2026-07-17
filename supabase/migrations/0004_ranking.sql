-- App Alpha Athletics · Migración 0004 · Ranking de disciplina del equipo
-- Pegar completo en: Supabase → SQL Editor → New query → Run
--
-- Devuelve SOLO cumplimiento agregado por asesorado (sesiones completas,
-- días de nutrición cumplidos, check-ins y puntos). Nunca expone datos
-- personales: ni estados de ánimo, ni cargas, ni notas. Mismo criterio que
-- src/domain/ranking.ts en la app.

create or replace function public.ranking_disciplina()
returns table (
  usuario_id uuid,
  nombre text,
  iniciales text,
  sesiones_completas int,
  dias_cumplidos int,
  checkins int,
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
  )
  select
    a.id,
    a.nombre,
    a.avatar_iniciales,
    coalesce(s.completas, 0)::int,
    (coalesce(adh.dias_si, 0) + coalesce(adh.dias_parcial, 0))::int,
    coalesce(rc.n, 0)::int,
    (
      coalesce(s.completas, 0) * 3
      + coalesce(adh.dias_si, 0) * 2
      + coalesce(adh.dias_parcial, 0)
      + coalesce(rc.n, 0)
    )::int as puntos
  from asesorados a
  left join sesiones s on s.usuario_id = a.id
  left join adherencia adh on adh.usuario_id = a.id
  left join registro_checkins rc on rc.usuario_id = a.id
  order by puntos desc, a.nombre;
$$;

revoke all on function public.ranking_disciplina() from public;
grant execute on function public.ranking_disciplina() to authenticated;
