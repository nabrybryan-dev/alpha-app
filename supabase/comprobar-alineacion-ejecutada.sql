-- ¿La prescripcion se solto de la ejecucion? Frase contra REGISTRO, no contra campos.
--
-- CONTRATO: cada fila es un ejercicio donde |prescrita - realizada| / prescrita
-- supera el 15 % en DOS microciclos seguidos. No es «cero filas y ya»: cada fila
-- exige una decision del coach — reanclar la prescripcion a lo ejecutado, o
-- explicar por que la brecha es deliberada. Lo que no puede es quedarse sin mirar.
--
-- DE DONDE SALE. Es la verificacion §6.2 del diseño de agentes, y es la que
-- habria cazado el caso del 24/08: una prensa pautada a 142,5 kg moviendose 80
-- (-44 %) durante un microciclo entero, sin que nada lo dijera. La progresion
-- venia sumando sobre el numero de la frase, no sobre el registrado.
--
-- Y el dia que se estreno (2026-08-25, con los cerrados recien rellenados por
-- `rellenar-carga.sql`) cazo el caso INVERSO: una prensa pautada a 145 kg con la
-- persona moviendo 160->240 en piramide — 31 % de desvio un microciclo, 45 % el
-- siguiente, y creciendo. La frase decia «SUBE +5KG VS M2» con el numero
-- congelado dos microciclos mientras el asesorado se autoprogresaba. Si la
-- progresion sumara sobre lo prescrito, le pautaria 150 a alguien que mueve 240.
-- Las dos direcciones del mismo fallo: I-2, la linea base es lo EJECUTADO.
--
-- POR QUE DOS MICROCICLOS Y NO UNO. Un microciclo puede ser un mal dia, una
-- maquina distinta o un registro tecleado con prisa; dos seguidos es que la
-- prescripcion y la realidad van por caminos distintos. Con umbral de un
-- microciclo salen ~50 filas y el ruido entierra la señal.
--
-- QUE NECESITA PARA VER. `cargaKg` poblado (o `seriesPrescritas` en las
-- onduladas) Y series registradas con carga. Antes del relleno del 2026-08-25
-- solo 50 de 1.038 filas eran comparables y esta consulta era ciega en 20 de
-- cada 21 ejercicios; despues, 190. El limite que queda es el registro: sin
-- series anotadas no hay `realizada`, y eso no lo arregla ningun SQL.
--
-- La prescrita de una ondulada es la MEDIA de su escalera: un solo numero no
-- representa 60 · 60 · 62.5 · 67.5, pero para medir un desvio del 15 % la media
-- es el ancla justa.

with ej as (
  select u.nombre as asesorado, m.numero, m.estado,
         s->>'nombre' as sesion, e->>'nombre' as ejercicio,
         left(coalesce(e->>'prescripcion',''), 90) as frase,
         coalesce(nullif(e->>'cargaKg','')::numeric,
           (select avg(nullif(x->>'cargaKg','')::numeric)
              from jsonb_array_elements(coalesce(e->'seriesPrescritas','[]'::jsonb)) x)) as prescrita,
         (select avg(nullif(x->>'cargaKg','')::numeric)
            from jsonb_array_elements(coalesce(e->'series','[]'::jsonb)) x
           where nullif(x->>'cargaKg','')::numeric > 0) as realizada
    from public.microciclos m
    join public.usuarios_app u on u.id = m.usuario_id,
         jsonb_array_elements(m.datos->'sesiones') s,
         jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
   -- La ventana: los dos ultimos microciclos de cada persona. Sin filtro de
   -- `rol` (el rol decide a quien se le programa, no que datos existen).
   where m.numero >= (select max(m2.numero) - 1 from public.microciclos m2
                       where m2.usuario_id = m.usuario_id)
     and jsonb_typeof(e) = 'object'
), d as (
  select *, abs(prescrita - realizada) / prescrita as desvio
    from ej
   where prescrita > 0 and realizada is not null
)
select asesorado, numero, estado, sesion, ejercicio,
       prescrita,
       round(realizada, 1)   as realizada,
       round(100 * desvio)   as desvio_pct,
       case when realizada > prescrita
            then 'la persona va POR DELANTE de la frase'
            else 'la persona va POR DETRAS de la frase' end as direccion,
       frase
  from d
 where (asesorado, ejercicio, sesion) in (
         select asesorado, ejercicio, sesion
           from d
          where desvio > 0.15
          group by asesorado, ejercicio, sesion
         having count(distinct numero) >= 2
       )
 order by asesorado, ejercicio, numero;

-- SI SALEN FILAS: el arreglo va en la PRESCRIPCION del siguiente microciclo —
-- reanclarla a lo ejecutado (I-2) — nunca en el registro. Lo que la persona
-- anoto es lo que paso; reescribirlo inventaria un dato que nadie midio.
