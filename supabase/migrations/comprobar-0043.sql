-- Comprobacion de la 0043. Se corre APARTE, despues de aplicarla.
--
-- No comprueba «existen las tablas» y ya: eso lo ve cualquiera en el panel. Lo
-- que comprueba es que las TRES REJAS muerden, porque una restriccion que no
-- rechaza nada es peor que no tenerla — da la seguridad sin darla.
--
-- Y hay una que ya fallo una vez, antes de aplicarse. La version original de
-- `mediciones_motivo_obligatorio` decia `array_length(motivos_calidad,1) >= 1`,
-- y `array_length` de un array vacio devuelve NULL, no 0. Un CHECK que evalua a
-- NULL PASA. Se probo en transaccion contra la base real: la fila
-- ('descartada', '{}') entraba tan campante. Con `coalesce(...,0)` ya no.
-- Por eso la comprobacion 4 existe y por eso no se puede quitar.
--
-- Las comprobaciones de rechazo se hacen dentro de una transaccion que se
-- deshace, asi que ESTE SCRIPT NO ESCRIBE NADA. Se puede correr en produccion.

-- ── 1 · las tres tablas y su RLS ─────────────────────────────────────────────

select 'tablas creadas' as comprueba,
       count(*)::text as sale,
       '3' as tiene_que_dar
from information_schema.tables
where table_schema = 'public'
  and table_name in ('mediciones_velocidad','perfil_carga_velocidad','estado_del_dia')

union all
select 'las tres con RLS activada',
       count(*)::text, '3'
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('mediciones_velocidad','perfil_carga_velocidad','estado_del_dia')
  and c.relrowsecurity

union all
select 'politicas (1 de mediciones + 2 de perfil + 2 de estado)',
       count(*)::text, '5'
from pg_policies
where schemaname = 'public'
  and tablename in ('mediciones_velocidad','perfil_carga_velocidad','estado_del_dia')

-- ── 2 · el indice parcial, que es el que sostiene el bucle 2 ─────────────────
-- La consulta caliente corre mientras el asesorado espera entre series. Sin el
-- `where calidad = 'buena'` el indice es otro indice.

union all
select 'indice parcial de referencia, filtrado a buenas',
       count(*)::text, '1'
from pg_indexes
where schemaname = 'public'
  and indexname = 'mediciones_referencia'
  and indexdef ilike '%where (calidad = ''buena''::text)%'

union all
select 'indice GIN para contar motivos',
       count(*)::text, '1'
from pg_indexes
where schemaname = 'public' and indexname = 'mediciones_motivos'

-- ── 3 · el vocabulario acepta lo que el codigo emite HOY ─────────────────────
-- Los cuatro de abajo nacieron con la rama de cuatro marcas, despues de que se
-- escribiera el contrato. Si esta comprobacion falla, la base rechazaria justo
-- las mediciones que estan fallando ahora mismo.

union all
select 'vocabulario acepta los cuatro motivos nuevos',
       public.motivos_calidad_validos(
         '{sin_escala,referencia_torcida,inclinacion_no_medible,pocas_reps}')::text,
       'true'

union all
select 'vocabulario acepta las cinco de una toma real',
       public.motivos_calidad_validos(
         '{marcador_perdido,angulo,pocas_reps,sin_escala,referencia_torcida}')::text,
       'true'

union all
select 'vocabulario RECHAZA lo que no existe',
       public.motivos_calidad_validos('{motivo_inventado}')::text,
       'false'

union all
select 'vocabulario acepta el array vacio (una buena no lleva motivos)',
       public.motivos_calidad_validos('{}')::text,
       'true';

-- ── 4 · las rejas muerden ────────────────────────────────────────────────────
-- Se intenta insertar tres filas que NO deben entrar. Todo dentro de una
-- transaccion que se deshace al final: no queda rastro.

begin;

do $$
declare
  r text := '';
  u uuid;
begin
  select id into u from public.usuarios_app limit 1;
  if u is null then
    raise exception 'No hay ningun usuario para probar. Comprobacion 4 NO CORRIDA.';
  end if;

  -- 4a · descartada SIN motivo. Es la que fallaba con `array_length` a secas.
  begin
    insert into public.mediciones_velocidad
      (id, usuario_id, fecha, ejercicio_id, ejercicio_nom, orden_serie, carga_kg,
       calidad, motivos_calidad, version_algo, captura)
    values ('_probe_a', u, current_date, 'e', 'E', 1, 0,
            'descartada', '{}', 'v0', '{}'::jsonb);
    r := r || 'FALLA: entro una descartada sin motivo; ';
  exception when check_violation then r := r || 'motivo_obligatorio ok; ';
  end;

  -- 4b · buena CON motivos: es una contradiccion
  begin
    insert into public.mediciones_velocidad
      (id, usuario_id, fecha, ejercicio_id, ejercicio_nom, orden_serie, carga_kg,
       calidad, motivos_calidad, version_algo, captura)
    values ('_probe_b', u, current_date, 'e', 'E', 2, 0,
            'buena', '{sin_escala}', 'v0', '{}'::jsonb);
    r := r || 'FALLA: entro una buena con motivos; ';
  exception when check_violation then r := r || 'buena_sin_motivos ok; ';
  end;

  -- 4c · motivo fuera del vocabulario
  begin
    insert into public.mediciones_velocidad
      (id, usuario_id, fecha, ejercicio_id, ejercicio_nom, orden_serie, carga_kg,
       calidad, motivos_calidad, version_algo, captura)
    values ('_probe_c', u, current_date, 'e', 'E', 3, 0,
            'dudosa', '{esto_no_existe}', 'v0', '{}'::jsonb);
    r := r || 'FALLA: entro un motivo inventado; ';
  exception when check_violation then r := r || 'vocabulario ok; ';
  end;

  -- 4d · y una legitima SI tiene que entrar
  begin
    insert into public.mediciones_velocidad
      (id, usuario_id, fecha, ejercicio_id, ejercicio_nom, orden_serie, carga_kg,
       calidad, motivos_calidad, version_algo, captura)
    values ('_probe_d', u, current_date, 'e', 'E', 4, 0,
            'descartada', '{marcador_perdido,sin_escala}', 'v0', '{"fpsReal":53.9}'::jsonb);
    r := r || 'legitima entra ok; ';
  exception when others then r := r || 'FALLA: rechazo una legitima (' || sqlerrm || '); ';
  end;

  raise notice 'REJAS: %', r;
  if r <> 'motivo_obligatorio ok; buena_sin_motivos ok; vocabulario ok; legitima entra ok; '
  then
    raise exception 'COMPROBACION 4 EN ROJO -> %', r;
  end if;
end $$;

select 'las cuatro rejas se comportan' as comprueba, 'ok' as sale, 'ok' as tiene_que_dar;

rollback;
