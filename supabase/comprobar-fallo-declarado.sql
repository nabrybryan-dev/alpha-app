-- ¿Hay algún ejercicio que PIDA el fallo en la prosa sin declararlo en el campo?
--
-- CONTRATO: cero filas. Se corre con las demas despues de cada carga.
--
-- LA REGLA. En Alpha las repeticiones son COMPLETAS y a rango completo siempre,
-- salvo excepcion escrita en el ejercicio. `RIR 0` NO es el fallo: es la ultima
-- repeticion COMPLETA, con la parcial todavia en reserva. El fallo se declara
-- escribiendo la palabra, y desde el 2026-08-25 se declara en el CAMPO
-- `rirObjetivo`, que la app escribe en la cabecera como `(FALLO)`.
--   → `Cerebro Alpha/wiki/motor-decision/02-intensidad-rir-rpe-cargas.md`
--
-- POR QUE ESTO NO PUEDE SER UN DETECTOR AUTOMATICO, y esta medido. El 2026-08-25
-- se barrieron las 2.702 prescripciones de produccion. La palabra «fallo» salia
-- en 81, y al leerlas una a una la mayoria querian decir lo CONTRARIO:
--
--   · la negacion  — «SIN FALLO», «LEJOS DEL FALLO», «AQUI NO SE BUSCA EL FALLO»
--   · el recuerdo  — «EN M14 LLEGASTE AL FALLO CON ESTE PESO»
--   · la disculpa  — «ES UN FALLO MIO, NO TUYO», que ni va de entrenar
--
-- Una expresion regular ingenua habria leido «SIN LLEGAR AL FALLO» como una
-- orden de llegar al fallo, y en el corpus real esa frase estaba en isometricas
-- terapeuticas. Eso es rango 1 de la jerarquia: seguridad. Por eso esta consulta
-- **no decide**: aparta candidatos para que los mire el coach.
--
-- OJO CON «FALLO TECNICO». No es lo mismo: es «hasta que la forma se rompa»,
-- que puede quedarse ANTES de la ultima repeticion completa. Sale en la lista
-- marcado aparte, y quien decide si eso es un `FALLO` del metodo es el coach.

with ej as (
  select m.id as microciclo, m.estado, m.usuario_id,
         e->>'nombre'      as ejercicio,
         e->>'rirObjetivo' as rir_campo,
         coalesce(e->>'prescripcion','') as pres
    from public.microciclos m,
         jsonb_array_elements(m.datos->'sesiones') s,
         jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
), marcada as (
  select ej.*,
         -- AFIRMA el fallo: la instruccion de meterse en la parcial.
         pres ~* '(HASTA\s+EL\s+FALLO|[×xX]\s*FALLO\M|\mQUIERO\s+FALLO|FALLO\s+REAL)' as afirma,
         pres ~* 'FALLO\s+T[ÉE]CNICO'                                                 as es_tecnico,
         -- NIEGA: lo mas frecuente del corpus.
         pres ~* '(\mSIN\s+(LLEGAR\s+AL\s+)?FALLO|LEJOS\s+DEL\s+FALLO|\mNO\s+(EL\s+|AL\s+|PARA\s+|SE\s+BUSCA\s+EL\s+)FALLO|\mNO\s+FALLO)' as niega,
         -- NARRA lo que ya paso, o se disculpa. No es una pauta.
         pres ~* '(LLEGASTE|HICISTE|REGISTRASTE|TERMINASTE|VEN[ÍI]A|PED[ÍI]A|SEMANA\s+PASADA|FALLO\s+M[ÍI]O)' as narra,
         -- PROXIMIDAD no es fallo: es el nombre de la variable, no una orden.
         pres ~* '(CERCA\s+DEL\s+FALLO|PROXIMIDAD\s+AL\s+FALLO|BORDE\s+DEL\s+FALLO)'  as proximidad
    from ej
   where pres ~* '\mFALLOS?\M'
)
select microciclo,
       estado,
       usuario_id,
       ejercicio,
       rir_campo,
       case when es_tecnico then 'fallo tecnico — lo decide el coach'
            else 'afirma el fallo y el campo no lo declara' end as motivo,
       left(pres, 140) as prescripcion
  from marcada
 where (afirma or es_tecnico)
   and not niega
   and not narra
   and not proximidad
   -- Ya declarado en el campo: nada que migrar.
   and coalesce(upper(rir_campo),'') <> 'FALLO'
 order by (estado = 'activo') desc, microciclo;

-- SI SALEN FILAS: no se reescriben solas. Cada una se mira y se decide si es un
-- `FALLO` del metodo —y entonces el campo `rirObjetivo` pasa a `FALLO`— o si la
-- frase estaba diciendo otra cosa. Lo ya registrado NO se toca.
