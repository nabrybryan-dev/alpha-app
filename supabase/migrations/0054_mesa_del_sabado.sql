-- 0054 · La mesa del sábado, como función
--
-- POR QUÉ ES UNA FUNCIÓN Y NO UN ARCHIVO .sql QUE SE PEGA. La consulta vivía en
-- `cerebro-alpha-agentes/tuberia/sql/mesa-del-sabado.sql` y la cinta de n8n
-- necesita correrla cada sábado. Copiarla dentro del flujo habría dejado DOS
-- definiciones de la misma verdad, y ese repo ya tiene escrito lo que pasa
-- entonces (`agentes/taxonomia.py`): «escribir aquí una tercera copia es
-- garantizar la divergencia». Como función, el archivo y la cinta llaman a lo
-- mismo, y ese archivo pasó a ser un `select public.mesa_del_sabado()`.
--
-- QUÉ DEVUELVE. Una fila por persona **con microciclo activo**: dónde está su
-- microciclo (para el carril), cuánto suministra en los TRES últimos (para el
-- tramo T0-T4) y sus check-ins. El cruce con el plan estratégico NO se hace aquí
-- —eso vive en `agentes/mesa_del_sabado.py`, que lee los planes del wiki—.
--
-- ⚠ EL PREDICADO NO ES `rol = 'asesorado'`, Y ESO COSTÓ UNA FILA.
-- La primera versión filtraba por rol y dejaba fuera a **Manuela Quintero**, que
-- tiene `rol = 'nutricionista'` y es asesorada a la vez: microciclo activo, 68 %
-- de registro, 7 check-ins. La mesa habría perdido a una persona real todos los
-- sábados, y en silencio. El sistema tiene UN campo de rol, así que «es staff» y
-- «es asesorada» no se pueden decir a la vez; mientras siga así, **quien define a
-- un asesorado es tener microciclo**.
--
-- LA VENTANA SON LOS TRES ÚLTIMOS MICROCICLOS, no el que está en curso: medir
-- sobre el vivo castiga a quien va por el día 4 de 8 y aún tiene sesiones.
--
-- `pendientes` reproduce `sesionCompleta` (`src/domain/cumplimiento.ts`): si hay
-- ejercicios mandan los ejercicios (series >= sets); si no, mandan los bloques de
-- cardio marcados. Con `pendientes = 0` el microciclo YA venció aunque no haya
-- llegado su fecha — regla del 1-ago: vence por lo que ocurra primero.
--
-- La HUELLA (marca de preparación o cardio marcado) distingue «no lo hizo» de «lo
-- hizo y no lo anotó» (I-20). Sin ella, T0 y T1 serían el mismo tramo.
--
-- SEGURIDAD: `security invoker` (el defecto), así que manda la RLS de
-- `microciclos` y `checkins`. Y el `revoke` a `anon` NO es opcional: el proyecto
-- trae un `alter default privileges ... grant execute on functions to anon`.

begin;

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
  v as (
    select * from (
      select a.id, m.datos, row_number() over (partition by a.id order by m.numero desc) rn
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
