-- 0149 · Quien recalcula `estandarizado_ejercicio`.
--
-- EL HUECO. La 0043 creó la tabla y `supabase/sembrar-estandarizado.sql` la llenó UNA vez, el
-- 2026-08-25 (1.217 filas, 31 en «si»). La 0043 dice que el valor es «derivado por la carga», pero la
-- carga no lo recalcula: desde esa fecha nadie lo ha tocado. Una racha de tres microciclos limpios que
-- se cumpliera después seguiría diciendo «no» para siempre.
--
-- LA ELECCIÓN: UNA FUNCIÓN QUE RECALCULA TODO + pg_cron, y no un disparador al guardar series.
--   · Un disparador sobre `microciclos` se dispararía en cada serie que la persona guarda (el microciclo
--     entero es un jsonb que se reescribe), para un dato que solo cambia al cerrar un microciclo.
--   · La racha es una propiedad del HISTORIAL (cuántos microciclos limpios seguidos), no de la última
--     escritura. Recalcular desde el historial es idempotente y se corrige solo: si un microciclo se
--     edita o se borra, la siguiente pasada lo refleja. Un contador incremental no.
--   · Es la misma consulta que ya se ensayó y se sembró contra producción (sembrar-estandarizado.sql,
--     cifras que coincidieron exactas), así que no se inventa una regla nueva.
--
-- LA REGLA es la de `src/domain/estandarizacion.ts` (`siguienteEstado`):
--   primera aparición del ejercicio       -> rompe (ejercicio nuevo)
--   el cue cambió respecto al anterior    -> rompe (nota tecnica nueva)
--       (se compara como `normalizarCue` de TypeScript: sin tildes, mayúsculas, espacios colapsados y sin
--        signos de puntuación en los bordes. La siembra no quitaba tildes ni puntuación de los bordes: un
--        punto de más habría reiniciado tres semanas de conteo.)
--   ninguna serie trae RIR                -> quieto (ni suma ni rompe)
--   |RIR real - objetivo| > 1             -> rompe (rir fuera de banda)
--   resto                                 -> suma
--   estandarizado = racha >= 3
--
-- DIFERENCIA CON LA SIEMBRA, A PROPÓSITO. La siembra contaba también el microciclo activo. Aquí un
-- microciclo que no está `cerrado` NO SUMA (queda «quieto»), aunque sí puede ROMPER la racha. Motivo: el
-- activo está a medias, y una sola serie buena de la semana en curso no puede dar por asentada la técnica.
-- Marcar de más es el error caro (0043, líneas 18-22); marcar de menos cuesta una semana.
--
-- EL VETO GANA. Las filas con origen 'veto_coach' no se tocan: el `do update` solo actúa sobre las
-- derivadas. Una fila nueva se inserta siempre como derivada.
--
-- PERMISOS. `security definer` con ruta fija; solo `service_role` (y el cron, que corre como dueño) la
-- ejecutan. Ni anon ni authenticated: el asesorado LEE su fila (política de la 0043) pero no dispara
-- recálculos.
--
-- NO SE APLICA SOLA: se aplica a mano, como el resto. Tras aplicarla, el primer recálculo cambiará filas
-- (la tabla lleva dos meses sin moverse). Ver «Comprobación» al final.

create or replace function public.recalcular_estandarizado()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas integer;
begin
  with ej as (
    select m.usuario_id, m.numero, m.id as mid, m.estado as estado_micro, e->>'id' as eid,
           regexp_replace(
             translate(upper(regexp_replace(coalesce(e->>'cues',''), '\s+', ' ', 'g')),
                       'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑ', 'AAAAEEEEIIIIOOOOUUUUN'),
             '^[\s;.,]+|[\s;.,]+$', '', 'g') as cue,
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
           case when pos = 1                           then 'rompe'
                when cue is distinct from cue_previo   then 'rompe'
                when peor_desv is null                 then 'quieto'
                when peor_desv > 1                     then 'rompe'
                when estado_micro = 'cerrado'          then 'suma'
                else 'quieto' end as ev,
           case when pos = 1                           then 'ejercicio nuevo'
                when cue is distinct from cue_previo   then 'nota tecnica nueva'
                when peor_desv > 1                     then 'rir fuera de banda'
                end as motivo
      from con_previo
  ), corte as (
    select usuario_id, eid,
           max(numero) filter (where ev = 'rompe') as ultimo_rompe,
           (array_agg(motivo order by numero desc) filter (where ev = 'rompe'))[1] as motivo
      from evento group by 1, 2
  ), racha as (
    select e.usuario_id, e.eid, c.motivo,
           count(*) filter (where e.ev = 'suma' and e.numero > coalesce(c.ultimo_rompe, -1)) as ok
      from evento e join corte c using (usuario_id, eid)
     group by 1, 2, 3
  ), escrito as (
    insert into public.estandarizado_ejercicio
           (usuario_id, ejercicio_id, estado, origen, microciclos_ok, motivo, actualizado_en)
    select usuario_id, eid,
           case when ok >= 3 then 'si' else 'no' end,
           'derivado',
           ok,
           case when ok >= 3 then null else motivo end,
           now()
      from racha
    on conflict (usuario_id, ejercicio_id) do update
       set estado = excluded.estado,
           microciclos_ok = excluded.microciclos_ok,
           motivo = excluded.motivo,
           actualizado_en = excluded.actualizado_en
     where public.estandarizado_ejercicio.origen = 'derivado'
       and (public.estandarizado_ejercicio.estado,
            public.estandarizado_ejercicio.microciclos_ok,
            public.estandarizado_ejercicio.motivo)
           is distinct from (excluded.estado, excluded.microciclos_ok, excluded.motivo)
    returning 1
  )
  select count(*) into v_filas from escrito;

  return v_filas;
end;
$$;

comment on function public.recalcular_estandarizado() is
  'Recalcula estandarizado_ejercicio desde el historial de microciclos (racha de 3 cerrados limpios). '
  'Idempotente; no toca filas con origen veto_coach. Devuelve las filas insertadas o cambiadas.';

revoke all on function public.recalcular_estandarizado() from public, anon, authenticated;
grant execute on function public.recalcular_estandarizado() to service_role;

-- ── El cron, aparte y con la misma cautela que la 0048 ──────────────────────
-- Cada hora, al minuto 20. Sin pg_cron (el Postgres limpio de la CI) no se programa nada y no se rompe
-- nada: la función se puede llamar a mano con service_role. `unschedule` antes de `schedule` para poder
-- volver a correr la migración sin duplicar el trabajo.

do $cron_setup$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    if exists (select 1 from cron.job where jobname = 'recalcular-estandarizado') then
      perform cron.unschedule('recalcular-estandarizado');
    end if;
    perform cron.schedule(
      'recalcular-estandarizado',
      '20 * * * *',
      'select public.recalcular_estandarizado();'
    );
    raise notice 'Recalculo de estandarizado_ejercicio programado cada hora (minuto 20).';
  else
    raise notice 'pg_cron no esta disponible aqui: estandarizado_ejercicio no se recalcula sola. Llamar public.recalcular_estandarizado() con service_role.';
  end if;
end
$cron_setup$;

-- ── Comprobación (a mano, tras aplicar) ─────────────────────────────────────
--
-- 1) Que el cron quedó:
--      select jobname, schedule, active from cron.job where jobname = 'recalcular-estandarizado';
-- 2) Primera pasada y su efecto (cuántas filas cambian tras dos meses parada):
--      select public.recalcular_estandarizado();
--      select count(*) filter (where estado = 'si') as estandarizados, count(*) as filas,
--             count(*) filter (where origen = 'veto_coach') as vetos
--        from public.estandarizado_ejercicio;
-- 3) Idempotencia: una segunda llamada seguida debe devolver 0.
