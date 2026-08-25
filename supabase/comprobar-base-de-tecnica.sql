-- ¿`repsDiana` lleva la BASE o el total, cuando el ejercicio tiene tecnica?
--
-- CONTRATO: cero filas. Se corre con las demas despues de cada carga.
--
-- QUE VIGILA. Cuando la prescripcion describe una tecnica —myo-reps, rest-pause,
-- «N REPS + PAUSA + M REPS»— el campo `repsDiana` tiene que llevar la **base**,
-- nunca el total. La convencion esta en
-- `Cerebro Alpha/wiki/conocimiento/tecnicas-de-intensidad.md` §11.2 y §11.4.
--
-- POR QUE IMPORTA, y no es teorico. `RegistroSerie.tsx` prefija el campo `reps`
-- desde `prescrita?.reps ?? ejercicio.repsDiana`: el asesorado ve ese numero y lo
-- confirma. Si `repsDiana` trae el total de la tecnica, **el asesorado registra el
-- total haciendo exactamente lo correcto**, y a partir de ahi:
--
--   · el volumen del PANEL cuenta reps que la convencion dice no contar;
--   · la progresion compara una base contra un total y propone carga de menos;
--   · y el dato queda con la interpretacion dentro, asi que ya no se puede
--     separar — un `9` sobre un `repsDiana` de 9 no dice si fueron 9 limpias o
--     6+3. Es irrecuperable, no solo incomodo.
--
-- POR QUE NO LO CAZA `comprobar-alineacion.sql`. Ese barrido compara la frase con
-- los campos, pero solo sabe leer la cabecera canonica `{CARGA}KG A {REPS} REPS`.
-- Una frase como `80KG TOTAL (40 CADA UNA): 6 REPS + PAUSA 15-20 SEG + 3-4 REPS`
-- no encaja en ese patron y pasa de largo. Esta consulta lee el PRIMER «N REPS»
-- de la frase, encaje o no en la cabecera.
--
-- ESTADO AL ESCRIBIRLA (2026-08-25): **una sola fila** en toda la base, y en un
-- microciclo ya cerrado —un press de banca cuya frase decia «6 REPS + PAUSA +
-- 3-4 REPS» con `repsDiana` en 9—. Los 12 ejercicios activos con tecnica estan
-- todos correctos. No se reparo nada: la convencion se cumple, esto es el
-- guardian para que siga cumpliendose.

with ej as (
  select m.id as microciclo, m.estado, m.usuario_id,
         e->>'nombre' as ejercicio,
         coalesce(e->>'prescripcion','') as pres,
         case when e->>'repsDiana' ~ '^[0-9]+$' then (e->>'repsDiana')::int end as diana
    from public.microciclos m,
         jsonb_array_elements(m.datos->'sesiones') s,
         jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
   -- Sin filtrar por `rol`: el rol decide a quien se le PROGRAMA, no que datos
   -- existen. Hasta el 2026-08-24 `comprobar-fosiles` filtraba y por eso conto
   -- 141 marcas el dia que habia 161.
   where coalesce(e->>'prescripcion','') ~* 'myo[- ]?rep|rest[- ]?pause|\+ *PAUSA'
), lectura as (
  select ej.*,
         -- primer «N REPS» o «N-M REPS» de la frase
         nullif(substring(pres from '([0-9]+)\s*(?:-\s*[0-9]+)?\s*REPS'),'')::int as base,
         nullif(substring(pres from '[0-9]+\s*-\s*([0-9]+)\s*REPS'),'')::int      as tope
    from ej
)
select microciclo,
       estado,
       usuario_id,
       ejercicio,
       diana        as reps_diana_campo,
       base         as base_en_la_frase,
       left(pres, 100) as prescripcion
  from lectura
 where diana is not null
   and base is not null
   -- Un rango «10-12» es correcto con cualquier diana dentro del rango.
   and not (tope is not null and diana between least(base,tope) and greatest(base,tope))
   and diana <> base
 order by estado, microciclo;

-- SI SALEN FILAS: el arreglo va en la PRESCRIPCION, no en el registro.
-- `repsDiana` se corrige a la base y el protocolo de la tecnica se deja en la
-- prosa del coach. Lo ya registrado NO se toca: el asesorado anoto lo que la app
-- le puso delante, y reescribirlo a posteriori inventaria un dato que nadie midio.
