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
-- Por eso esto comprueba los EFECTOS de cada migración en vez de fiarse de una
-- tabla de versiones que no tenemos.
--
-- Y «efecto» no es «existe algo con ese nombre». Es la trampa en la que cayeron
-- las tres señales de política de la 0013 durante un mes: preguntaban si existía
-- una política llamada `checkins_lee_staff`, y existía desde la 0006 con el
-- `es_staff()` permisivo. Daban SI con la 0013 aplicada y SI sin ella, así que
-- la fuga que la 0013 venía a cerrar siguió abierta con la comprobación en verde.
-- Corregidas el 2026-08-15.
--
-- Al escribir una señal nueva, la prueba es esta: **¿en qué estado del mundo
-- diría NO?** Si no hay ninguno, no es una señal. Correrla ANTES de aplicar la
-- migración es la forma barata de comprobarlo — tiene que decir NO.
--
--   nombre de un objeto      →  débil: sobrevive a que otro lo creara antes
--   expresión de una policy  →  fuerte: cambia con la migración
--   privilegio efectivo      →  fuerte: mide lo que se puede hacer, no lo que
--                                se mandó hacer (ver la sección (4) de la 0013,
--                                cuyo `revoke` no revocaba nada)
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
-- **Esta cabecera se actualiza con cada migración.** Es la mitad que dice qué
-- DEBERÍA haber; la consulta solo dice qué HAY. Estuvo congelada en el 2026-07-31
-- mientras entraban siete migraciones, y llegó a afirmar que la 0015 y la 0016
-- estaban «sin aplicar» cuando la propia 0017 escribe «no se toca la 0015, ya está
-- aplicada». Sin tabla de versiones, una cabecera vieja miente con autoridad.
--
-- Lee la columna "aplicada". Estado esperado hoy (2026-08-03):
--   · 0008 → todo SI
--   · 0013 → todo SI
--   · 0014 → todo SI. Aplicada el 2026-07-30 junto con la carga de los 1.195
--            alimentos. Si `sin_tildes() IMMUTABLE` dijera NO, el índice de
--            trigramas no existe y la búsqueda recorre la tabla entera sin fallar
--            de forma visible.
--   · 0015 → todo SI. Registro de comidas.
--   · 0016 → todo SI. Perfil alimentario (las preguntas del cuestionario).
--   · 0017 → todo SI. Registro desde el móvil (`cliente_id` y sus triggers).
--   · 0018 → todo SI. Interruptores de visibilidad de la nutricionista.
--   · 0019 → todo SI. Respuestas de la encuesta.
--            Las cinco se aplicaron antes de mezclar el PR del registro de comidas.
--   · 0020 → SIN CONFIRMAR. Es la de `prueba_calibracion`. **Ojo con el número:**
--            otra rama usó `0020` a la vez y la suya se renumeró a `0021` DESPUÉS
--            de estar aplicada en producción, así que un «ya corrí la 0020» es
--            ambiguo. Aquí las señales de las dos son distintas: fíate de ellas y
--            no del recuerdo.
--   · 0021 → todo SI. Ya aplicada en producción cuando aún se llamaba `0020`.
--   · 0022 → SIN CONFIRMAR. Adjuntos del chat. Aviso: solo hay señal para
--            `mensajes.adjunto_path`, no para `adjunto_tipo`, que entra en el mismo
--            `alter table`. Si el pegado se corta entre las dos, esto dirá SI y la
--            hidratación del chat se caerá (`hidratar.ts:42` y `:285`).
--   · 0023 → APLICADA Y COMPROBADA el 2026-08-05 (3 índices, 3 sin predicado).
--            Es la que desatascó el registro de comidas: quitaba el
--            `where cliente_id is not null` de tres índices únicos porque un
--            `ON CONFLICT (cliente_id)` no puede arbitrar sobre un índice parcial.
--            Mientras dijo NO, cada comida que un asesorado registró falló con
--            42P10 y se descartó **en silencio**. Va después de la 0017 y la 0020.
--   · 0024 → SIN APLICAR. La despensa (spec §11). Sus tres señales van juntas -tabla,
--            RLS y vista- porque la tabla existiendo sin sus políticas dejaría a la
--            vista lo que come cada persona, y eso no puede pasar por «aplicada».

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

-- ---------------------------------------------------------------------------
-- Las tres señales de política de la 0013 miraban el NOMBRE. No servían.
--
-- La 0013 no crea `consultas_leer_propias`, `consultas_actualizar_staff` ni
-- `checkins_lee_staff`: las REDEFINE. Ya existían —las creó la 0006 y la 0010
-- con el `es_staff()` permisivo— así que preguntar «¿existe una política que se
-- llame así?» daba SI con la migración aplicada y SI sin ella.
--
-- No es teoría. El 2026-07-29 se detectó la 0013 a medias y se creyó arreglada.
-- El 2026-08-15, con estas tres señales en SI, se midió la expresión viva y las
-- tres seguían en `es_staff()`: la nutricionista llevaba un mes bajándose 47
-- check-ins de 9 personas —ánimo, estrés, horas de sueño, 19 con comentarios de
-- texto libre— y las 15 consultas del chat. Un mes de fuga con la comprobación
-- en verde.
--
-- Una señal que no puede fallar es peor que ninguna: da confianza sin
-- respaldarla. Estas miran la EXPRESIÓN.
-- ---------------------------------------------------------------------------

union all
select '0013 · acotar nutricionista', 'policy consultas_leer_propias usa es_coach',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'consultas_chat'
           and policyname = 'consultas_leer_propias'
           and qual like '%es_coach()%' and qual not like '%es_staff()%'
       ) then 'SI' else 'NO' end

union all
select '0013 · acotar nutricionista', 'policy consultas_actualizar_staff usa es_coach',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'consultas_chat'
           and policyname = 'consultas_actualizar_staff'
           and qual like '%es_coach()%' and qual not like '%es_staff()%'
       ) then 'SI' else 'NO' end

union all
select '0013 · acotar nutricionista', 'policy checkins_lee_staff usa es_coach',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'checkins'
           and policyname = 'checkins_lee_staff'
           and qual like '%es_coach()%' and qual not like '%es_staff()%'
       ) then 'SI' else 'NO' end

union all
select '0013 · acotar nutricionista', 'vista checkins_nutricion',
       case when to_regclass('public.checkins_nutricion') is not null then 'SI' else 'NO' end

union all
select '0013 · acotar nutricionista', 'policy nueva fichas_escribir_coach usa es_coach',
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'fichas_respuesta'
           and policyname = 'fichas_escribir_coach'
           and qual like '%es_coach()%'
       ) then 'SI' else 'NO' end

union all
-- La sección (4) de la 0013, que faltaba aquí y encima venía mal escrita en la
-- migración: decía `revoke ... from anon`, y el permiso no lo tenía `anon` a su
-- nombre sino heredado de PUBLIC, porque `create function` se lo concede por
-- defecto. Revocarle a `anon` algo que nunca tuvo a su nombre no quita nada: la
-- 0013 habría dejado esto abierto aunque se hubiera aplicado entera en julio.
-- Cerrado de verdad el 2026-08-15 con `from public`.
--
-- Se comprueba el efecto —¿puede anon ejecutarlas?— y no la orden que se corrió,
-- que es lo que habría escondido el fallo.
select '0013 · acotar nutricionista', 'es_staff y es_coach cerradas a anon',
       case when not has_function_privilege('anon', 'public.es_staff()', 'EXECUTE')
             and not has_function_privilege('anon', 'public.es_coach()', 'EXECUTE')
            then 'SI' else 'NO' end

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

union all
select '0017 - registro desde el movil', 'registro_comida.cliente_id existe',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'registro_comida'
           and column_name = 'cliente_id'
       ) then 'SI' else 'NO' end

union all
select '0017 - registro desde el movil', 'registro_item.comida_cliente_id existe',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'registro_item'
           and column_name = 'comida_cliente_id'
       ) then 'SI' else 'NO' end

union all
select '0017 - registro desde el movil', 'las dos tablas tienen borrado logico',
       case when (
         select count(*) from information_schema.columns
         where table_schema = 'public'
           and table_name in ('registro_comida', 'registro_item')
           and column_name = 'borrado'
       ) = 2 then 'SI' else 'NO' end

union all
select '0017 - registro desde el movil', 'el trigger resuelve la comida del item',
       case when exists (
         select 1 from pg_trigger
         where not tgisinternal and tgname = 'registro_item_resolver_comida'
       ) then 'SI' else 'NO' end

union all
select '0017 - registro desde el movil', 'cliente_id es unico en registro_comida',
       case when exists (
         select 1 from pg_indexes
         where schemaname = 'public' and indexname = 'registro_comida_cliente_id_unico'
       ) then 'SI' else 'NO' end

union all
-- Los dos indices de lectura. No fallan de forma visible si faltan: el diario
-- sigue abriendo, solo que recorriendo la tabla entera. Es el mismo riesgo
-- silencioso que el indice de trigramas de la 0014.
select '0017 - registro desde el movil', 'estan los dos indices de lectura del diario',
       case when (
         select count(*) from pg_indexes
         where schemaname = 'public'
           and indexname in ('registro_item_por_comida_cliente', 'registro_comida_vivas')
       ) = 2 then 'SI' else 'NO' end

union all
select '0018 - visibilidad de cifras', 'la tabla de interruptores existe',
       case when exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = 'visibilidad_nutricion'
       ) then 'SI' else 'NO' end

union all
select '0018 - visibilidad de cifras', 'los tres interruptores estan',
       case when (
         select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'visibilidad_nutricion'
           and column_name in ('ver_composicion', 'ver_objetivo_calorico', 'ver_contador_kcal')
       ) = 3 then 'SI' else 'NO' end

union all
select '0018 - visibilidad de cifras', 'la nota clinica esta en su propia tabla',
       case when exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = 'visibilidad_nutricion_nota'
       ) then 'SI' else 'NO' end

union all
select '0018 - visibilidad de cifras', 'el asesorado NO puede escribir sus interruptores',
       case when not exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'visibilidad_nutricion'
           and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
           and qual like '%auth.uid()%'
       ) then 'SI' else 'NO' end

union all
select '0018 - visibilidad de cifras', 'la vista de pendientes respeta RLS',
       case when exists (
         select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'visibilidad_pendiente'
           and c.reloptions::text like '%security_invoker=true%'
       ) then 'SI' else 'NO' end

union all
select '0019 - respuestas de la encuesta', 'perfil_alimentario.respuestas existe',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'perfil_alimentario'
           and column_name = 'respuestas' and data_type = 'jsonb'
       ) then 'SI' else 'NO' end

union all
select '0019 - respuestas de la encuesta', 'perfil_alimentario.completada_en existe',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'perfil_alimentario'
           and column_name = 'completada_en'
       ) then 'SI' else 'NO' end

union all
select '0019 - respuestas de la encuesta', 'la vista de revision respeta RLS',
       case when exists (
         select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'cifras_por_revisar'
           and c.reloptions::text like '%security_invoker=true%'
       ) then 'SI' else 'NO' end

union all
select '0020 - pruebas desde el movil', 'prueba_calibracion.cliente_id existe',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'prueba_calibracion'
           and column_name = 'cliente_id'
       ) then 'SI' else 'NO' end

union all
select '0020 - pruebas desde el movil', 'cliente_id es unico',
       case when exists (
         select 1 from pg_indexes
         where schemaname = 'public' and indexname = 'prueba_calibracion_cliente_id_unico'
       ) then 'SI' else 'NO' end

union all
select '0021 - estado del microciclo', 'existe la funcion proteger_estado_microciclo',
       case when exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'proteger_estado_microciclo'
       ) then 'SI' else 'NO' end

union all
-- La función sin el trigger no protege nada, y las dos mitades se aplican en
-- sentencias distintas: se comprueban por separado a propósito.
select '0021 - estado del microciclo', 'el trigger esta puesto en microciclos',
       case when exists (
         select 1 from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'microciclos'
           and t.tgname = 'trg_proteger_estado_microciclo' and not t.tgisinternal
       ) then 'SI' else 'NO' end

union all
select '0022 - adjuntos del chat', 'existe el bucket privado adjuntos-chat',
       case when exists (
         select 1 from storage.buckets where id = 'adjuntos-chat' and public = false
       ) then 'SI' else 'NO' end

union all
select '0022 - adjuntos del chat', 'mensajes tiene adjunto_path',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'mensajes'
           and column_name = 'adjunto_path'
       ) then 'SI' else 'NO' end

union all
-- Va aparte de adjunto_path aunque las dos columnas entren en el mismo
-- `alter table`: si el pegado se corta entre ambas, la senal de arriba diria SI
-- con la migracion a medias, y `hidratar.ts` selecciona `adjunto_tipo` -- el chat
-- se caeria en produccion con el comprobador en verde. Es el caso de la 0013.
select '0022 - adjuntos del chat', 'mensajes tiene adjunto_tipo y su restriccion',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'mensajes'
           and column_name = 'adjunto_tipo'
       ) and exists (
         select 1 from pg_constraint
         where conname = 'mensajes_adjunto_tipo_valido'
       ) then 'SI' else 'NO' end

union all
-- El bucket sin sus politicas es un bucket al que nadie puede subir. Se
-- comprueban aparte porque se aplican en sentencias distintas.
select '0022 - adjuntos del chat', 'estan las dos politicas de storage',
       case when (
         select count(*) from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname in (
             'adjuntos: sube en su propia carpeta',
             'adjuntos: lee quien envio o recibio'
           )
       ) = 2 then 'SI' else 'NO' end

union all
-- La señal es que el índice NO sea parcial. Un `ON CONFLICT (cliente_id)` no
-- puede inferir un índice con `where`, así que mientras lo tuviera, cada comida
-- moría con 42P10 y se descartaba en silencio: ni una llegó al servidor desde
-- que existe la función. Si esto diera NO, el registro de comidas no sube.
select '0023 - indices cliente_id no parciales', 'los tres indices sin predicado',
       case when (
         select count(*) from pg_indexes
         where schemaname = 'public'
           and indexname in (
             'registro_comida_cliente_id_unico',
             'registro_item_cliente_id_unico',
             'prueba_calibracion_cliente_id_unico'
           )
           and indexdef not ilike '%where%'
       ) = 3 then 'SI' else 'NO' end

union all
-- Tres señales en una: la tabla, su RLS y la vista de la cola. Se comprueban
-- juntas porque una despensa sin RLS deja a la vista lo que come cada persona,
-- y un pegado que se corte a la mitad crearía la tabla sin llegar a las
-- políticas. Que la tabla exista no basta para dar esto por aplicado.
select '0024 - despensa', 'tabla, RLS y vista de pedidos',
       case when (
         select count(*) from (
           select 1 from pg_tables
            where schemaname = 'public' and tablename = 'despensa' and rowsecurity
           union all
           select 1 from pg_policies
            where schemaname = 'public' and tablename = 'despensa'
              and policyname = 'despensa_cada_uno_la_suya'
           union all
           select 1 from pg_views
            where schemaname = 'public' and viewname = 'alimentos_pedidos'
         ) as senales
       ) = 3 then 'SI' else 'NO' end

union all
-- La columna Y su índice parcial. Sin la columna, quitar un veto no llega a la
-- base y el alimento reaparece en la siguiente hidratación; sin el índice, la
-- consulta de cada hidratación recorre la tabla entera.
select '0035 - borrado de vetos', 'columna borrado e indice de vivos',
       case when (
         select count(*) from (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'perfil_alimentario_veto'
              and column_name = 'borrado'
           union all
           select 1 from pg_indexes
            where schemaname = 'public' and indexname = 'perfil_alimentario_veto_vivos'
         ) as senales
       ) = 2 then 'SI' else 'NO' end

-- ---------------------------------------------------------------------------
-- 0025 a 0034: las cargas de DATOS, que hasta el 2026-08-12 no comprobaba nadie
--
-- Las de esquema fallan ruidosamente: si una tabla no existe, la app revienta.
-- Estas no. Una carga de datos que se corta a la mitad deja la base en pie y en
-- silencio, con la mitad de los alimentos. Es la misma forma del incidente de la
-- carga del 2026-08-09, que dejó seis sesiones en null y lo notó una asesorada.
--
-- Se comprueban por CONTENIDO, no por «existe la tabla»: qué filas tienen que
-- estar y con qué valor. Un umbral flojo («más de mil alimentos») diría SI con
-- media carga dentro.
-- ---------------------------------------------------------------------------

union all
-- La 0025 y la 0026 metieron a las filas de USDA los micros que solo tenía la
-- TCAC. Antes: 0 de 295. Se comprueba que la CLAVE exista en todas las filas, no
-- que tenga valor: que a un alimento no le hayan medido el zinc es un hueco
-- legítimo de la fuente, y exigir valor daría NO para siempre. Lo que no puede
-- pasar es que la clave no esté, porque entonces el panel lo pinta en blanco
-- como si fuera cero. Así se coló el hígado con la vitamina A en None.
select '0025 - potasio y vitamina A de USDA', 'la clave esta en todas las filas',
       case when (
         select count(*) from public.alimentos
          where not (por_100g ? 'potasio_mg') or not (por_100g ? 'vitamina_a_er')
       ) = 0 then 'SI' else 'NO' end

union all
select '0026 - los seis micros que faltaban', 'las ocho claves estan en todas las filas',
       case when (
         select count(*) from public.alimentos
          where not (por_100g ?& array['zinc_mg','magnesio_mg','sodio_mg','vitamina_c_mg',
                                       'folatos_ug','fosforo_mg','b12_ug','vitamina_d_ug'])
       ) = 0 then 'SI' else 'NO' end

union all
-- Las altas de 0027, 0029, 0030, 0031 y 0032 van juntas y es a propósito: la
-- 0030 reemite las mismas filas que las otras (mismo id, misma composición,
-- mismo origen_id), así que no admite una señal propia. Fingirle una que en
-- realidad comprueba a sus vecinas sería peor que no tenerla. Son 53 ids
-- distintos entre las cinco.
select '0027 a 0032 - altas de catalogo', 'las 53 altas estan en el catalogo',
       case when (
         select count(*) from public.alimentos
          where id in (
            'agua-de-panela','agua-de-panela-con-limon','agua-de-panela-con-queso',
            'aguardiente-un-trago','arroz-blanco-cocido','avena-en-caja','avena-en-leche',
            'avena-preparada-con-leche','batido-de-banano-en-leche','batido-de-proteina-con-leche',
            'batido-ganador-de-peso-casero','cafe-con-leche',
            'carne-de-res-magra-posta-o-bola-de-pierna-cruda','cerdo-lomo-crudo',
            'chocolate-caliente-en-leche','chocolate-con-leche','chocolate-con-queso',
            'chocolate-en-agua','ciruela-comun-cruda','garbanzo-cocido-sin-sal',
            'guayaba-madura-cruda','huevo-de-gallina-entero-cocido-sin-sal',
            'huevo-de-gallina-entero-crudo','jugo-de-guanabana-en-agua',
            'jugo-de-guanabana-en-leche','jugo-de-guayaba-en-agua','jugo-de-guayaba-en-leche',
            'jugo-de-lulo-en-agua','jugo-de-mango-en-agua','jugo-de-maracuya-en-agua',
            'jugo-de-mora-en-agua','jugo-de-mora-en-leche','jugo-de-papaya-en-agua',
            'leche-de-vaca-descremada-en-polvo','leche-de-vaca-descremada-liquida-pasteurizada',
            'leche-de-vaca-entera-en-polvo','leche-de-vaca-entera-liquida-pasteurizada',
            'lenteja-comun-cocida-sin-sal','limonada','limonada-de-coco','lomo-de-cerdo-magro-crudo',
            'mandarina-cruda','mango-tommy-atkins-crudo','palmito-en-lata','papaya-madura-cruda',
            'pasta-alimenticia-sin-enriquecer-cocida-sin-sal','pavo-pechuga-sin-piel-cruda',
            'pepino-cohombro-crudo','pera-cruda','sierra-entera-cruda',
            'sustituto-de-comida-preparado-con-leche','te-frio-en-botella','tinto-con-azucar')
       ) = 53 then 'SI' else 'NO' end

union all
-- Los valores exactos que Bryan decidió uno a uno el 2026-08-09. El zinc de la
-- posta bajó de 6,90 a 5,25 al promediar las dos fuentes —consecuencia avisada,
-- no descuido— y la vitamina D del bagre (12,5) no la publica la TCAC en ninguna
-- fila: sin ese traspaso se perdería al esconder la de USDA.
select '0033 - los cuatro ultimos duplicados', 'los valores fusionados, no los de antes',
       case when (
         select count(*) from (
           select 1 from public.alimentos
            where id = 'carne-de-res-magra-posta-o-bola-de-pierna-cruda'
              and (por_100g->>'zinc_mg')::numeric = 5.25
           union all
           select 1 from public.alimentos
            where id = 'bagre-magro-sin-cabeza-crudo'
              and (por_100g->>'vitamina_d_ug')::numeric = 12.5
           union all
           select 1 from public.alimentos
            where id = 'fresa-madura-cruda' and (por_100g->>'vitamina_c_mg')::numeric = 67
         ) as senales
       ) = 3 then 'SI' else 'NO' end

union all
-- NO es «el array existe»: el fallo era un `null` DENTRO del array, en la
-- posición exacta donde iba una sesión real. El array seguía ahí y la app se
-- caía con «Esta sección no se pudo mostrar». Esta señal es la única de todo el
-- archivo que hay que volver a mirar DESPUÉS DE CADA CARGA de microciclo, no
-- solo al aplicar una migración.
select '0034 - recuperar sesiones nulas', 'ningun null dentro del array de sesiones',
       case when (
         select count(*) from public.microciclos m
          where exists (
            select 1 from jsonb_array_elements(m.datos->'sesiones') as s
             where jsonb_typeof(s) = 'null'
          )
       ) = 0 then 'SI' else 'NO' end

union all
-- El respaldo existe con sus 33 microciclos y ni un ejercicio de esos quedó con
-- categoría de la taxonomía vieja. La función tmp_ tiene que estar muerta:
-- escribe microciclos, y create function la deja al alcance de la anon key.
-- UNA SEÑAL NO PUEDE VIVIR DE SU RESPALDO.
--
-- Esta pedía que `respaldo_0036_microciclos` existiera con sus 33 filas, y
-- acotaba la comprobación de categorías a las filas respaldadas. Eso ataba la
-- señal a una tabla temporal: al ir a soltar el respaldo -344 kB con datos
-- reales de asesorados, sin política de RLS y sin fecha de caducidad- la señal
-- habría pasado a NO y habría parecido que la 0036 se desaplicó. Un falso
-- negativo enseña a ignorar los NO, que es lo contrario de para lo que existe
-- este archivo.
--
-- La 0038 ya tenía el patrón bueno: mira los DATOS VIVOS. Esta hace lo mismo, y
-- de paso comprueba más que antes -los 93 microciclos, no solo los 33 que se
-- respaldaron-.
--
-- Lo que se pierde: saber que el respaldo existió. No es lo que había que
-- comprobar. Lo que importa es que la migración dejó los datos como debía, y eso
-- se lee en los datos.
select '0036 - taxonomia por accion articular', 'categorias migradas y funcion limpiada',
       case when (
         select count(*) from (
           select 1 where not exists (
             select 1 from microciclos m,
                  lateral jsonb_array_elements(coalesce(m.datos->'sesiones', '[]'::jsonb)) s,
                  lateral jsonb_array_elements(coalesce(s->'ejercicios', '[]'::jsonb)) e
             where e->>'categoria' like 'AISLAMIENTO %' or e->>'categoria' = 'SENTADILLAS'
           )
           union all
           -- La función `tmp_` escribe microciclos, y `create function` la deja
           -- al alcance de la anon key. Tiene que estar muerta.
           select 1 where not exists (
             select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'tmp_categoria_de'
           )
         ) as senales
       ) = 2 then 'SI' else 'NO' end

union all
-- La columna `hambre_escala` existe en la vista Y la vista sigue SIN
-- security_invoker. Las dos cosas juntas, porque cada una sola engaña: con la
-- columna pero en modo invoker, la nutricionista recibe la fila entera; en modo
-- correcto pero sin la columna, recibe blanco en los check-ins recientes.
--
-- Se mira el CONTENIDO, no el nombre. Las tres señales de la 0013 preguntan si
-- existe una política que se llame así, y existía desde la 0006 con el `es_staff()`
-- permisivo: daban SI con la migración aplicada y SI sin ella. Una comprobación
-- que no puede fallar no comprueba nada.
select '0039 - hambre escala en la vista', 'columna nueva y la vista sin invoker',
       case when (
         select count(*) from (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'checkins_nutricion'
              and column_name = 'hambre_escala'
           union all
           select 1 from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = 'checkins_nutricion'
              and not coalesce(c.reloptions::text like '%security_invoker=true%', false)
         ) as senales
       ) = 2 then 'SI' else 'NO' end

union all
-- El NOT NULL y el check de contenido, los dos. Por separado no bastan: con el
-- NOT NULL solo, un motivo de un espacio pasa; con el check solo, un NULL pasa.
select '0040 - un veto sin motivo no se guarda', 'motivo not null y con contenido',
       case when (
         select count(*) from (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'perfil_alimentario_veto'
              and column_name = 'motivo' and is_nullable = 'NO'
           union all
           select 1 from pg_constraint
            where conname = 'perfil_alimentario_veto_motivo_escrito'
         ) as senales
       ) = 2 then 'SI' else 'NO' end

union all
-- Las tres funciones de escritura quirúrgica, y que NINGUNA quede al alcance de
-- la anon key. `revoke ... from public` no basta en Supabase: el `alter default
-- privileges` del proyecto concede EXECUTE a `anon` por su cuenta, así que hay
-- que revocarle a él también. Se comprueban las dos mitades.
select '0037 - escrituras quirurgicas de microciclo', 'las tres funciones, y ninguna abierta a anon',
       case when (
         select count(*) from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('fijar_series_ejercicio', 'fijar_test_post', 'fijar_preparacion_sesion')
       ) = 3 and not exists (
         select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('fijar_series_ejercicio', 'fijar_test_post', 'fijar_preparacion_sesion')
           and (has_function_privilege('anon', p.oid, 'execute')
             or has_function_privilege('public', p.oid, 'execute'))
       ) then 'SI' else 'NO' end

union all
-- La taxonomía, medida donde vive: dentro del JSONB de los microciclos. Si
-- alguna categoría vuelve a traer minúsculas es que un cliente subió el blob
-- entero por encima -el fallo que la 0037 existe para impedir- y hay que mirarlo.
select '0038 - taxonomia final', 'ninguna categoria fuera del canon',
       case when not exists (
         select 1 from microciclos m,
              lateral jsonb_array_elements(coalesce(m.datos->'sesiones', '[]'::jsonb)) s,
              lateral jsonb_array_elements(coalesce(s->'ejercicios', '[]'::jsonb)) e
          where e->>'categoria' ~ '[a-z]'
       ) then 'SI' else 'NO' end

union all
-- Ni RIR ni reps pueden volver a guardar texto. Se mira el dato real, no el
-- tipo: la columna es JSONB y acepta lo que le echen.
select '0041 - rir y reps que no son numeros', 'ninguna serie con texto en rir o reps',
       case when not exists (
         select 1 from microciclos m,
              lateral jsonb_array_elements(coalesce(m.datos->'sesiones', '[]'::jsonb)) s,
              lateral jsonb_array_elements(coalesce(s->'ejercicios', '[]'::jsonb)) e,
              lateral jsonb_array_elements(coalesce(e->'series', '[]'::jsonb)) sr
          where (sr->>'rir') ~ '[A-Za-z]' or (sr->>'reps') ~ '[A-Za-z]'
       ) then 'SI' else 'NO' end

union all
-- La columna Y el índice de lo vivo. Y una tercera que se lee al revés: el
-- índice de `cliente_id` NO puede volverse parcial. Si alguien le añadiera un
-- `where not borrado` «por simetría», `ON CONFLICT (cliente_id)` dejaría de
-- poder arbitrar sobre él y la despensa entera dejaría de subir en silencio.
-- Es literalmente lo que paso con el registro de comidas (ver 0023).
select '0042 - borrado de despensa', 'columna, indice de lo vivo y cliente_id no parcial',
       case when (
         select count(*) from (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'despensa'
              and column_name = 'borrado'
           union all
           select 1 from pg_indexes
            where schemaname = 'public' and indexname = 'despensa_viva'
           union all
           select 1 from pg_indexes
            where schemaname = 'public' and indexname = 'despensa_cliente_id_unico'
              and indexdef not ilike '%where%'
         ) as senales
       ) = 3 then 'SI' else 'NO' end

union all
-- El unico indice de la 0044 que no estaba ya duplicado. Los otros tres del
-- borrador se cayeron: `registro_comida_vivas` (0017) y
-- `perfil_alimentario_veto_vivos` (0035) ya existian, y el tercero apuntaba a
-- una columna inexistente.
select '0044 - indice de consultas por fecha', 'consultas_chat ordenado por creado_en',
       case when exists (
         select 1 from pg_indexes
          where schemaname = 'public' and indexname = 'consultas_chat_por_fecha'
       ) then 'SI' else 'NO' end

union all
-- Se mira `usuarios_leer` como testigo de las 21: es la politica que mas se
-- evalua de todas, porque `es_coach()` y `es_staff()` consultan esta tabla.
-- Sin envolver, se llamaban una vez POR FILA: 76 millones de filas leidas de
-- una tabla de 26.
select '0045 - RLS en InitPlan', 'usuarios_leer envuelve auth.uid() y es_staff()',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'usuarios_app'
            and policyname = 'usuarios_leer'
            and qual like '%SELECT auth.uid()%'
            and qual like '%SELECT es_staff()%'
       ) then 'SI' else 'NO' end

union all
-- Dos señales, y hacen falta las dos. Que no quede ningun `for all` prueba que
-- dejaron de dispararse al LEER; que haya 15 politicas de escritura -tres por
-- tabla- prueba que no se perdio ningun permiso por el camino. Con solo la
-- primera, borrar las cinco a secas tambien daria 'SI'.
select '0046 - las de escritura no leen', 'ningun for all, y tres de escritura por tabla',
       case when (
         select count(*) from pg_policies
          where schemaname = 'public'
            and tablename in ('perfiles','planes_nutricionales','contenidos',
                              'cuestionarios','premiaciones')
            and cmd = 'ALL'
       ) = 0 and (
         select count(*) from pg_policies
          where schemaname = 'public'
            and tablename in ('perfiles','planes_nutricionales','contenidos',
                              'cuestionarios','premiaciones')
            and policyname like '%escribir\_coach\_%'
       ) = 15 then 'SI' else 'NO' end

union all
-- Esta se lee al reves: la señal es que la politica NO este. `checkins_lee_staff`
-- quedo vacia de contenido en la 0013, cuando se acoto a `es_coach()` y
-- `checkins_todo_propio` ya concedia eso mismo.
select '0047 - checkins_lee_staff sobraba', 'la politica redundante ya no esta',
       case when not exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'checkins'
            and policyname = 'checkins_lee_staff'
       ) then 'SI' else 'NO' end

union all
-- Las tres piezas, porque sueltas no sirven: sin el sello la caché no sabria
-- cuando esta vieja, y sin el calculo vivo no habria a donde volver si el cron
-- se cae. Una vista materializada sin refrescar no da error: da un ranking
-- creible y viejo.
select '0048 - ranking en cache', 'vista materializada, calculo vivo y sello',
       case when (
         select count(*) from (
           select 1 from pg_matviews
            where schemaname = 'public' and matviewname = 'ranking_disciplina_cache'
           union all
           select 1 from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'ranking_disciplina_vivo'
           union all
           select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'ranking_cache_sello'
         ) as senales
       ) = 3 then 'SI' else 'NO' end

union all
-- Tres señales, y las tres hacen falta. La columna sola no dice nada: existia
-- en siete tablas desde antes y NO habia un solo trigger que la mantuviera, asi
-- que se rellenaba a mano en los scripts de carga y las escrituras de la app no
-- la tocaban. Ese era justo el fallo que esta migracion viene a cerrar: sin el
-- trigger, la firma diria «no cambio» sobre datos que si cambiaron.
select '0049 - firma de sincronizacion', 'columna, trigger en las 21 y el RPC',
       case when (
         select count(*) from (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'usuarios_app'
              and column_name = 'actualizado_en'
           union all
           select 1 from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'firma_de_sincronizacion'
         ) as senales
       ) = 2
       and (select count(*) from pg_trigger
             where tgname = 'trg_actualizado_en' and not tgisinternal) = 21
       then 'SI' else 'NO' end

union all
-- Se lee AL REVES: la señal es que las funciones NO esten. Se borran al
-- terminar cada carga -`plantilla-carga-microciclo.sql` las recrea con
-- `create or replace`, asi que borrarlas no pierde nada- y dejarlas puestas es
-- lo que permitio que el 2026-08-27 dos funciones que ESCRIBEN microciclos
-- estuvieran al alcance de la anon key.
--
-- Ojo: esta señal dira SI en cuanto se borren, aunque nadie haya arreglado el
-- flujo. La que vigila de verdad es `comprobar-funciones-expuestas.sql`, que hay
-- que correr DESPUES DE CADA CARGA.
select '0050 - funciones de carga cerradas', 'ninguna tmp_ viva y search_path en marcar_actualizado',
       case when not exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname like 'tmp\_%')
            and exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'marcar_actualizado'
                 and array_to_string(p.proconfig, ',') like '%search_path=public%')
       then 'SI' else 'NO' end

union all
-- Se lee AL REVES, como la 0050: la señal es que las ocho NO esten. Y se acota
-- a esas ocho por nombre EXACTO a proposito: un `like '%respaldo%'` diria NO en
-- cuanto alguien creara un respaldo nuevo y legitimo, que es justo lo que hay
-- que poder hacer sin que una comprobacion se ponga en rojo.
select '0051 - respaldos que ya cumplieron', 'las ocho auditadas ya no estan',
       case when not exists (
         select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
            and c.relname in ('tmp_arreglo_20260824_antes','respaldo_contenidos_20260827',
                              'respaldo_microciclos_20260827','respaldo_fechainicio_20260825',
                              'tmp_respaldo_juliana_20260824','tmp_respaldo_dup_20260824',
                              '_backup_microciclos_20260823','tmp_respaldo_20260824')
       ) then 'SI' else 'NO' end

union all
-- La funcion existe, no se salta la RLS y `anon` no la puede llamar. Las tres
-- cosas en una senal porque las tres tienen que darse: una funcion que ESCRIBE
-- microciclos y nace ejecutable por la anon key es el agujero de siempre.
select '0052 - la sesion lleva fecha', 'fijar_fecha_sesion existe, invoker y cerrada a anon',
       case when exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'fijar_fecha_sesion'
                 and p.prosecdef = false)
            and not has_function_privilege('anon',
                  'public.fijar_fecha_sesion(text,text,text)', 'execute')
       then 'SI' else 'NO' end

union all
-- Dos señales en una, y hacen falta las dos. La columna se busca POR SU CHECK y
-- no por su nombre: una columna `sexo` sin el check dejaría entrar la 'M' o la
-- 'F' de una carga, y la app no dibujaría nada con ellas. Y el trigger tiene
-- que nombrarla: `proteger_perfil` compara `datos` y solo `datos`, así que una
-- columna fuera del blob se le escapaba y el asesorado podía escribirla por la
-- API. Diría NO con la migración a medias (columna sí, función no).
select '0056 - el sexo en la ficha', 'columna con check (hombre, mujer) y proteger_perfil la vigila',
       case when exists (
              select 1 from pg_constraint c
                join pg_class t on t.oid = c.conrelid
                join pg_namespace n on n.oid = t.relnamespace
               where n.nspname = 'public' and t.relname = 'perfiles'
                 and c.contype = 'c'
                 and pg_get_constraintdef(c.oid) like '%sexo%'
                 and pg_get_constraintdef(c.oid) like '%hombre%'
                 and pg_get_constraintdef(c.oid) like '%mujer%')
            and exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'proteger_perfil'
                 and p.prosrc like '%new.sexo%')
       then 'SI' else 'NO' end

union all
-- Las dos cosas de la 0057: la función que mete la medida y el trigger que admite el
-- estreno de la ficha (el blob con `usuarioId` y nada más). Con la función sin el
-- trigger, la primera medida de quien no tiene ficha seguiría rechazada; con el
-- trigger sin la función, el cliente nuevo llamaría a una RPC inexistente y la cola
-- descartaría la medida. Diría NO con cualquiera de las dos a medias.
select '0057 - el asesorado estrena su ficha', 'registrar_medida existe y proteger_perfil admite el estreno',
       case when exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'registrar_medida')
            and exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'proteger_perfil'
                 and p.prosrc like '%usuarioId%')
       then 'SI' else 'NO' end

union all
-- 0058, primera señal: la tabla con sus DOCE preguntas y el candado que impide que una
-- fila de la app venga a medias. Se cuentan las columnas por su nombre, no el total:
-- una tabla con diecisiete columnas donde una se llame distinto no le sirve a
-- `entrada_desde_historial.py`, que las vuelca al dictamen SIN traducir. Y sin el check
-- `cribado_de_la_app_esta_completo`, una fila `app` incompleta sería indistinguible de
-- una `wiki` a medias — que es justo la ambigüedad que la migración viene a cerrar.
select '0058 - el cribado vive en la base', 'tabla con las 12 preguntas y el check de completitud',
       case when (
              select count(*) = 12 from information_schema.columns
               where table_schema = 'public' and table_name = 'cribado'
                 and column_name in (
                   'diagnostico','quien_lo_lleva','tratamiento_activo','medicacion_cronica',
                   'autorizacion_sanitaria','restricciones_explicitas','sintomas_con_esfuerzo',
                   'nivel_funcional','que_le_han_dicho_que_no_haga',
                   'parq_enfermedad_cardiaca','parq_medicamento_presion','parq_huesos_articulaciones'))
            and exists (
              select 1 from pg_constraint c
                join pg_class t on t.oid = c.conrelid
                join pg_namespace n on n.oid = t.relnamespace
               where n.nspname = 'public' and t.relname = 'cribado'
                 and c.conname = 'cribado_de_la_app_esta_completo')
       then 'SI' else 'NO' end

union all
-- 0058, segunda señal: la puerta no se abre desde el lado que protege. Son datos de
-- salud y este dato PARA la cadena: quien contesta «sí» a dolor torácico queda en zona
-- roja. Si el asesorado pudiera hacer UPDATE de su propia fila, se desbloquearía solo.
-- Se exige, las tres: RLS encendida, que exista una política de UPDATE, y que NINGUNA
-- política de UPDATE mencione `auth.uid()` — es decir, que cambiar una respuesta sea
-- del coach y de nadie más. Diría NO con la tabla creada y las políticas sin poner,
-- que es el estado peligroso: tabla viva y abierta.
select '0058 - el cribado vive en la base', 'RLS encendida y el UPDATE es solo del coach',
       case when (select coalesce(bool_and(c.relrowsecurity), false)
                    from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = 'cribado')
            and exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'cribado' and cmd = 'UPDATE')
            and not exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'cribado' and cmd = 'UPDATE'
                 and coalesce(qual, '') || coalesce(with_check, '') like '%uid()%')
       then 'SI' else 'NO' end

union all
-- La 0060: activar es UNA operación. Se pide la función Y que no la pueda llamar la
-- clave anónima, porque `create function` concede EXECUTE a PUBLIC y sin el revoke la
-- puerta queda abierta aunque la RLS pare las escrituras. Con la función sin el revoke
-- diría NO, que es lo que se quiere: media migración aplicada no es aplicada.
select '0060 - activar microciclo en una operacion', 'activar_microciclo existe y anon no puede llamarla',
       case when exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'activar_microciclo'
                 and not has_function_privilege('anon', p.oid, 'execute'))
       then 'SI' else 'NO' end

union all
-- La 0062: el cribado guarda su historia. Se piden las dos cosas que la hacen segura y
-- útil a la vez: que la vista `cribado_vigente` exista CON `security_invoker` —sin él se
-- saltaría la RLS de la tabla y cualquiera vería el cribado de cualquiera— y que la
-- clave primaria ya no sea la persona sino la fila. Con la vista creada sin la opción
-- diría NO, que es el estado peligroso.
select '0062 - el cribado guarda su historia', 'cribado_vigente con security_invoker y la clave es la fila',
       case when exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'cribado_vigente' and c.relkind = 'v'
                 and coalesce(c.reloptions::text, '') like '%security_invoker=true%')
            and exists (
              select 1 from pg_constraint k
                join pg_class t on t.oid = k.conrelid
                join pg_namespace n on n.oid = t.relnamespace
               where n.nspname = 'public' and t.relname = 'cribado' and k.contype = 'p'
                 and pg_get_constraintdef(k.oid) = 'PRIMARY KEY (id)')
       then 'SI' else 'NO' end

union all
-- La 0065: los días que la persona puede entrenar. La función tiene que existir, la
-- clave anónima no puede llamarla, y el trigger `proteger_perfil` tiene que admitir la
-- clave `diasDisponibles` — si no, la app llamaría a una función que el candado
-- rechaza y la cola descartaría los días en silencio.
select '0065 - los dias que puede entrenar', 'registrar_dias_disponibles existe, anon no la llama y proteger_perfil admite la clave',
       case when exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'registrar_dias_disponibles'
                 and not has_function_privilege('anon', p.oid, 'execute'))
            and exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'proteger_perfil'
                 and pg_get_functiondef(p.oid) like '%diasDisponibles%')
-- == LAS QUE FALTABAN, Y LOS DOS PARES REPETIDOS (anadidas el 2026-09-10) =====
--
-- En `main` hay DOS archivos llamados 0062 y DOS llamados 0065, y falta la 0063
-- entera aunque su efecto este aplicado. Con las migraciones pegadas a mano, un
-- numero repetido significa que **nadie puede saber cual de las dos corrio**: la
-- lista de archivos no lo dice y la base tampoco guarda versiones.
--
-- Esto lo arregla SIN TOCAR EL TRABAJO DE NADIE: no se renombra ni se reescribe
-- ninguna migracion —estan aplicadas, y renombrar lo aplicado es como se pierde el
-- rastro de verdad—. Cada una tiene aqui su propia senal, y cada senal mira lo que
-- esa migracion HACE. Asi el par deja de ser ambiguo: dos filas distintas, cada
-- una con su SI o su NO.

-- La 0053: la tabla del motivo por el que alguien se queda sin plan, con su RLS. Se
-- pide la tabla Y que la RLS este encendida: una tabla sin RLS en este repo es una
-- tabla abierta a la clave anonima, asi que media migracion tiene que decir NO.
select '0053 - motivo sin plan', 'la tabla existe con RLS encendida',
       case when exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'motivo_sin_plan' and c.relrowsecurity)
       then 'SI' else 'NO' end

union all
-- La 0054 y la 0055 tocan LA MISMA funcion (`mesa_del_sabado`), asi que preguntar si
-- existe no distingue una de otra: con la 0054 aplicada y la 0055 no, existir existe.
-- Lo que separa a la 0055 es que la ventana va por FECHA, y eso se lee en su cuerpo.
select '0054 - mesa del sabado', 'la funcion mesa_del_sabado existe',
       case when exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'mesa_del_sabado')
       then 'SI' else 'NO' end

union all
select '0055 - la ventana de la mesa va por fecha', 'mesa_del_sabado filtra por fecha',
       case when exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'mesa_del_sabado'
                 and p.prosrc like '%fecha%')
       then 'SI' else 'NO' end

union all
select '0058 - el cribado', 'la tabla cribado existe con RLS encendida',
       case when exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'cribado' and c.relrowsecurity)
       then 'SI' else 'NO' end

union all
select '0061 - el cajon de medios', 'la tabla medios_app existe con RLS encendida',
       case when exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'medios_app' and c.relrowsecurity)
       then 'SI' else 'NO' end

union all
-- LA OTRA 0062: el saludo es una via propia de la consulta. La primera -el cribado
-- guarda su historia- tiene su senal mas arriba, escrita por otra sesion. Esta es la
-- que faltaba, y su efecto vive en la restriccion de `via`, no en ninguna tabla nueva.
select '0062b - el saludo es una via', 'consultas_chat.via admite saludo',
       case when exists (
              select 1 from pg_constraint
               where conname = 'consultas_chat_via_check'
                 and pg_get_constraintdef(oid) like '%saludo%')
       then 'SI' else 'NO' end

union all
-- La 0063 es el caso mas raro de todos, y hay que contarlo entero porque la primera
-- lectura fue equivocada: NO es un archivo que se perdiera al renumerar. Su fichero
-- vive en `origin/feat/permiso-de-avisos`, un PR **todavia abierto**, asi que el
-- numero esta reservado por codigo sin fusionar. Lo que si es cierto -y es lo que
-- importa- es que **su tabla YA existe en la base**: la migracion se aplico por
-- delante de su codigo. Por eso lleva senal aunque `main` no tenga el archivo: si no,
-- quien compare las dos listas veria un hueco y no vera que la base va por delante.
select '0063 - permisos de aviso (aplicada; su archivo sigue en un PR abierto)', 'existe la tabla de suscripciones de aviso',
       case when exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public'
                 and c.relname in ('permisos_de_aviso', 'suscripciones_push', 'suscripciones_aviso'))
       then 'SI' else 'NO' end

union all
select '0064 - el mapa de vida', 'la tabla de respuestas existe con RLS encendida',
       case when exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'mapa_de_vida_respuestas'
                 and c.relrowsecurity)
       then 'SI' else 'NO' end

union all
-- LA OTRA 0065: el video es de cada quien. La primera -los dias que puede entrenar-
-- tiene su senal mas arriba. Esta es la que faltaba: tabla propia con RLS.
select '0065a - el video es de cada quien', 'la tabla videos_semanales existe con RLS encendida',
       case when exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'videos_semanales' and c.relrowsecurity)
       then 'SI' else 'NO' end

union all
-- La 0067: los borradores que esperan firma. Lo que se pide NO es que el `origen`
-- admita dos valores mas -eso solo dice que la restriccion cambio- sino que la
-- LECTURA esconda el borrador a su destinatario, que es lo unico que impide que el
-- asesorado vea y oiga un video antes de que nadie lo firme.
select '0067 - borradores que esperan firma', 'mensajes_leer esconde los borradores al destinatario',
       case when exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'mensajes'
                 and policyname = 'mensajes_leer' and qual::text like '%borrador%')
            and exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'es_nutricionista')
       then 'SI' else 'NO' end

union all
-- La 0068: el video no sale hasta que alguien lo firma. Se piden LAS DOS MITADES,
-- porque se pueden deshacer por separado y cada una sola deja el agujero abierto
-- por su lado:
--
--   1. que `videos_semanales` tenga `aprobado_en` Y que la lectura del asesorado lo
--      exija no nulo. Con la columna puesta pero la politica vieja, la fila se lee
--      igual sin firmar;
--   2. que la politica del ARCHIVO haya dejado de colgar de la carpeta. Con la
--      politica vieja, `personas/<uuid>/<lunes>.mp4` se abre adivinando la ruta,
--      sin que exista ninguna fila — que es como estaba el 10-sep.
--
-- Lo que se pide NO es que la columna exista: eso solo dice que el `alter` corrio.
select '0068 - el video no sale sin firma', 'aprobado_en existe, la lectura lo exige, y el archivo cuelga de la fila firmada',
       case when exists (
              select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'videos_semanales'
                 and column_name = 'aprobado_en')
            and exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'videos_semanales'
                 and qual::text like '%aprobado_en%')
            and exists (
              select 1 from pg_policies
               where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'medios: el video firmado, y de su dueno'
                 and qual::text like '%videos_semanales%')
            and not exists (
              select 1 from pg_policies
               where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'medios: cada quien abre su video')
       then 'SI' else 'NO' end

union all
-- La 0066: el estado del microciclo deja de vivir en dos sitios. Se piden TRES efectos,
-- porque la migracion hace tres cosas que se pueden deshacer por separado y cada una sola
-- deja el agujero abierto por su lado:
--
--   1. que `activar_microciclo` ya NO escriba el estado dentro del blob. Si se restaurara
--      una version anterior de la funcion, la clave volveria a aparecer en cada activacion
--      y el trigger estaria limpiando detras de ella para siempre;
--   2. que el trigger que la quita este puesto sobre `microciclos`;
--   3. que NINGUNA fila tenga ya la clave en el blob.
--
-- La tercera mira DATOS y no catalogo, que normalmente no vale como senal —lo que cambia
-- cada dia no dice si una migracion corrio—. Aqui si vale, y es la excepcion que conviene
-- entender: no cuenta filas, cuenta una condicion que el trigger mantiene en CERO para
-- siempre. Si algun dia da mas de cero, la respuesta correcta es «el trigger se cayo o
-- alguien lo quito», que es justo lo que una senal tiene que poder decir.
select '0066 - el estado deja de vivir en dos sitios', 'activar_microciclo no escribe el blob, el trigger esta puesto y ninguna fila conserva la clave',
       case when exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'activar_microciclo'
                 and pg_get_functiondef(p.oid) not like '%jsonb_build_object(''estado''%'
                 and pg_get_functiondef(p.oid) not like '%jsonb_set(datos, ''{estado}''%')
            and exists (
              select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'microciclos'
                 and t.tgname = 'trg_sin_estado_en_el_blob' and not t.tgisinternal)
            and not exists (
              select 1 from public.microciclos where jsonb_exists(datos, 'estado'))
       then 'SI' else 'NO' end

union all
-- La 0068: un solo microciclo activo por persona. Lo que se pide NO es que exista un
-- indice con ese nombre -eso lo cumple cualquier indice- sino que sea UNICO y PARCIAL.
-- Un unico sin el `where` prohibiria dos CERRADOS, que es lo normal en una persona con
-- historial: seria el candado equivocado, dando SI. Y se anade el estado que el candado
-- existe para sostener: nadie con dos activos.
select '0068 - un solo microciclo activo', 'indice unico PARCIAL sobre usuario_id donde estado=activo, y nadie con dos',
       case when exists (
              select 1 from pg_indexes
               where schemaname = 'public' and tablename = 'microciclos'
                 and indexname = 'microciclos_un_activo_por_usuario'
                 and indexdef ilike '%unique%'
                 and indexdef ilike '%where (estado = ''activo''%')
            and not exists (
              select 1 from public.microciclos
               where estado = 'activo' group by usuario_id having count(*) > 1)
       then 'SI' else 'NO' end

order by migracion, senal;
