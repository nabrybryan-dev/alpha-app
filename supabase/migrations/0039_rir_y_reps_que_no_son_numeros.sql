-- 0039 · El RIR y las reps que no eran números
--
-- 81 series guardaban texto donde el tipo pide un número: «Control» (51),
-- «Isometría» (8), «Movilidad» (6), «Suave» (1), «RIR 2-3» (8), «RIR 1» (3), y
-- en `reps` además «Superset», «Densidad» e «Isometría».
--
-- NO ERA CORRUPCIÓN. Era información real metida en el campo equivocado: una
-- plancha isométrica no tiene repeticiones en reserva y un foam roller tampoco.
-- El coach escribió lo que sí aplicaba porque el tipo exigía rellenar algo.
--
-- Lo destapó un `avg` sobre RIR que reventó con «invalid input syntax for type
-- numeric: "Isometría"» al preparar los datos de planificación.
--
-- DOS TRATOS DISTINTOS, y la diferencia importa:
--
--   · «RIR 1» y «RIR 2-3» SÍ son RIR, escritos con la etiqueta pegada. Se
--     convierten: 1 y 2,5 (punto medio del rango). 11 series.
--   · «Control», «Isometría», «Movilidad», «Suave» NO son RIR. Se quita la
--     clave. 66 series. Poner un número ahí sería inventarse el dato, y ese
--     número entra en los promedios que deciden la carga de la semana
--     siguiente. RIR 0 significa «llegué al fallo»: es lo más lejos que hay
--     de un isométrico de control.
--
-- La serie NO se borra: conserva `orden` y `cargaKg`, así que sigue probando
-- que la persona entrenó. Lo que desaparece es una métrica que no existía.
--
-- Requiere `SerieRegistrada.reps` y `.rir` opcionales (`src/domain/types.ts`) y
-- los siete consumidores adaptados para saltarse las series sin dato en vez de
-- contarlas como cero. Ver `src/domain/series-sin-rir.test.ts`.

begin;

create table if not exists respaldo_0039_microciclos as
select id, datos, now() as respaldado_en from microciclos where false;

alter table respaldo_0039_microciclos enable row level security;

create or replace function tmp_serie_limpia(x jsonb) returns jsonb
language sql immutable as $$
  with paso_rir as (
    select case
      when x->>'rir' is null then x
      when x->>'rir' ~ '^-?[0-9]+(\.[0-9]+)?$' then x
      -- «RIR 2-3»: un rango con etiqueta. Punto medio.
      when x->>'rir' ~ '^RIR *[0-9]+ *- *[0-9]+$' then jsonb_set(x, '{rir}', to_jsonb(
        (((substring(x->>'rir' from 'RIR *([0-9]+)'))::numeric
         + (substring(x->>'rir' from '- *([0-9]+)'))::numeric) / 2)::float8))
      -- «RIR 1»: un número con la etiqueta pegada delante.
      when x->>'rir' ~ '^RIR *[0-9]+$' then jsonb_set(x, '{rir}', to_jsonb(
        (substring(x->>'rir' from 'RIR *([0-9]+)'))::float8))
      -- El resto no es RIR. Se quita la clave; no se inventa un cero.
      else x - 'rir'
    end as y
  )
  select case
    when y->>'reps' is null then y
    when y->>'reps' ~ '^-?[0-9]+(\.[0-9]+)?$' then y
    else y - 'reps'
  end
  from paso_rir
$$;

-- `create function` concede EXECUTE a PUBLIC, y en Supabase además hay un
-- `alter default privileges ... to anon`. Los dos revokes hacen falta.
revoke execute on function tmp_serie_limpia(jsonb) from public, anon;

insert into respaldo_0039_microciclos (id, datos, respaldado_en)
select id, datos, now() from microciclos
where id not in (select id from respaldo_0039_microciclos);

-- El `float8` no es cosmético: `(2+3)/2` en `numeric` da 2.5000000000000000 y
-- eso entraría en el JSON con esa precisión absurda.
update microciclos m
set datos = jsonb_set(m.datos, '{sesiones}', (
  select coalesce(jsonb_agg(
    case when jsonb_typeof(s->'ejercicios') = 'array' then jsonb_set(s, '{ejercicios}', (
      select coalesce(jsonb_agg(
        case when jsonb_typeof(e->'series') = 'array' then jsonb_set(e, '{series}', (
          select coalesce(jsonb_agg(tmp_serie_limpia(x) order by ox), '[]'::jsonb)
          from jsonb_array_elements(e->'series') with ordinality as sers(x, ox)
        )) else e end
        order by oe
      ), '[]'::jsonb)
      from jsonb_array_elements(s->'ejercicios') with ordinality as ejs(e, oe)
    )) else s end
    order by os
  ), '[]'::jsonb)
  from jsonb_array_elements(m.datos->'sesiones') with ordinality as ses(s, os)
))
where m.id in (select id from respaldo_0039_microciclos);

drop function tmp_serie_limpia(jsonb);

commit;

-- Después: supabase/comprobar-0039.sql, y las cinco señales en cero.
