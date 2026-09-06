-- ============================================================================
-- 0055 · La ventana de la mesa va por FECHA, no por número de microciclo
-- ============================================================================
--
-- `mesa_del_sabado()` mira «los tres últimos microciclos» de cada persona para
-- decidir cuánto suministra, y de ahí sale su TRAMO (T0…T4) — que es lo que
-- decide si entra en modo a ciegas. Los elegía con
--
--     row_number() over (partition by a.id order by m.numero desc)
--
-- y **hay gente con dos bloques conviviendo**, con numeraciones que se solapan.
-- Con el orden por número, el más alto es el del bloque VIEJO.
--
-- MEDIDO EL 2026-09-06, seis personas con la ventana equivocada y tres de forma
-- grave —se les medía un bloque entero de julio en vez del actual—:
--
--   Juan Andrés Bolaño   media M21,M20,M19 (julio)  en vez de  M3,M2,M1
--   Karin Better         media M20,M19,M6           en vez de  M6,M5,M4
--   Laura Giraldo        media M25,M24,M6           en vez de  M6,M5,M4
--
-- LO QUE COSTABA, y no era cosmético: **a Bolaño lo clasificaba en T0 —cero
-- registro— cuando lleva un 26 %**, y estaba a punto de recibir un bloque de
-- cuatro microciclos a ciegas que no le corresponde. Laura Giraldo pasa de T2 a
-- **T4**, que es el tramo de quien lo hace todo bien.
--
-- ES LA MISMA LECCIÓN QUE `plantilla-carga-microciclo.sql` YA TENÍA ESCRITA para
-- elegir el microciclo origen —«POR `estado`, NUNCA por `numero desc`. Con dos
-- bloques conviviendo, el número más alto es el del bloque VIEJO»— y aquí se
-- repitió en una función escrita el día antes.
--
-- El desempate por `numero desc` se queda para el caso de dos microciclos que
-- empiecen el mismo día, que existe: Natalia tiene el M2 y el M3 con fechas
-- casi pegadas.
--
-- Solo cambia el CTE `v`. El resto del cuerpo es idéntico a la 0054.
-- ============================================================================

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
    'checkins',      coalesce(k.checkins, 0)
  ) order by a.nombre), '[]'::json)
  from activos a
  left join cierre c  on c.id  = a.id
  left join s3        on s3.id = a.id
  left join h3        on h3.id = a.id
  left join k         on k.id  = a.id;
$$;

revoke execute on function public.mesa_del_sabado() from public, anon;
grant execute on function public.mesa_del_sabado() to authenticated;

commit;

-- Comprobación: supabase/comprobar-0054.sql
-- Aplicada a producción el 2026-09-05; sus cinco señales en OK, incluida la que
-- exige que Manuela siga dentro del resultado.
