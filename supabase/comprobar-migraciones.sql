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
select '0036 - taxonomia por accion articular', 'respaldo, categorias migradas y funcion limpiada',
       case when (
         select count(*) from (
           select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'respaldo_0036_microciclos'
           union all
           select 1 where (select count(*) from respaldo_0036_microciclos) = 33
           union all
           select 1 where not exists (
             select 1 from microciclos m
             join respaldo_0036_microciclos r on r.id = m.id,
                  lateral jsonb_array_elements(m.datos->'sesiones') s,
                  lateral jsonb_array_elements(s->'ejercicios') e
             where e->>'categoria' like 'AISLAMIENTO %' or e->>'categoria' = 'SENTADILLAS'
           )
           union all
           select 1 where not exists (
             select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'tmp_categoria_de'
           )
         ) as senales
       ) = 4 then 'SI' else 'NO' end

order by migracion, senal;
