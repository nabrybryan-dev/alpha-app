-- Comprobación de la migración 0039 (RIR y reps que no eran números).
-- Las cinco consultas tienen que devolver CERO filas.

-- 1 · No queda texto donde el tipo pide un número.
select '1 · texto donde va un número' as señal, m.id, e->>'nombre' as ejercicio,
       x->>'rir' as rir, x->>'reps' as reps
from microciclos m,
     lateral jsonb_array_elements(m.datos->'sesiones') s,
     lateral jsonb_array_elements(s->'ejercicios') e,
     lateral jsonb_array_elements(coalesce(e->'series','[]'::jsonb)) x
where (x->>'rir' is not null and x->>'rir' !~ '^-?[0-9]+(\.[0-9]+)?$')
   or (x->>'reps' is not null and x->>'reps' !~ '^-?[0-9]+(\.[0-9]+)?$');

-- 2 · No se perdió ninguna sesión ni ningún ejercicio.
select '2 · sesiones o ejercicios perdidos' as señal, m.id
from microciclos m join respaldo_0039_microciclos r on r.id = m.id
where jsonb_array_length(m.datos->'sesiones') <> jsonb_array_length(r.datos->'sesiones')
   or (select count(*) from jsonb_array_elements(m.datos->'sesiones') s,
              lateral jsonb_array_elements(s->'ejercicios') e)
   <> (select count(*) from jsonb_array_elements(r.datos->'sesiones') s,
              lateral jsonb_array_elements(s->'ejercicios') e);

-- 3 · Ninguna SERIE desapareció. Quitar una clave no es borrar la serie: la
--     serie sigue probando que la persona entrenó.
select '3 · series perdidas' as señal, m.id, ea->>'nombre' as ejercicio
from microciclos m join respaldo_0039_microciclos r on r.id = m.id,
     lateral jsonb_array_elements(m.datos->'sesiones') with ordinality as sa(a,i),
     lateral jsonb_array_elements(r.datos->'sesiones') with ordinality as sr(b,j),
     lateral jsonb_array_elements(a->'ejercicios') with ordinality as xa(ea,k),
     lateral jsonb_array_elements(b->'ejercicios') with ordinality as xb(er,l)
where i=j and k=l
  and jsonb_array_length(coalesce(ea->'series','[]'::jsonb))
   <> jsonb_array_length(coalesce(er->'series','[]'::jsonb));

-- 4 · Dentro del ejercicio solo cambiaron las series. La prescripción, la
--     categoría y las notas quedan intactas.
select '4 · cambió algo fuera de las series' as señal, m.id, ea->>'nombre' as ejercicio
from microciclos m join respaldo_0039_microciclos r on r.id = m.id,
     lateral jsonb_array_elements(m.datos->'sesiones') with ordinality as sa(a,i),
     lateral jsonb_array_elements(r.datos->'sesiones') with ordinality as sr(b,j),
     lateral jsonb_array_elements(a->'ejercicios') with ordinality as xa(ea,k),
     lateral jsonb_array_elements(b->'ejercicios') with ordinality as xb(er,l)
where i=j and k=l and (ea - 'series') <> (er - 'series');

-- 5 · La carga y el orden de cada serie no se tocaron. Es lo que prueba que la
--     persona levantó ese peso: si esto cambia, se perdió evidencia.
select '5 · cambió la carga o el orden' as señal, m.id, x->>'orden' as orden
from microciclos m join respaldo_0039_microciclos r on r.id = m.id,
     lateral jsonb_array_elements(m.datos->'sesiones') with ordinality as sa(a,i),
     lateral jsonb_array_elements(r.datos->'sesiones') with ordinality as sr(b,j),
     lateral jsonb_array_elements(a->'ejercicios') with ordinality as xa(ea,k),
     lateral jsonb_array_elements(b->'ejercicios') with ordinality as xb(er,l),
     lateral jsonb_array_elements(coalesce(ea->'series','[]'::jsonb)) with ordinality as ya(x,p),
     lateral jsonb_array_elements(coalesce(er->'series','[]'::jsonb)) with ordinality as yb(y,q)
where i=j and k=l and p=q
  and (x->>'cargaKg' is distinct from y->>'cargaKg'
    or x->>'orden' is distinct from y->>'orden');
