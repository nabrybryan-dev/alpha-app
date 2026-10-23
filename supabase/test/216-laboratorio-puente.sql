-- El puente con el laboratorio (migración 0116).
--
-- Lo que se prueba, con el rol real `lab_lector`:
--   1. Ve las series de quien dio permiso (con seudónimo) y NINGUNA de quien no lo dio ni de quien revocó.
--   2. No ve ninguna tabla base (public.microciclos, public.perfiles, public.usuarios_app) ni lab.consentimientos.
--   3. No puede escribir (la vista, la tabla de consentimientos) ni crear objetos.
--   4. Las vistas no exponen nombre, correo, usuario_id ni la huella de velocidad.
--   5. Texto en rir/reps sale NULL (no 0); el peso ausente sale NULL; los segmentos solo con permiso aparte.
--   6. lab_revocaciones lista al revocado; borrar a la persona de la app la deja revocada.
--   7. anon y authenticated no tienen ni USAGE sobre `lab`.
--
-- Bloque de UUID propio (f116…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f1160000-0000-0000-0000-000000000001', 'lab-con-permiso@ejemplo.test'),
  ('f1160000-0000-0000-0000-000000000002', 'lab-sin-permiso@ejemplo.test'),
  ('f1160000-0000-0000-0000-000000000003', 'lab-revocado@ejemplo.test'),
  ('f1160000-0000-0000-0000-000000000004', 'lab-se-borra@ejemplo.test'),
  ('f1160000-0000-0000-0000-000000000005', 'lab-revocado-con-segmentos@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f1160000-0000-0000-0000-000000000001', 'Nombre Secreto Uno', 'asesorado', 'NU'),
  ('f1160000-0000-0000-0000-000000000002', 'Nombre Secreto Dos', 'asesorado', 'ND'),
  ('f1160000-0000-0000-0000-000000000003', 'Nombre Secreto Tres', 'asesorado', 'NT'),
  ('f1160000-0000-0000-0000-000000000004', 'Nombre Secreto Cuatro', 'asesorado', 'NC'),
  ('f1160000-0000-0000-0000-000000000005', 'Nombre Secreto Cinco', 'asesorado', 'NS')
on conflict (id) do update set nombre = excluded.nombre;

-- Perfil: la 1 con peso y segmentos; la 3 sin peso.
insert into public.perfiles (usuario_id, sexo, datos) values
  ('f1160000-0000-0000-0000-000000000001', 'mujer',
   '{"medidas":[{"fecha":"2026-08-01","alturaCm":160,"pesoKg":55,"perimetros":{}},
                {"fecha":"2026-10-01","alturaCm":163,"pesoKg":60.2,"perimetros":{"Glúteos":98},"pgPct":24,
                 "cuerpo":{"femurCm":44.5,"tibiaCm":37.5,"torsoCm":50}}]}'::jsonb),
  ('f1160000-0000-0000-0000-000000000003', 'hombre',
   '{"medidas":[{"fecha":"2026-10-01","alturaCm":175,"perimetros":{}}]}'::jsonb),
  ('f1160000-0000-0000-0000-000000000005', 'hombre',
   '{"medidas":[{"fecha":"2026-10-01","alturaCm":181,"pesoKg":77,"cuerpo":{"femurCm":46,"tibiaCm":39,"torsoCm":52}}]}'::jsonb)
on conflict (usuario_id) do update set sexo = excluded.sexo, datos = excluded.datos;

-- Un microciclo por persona. La 1: serie con RIR numérico, serie con RIR texto y huella; las demás, una serie.
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('lab-m1', 'f1160000-0000-0000-0000-000000000001', 7, 'activo',
   '{"fechaInicio":"2026-10-05","sesiones":[{"id":"s1","orden":1,"fecha":"2026-10-06","ejercicios":[
      {"id":"sent","nombre":"Sentadilla goblet","rirObjetivo":2,"notaCoach":"SECRETO-NOTA",
       "seriesPrescritas":[{"orden":1,"reps":10,"rir":2,"cargaKg":20},{"orden":2,"reps":10,"rir":2,"cargaKg":20}],
       "series":[{"orden":1,"cargaKg":22.5,"reps":10,"rir":3,"confirmada":"editada",
                  "velocidad":{"pvPct":12.5,"hayEscala":true,"calidad":"buena","huella":[1,2,3]}},
                 {"orden":2,"cargaKg":20,"reps":"Control","rir":"RIR 2-3"}]}]}]}'::jsonb),
  ('lab-m2', 'f1160000-0000-0000-0000-000000000002', 1, 'activo',
   '{"fechaInicio":"2026-10-05","sesiones":[{"ejercicios":[{"id":"x","nombre":"Sin permiso","series":[{"orden":1,"cargaKg":99,"reps":5,"rir":1}]}]}]}'::jsonb),
  ('lab-m3', 'f1160000-0000-0000-0000-000000000003', 1, 'activo',
   '{"fechaInicio":"2026-10-05","sesiones":[{"ejercicios":[{"id":"x","nombre":"Revocado","series":[{"orden":1,"cargaKg":88,"reps":5,"rir":1}]}]}]}'::jsonb),
  ('lab-m5', 'f1160000-0000-0000-0000-000000000005', 1, 'activo',
   '{"fechaInicio":"2026-10-05","sesiones":[{"ejercicios":[{"id":"x","nombre":"Revocado con segmentos","series":[{"orden":1,"cargaKg":66,"reps":5,"rir":1}]}]}]}'::jsonb),
  ('lab-m4', 'f1160000-0000-0000-0000-000000000004', 1, 'activo',
   '{"fechaInicio":"2026-10-05","sesiones":[{"ejercicios":[{"id":"x","nombre":"Se borra","series":[{"orden":1,"cargaKg":77,"reps":5,"rir":1}]}]}]}'::jsonb);

-- P-905: REVOCADO pero con permite_segmentos = true. No debe salir en NINGUNA vista de datos (solo en lab_revocaciones).
-- Consentimientos (como dueño, en el SQL Editor): 1 vigente con segmentos, 3 revocado, 4 vigente; la 2 no tiene.
insert into lab.consentimientos (usuario_id, seudonimo, permite_segmentos, cuenta_de_prueba, nota) values
  ('f1160000-0000-0000-0000-000000000001', 'P-901', true, true, 'prueba'),
  ('f1160000-0000-0000-0000-000000000004', 'P-904', false, false, 'prueba');
insert into lab.consentimientos (usuario_id, seudonimo, revocado_en, nota) values
  ('f1160000-0000-0000-0000-000000000003', 'P-903', now(), 'prueba');
insert into lab.consentimientos (usuario_id, seudonimo, permite_segmentos, revocado_en, nota) values
  ('f1160000-0000-0000-0000-000000000005', 'P-905', true, now(), 'prueba');

-- La 1.ª: el seudónimo automático existe con la forma P-NNN.
insert into lab.consentimientos (usuario_id, nota) values ('f1160000-0000-0000-0000-000000000002', 'auto');
select pruebas.afirmar((select seudonimo ~ '^P-[0-9]{3,}$' from lab.consentimientos
                         where usuario_id = 'f1160000-0000-0000-0000-000000000002'), 'el seudónimo automático no tiene forma P-NNN');
-- ...y se revoca enseguida para que el control negativo siga siendo «sin permiso».
update lab.consentimientos set revocado_en = now() where usuario_id = 'f1160000-0000-0000-0000-000000000002';

-- 7 · anon y authenticated no tienen USAGE sobre lab
select pruebas.afirmar(not has_schema_privilege('anon', 'lab', 'usage') and not has_schema_privilege('authenticated', 'lab', 'usage'),
  'anon o authenticated pueden usar el esquema lab');
select pruebas.afirmar(has_schema_privilege('lab_lector', 'lab', 'usage'), 'lab_lector no puede usar el esquema lab');
select pruebas.afirmar(not has_table_privilege('lab_lector', 'public.microciclos', 'select')
  and not has_table_privilege('lab_lector', 'public.perfiles', 'select')
  and not has_table_privilege('lab_lector', 'public.usuarios_app', 'select')
  and not has_table_privilege('lab_lector', 'lab.consentimientos', 'select'),
  'lab_lector tiene SELECT sobre una tabla base o sobre los consentimientos');
select pruebas.afirmar((select not rolcanlogin and not rolbypassrls and not rolsuper from pg_roles where rolname = 'lab_lector'),
  'lab_lector nace con login, bypassrls o superusuario');

-- funciones de lab: ni PUBLIC, ni anon, ni authenticated, ni lab_lector pueden ejecutarlas
select pruebas.afirmar(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'lab'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
          or (has_function_privilege('lab_lector', p.oid, 'execute') and p.proname not in ('num', 'dia'))
          or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0))),
  'una funcion del esquema lab es ejecutable por PUBLIC, anon, authenticated o lab_lector (salvo num y dia, que usan las vistas)');
select pruebas.afirmar(has_function_privilege('lab_lector', 'lab.num(jsonb)', 'execute') and has_function_privilege('lab_lector', 'lab.dia(text)', 'execute')
  and not has_function_privilege('lab_lector', 'lab.revocar_si_se_borro()', 'execute'),
  'lab_lector debe ejecutar solo lab.num y lab.dia (las que usan las vistas)');

-- 4 · lista blanca de columnas (leída como dueño del catálogo)
select pruebas.afirmar(not exists (
  select 1 from information_schema.columns
   where table_schema = 'lab' and table_name in ('lab_series', 'lab_sujetos', 'lab_revocaciones')
     and (column_name ~* '(nombre_?completo|correo|email|usuario|huella|nota|cues)' and column_name <> 'ejercicio_nombre')),
  'una vista del laboratorio expone una columna prohibida');
select pruebas.afirmar(
  (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
    where table_schema = 'lab' and table_name = 'lab_series')
  = array['seudonimo','microciclo_numero','microciclo_estado','microciclo_actualizado_en','fecha_inicio','sesion_fecha',
          'ejercicio_id','ejercicio_nombre','serie_orden','carga_kg','reps','rir','confirmada','pv_pct','pv_hay_escala',
          'pv_calidad','pv_inclinacion_max','rir_objetivo','objetivo_al_fallo','rir_prescrito','reps_prescritas','carga_prescrita_kg'],
  'las columnas de lab_series no son las de la lista blanca');

-- El esquema de ayuda `pruebas` solo existe en el CI (00-suplantar-supabase.sql) y no da permiso a lab_lector;
-- se le presta aquí, dentro de esta transacción que termina en rollback, solo para poder afirmar.
grant usage on schema pruebas to lab_lector;
grant execute on all functions in schema pruebas to lab_lector;

-- ════════════════ Como lab_lector ════════════════
set role lab_lector;

-- 1 · solo la persona con permiso vigente (P-901 y P-904); no P-903 (revocado) ni la 2 (revocada)
select pruebas.afirmar((select count(*) from lab.lab_series) = 3, 'lab_series no devuelve exactamente 3 series (2 de P-901 y 1 de P-904)');
select pruebas.afirmar((select array_agg(distinct seudonimo order by seudonimo) from lab.lab_series) = array['P-901','P-904'],
  'lab_series devuelve seudónimos que no deberían estar');
select pruebas.afirmar(not exists (select 1 from lab.lab_series where carga_kg in (99, 88)), 'aparecen series de quien no dio permiso o revocó');

-- 5 · texto -> NULL, no 0; datos de la serie 1; prescrito emparejado por orden
select pruebas.afirmar((select rir is null and reps is null and carga_kg = 20 from lab.lab_series where seudonimo = 'P-901' and serie_orden = 2),
  'rir/reps de texto no salieron NULL');
select pruebas.afirmar((select rir = 3 and rir_prescrito = 2 and rir_objetivo = 2 and not objetivo_al_fallo and confirmada = 'editada'
                               and pv_pct = 12.5 and pv_hay_escala and pv_calidad = 'buena' and sesion_fecha = date '2026-10-06'
                          from lab.lab_series where seudonimo = 'P-901' and serie_orden = 1),
  'la serie 1 de P-901 no trae lo esperado');
select pruebas.afirmar((select peso_kg = 60.2 and talla_cm = 163 and sexo = 'mujer' and femur_cm = 44.5 and tibia_cm = 37.5 and torso_cm = 50
                          from lab.lab_sujetos where seudonimo = 'P-901'), 'lab_sujetos P-901: última medida con segmentos');
select pruebas.afirmar(not exists (select 1 from lab.lab_sujetos where seudonimo = 'P-905')
                       and not exists (select 1 from lab.lab_series where seudonimo = 'P-905'),
  'una persona REVOCADA con permite_segmentos=true aparece en una vista de datos');
select pruebas.afirmar((select count(*) from lab.lab_sujetos) = 1, 'lab_sujetos debe tener solo a P-901 (P-904 no tiene perfil)');

-- 6 · revocaciones
select pruebas.afirmar((select array_agg(seudonimo order by seudonimo) from lab.lab_revocaciones) @> array['P-903'],
  'lab_revocaciones no lista a P-903');
select pruebas.afirmar(not exists (select 1 from lab.lab_revocaciones where seudonimo in ('P-901','P-904')), 'lab_revocaciones lista a un vigente');

-- 2 · no ve tablas base
do $$ begin
  begin perform 1 from public.microciclos limit 1; raise exception 'FALLO: lab_lector leyó public.microciclos';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.perfiles limit 1; raise exception 'FALLO: lab_lector leyó public.perfiles';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.usuarios_app limit 1; raise exception 'FALLO: lab_lector leyó public.usuarios_app';
  exception when insufficient_privilege then null; end;
  begin perform 1 from lab.consentimientos limit 1; raise exception 'FALLO: lab_lector leyó lab.consentimientos';
  exception when insufficient_privilege then null; end;
end $$;

-- 3 · no escribe ni crea
do $$ begin
  begin insert into lab.consentimientos (usuario_id) values ('f1160000-0000-0000-0000-000000000002');
        raise exception 'FALLO: lab_lector insertó consentimientos';
  exception when insufficient_privilege then null; end;
  begin update lab.consentimientos set permite_segmentos = true; raise exception 'FALLO: lab_lector actualizó consentimientos';
  exception when insufficient_privilege then null; end;
  begin delete from lab.lab_revocaciones; raise exception 'FALLO: lab_lector borró de una vista';
  exception when insufficient_privilege then null; end;
  begin create table lab.sorpresa (x int); raise exception 'FALLO: lab_lector creó una tabla';
  exception when insufficient_privilege then null; end;
end $$;

reset role;

-- 6b · borrar a la persona de la app deja su fila revocada y sin vínculo
delete from public.usuarios_app where id = 'f1160000-0000-0000-0000-000000000004';
select pruebas.afirmar((select usuario_id is null and revocado_en is not null from lab.consentimientos where seudonimo = 'P-904'),
  'al borrar a la persona, su consentimiento no quedó revocado');
set role lab_lector;
select pruebas.afirmar(not exists (select 1 from lab.lab_series where seudonimo = 'P-904'), 'P-904 sigue en lab_series tras borrarse');
select pruebas.afirmar(exists (select 1 from lab.lab_revocaciones where seudonimo = 'P-904'), 'P-904 no aparece en lab_revocaciones');
reset role;

rollback;
