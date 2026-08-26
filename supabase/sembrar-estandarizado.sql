-- Siembra inicial de `estandarizado_ejercicio`, desde el historial que ya existe.
--
-- SE CORRE UNA SOLA VEZ, justo despues de aplicar la 0043.
--
-- POR QUE HACE FALTA. La tabla nace vacia, y la derivacion solo cuenta desde el
-- microciclo siguiente. Sin esto, un ejercicio que el historial YA demuestra
-- asentado —tres vueltas limpias seguidas— tardaria otras tres en aparecer como
-- tal, y el planificador le congelaria la carga mientras tanto sin motivo.
--
-- LA REGLA, la misma que `src/domain/estandarizacion.ts`:
--
--     primera aparicion del ejercicio    -> rompe (ejercicio nuevo)
--     el cue cambio respecto al anterior -> rompe (nota tecnica nueva)
--     ninguna serie trae RIR             -> QUIETO: ni suma ni rompe
--     |RIR real - objetivo| > 1          -> rompe (fuera de banda)
--     resto                              -> suma
--
--     estandarizado = racha final >= 3
--
-- «Quieto» y no «rompe» cuando falta el RIR: no hay prueba de que la tecnica
-- aguante, pero tampoco de que falle. Romper ahi haria que quien no reporta no
-- estandarice jamas, y el 34,5 % de las filas no trae RIR.
--
-- ── LO QUE SALE, MEDIDO CONTRA PRODUCCION EL 2026-08-25 ────────────────────
--
--   1.217 linajes de ejercicio en total
--     882 con racha 0
--     248 con racha 1
--      56 con racha 2
--      31 con racha >= 3   ->  ESTANDARIZADOS de entrada
--
-- Y por que solo 31, que es la pregunta que uno se hace al ver el numero.
-- Reparto de los 2.702 pares ejercicio-microciclo:
--
--     45,0 %  primera aparicion del ejercicio
--     34,5 %  sin RIR registrado
--     17,8 %  limpio, suma
--      1,5 %  cue cambiado por el coach
--      1,1 %  RIR fuera de banda
--
-- NO es que la tecnica sea inestable ni que el coach cambie mucho los cues: eso
-- son 2,6 % entre los dos. Es que **los linajes son cortos** —1.217 linajes en
-- 2.702 filas: 2,2 microciclos de media por ejercicio— y que un tercio de las
-- filas no tiene con que medirse.
--
-- CONSECUENCIA PARA EL COACH, y es decision suya: con la racha en 3 arrancan 31.
-- Bajarla a 2 sumaria los 56 de racha exactamente 2, o sea 87. La constante vive
-- en `RACHA_PARA_ESTANDARIZAR` (src/domain/estandarizacion.ts) y aqui abajo.
--
-- ══ APLICADO EL 2026-08-25 ═════════════════════════════════════════════════
-- Migracion 0043 aplicada y verificada (7 columnas, RLS activo, politica de
-- lectura, 3 checks + PK + FK, indice parcial de vetos). Siembra corrida: las
-- 1.217 filas entraron y la distribucion coincide EXACTA con el ensayo en seco
-- —882 / 248 / 56 / 31—, asi que no hubo deriva entre medir y escribir.
--
-- 25 personas con filas; 31 ejercicios estandarizados de entrada, y **19 de esos
-- 31 son de una sola asesorada**, que tiene 19 de sus 21 ejercicios avalados.
-- No es que entrene mejor: es la unica con historial largo y RIR anotado en casi
-- todo. Otra tiene 58 ejercicios y 5 avalados. Confirma desde otro angulo que el
-- cuello de botella es el REGISTRO, no el criterio.
--
-- Nada de esto ha cambiado un microciclo ni una carga: la tabla es de lectura y
-- hoy no la consulta nadie —`estandarizacion.ts` sigue en MODULOS_SIN_ENCHUFAR—.
--
-- Diseño → Cerebro Alpha/docs/superpowers/specs/2026-08-25-atributos-por-ejercicio.md §4


-- ══ PASO 1 · ENSAYO EN SECO ════════════════════════════════════════════════
-- Correr esto primero. No escribe nada. Tiene que dar los numeros de arriba.

with ej as (
  select m.usuario_id, m.numero, m.id as mid, e->>'id' as eid,
         upper(regexp_replace(coalesce(e->>'cues',''), '\s+', ' ', 'g')) as cue,
         (select max(abs((x->>'rir')::numeric
                    - (case when e->>'rirObjetivo' ~ '^-?[0-9]+(\.[0-9]+)?$'
                            then (e->>'rirObjetivo')::numeric end)))
            from jsonb_array_elements(coalesce(e->'series','[]'::jsonb)) x
           where x ? 'rir' and jsonb_typeof(x->'rir') = 'number') as peor_desv
    from public.microciclos m,
         jsonb_array_elements(m.datos->'sesiones') s,
         jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
   where coalesce(e->>'id','') <> ''
), con_previo as (
  select *,
         lag(cue) over (partition by usuario_id, eid order by numero, mid) as cue_previo,
         row_number() over (partition by usuario_id, eid order by numero, mid) as pos
    from ej
), evento as (
  select usuario_id, eid, numero,
         case when pos = 1                         then 'rompe'
              when cue is distinct from cue_previo then 'rompe'
              when peor_desv is null               then 'quieto'
              when peor_desv > 1                   then 'rompe'
              else 'suma' end as ev,
         case when pos = 1                         then 'ejercicio nuevo'
              when cue is distinct from cue_previo then 'nota tecnica nueva'
              when peor_desv > 1                   then 'rir fuera de banda'
              end as motivo
    from con_previo
), corte as (
  select usuario_id, eid,
         max(numero) filter (where ev = 'rompe') as ultimo_rompe,
         (array_agg(motivo order by numero desc) filter (where ev = 'rompe'))[1] as motivo
    from evento group by 1,2
), racha as (
  select e.usuario_id, e.eid, c.motivo,
         count(*) filter (where e.ev = 'suma' and e.numero > coalesce(c.ultimo_rompe, -1)) as ok
    from evento e join corte c using (usuario_id, eid)
   group by 1,2,3
)
select case when ok >= 3 then 'racha >=3  → ESTANDARIZADO'
            else 'racha ' || ok::text end as tramo,
       count(*) as linajes
  from racha group by 1 order by 1;


-- ══ PASO 2 · LA SIEMBRA ════════════════════════════════════════════════════
-- Solo si el ensayo cuadra. Es idempotente: `on conflict do nothing` respeta
-- cualquier fila que ya exista —incluido un veto del coach puesto a mano— asi
-- que volver a correrlo no puede pisar una decision.

insert into public.estandarizado_ejercicio
       (usuario_id, ejercicio_id, estado, origen, microciclos_ok, motivo)
with ej as (
  select m.usuario_id, m.numero, m.id as mid, e->>'id' as eid,
         upper(regexp_replace(coalesce(e->>'cues',''), '\s+', ' ', 'g')) as cue,
         (select max(abs((x->>'rir')::numeric
                    - (case when e->>'rirObjetivo' ~ '^-?[0-9]+(\.[0-9]+)?$'
                            then (e->>'rirObjetivo')::numeric end)))
            from jsonb_array_elements(coalesce(e->'series','[]'::jsonb)) x
           where x ? 'rir' and jsonb_typeof(x->'rir') = 'number') as peor_desv
    from public.microciclos m,
         jsonb_array_elements(m.datos->'sesiones') s,
         jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
   where coalesce(e->>'id','') <> ''
), con_previo as (
  select *,
         lag(cue) over (partition by usuario_id, eid order by numero, mid) as cue_previo,
         row_number() over (partition by usuario_id, eid order by numero, mid) as pos
    from ej
), evento as (
  select usuario_id, eid, numero,
         case when pos = 1                         then 'rompe'
              when cue is distinct from cue_previo then 'rompe'
              when peor_desv is null               then 'quieto'
              when peor_desv > 1                   then 'rompe'
              else 'suma' end as ev,
         case when pos = 1                         then 'ejercicio nuevo'
              when cue is distinct from cue_previo then 'nota tecnica nueva'
              when peor_desv > 1                   then 'rir fuera de banda'
              end as motivo
    from con_previo
), corte as (
  select usuario_id, eid,
         max(numero) filter (where ev = 'rompe') as ultimo_rompe,
         (array_agg(motivo order by numero desc) filter (where ev = 'rompe'))[1] as motivo
    from evento group by 1,2
), racha as (
  select e.usuario_id, e.eid, c.motivo,
         count(*) filter (where e.ev = 'suma' and e.numero > coalesce(c.ultimo_rompe, -1)) as ok
    from evento e join corte c using (usuario_id, eid)
   group by 1,2,3
)
select usuario_id,
       eid,
       case when ok >= 3 then 'si' else 'no' end,
       'derivado',
       ok,
       case when ok >= 3 then null else motivo end
  from racha
on conflict (usuario_id, ejercicio_id) do nothing;


-- ══ PASO 3 · COMPROBAR ═════════════════════════════════════════════════════
-- Tiene que dar 1.217 filas y 31 estandarizados (cifras del 2026-08-25; si el
-- historial crecio desde entonces, subiran).

select count(*)                                          as filas,
       count(*) filter (where estado = 'si')             as estandarizados,
       count(*) filter (where origen = 'veto_coach')     as vetos_respetados,
       count(distinct usuario_id)                        as personas
  from public.estandarizado_ejercicio;
