-- Solo base local de pruebas, datos ficticios; deshace todas las filas.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email, raw_user_meta_data) values
 ('01750000-0000-4000-8000-000000000001', 'cadena-r1-a@invalid.test', '{"nombre":"PRUEBA CADENA R1 A"}'),
 ('01750000-0000-4000-8000-000000000002', 'cadena-r1-b@invalid.test', '{"nombre":"PRUEBA CADENA R1 B"}');
insert into public.cuestionarios (id, datos) values
 ('preg-PRUEBA-R1-a', '{"ref":"ref-ficticia","solicitud_id":"sol-ficticia"}'),
 ('preg-PRUEBA-R1-b', '{}'), ('preg-viernes-PRUEBA-R1', '{}'),
 ('otro-PRUEBA-R1', '{}'), ('preg-PRUEBA-R1-vieja', '{}');
insert into public.respuestas (id, cuestionario_id, usuario_id, fecha_iso, valores) values
 ('PRUEBA-R1-a0','preg-PRUEBA-R1-a','01750000-0000-4000-8000-000000000001',now()-interval '1 day','{"marca":"anterior"}'),
 ('PRUEBA-R1-a1','preg-PRUEBA-R1-a','01750000-0000-4000-8000-000000000001',now(),'{"marca":"ficticia"}'),
 ('PRUEBA-R1-b','preg-PRUEBA-R1-b','01750000-0000-4000-8000-000000000002',now(),'{}'),
 ('PRUEBA-R1-v','preg-viernes-PRUEBA-R1','01750000-0000-4000-8000-000000000001',now(),'{}'),
 ('PRUEBA-R1-o','otro-PRUEBA-R1','01750000-0000-4000-8000-000000000001',now(),'{}'),
 ('PRUEBA-R1-old','preg-PRUEBA-R1-vieja','01750000-0000-4000-8000-000000000001',now()-interval '61 days','{}');
create temporary table conteo_inicial as select count(*) n from public.lecturas_cadena;
set local role service_role;
create temporary table salida_primera as select to_jsonb(r) fila from public.cadena_respuestas_preg() r;
create temporary table salida_segunda as select to_jsonb(r) fila from public.cadena_respuestas_preg() r;
select pruebas.afirmar(not exists (
 select 1 from salida_primera, lateral jsonb_each_text(fila) c
 where c.value ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
), 'ninguna columna de respuestas_preg contiene UUID (incluye valores y referencias ficticios)');
select pruebas.afirmar(
 (select count(*) = 1 and bool_and(fila->>'codigo' ~ '^piloto-[0-9]{2,}$' and not (fila ? 'usuario_id'))
    from salida_primera where fila->>'respuesta_id' = 'PRUEBA-R1-a1'),
 'positiva: debe salir un seudonimo piloto con dos digitos o mas y SIN usuario_id');
select pruebas.afirmar(
 (select a.fila->>'codigo' = b.fila->>'codigo' from salida_primera a join salida_segunda b
 on a.fila->>'respuesta_id' = b.fila->>'respuesta_id' where a.fila->>'respuesta_id' = 'PRUEBA-R1-a1'),
 'el codigo debe ser estable entre llamadas');
select pruebas.afirmar(
 (select count(distinct fila->>'codigo') = 2 from salida_primera where fila->>'respuesta_id' in ('PRUEBA-R1-a1','PRUEBA-R1-b')),
 'dos personas deben recibir codigos distintos');
select pruebas.afirmar(
 not exists (select 1 from salida_primera where fila->>'respuesta_id' in ('PRUEBA-R1-a0','PRUEBA-R1-v','PRUEBA-R1-o','PRUEBA-R1-old')),
 'se mantienen ultima respuesta, prefijos y ventana de 60 dias');
select pruebas.afirmar(
 (select fila->'valores' = '{"marca":"ficticia"}'::jsonb and fila->>'pregunta_ref' = 'ref-ficticia'
 and fila->>'solicitud_id' = 'sol-ficticia' from salida_primera where fila->>'respuesta_id' = 'PRUEBA-R1-a1'),
 'se conservan valores y referencias');
reset role;
-- Las altas elegibles conservan UUID para la app y comparten codigo con respuestas.
update public.usuarios_app set nombre='ALTA FICTICIA R2'
 where id='01750000-0000-4000-8000-000000000001';
update public.usuarios_app set nombre='PRUEBA-AGENTES FICTICIA R2'
 where id='01750000-0000-4000-8000-000000000002';
set local role service_role;
create temporary table altas_primera as select * from public.cadena_altas_pendientes();
create temporary table altas_segunda as select * from public.cadena_altas_pendientes();
select pruebas.afirmar((select count(*)=1 and bool_and(a.codigo ~ '^piloto-[0-9]{2,}$'
 and a.codigo=b.codigo and a.codigo=r.fila->>'codigo' and a.creado_en is not null)
 from altas_primera a join altas_segunda b using(usuario_id)
 join salida_primera r on r.fila->>'respuesta_id'='PRUEBA-R1-a1'
 where a.usuario_id='01750000-0000-4000-8000-000000000001'),
 'altas: UUID disponible para app, mismo seudonimo en dos llamadas y en respuestas');
select pruebas.afirmar(not exists(select 1 from altas_primera
 where usuario_id='01750000-0000-4000-8000-000000000002'), 'altas mantiene exclusion PRUEBA-AGENTES');
reset role;
select pruebas.afirmar((select count(*) from public.lecturas_cadena) = (select n+2 from conteo_inicial),
 'cada llamada deja exactamente una lectura');
select pruebas.afirmar((select count(*) = 2 from public.lecturas_cadena
 where accion = 'respuestas_preg' and filas = (select count(*) from salida_primera)), 'registro con numero de filas');
-- Incluye llamada vacia, sin quitar filtros ni guardas.
delete from public.respuestas;
set local role service_role;
select pruebas.afirmar((select count(*) from public.cadena_respuestas_preg()) = 0, 'salida vacia');
reset role;
select pruebas.afirmar((select count(*) from public.lecturas_cadena) = (select n+3 from conteo_inicial)
 and exists (select 1 from public.lecturas_cadena where accion='respuestas_preg' and filas=0), 'registra tambien cero filas');
-- Privilegios efectivos: ejecuta las operaciones y exige permission_denied.
select pruebas.afirmar(not exists (
 select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl, acldefault('s', c.relowner))) a
 where c.oid in ('public.codigos_cadena_numero'::regclass, 'public.lecturas_cadena_id_seq'::regclass)
 and a.grantee <> c.relowner
), 'solo propietario tiene privilegios en las dos secuencias');
do $$
declare rol text; tabla text; operacion text;
begin
 foreach rol in array array['anon','authenticated','service_role'] loop
  execute format('set local role %I', rol);
  foreach tabla in array array['codigos_cadena','lecturas_cadena'] loop
   begin
    execute format('select * from public.%I', tabla);
    raise exception 'FALLO: % pudo leer %', rol, tabla;
   exception when insufficient_privilege then null; end;
  end loop;
  foreach operacion in array array[
   'select nextval(''public.codigos_cadena_numero'')',
   'select setval(''public.codigos_cadena_numero'',99999)',
   'select last_value from public.codigos_cadena_numero',
   'select nextval(''public.lecturas_cadena_id_seq'')',
   'select setval(''public.lecturas_cadena_id_seq'',99999)',
   'select last_value from public.lecturas_cadena_id_seq',
   'insert into public.codigos_cadena(usuario_id,codigo) values (''01750000-0000-4000-8000-000000000001'',''piloto-99999'')',
   'update public.codigos_cadena set codigo=''piloto-99998''',
   'delete from public.codigos_cadena',
   'select public.cadena_codigo_interno(''01750000-0000-4000-8000-000000000001'')'
  ] loop
   begin execute operacion; raise exception 'FALLO: % pudo ejecutar %', rol, operacion;
   exception when insufficient_privilege then null; end;
  end loop;
  reset role;
  if rol in ('anon','authenticated') then
   execute format('set local role %I', rol);
   foreach operacion in array array['select public.cadena_respuestas_preg()', 'select public.cadena_altas_pendientes()'] loop
    begin execute operacion; raise exception 'FALLO: % pudo ejecutar %', rol, operacion;
    exception when insufficient_privilege then null; end;
   end loop;
   reset role;
  end if;
 end loop;
end $$;
select pruebas.afirmar(
 (select bool_and(relrowsecurity) from pg_class where oid in ('public.codigos_cadena'::regclass,'public.lecturas_cadena'::regclass))
 and not exists (select 1 from pg_policies where schemaname='public' and tablename in ('codigos_cadena','lecturas_cadena')),
 'RLS encendida sin politicas de acceso');
rollback;
