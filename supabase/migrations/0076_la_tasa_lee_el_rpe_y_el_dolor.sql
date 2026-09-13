-- 0076 · La tasa lee el RPE y el dolor
--
-- Hasta aquí la revisión larga decía «la app todavía no lo lee» a quien tiene en su plan un techo
-- de RPE o «cero dolor»: el dato existía (`testPost.rpeSesion` en cada sesión, `dolor` en el
-- check-in diario) pero el export no lo traía. Con esto esos planes pueden escribir su meta
-- (`rpe <= 8`, `dolor_eva <= 0`) y la pieza de la tasa medirla.
--
-- Solo AÑADE dos claves: `microciclos[].rpe_sesiones` y `personas[].dolores`. Quitadas esas dos,
-- el export sale idéntico al de la 0074 (comprobado antes de aplicar).

begin;

create or replace function public.tasa_contra_el_plan_export()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
with activos as (
  select distinct u.id, u.nombre
    from public.usuarios_app u
    join public.microciclos m on m.usuario_id = u.id and m.estado = 'activo'
),
micros as (
  select a.id, m.numero, m.estado, m.datos,
         row_number() over (partition by a.id
                            order by (m.estado = 'activo') desc, m.numero desc,
                                     m.datos->>'fechaInicio' desc nulls last) as rn
    from activos a
    join public.microciclos m on m.usuario_id = a.id
   where m.numero <= (select max(m2.numero) from public.microciclos m2
                       where m2.usuario_id = a.id and m2.estado = 'activo')
),
v as (
  -- 6 y no 4: un número repetido de un bloque viejo puede ocupar un sitio.
  select * from micros where rn <= 6
),
ses as (
  select v.id, v.numero, s.sord, s.ses
    from v
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(v.datos->'sesiones') = 'array' then v.datos->'sesiones' else '[]'::jsonb end
    ) with ordinality as s(ses, sord)
),
ej as (
  select ses.id, ses.numero, ses.sord, e.eord, e.ej
    from ses
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(ses.ses->'ejercicios') = 'array' then ses.ses->'ejercicios' else '[]'::jsonb end
    ) with ordinality as e(ej, eord)
),
sr as (
  select ej.id, ej.numero, ej.sord, ej.eord, x.serie,
         coalesce(
           (select p
              from jsonb_array_elements(
                case when jsonb_typeof(ej.ej->'seriesPrescritas') = 'array' then ej.ej->'seriesPrescritas' else '[]'::jsonb end
              ) p
             where p->'orden' = x.serie->'orden'
             limit 1),
           jsonb_build_object('reps', ej.ej->'repsDiana', 'cargaKg', ej.ej->'cargaKg', 'rir', ej.ej->'rirObjetivo')
         ) as pauta
    from ej
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(ej.ej->'series') = 'array' then ej.ej->'series' else '[]'::jsonb end
    ) as x(serie)
),
srf as (
  select sr.*,
         (sr.serie->'reps'    is not distinct from sr.pauta->'reps'
          and sr.serie->'cargaKg' is not distinct from sr.pauta->'cargaKg'
          and sr.serie->'rir'     is not distinct from sr.pauta->'rir') as calcada,
         (sr.serie->'rir' is not distinct from sr.pauta->'rir') as rir_coincide,
         case when jsonb_typeof(sr.serie->'reps') = 'number' and jsonb_typeof(sr.serie->'cargaKg') = 'number'
              then (sr.serie->>'reps')::numeric * (sr.serie->>'cargaKg')::numeric end as kgrep
    from sr
),
ejx as (
  select ej.id, ej.numero, ej.sord, ej.eord,
         max(case when jsonb_typeof(ej.ej->'sets') = 'number' then (ej.ej->>'sets')::numeric else 0 end) as sets,
         max(case when jsonb_typeof(ej.ej->'sets') = 'number'
                   and jsonb_typeof(ej.ej->'repsDiana') = 'number'
                   and jsonb_typeof(ej.ej->'cargaKg') = 'number'
                  then (ej.ej->>'sets')::numeric * (ej.ej->>'repsDiana')::numeric * (ej.ej->>'cargaKg')::numeric
                  else 0 end) as pautado_kgrep,
         count(srf.serie) as n_series,
         count(srf.serie) filter (where srf.calcada) as n_calcadas,
         count(srf.serie) filter (where srf.rir_coincide) as rir_coinciden,
         coalesce(sum(srf.kgrep), 0) as hecho_kgrep
    from ej
    left join srf
      on srf.id = ej.id and srf.numero = ej.numero and srf.sord = ej.sord and srf.eord = ej.eord
   group by ej.id, ej.numero, ej.sord, ej.eord
),
sesx as (
  select ses.id, ses.numero, ses.sord,
         (exists (select 1 from jsonb_array_elements(
                    case when jsonb_typeof(ses.ses->'preparacion') = 'array' then ses.ses->'preparacion' else '[]'::jsonb end) p
                   where p->>'hechoEn' is not null)
          or exists (select 1 from jsonb_array_elements(
                    case when jsonb_typeof(ses.ses->'bloquesCardio') = 'array' then ses.ses->'bloquesCardio' else '[]'::jsonb end) b
                   where b->>'hechoEn' is not null)) as con_huella,
         exists (select 1 from ejx
                  where ejx.id = ses.id and ejx.numero = ses.numero and ejx.sord = ses.sord and ejx.n_series > 0) as con_series
    from ses
),
mx as (
  select v.id, v.numero, v.estado,
         v.datos->>'fechaInicio' as inicio,
         v.datos->'cadenciaDias' as cadencia,
         (select count(*) from sesx where sesx.id = v.id and sesx.numero = v.numero) as sesiones,
         -- LA 0076: el RPE de cada sesión con test post-sesión, en su orden. Solo números: un
         -- test a medias no pone un RPE que nadie escribió.
         (select coalesce(jsonb_agg(ses.ses->'testPost'->'rpeSesion' order by ses.sord), '[]'::jsonb)
            from ses
           where ses.id = v.id and ses.numero = v.numero
             and jsonb_typeof(ses.ses->'testPost'->'rpeSesion') = 'number') as rpe_sesiones,
         (select count(*) from sesx where sesx.id = v.id and sesx.numero = v.numero and sesx.con_huella) as sesiones_con_huella,
         (select count(*) from sesx where sesx.id = v.id and sesx.numero = v.numero
                                      and (sesx.con_huella or sesx.con_series)) as sesiones_con_evidencia,
         e.ejercicios, e.con_serie, e.con_serie_util, e.series_pautadas, e.series_hechas,
         e.series_calcadas, e.rir_coinciden, e.ejercicios_sin_carga_pautada,
         e.pautado_kgrep, e.hecho_kgrep, e.hecho_kgrep_total
    from v
    left join lateral (
      select count(*) as ejercicios,
             count(*) filter (where n_series > 0) as con_serie,
             count(*) filter (where n_series > 0 and n_calcadas < n_series) as con_serie_util,
             coalesce(sum(sets), 0) as series_pautadas,
             coalesce(sum(n_series), 0) as series_hechas,
             coalesce(sum(n_calcadas), 0) as series_calcadas,
             coalesce(sum(rir_coinciden), 0) as rir_coinciden,
             count(*) filter (where pautado_kgrep = 0) as ejercicios_sin_carga_pautada,
             round(coalesce(sum(pautado_kgrep), 0), 1) as pautado_kgrep,
             round(coalesce(sum(hecho_kgrep) filter (where pautado_kgrep > 0), 0), 1) as hecho_kgrep,
             round(coalesce(sum(hecho_kgrep), 0), 1) as hecho_kgrep_total
        from ejx
       where ejx.id = v.id and ejx.numero = v.numero
    ) e on true
),
per as (
  select a.id, a.nombre,
         -- Las medidas viven en DOS sitios (memoria `medidas-viven-en-dos-tablas`):
         -- el perfil y el formulario de nutrición. Se miran los dos.
         (select jsonb_build_object(
                   'n', count(*),
                   'con_perimetros', count(*) filter (where (md ? 'perimetros'
                        and md->'perimetros' not in ('null'::jsonb, '{}'::jsonb, '[]'::jsonb))
                        or jsonb_typeof(md->'cuerpo'->'cinturaCm') = 'number'
                        or jsonb_typeof(md->'cuerpo'->'caderasCm') = 'number'),
                   'con_peso', count(*) filter (where jsonb_typeof(md->'pesoKg') = 'number'),
                   'ultima_fecha', max(md->>'fecha'))
            from public.perfiles p
            cross join lateral jsonb_array_elements(
              case when jsonb_typeof(p.datos->'medidas') = 'array' then p.datos->'medidas' else '[]'::jsonb end) md
           where p.usuario_id = a.id) as medidas_perfil,
         -- Los pesos UNO A UNO, para la tendencia en kg/semana: con el último solo no
         -- se ve ni el ritmo ni que la app los siembra (una asesorada: el mismo peso diez días seguidos).
         (select jsonb_agg(jsonb_build_object('fecha', x.fecha, 'peso', x.peso, 'fuente', x.fuente)
                           order by x.fecha)
            from (select c.fecha, (c.datos->>'pesoKg')::numeric as peso, 'checkin' as fuente
                    from public.checkins c
                   where c.usuario_id = a.id and c.fecha >= current_date - 42
                     and jsonb_typeof(c.datos->'pesoKg') = 'number'
                  union all
                  select cn.fecha, cn.peso_kg, 'nutricion'
                    from public.checkins_nutricion cn
                   where cn.usuario_id = a.id and cn.fecha >= current_date - 42
                     and cn.peso_kg is not null) x) as pesos,
         -- Los perímetros con su clave TAL CUAL: las claves son libres («Cintura»,
         -- «Cintura ombligo», «Cintura natural» son tres cosas) y el script no las funde.
         -- LA 0074: desde el 2026-09-08 la tarjeta de medidas guarda la cintura y las caderas
         -- en `cuerpo` (cinturaCm, caderasCm) y deja `perimetros` VACÍO. Sin esto, cada toma
         -- nueva se descartaba aquí por vacía. Entran como «Cintura» y «Caderas», que es la
         -- etiqueta que la persona lee en la tarjeta; si la misma toma trae las dos, manda `cuerpo`.
         (select jsonb_agg(jsonb_build_object('fecha', x.fecha, 'perimetros', x.perimetros)
                           order by x.fecha)
            from (select md->>'fecha' as fecha,
                         (case when jsonb_typeof(md->'perimetros') = 'object' then md->'perimetros' else '{}'::jsonb end)
                         || jsonb_strip_nulls(jsonb_build_object(
                              'Cintura', case when jsonb_typeof(md->'cuerpo'->'cinturaCm') = 'number' then md->'cuerpo'->'cinturaCm' end,
                              'Caderas', case when jsonb_typeof(md->'cuerpo'->'caderasCm') = 'number' then md->'cuerpo'->'caderasCm' end))
                           as perimetros
                    from public.perfiles p
                    cross join lateral jsonb_array_elements(
                      case when jsonb_typeof(p.datos->'medidas') = 'array' then p.datos->'medidas' else '[]'::jsonb end) md
                   where p.usuario_id = a.id) x
           where x.perimetros <> '{}'::jsonb) as perimetros,
         -- LA 0076: el dolor de cada check-in que lo anota (EVA 0-10). El cero va dentro: «sin
         -- dolor» es una medición. El día sin anotar no está, y no se inventa como cero.
         (select jsonb_agg(jsonb_build_object('fecha', c.fecha, 'eva', c.datos->'dolor') order by c.fecha)
            from public.checkins c
           where c.usuario_id = a.id and c.fecha >= current_date - 42
             and jsonb_typeof(c.datos->'dolor') = 'number') as dolores,
         (select jsonb_build_object('peso', pa.respuestas->'pesoKg',
                                    'cintura', pa.respuestas->'cinturaCm',
                                    'completada_en', pa.completada_en)
            from public.perfil_alimentario pa
           where pa.asesorado_id = a.id
           limit 1) as formulario,
         -- `pesos_distintos` existe porque una asesorada tenía ocho check-ins con el mismo peso exacto.
         -- El selector se siembra con el último valor y se guarda se toque o no.
         (select jsonb_build_object(
                   'n', count(*),
                   'con_peso', count(*) filter (where jsonb_typeof(c.datos->'pesoKg') = 'number'),
                   'pesos_distintos', count(distinct c.datos->'pesoKg') filter (where jsonb_typeof(c.datos->'pesoKg') = 'number'),
                   'ultimo_peso', (array_agg(c.datos->'pesoKg' order by c.fecha desc)
                                     filter (where jsonb_typeof(c.datos->'pesoKg') = 'number'))[1],
                   'ultimo_peso_fecha', max(c.fecha) filter (where jsonb_typeof(c.datos->'pesoKg') = 'number'),
                   'con_dolor', count(*) filter (where c.datos ? 'dolor'))
            from public.checkins c
           where c.usuario_id = a.id and c.fecha >= current_date - 42) as checkins,
         (select jsonb_build_object(
                   'con_peso', count(cn.peso_kg),
                   'pesos_distintos', count(distinct cn.peso_kg),
                   'ultimo_peso', (array_agg(cn.peso_kg order by cn.fecha desc) filter (where cn.peso_kg is not null))[1],
                   'ultimo_peso_fecha', max(cn.fecha) filter (where cn.peso_kg is not null))
            from public.checkins_nutricion cn
           where cn.usuario_id = a.id and cn.fecha >= current_date - 42) as nutricion
    from activos a
)
select jsonb_build_object(
         'hoy', current_date,
         'personas', coalesce(jsonb_agg(jsonb_build_object(
             'nombre', per.nombre,
             'usuario_id', per.id,
             'medidas_perfil', per.medidas_perfil,
             'formulario', per.formulario,
             'checkins', per.checkins,
             'nutricion', per.nutricion,
             'pesos', per.pesos,
             'dolores', per.dolores,
             'perimetros', per.perimetros,
             'microciclos', (select jsonb_agg(to_jsonb(mx) - 'id' order by mx.numero desc)
                               from mx where mx.id = per.id)
         ) order by per.nombre), '[]'::jsonb)
       ) as export
  from per;
$fn$;

revoke all on function public.tasa_contra_el_plan_export() from public;
revoke all on function public.tasa_contra_el_plan_export() from anon, authenticated;
grant execute on function public.tasa_contra_el_plan_export() to service_role;

comment on function public.tasa_contra_el_plan_export() is 'Export de la tasa de progresión contra el plan para la revisión semanal larga. Solo lectura, solo service_role. 0074: medidas de medidas[].cuerpo. 0076: RPE de sesión (testPost) por microciclo y dolor (EVA) de los check-ins.';

commit;
