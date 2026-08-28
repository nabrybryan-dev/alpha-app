-- ============================================================================
-- COMPROBAR · ¿dice la frase lo mismo que los campos?
-- ----------------------------------------------------------------------------
-- Se corre DESPUÉS DE CADA CARGA, junto a `comprobar-fosiles.sql`.
-- Tiene que devolver CERO FILAS. Si devuelve alguna, no repartas la semana.
--
-- POR QUÉ EXISTE
-- Cada ejercicio guarda su prescripción dos veces: la frase que el asesorado lee
-- (`prescripcion`) y los campos con los que la app opera (`sets`, `repsDiana`,
-- `rirObjetivo`, `cargaKg`). La duplicación viene del Excel, cuya fila lleva las
-- columnas SET · RANGO · REPETICIONES · RIR y además la prescripción escrita
-- dentro de NOTAS ASESORADO. Dos copias que nadie compara acaban divergiendo.
--
-- EL INCIDENTE (2026-08-12)
-- La semana del 11 de agosto salió con 128 ejercicios de 13 asesorados
-- desalineados: 63 leían «3 SERIES» con `sets` en 2, 69 leían «(RIR 1)» con
-- `rirObjetivo` en 2, y uno tenía una escalera de 3 series con `sets` en 2.
--
-- No es cosmético. `sets` decide cuándo se da el ejercicio por terminado, así
-- que la app cerraba la tercera serie que la propia prescripción pedía. Y
-- `rirObjetivo` elige el coeficiente de %1RM: pedir RIR 1 y operar con RIR 2
-- hace que el motor proponga casi un 5 % menos de carga la semana siguiente.
--
-- LA CAUSA
-- Herencia. `tmp_nuevo_micro` escribe `sets`, `rir` y `reps` SOLO cuando el
-- ajuste los trae. Si la carga pasa la frase nueva (`nota`) sin pasarlos, la
-- frase se actualiza y los campos se quedan con los del microciclo anterior. Se
-- verificó: en prácticamente todos, el campo era idéntico al de la semana previa.
--
-- QUÉ MANDA
-- La frase, porque es lo que el coach escribe y lo que la persona lee. Salvo en
-- un ejercicio ondulado: ahí manda `seriesPrescritas`, que lista las series una
-- a una.
--
-- El equivalente en TypeScript es `src/domain/alineacion.ts`, con sus tests.
-- Si cambias uno, cambia el otro.
-- ============================================================================

with ejercicios as (
  select u.nombre                                   as asesorado,
         m.id                                       as microciclo,
         s->>'nombre'                               as sesion,
         e->>'nombre'                               as ejercicio,
         e->>'prescripcion'                         as frase,
         -- Los campos se leen como TEXTO y se castean solo si son numéricos:
         -- hay `repsDiana` que valen «Isometría» y `rirObjetivo` que valen
         -- «2-3». Castear a ciegas aborta el barrido entero por un ejercicio.
         e->>'sets'                                 as sets_campo,
         e->>'repsDiana'                            as reps_campo,
         e->>'rirObjetivo'                          as rir_campo,
         e->>'cargaKg'                              as carga_campo,
         jsonb_array_length(coalesce(e->'seriesPrescritas','[]'::jsonb)) as escalera,
         -- La cabecera se lee ANCLADA AL PRINCIPIO, igual que en el parser de
         -- TypeScript: lo que venga después es nota del coach, aunque lleve
         -- números, «TOTAL» o «KG». Un ejercicio de peso corporal cuya nota dice
         -- «te quedó registrado 20KG» no tiene 20 kg de carga pautada.
         (regexp_match(e->>'prescripcion',
            '^\s*(\d+([.,]\d+)?)\s*KGS?\y', 'i'))[1]                as carga_frase,
         (regexp_match(e->>'prescripcion',
            '^\s*\d+([.,]\d+)?\s*KGS?\y[^;]*?(?:\yA\s+|[x×]\s*)(\d+)', 'i'))[2] as reps_frase,
         (regexp_match(e->>'prescripcion',
            '^\s*\d+([.,]\d+)?\s*KGS?\y[^;]*;\s*(\d+)\s*SERIES?', 'i'))[2] as sets_frase,
         (regexp_match(e->>'prescripcion',
            '^\s*\d+([.,]\d+)?\s*KGS?\y[^;]*(?:\(RIR\s+(\d+)\))?\s*;\s*\d+\s*SERIES?(?:\s*\(RIR\s+(\d+)\))?', 'i'))[2] as rir_frase
    from public.microciclos m
    join public.usuarios_app u on u.id = m.usuario_id,
         jsonb_array_elements(m.datos->'sesiones')  s,
         jsonb_array_elements(s->'ejercicios')      e
   where m.estado = 'activo'
)
select asesorado, microciclo, sesion, ejercicio,
       campo, en_la_frase, en_el_campo,
       left(frase, 90) as frase
  from ejercicios,
       lateral (values
         -- En un ondulado manda la escalera; en el resto, la cabecera.
         ('sets',        case when escalera > 0 then escalera::text else sets_frase end, sets_campo),
         ('repsDiana',   case when escalera > 0 then null           else reps_frase end, reps_campo),
         ('rirObjetivo', case when escalera > 0 then null           else rir_frase  end, rir_campo),
         ('cargaKg',     case when escalera > 0 then null           else carga_frase end, carga_campo)
       ) as v(campo, en_la_frase, en_el_campo)
 where en_la_frase is not null
   -- Un campo que TODAVÍA NO EXISTE no está desalineado: está sin rellenar, y de
   -- eso se ocupa `scripts/rellenar-carga.mjs`. Sin esta salvedad, `cargaKg`
   -- —vacío en los 506 activos— daba 279 falsos positivos y tapaba los reales.
   and en_el_campo is not null and en_el_campo <> ''
   -- Un campo que no es un número no se contrasta contra uno que sí: no hay
   -- desajuste que reportar, hay un dato de otra naturaleza («Isometría»).
   and en_el_campo ~ '^\s*\d+([.,]\d+)?\s*$'
   and replace(en_la_frase, ',', '.')::numeric
       is distinct from replace(en_el_campo, ',', '.')::numeric
 order by asesorado, microciclo, sesion, ejercicio, campo;

-- ── Si sale alguna fila ─────────────────────────────────────────────────────
-- Manda la frase. Para alinear los campos de la semana en curso, con respaldo
-- previo (ver el incidente del 2026-08-12 en `wiki/` del Cerebro de Programación):
--
--   create table if not exists public.tmp_respaldo_microciclos_<fecha> (
--     id text primary key, datos jsonb not null,
--     guardado_en timestamptz not null default now());
--   alter table public.tmp_respaldo_microciclos_<fecha> enable row level security;
--   insert into public.tmp_respaldo_microciclos_<fecha> (id, datos)
--   select id, datos from public.microciclos
--    where estado='activo' and datos->>'fechaInicio'='<fecha>'
--   on conflict (id) do nothing;
--
-- Y para revertir, si hiciera falta:
--   update public.microciclos m set datos = r.datos
--     from public.tmp_respaldo_microciclos_<fecha> r where r.id = m.id;
