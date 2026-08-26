-- ============================================================================
-- REMAPEO DE CATEGORIAS · Alejandra Tapasco · M2
-- Generado el 2026-08-26 por la auditoria. **SIN EJECUTAR.**
-- ============================================================================
--
-- QUE ARREGLA
-- Su M2 se cargo con la taxonomia VIEJA —por musculo («Aductores»,
-- «Isquiosurales», «Cadera») y por funcion («Cadenas», «Reactiva»)— en vez de
-- con las 32 categorias canonicas por patron de movimiento. Consecuencia: esos
-- ejercicios suman CERO al PANEL y a los landmarks.
--
-- **27 de sus 60 series registradas —el 45 por ciento— no se estan contando.** Y es un
-- bloque de PIERNA: sus cuatro ejercicios mas cargados (prensa, hack, hip thrust
-- y peso muerto rumano) estan los cuatro invisibles.
--
-- LO QUE ESTE SQL NO TOCA, Y ES DELIBERADO
-- Los 13 ejercicios del dia atletico —cadenas, tejido pasivo, reactiva, potencia—
-- NO tienen categoria canonica que les corresponda. No es un error de carga: es
-- un HUECO DE LA TAXONOMIA. Meterlos a la fuerza en PREV/REHAB o ACONDICIONAMIENTO
-- seria decidir por el metodo. Se quedan como estan hasta que el coach decida.
--
-- ANTES DE CORRER: leelo entero. Cambia datos de produccion.
-- ============================================================================

begin;

with remap(ejercicio, canonica) as (
  values
    ('Hip thrust con barra', 'EXTENSIÓN DE CADERA'),   -- 4 series ya registradas
    ('Peso muerto rumano con mancuernas', 'BISAGRA DE CADERA'),   -- 4 series ya registradas
    ('Prensa 45° pies anchos', 'SENTADILLA'),   -- ⚠ el coach la puso como Aductores; el patron es sentadilla y la postura ancha va en el parentesis
    ('Sentadilla hack en máquina', 'SENTADILLA'),   -- 4 series ya registradas
    ('Extensión de rodilla', 'EXTENSIÓN DE RODILLA'),   -- 3 series ya registradas
    ('Aducción de cadera en máquina', 'ADUCCIÓN DE CADERA'),   -- 3 series ya registradas
    ('Curl femoral tumbado', 'FLEXIÓN DE RODILLA'),   -- 3 series ya registradas
    ('Elevación de talones de pie', 'FLEXIÓN PLANTAR'),   -- 2 series ya registradas
    ('Aducción en polea de pie', 'ADUCCIÓN DE CADERA'),
    ('Extensión de cadera en banco 45°', 'EXTENSIÓN DE CADERA'),
    ('Jalón al pecho agarre prono abierto', 'TRACCIÓN VERTICAL'),
    ('Remo en máquina agarre neutro', 'TRACCIÓN HORIZONTAL'),
    ('Sentadilla sumo con mancuerna', 'SENTADILLA'),
    ('Zancada lateral (cossack) con mancuerna', 'SENTADILLA UNILATERAL'),   -- ⚠ o ADUCCIÓN DE CADERA: el cossack carga el aductor del lado extendido. Lo decide el coach
    ('Pallof press en polea', 'ANTIRROTACIÓN'),
    ('Abducción de cadera en máquina', 'ABDUCCIÓN DE CADERA'),
    ('Curl femoral sentado', 'FLEXIÓN DE RODILLA'),
    ('Patada de glúteo en polea', 'EXTENSIÓN DE CADERA'),
    ('Peso muerto rumano a una pierna', 'BISAGRA DE CADERA'),
    ('Plancha frontal', 'ANTIEXTENSIÓN')
)
update public.microciclos m
   set datos = jsonb_set(m.datos, '{sesiones}', (
         select jsonb_agg(
                  jsonb_set(s, '{ejercicios}', (
                    select jsonb_agg(
                             case when r.canonica is not null
                                  then jsonb_set(e, '{categoria}', to_jsonb(r.canonica))
                                  else e end order by ord2)
                      from jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb))
                             with ordinality t2(e, ord2)
                      left join remap r on r.ejercicio = e->>'nombre'))
                  order by ord)
           from jsonb_array_elements(m.datos->'sesiones') with ordinality t(s, ord)))
  from public.usuarios_app u
 where u.id = m.usuario_id
   and u.nombre = 'Alejandra Tapasco'
   and m.numero = 2;

-- COMPROBAR ANTES DE `commit`: tiene que devolver 0 filas de las remapeadas.
-- Si devuelve alguna, algo no caso por el nombre y NO se ha arreglado.

commit;
