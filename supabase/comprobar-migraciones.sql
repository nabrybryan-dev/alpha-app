-- ¿Qué migraciones están REALMENTE aplicadas en producción?
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE: consulta el catálogo
-- interno de Postgres. No crea, no borra, no modifica y no toca datos de asesorados.
-- Se puede ejecutar tantas veces como se quiera.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ EXISTE ESTE ARCHIVO
-- ─────────────────────────────────────────────────────────────────────────────
-- Las migraciones de este proyecto se aplican **pegándolas a mano** en el SQL
-- Editor, así que NO hay registro de qué versión está aplicada. El repo tiene los
-- archivos `migrations/00NN_*.sql`, pero el repo no sabe qué corrió en producción.
--
-- Consecuencia: **una migración a medias es indistinguible de una completa.** Ya
-- pasó. El 2026-07-29 se descubrió que la 0013 llevaba días aplicada a medias (3 de
-- 6 sentencias, probablemente por un pegado truncado): la nutricionista aún podía
-- escribir fichas de respuesta, y estaba a punto de desplegarse código que lee una
-- vista inexistente, lo que le habría roto el panel en producción.
--
-- Por eso esto comprueba los EFECTOS de cada migración (¿existe la política? ¿el
-- trigger? ¿la vista?) en vez de fiarse de una tabla de versiones que no tenemos.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CÓMO SE USA
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Correrlo ANTES de aplicar una migración (para saber de dónde partes) y DESPUÉS
--    (para confirmar que entró completa).
-- 2. Antes de mezclar un PR que dependa de una migración. Ver `/desplegar`.
-- 3. Al pegar una migración, comparar la última línea del editor con la última línea
--    del archivo antes de pulsar Run. Un pegado truncado no da ningún error.
--
-- **Al escribir una migración nueva, añádele aquí sus señales.** Un archivo de
-- comprobación desactualizado da una falsa sensación de cobertura. Ver `/migracion`.
--
-- Lee la columna "aplicada". Estado esperado hoy (2026-07-31):
--   · 0008 → todo SI
--   · 0013 → todo SI
--   · 0014 → todo SI. Aplicada el 2026-07-30 junto con la carga de los 1.195
--            alimentos. Si `sin_tildes() IMMUTABLE` dijera NO, el índice de
--            trigramas no existe y la búsqueda recorre la tabla entera sin fallar
--            de forma visible.
--   · 0015 → todo NO todavía. Escrita y revisada (Tarea 8 del plan de registro de
--            comidas), sin aplicar: aplicarla es decisión de Bryan.
--   · 0016 → todo NO todavía. Escrita y revisada (perfil alimentario del
--            asesorado, las doce preguntas del cuestionario), sin aplicar:
--            aplicarla es decisión de Bryan.

select '0008 · rol y perfil' as migracion,
       'trigger trg_proteger_rol en usuarios_app' as senal,
       case when exists (
         select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
         where c.relname = 'usuarios_app' and t.tgname = 'trg_proteger_rol' and not t.tgisinternal
       ) then 'SI' else 'NO' end as aplicada

union all
select '0008 · rol y perfil', 'trigger trg_proteger_perfil en perfiles',
       case when exists (
         select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
         where c.relname = 'perfiles' and t.tgname = 'trg_proteger_perfil' and not t.tgisinternal
       ) then 'SI' else 'NO' end

union all
select '0008 · rol y perfil', 'función proteger_rol()',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'proteger_rol'
       ) then 'SI' else 'NO' end

union all
select '0008 · rol y perfil', 'función proteger_perfil()',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'proteger_perfil'
       ) then 'SI' else 'NO' end

union all
select '0013 · acotar nutricionista', 'policy consultas_leer_propias',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'consultas_chat'
           and policyname = 'consultas_leer_propias'
       ) then 'SI' else 'NO' end

union all
select '0013 · acotar nutricionista', 'policy consultas_actualizar_staff',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'consultas_chat'
           and policyname = 'consultas_actualizar_staff'
       ) then 'SI' else 'NO' end

union all
select '0013 · acotar nutricionista', 'policy checkins_lee_staff',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'checkins'
           and policyname = 'checkins_lee_staff'
       ) then 'SI' else 'NO' end

union all
select '0013 · acotar nutricionista', 'vista checkins_nutricion',
       case when to_regclass('public.checkins_nutricion') is not null then 'SI' else 'NO' end

union all
select '0013 · acotar nutricionista', 'policy nueva fichas_escribir_coach',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'fichas_respuesta'
           and policyname = 'fichas_escribir_coach'
       ) then 'SI' else 'NO' end

union all
-- Esta fila se lee al revés: la política vieja y permisiva NO debe existir.
select '0013 · acotar nutricionista', 'policy vieja fichas_escribir_staff ya borrada',
       case when not exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'fichas_respuesta'
           and policyname = 'fichas_escribir_staff'
       ) then 'SI' else 'NO' end

union all
select '0014 · catálogo alimentos', 'tabla alimentos',
       case when to_regclass('public.alimentos') is not null then 'SI' else 'NO' end

union all
select '0014 · catálogo alimentos', 'tabla alimento_medidas',
       case when to_regclass('public.alimento_medidas') is not null then 'SI' else 'NO' end

union all
select '0014 · catálogo alimentos', 'tabla alimento_recetas',
       case when to_regclass('public.alimento_recetas') is not null then 'SI' else 'NO' end

union all
select '0014 · catálogo alimentos', 'función buscar_alimento()',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'buscar_alimento'
       ) then 'SI' else 'NO' end

union all
-- Sin esta función el índice de trigramas ni siquiera se puede crear (42P17).
select '0014 · catálogo alimentos', 'función sin_tildes() IMMUTABLE',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'sin_tildes' and p.provolatile = 'i'
       ) then 'SI' else 'NO' end

union all
select '0014 · catálogo alimentos', 'catálogo cargado (>1000 alimentos)',
       case when to_regclass('public.alimentos') is not null
             and (select count(*) from public.alimentos) > 1000
       then 'SI' else 'NO' end

union all
select '0015 · registro de comidas', 'tipo confianza_registro',
       case when to_regtype('public.confianza_registro') is not null then 'SI' else 'NO' end

union all
select '0015 · registro de comidas', 'tabla registro_comida',
       case when to_regclass('public.registro_comida') is not null then 'SI' else 'NO' end

union all
select '0015 · registro de comidas', 'tabla registro_item',
       case when to_regclass('public.registro_item') is not null then 'SI' else 'NO' end

union all
select '0015 · registro de comidas', 'tabla preferencia_estado',
       case when to_regclass('public.preferencia_estado') is not null then 'SI' else 'NO' end

union all
select '0015 · registro de comidas', 'tabla prueba_calibracion',
       case when to_regclass('public.prueba_calibracion') is not null then 'SI' else 'NO' end

union all
select '0015 · registro de comidas', 'policy registro_comida_propio',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'registro_comida'
           and policyname = 'registro_comida_propio'
       ) then 'SI' else 'NO' end

union all
select '0015 · registro de comidas', 'policy registro_item_propio',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'registro_item'
           and policyname = 'registro_item_propio'
       ) then 'SI' else 'NO' end

union all
select '0015 · registro de comidas', 'policy preferencia_estado_propia',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'preferencia_estado'
           and policyname = 'preferencia_estado_propia'
       ) then 'SI' else 'NO' end

union all
select '0015 · registro de comidas', 'policy prueba_calibracion_propia',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'prueba_calibracion'
           and policyname = 'prueba_calibracion_propia'
       ) then 'SI' else 'NO' end

union all
-- FK contra usuarios_app, no contra auth.users (ver el porqué en la propia
-- migración). Si esto diera NO, alguien aplicó la 0015 tal como estaba en el
-- plan original en vez de con la corrección de la revisión.
select '0015 · registro de comidas', 'asesorado_id referencia usuarios_app',
       case when exists (
         select 1
         from pg_constraint c
         join pg_class hijo on hijo.oid = c.conrelid
         join pg_namespace nsp on nsp.oid = hijo.relnamespace
         join pg_class padre on padre.oid = c.confrelid
         where c.contype = 'f'
           and nsp.nspname = 'public' and hijo.relname = 'registro_comida'
           and padre.relname = 'usuarios_app'
       ) then 'SI' else 'NO' end

union all
select '0016 · perfil alimentario', 'tabla perfil_alimentario',
       case when to_regclass('public.perfil_alimentario') is not null then 'SI' else 'NO' end

union all
select '0016 · perfil alimentario', 'tabla perfil_alimentario_veto',
       case when to_regclass('public.perfil_alimentario_veto') is not null then 'SI' else 'NO' end

union all
select '0016 · perfil alimentario', 'índice perfil_alimentario_veto_por_alimento',
       case when to_regclass('public.perfil_alimentario_veto_por_alimento') is not null
       then 'SI' else 'NO' end

union all
select '0016 · perfil alimentario', 'policy perfil_alimentario_propio',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'perfil_alimentario'
           and policyname = 'perfil_alimentario_propio'
       ) then 'SI' else 'NO' end

union all
select '0016 · perfil alimentario', 'policy perfil_alimentario_veto_propio',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'perfil_alimentario_veto'
           and policyname = 'perfil_alimentario_veto_propio'
       ) then 'SI' else 'NO' end

union all
-- FK contra usuarios_app, no contra auth.users: mismo riesgo que ya atrapó
-- esta misma comprobación para la 0015.
select '0016 · perfil alimentario', 'perfil_alimentario.asesorado_id referencia usuarios_app',
       case when exists (
         select 1
         from pg_constraint c
         join pg_class hijo on hijo.oid = c.conrelid
         join pg_namespace nsp on nsp.oid = hijo.relnamespace
         join pg_class padre on padre.oid = c.confrelid
         where c.contype = 'f'
           and nsp.nspname = 'public' and hijo.relname = 'perfil_alimentario'
           and padre.relname = 'usuarios_app'
       ) then 'SI' else 'NO' end

union all
select '0016 · perfil alimentario', 'perfil_alimentario_veto.asesorado_id referencia usuarios_app',
       case when exists (
         select 1
         from pg_constraint c
         join pg_class hijo on hijo.oid = c.conrelid
         join pg_namespace nsp on nsp.oid = hijo.relnamespace
         join pg_class padre on padre.oid = c.confrelid
         where c.contype = 'f'
           and nsp.nspname = 'public' and hijo.relname = 'perfil_alimentario_veto'
           and padre.relname = 'usuarios_app'
       ) then 'SI' else 'NO' end

order by migracion, senal;
