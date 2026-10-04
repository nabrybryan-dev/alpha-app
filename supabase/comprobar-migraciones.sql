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
--   · 0105 → SIN APLICAR (escrita el 2026-10-01, rama `feat/praxis-conexion`). La bandeja
--            de «pregunta en espera» de Praxis. Sus seis señales tienen que decir NO
--            antes de aplicarla y SI después. Mientras digan NO, Praxis ofrece la
--            pregunta, pero al aceptar dice que todavía no puede dejarla.
--   · 0108 → SIN APLICAR (escrita el 2026-10-03, rama `feat/praxis-aviso-coach`). Los avisos de
--            Praxis al coach (señal de riesgo: tipo, hora y origen, nunca la frase). Sus cinco
--            señales tienen que decir NO antes de aplicarla y SI después. Mientras digan NO,
--            la consola dice «falta aplicar la migración 0108» y la función solo anota en su log.

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
-- ARREGLADA EL 2026-09-11, y se arregla sola leyendo el archivo: esta señal pedía una
-- política llamada `checkins_lee_staff` que la **0047 borró a propósito** por redundante
-- —hay una señal veinte líneas más abajo que comprueba justamente que NO esté—. Dos
-- señales del mismo archivo pidiendo lo contrario: la vieja llevaba en rojo desde
-- entonces y nadie lo miraba, que es como un comprobador deja de leerse.
--
-- Y el arreglo es el que la cabecera de este archivo ya predicaba: **mirar el EFECTO, no
-- el NOMBRE**. Lo que la 0013 vino a cerrar es que el staff entre a los check-ins por
-- `es_staff()` —que incluye a la nutricionista— en vez de por `es_coach()`. Eso se
-- comprueba sobre TODAS las políticas de la tabla, se llamen como se llamen: tiene que
-- haber al menos una que conceda por `es_coach()`, y NINGUNA puede nombrar `es_staff()`.
-- Así sobrevive al siguiente renombre, que es lo que esta señal no hizo.
select '0013 · acotar nutricionista', 'ninguna politica de checkins abre por es_staff',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'checkins'
            and coalesce(qual, '') || coalesce(with_check, '') like '%es_coach()%'
       ) and not exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'checkins'
            and coalesce(qual, '') || coalesce(with_check, '') like '%es_staff()%'
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
-- ARREGLADA EL 2026-09-11: pedía un índice llamado `consultas_chat_por_fecha` y el que
-- hay se llama `consultas_chat_usuario_idx`. Pero **hace exactamente el trabajo**: es
-- `(usuario_id, creado_en DESC)`, que sirve para lo mismo y además acota por persona.
-- Un índice no se reconoce por su nombre sino por sus columnas y su orden, así que eso
-- es lo que se mira. Medido el 2026-09-11: en rojo desde que alguien lo renombró.
select '0044 - indice de consultas por fecha', 'hay un indice de consultas_chat por creado_en DESC',
       case when exists (
         select 1 from pg_indexes
          where schemaname = 'public' and tablename = 'consultas_chat'
            and indexdef like '%creado\_en DESC%'
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
select '0049 - firma de sincronizacion', 'ninguna tabla viva con la columna se queda sin su sello',
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
       -- ARREGLADA EL 2026-09-11: exigía EXACTAMENTE 21 tablas con el sello, y desde
       -- que la 0058 trajo `cribado` son 22. Se ponía roja justo cuando el sistema
       -- crecía BIEN — un número congelado dentro de una comprobación se convierte en
       -- una alarma que suena por aprobar el examen. Lo que hay que exigir es que
       -- ninguna tabla con la columna se quede SIN su disparador, que es el fallo real:
       -- una tabla que no sella cuando cambió deja a la caché creyendo que está al día.
       --
       -- Dos exclusiones, y las dos con razon: una VISTA hereda la columna de su tabla
       -- y no puede llevar disparador (`cribado_vigente`, `checkins_nutricion`,
       -- `visibilidad_pendiente`), y las `respaldo_*` son fotos de una limpieza, no
       -- datos vivos que alguien esperaria ver sellados.
       and not exists (
         select 1
           from information_schema.columns c
           join information_schema.tables tb
             on tb.table_schema = c.table_schema and tb.table_name = c.table_name
          where c.table_schema = 'public' and c.column_name = 'actualizado_en'
            and tb.table_type = 'BASE TABLE'
            and c.table_name not like 'respaldo\_%'
            and not exists (
              select 1 from pg_trigger tg
                join pg_class cl on cl.oid = tg.tgrelid
                join pg_namespace ns on ns.oid = cl.relnamespace
               where ns.nspname = 'public' and cl.relname = c.table_name
                 and tg.tgname = 'trg_actualizado_en' and not tg.tgisinternal))
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
       then 'SI' else 'NO' end

union all
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
-- La 0070: la revision semanal puede ser audio. Lo que se pide NO es que la columna
-- exista -eso solo dice que el `alter` corrio- sino que la RESTRICCION este puesta:
-- sin ella, un `tipo` mal escrito entra y la pantalla intenta reproducir algo que no
-- sabe leer. El `default 'video'` hace que olvidarse no falle, sino que mienta.
select '0070 - la revision puede ser audio', 'la columna tipo existe y solo admite audio o video',
       case when exists (
              select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'videos_semanales'
                 and column_name = 'tipo')
            and exists (
              select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid
               where t.relname = 'videos_semanales'
                 and pg_get_constraintdef(c.oid) like '%tipo%audio%video%')
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
-- La 0069: un solo microciclo activo por persona. (Nacio como 0068 y se renumero:
-- otra sesion fusiono su propia 0068 el mismo dia. La base no se guia por el numero.) Lo que se pide NO es que exista un
-- indice con ese nombre -eso lo cumple cualquier indice- sino que sea UNICO y PARCIAL.
-- Un unico sin el `where` prohibiria dos CERRADOS, que es lo normal en una persona con
-- historial: seria el candado equivocado, dando SI. Y se anade el estado que el candado
-- existe para sostener: nadie con dos activos.
select '0069 - un solo microciclo activo', 'indice unico PARCIAL sobre usuario_id donde estado=activo, y nadie con dos',
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

union all
-- La 0071: las tablas de respaldo dicen para que existen y hasta cuando.
-- La senal NO es «no hay ninguna sin rotulo»: eso se cumple solo con que no haya tablas de
-- respaldo, y una base recien creada no tiene ninguna — diria SI sin haberse aplicado nunca,
-- que es la forma clasica de nacer verde en vacio. Se piden LAS DOS cosas: que haya al menos
-- una rotulada Y que no quede ninguna sin rotulo. Y se pide el rotulo con su `caduca`, no
-- solo un comentario cualquiera, porque un respaldo sin fecha de caducidad es justo el
-- problema que esta migracion cierra.
select '0071 - los respaldos dicen para que existen', 'toda tabla de respaldo lleva rotulo con caduca, y hay al menos una',
       case when exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%'
                 and obj_description(c.oid) ~ 'caduca [0-9]{4}-[0-9]{2}-[0-9]{2}')
            and not exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%'
                 and (obj_description(c.oid) is null
                      or obj_description(c.oid) !~ 'caduca [0-9]{4}-[0-9]{2}-[0-9]{2}'))
       then 'SI' else 'NO' end

union all
-- La 0072: el primer respaldo que cumplio y se fue. Mismo aviso que la 0051: en una base
-- recien creada esa tabla no existio nunca, asi que esto dice SI sin que la migracion haya
-- hecho nada. Es inherente a un borrado. Lo que si se puede decir es que la haria decir NO:
-- que la tabla REAPAREZCA, que es el caso que importa vigilar. Se le pega la condicion de la
-- 0071 sobre lo que queda, que si distingue: 13 tablas y las 13 con su rotulo.
select '0072 - el primer respaldo que cumplio', 'respaldo_perfiles_notas_20260906 ya no esta, y lo que queda sigue rotulado',
       case when not exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r'
                 and c.relname = 'respaldo_perfiles_notas_20260906')
            and not exists (
              select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%'
                 and (obj_description(c.oid) is null
                      or obj_description(c.oid) !~ 'caduca [0-9]{4}-[0-9]{2}-[0-9]{2}'))
       then 'SI' else 'NO' end

union all
-- La 0073: la tasa contra el plan se exporta por rpc para la revision semanal larga. Lo que
-- se pide NO es solo que la funcion exista: que no la pueda ejecutar ni anon ni authenticated,
-- porque devuelve registro, pesos y perimetros de TODA la cartera. En Postgres una funcion
-- nueva nace ejecutable por PUBLIC, y olvidar el revoke no da ningun error. El orden del case
-- importa: preguntar privilegios sobre una funcion que no existe revienta en vez de decir NO.
select '0073 - la tasa contra el plan se exporta', 'la funcion existe, es de solo lectura y solo la ejecuta service_role',
       case when to_regprocedure('public.tasa_contra_el_plan_export()') is null then 'NO'
            when has_function_privilege('anon', 'public.tasa_contra_el_plan_export()', 'execute') then 'NO'
            when has_function_privilege('authenticated', 'public.tasa_contra_el_plan_export()', 'execute') then 'NO'
            when not has_function_privilege('service_role', 'public.tasa_contra_el_plan_export()', 'execute') then 'NO'
            when (select p.provolatile from pg_proc p
                   where p.oid = to_regprocedure('public.tasa_contra_el_plan_export()')) <> 's' then 'NO'
            else 'SI' end


union all
-- La 0074: el export lee las medidas que la tarjeta guarda en `cuerpo`. Sin ella la persona se
-- mide en la app y su revision larga sigue diciendo que no hay medida.
select '0074 - la tasa lee las medidas del cuerpo', 'el export de la tasa lee cinturaCm y caderasCm',
       case when to_regprocedure('public.tasa_contra_el_plan_export()') is null then 'NO'
            when pg_get_functiondef(to_regprocedure('public.tasa_contra_el_plan_export()')) like '%caderasCm%' then 'SI'
            else 'NO' end


union all
-- La 0075: la revision clinica que vence. En riesgo medio el plan ya no se para: se programa y se
-- le pregunta a la persona, y esta tabla guarda cuando se vuelve a mirar. Se pide lo que la hace
-- segura, no solo que exista: RLS encendida, anon sin lectura (lleva la pregunta clinica), y que
-- la mesa del sabado la lea. El orden del case importa: preguntar privilegios sobre una tabla que
-- no existe revienta en vez de decir NO.
select '0075 - la revision clinica que vence', 'la tabla existe con RLS, anon no la lee y la mesa exporta la revision abierta',
       case when to_regclass('public.reevaluaciones_clinicas') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c
                       where c.oid = to_regclass('public.reevaluaciones_clinicas')) then 'NO'
            when has_table_privilege('anon', 'public.reevaluaciones_clinicas', 'select') then 'NO'
            when to_regprocedure('public.mesa_del_sabado()') is null then 'NO'
            when pg_get_functiondef(to_regprocedure('public.mesa_del_sabado()')) like '%reevaluaciones_clinicas%' then 'SI'
            else 'NO' end


union all
-- La 0076: el export de la tasa trae el RPE de sesion y el dolor de los check-ins. Sin ella, un
-- plan con techo de RPE o con «cero dolor» nunca tiene desvio contra su meta.
select '0076 - la tasa lee el rpe y el dolor', 'el export de la tasa lee testPost.rpeSesion y el dolor del check-in',
       case when to_regprocedure('public.tasa_contra_el_plan_export()') is null then 'NO'
            when pg_get_functiondef(to_regprocedure('public.tasa_contra_el_plan_export()')) like '%rpeSesion%'
             and pg_get_functiondef(to_regprocedure('public.tasa_contra_el_plan_export()')) like '%dolores%' then 'SI'
            else 'NO' end

union all
-- La 0077: el cribado vuelve a guardarse. La 0062 perdio los ::boolean de los tres parq_* y
-- contestar_cribado() revento con 42883 para todo el mundo: cero cribados de la app en la base.
-- Se pide el cast EN LA COMPARACION del duplicado, que es lo que la 0062 rompio (el insert sin
-- cast tambien fallaria, pero la comparacion revienta antes), y que anon siga sin llamarla.
select '0077 - el cribado vuelve a guardarse', 'contestar_cribado compara los parq_* como boolean y anon no la llama',
       case when to_regprocedure('public.contestar_cribado(jsonb)') is null then 'NO'
            when has_function_privilege('anon', 'public.contestar_cribado(jsonb)', 'execute') then 'NO'
            when pg_get_functiondef(to_regprocedure('public.contestar_cribado(jsonb)'))
                 like '%is not distinct from (p_cribado->>''parq_enfermedad_cardiaca'')::boolean%' then 'SI'
            else 'NO' end

union all
-- La 0078: la app cuenta lo que le falla. Del 10 al 12-sep el cribado fallo para todo el mundo y
-- nadie se entero; esta tabla recoge los errores del navegador de cada persona. Se pide lo que la
-- hace segura, no solo que exista: RLS encendida, anon sin nada, que un asesorado no pueda
-- reescribir ni borrar (sin privilegio), que el insert exija su propio uid y que la lectura sea
-- del coach. Sin la 0078 dice NO en la primera rama; con una politica `with check (true)` dice NO
-- en la del insert. El orden importa: preguntar privilegios sobre una tabla que no existe revienta.
select '0078 - la app cuenta lo que le falla', 'la tabla existe con RLS, anon no la toca, nadie la reescribe, cada uno inserta lo suyo y lee el coach',
       case when to_regclass('public.errores_navegador') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c
                       where c.oid = to_regclass('public.errores_navegador')) then 'NO'
            when has_table_privilege('anon', 'public.errores_navegador', 'select')
              or has_table_privilege('anon', 'public.errores_navegador', 'insert') then 'NO'
            when has_table_privilege('authenticated', 'public.errores_navegador', 'update')
              or has_table_privilege('authenticated', 'public.errores_navegador', 'delete') then 'NO'
            when not exists (select 1 from pg_policies
                              where schemaname = 'public' and tablename = 'errores_navegador'
                                and cmd = 'INSERT' and with_check like '%auth.uid()%') then 'NO'
            when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'errores_navegador'
                            and cmd in ('SELECT', 'ALL') and qual not like '%es_coach()%') then 'NO'
            when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'errores_navegador'
                            and cmd = 'SELECT' and qual like '%es_coach()%') then 'SI'
            else 'NO' end

union all
-- La 0080: el yogur griego existe en la base. La app lo ofrece desde el 16-ago (#62) y
-- `registro_item.alimento_id` lo rechazaba por su clave ajena: el registro de comida no se
-- guardaba. Sin la 0080 dice NO; con solo uno de los dos, tambien.
select '0080 - el yogur griego existe', 'los dos yogures griegos del catalogo de la app estan en public.alimentos',
       case when (select count(*) from public.alimentos
                   where id in ('yogur-griego-entero', 'yogur-griego-descremado')) = 2 then 'SI'
            else 'NO' end

union all
select '0081 - firma de revision por version', 'RPC de coach y trigger de version presentes; anon sin permiso',
       case when to_regprocedure('public.decidir_revision_semanal(uuid,date,integer,boolean,text)') is null then 'NO'
            when has_function_privilege('anon', 'public.decidir_revision_semanal(uuid,date,integer,boolean,text)', 'execute') then 'NO'
            when not has_function_privilege('authenticated', 'public.decidir_revision_semanal(uuid,date,integer,boolean,text)', 'execute') then 'NO'
            when pg_get_functiondef(to_regprocedure('public.decidir_revision_semanal(uuid,date,integer,boolean,text)')) not like '%es_coach()%' then 'NO'
            when exists (select 1 from pg_trigger where tgname = 'versionar_revision_semanal'
                          and tgrelid = to_regclass('public.videos_semanales') and tgenabled <> 'D' and not tgisinternal) then 'SI'
            else 'NO' end

union all
-- La 0082: el cajon medios-app admite hasta 150 MB, a la par de TOPE_BYTES del dominio
-- (src/domain/video/publicacion.ts, PR #299). Sin ella el bucket cae al limite global del
-- proyecto y rechaza las revisiones LARGAS de 76-96 MB antes de llegar al tope del codigo.
select '0082 - el cajon de medios admite revisiones largas', 'file_size_limit de medios-app es 150 MB (157286400 bytes)',
       case when (select file_size_limit from storage.buckets where id = 'medios-app') = 150 * 1024 * 1024 then 'SI'
            else 'NO' end

union all
-- La 0083: capa de servidor de la consola del coach. capacidades_staff + tiene_capacidad(),
-- SECURITY DEFINER con search_path fijo, y anon sin nada. Sin esto ninguna politica de las
-- de abajo tiene puerta que consultar.
select '0083 - capacidades del staff', 'capacidades_staff con RLS, tiene_capacidad() security definer con search_path fijo y anon sin acceso',
       case when to_regclass('public.capacidades_staff') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.capacidades_staff')) then 'NO'
            when has_table_privilege('anon', 'public.capacidades_staff', 'select') then 'NO'
            when to_regprocedure('public.tiene_capacidad(text)') is null then 'NO'
            when has_function_privilege('anon', 'public.tiene_capacidad(text)', 'execute') then 'NO'
            when pg_get_functiondef(to_regprocedure('public.tiene_capacidad(text)')) not like '%search_path = public%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.tiene_capacidad(text)')) not like '%SECURITY DEFINER%' then 'NO'
            else 'SI' end

union all
-- La 0083: cadena_corridas es proyeccion de lectura. event_id unico (idempotencia del
-- evento, Q4 de Astra), RLS encendida y anon sin nada: la escribe solo service_role.
select '0083 - cadena_corridas es proyeccion de solo lectura', 'RLS encendida, anon sin acceso y event_id UNIQUE',
       case when to_regclass('public.cadena_corridas') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.cadena_corridas')) then 'NO'
            when has_table_privilege('anon', 'public.cadena_corridas', 'select')
              or has_table_privilege('anon', 'public.cadena_corridas', 'insert') then 'NO'
            when not exists (
                   select 1 from pg_constraint
                    where conrelid = to_regclass('public.cadena_corridas')
                      and contype = 'u'
                      and conkey = array[(select attnum from pg_attribute
                                           where attrelid = to_regclass('public.cadena_corridas')
                                             and attname = 'event_id')]
                 ) then 'NO'
            else 'SI' end

union all
-- La 0083: un unico plan_estrategico vigente por persona, forzado por indice unico
-- PARCIAL (mismo patron que 0069_un_solo_microciclo_activo). Sin el `where vigente` el
-- indice restringiria tambien al historial, que si puede tener muchas filas por persona.
select '0083 - un solo plan estrategico vigente por persona', 'indice unico parcial planes_estrategicos_un_vigente_por_persona con predicado vigente',
       case when not exists (
              select 1 from pg_indexes
               where schemaname = 'public' and tablename = 'planes_estrategicos'
                 and indexname = 'planes_estrategicos_un_vigente_por_persona'
                 and indexdef like '%WHERE (vigente)%'
            ) then 'NO'
            else 'SI' end

union all
-- La 0083: aprobaciones. La firma SSH se verifica FUERA de la base; el navegador no puede
-- insertar bajo ninguna circunstancia -- se pide el PRIVILEGIO efectivo de insert para
-- `authenticated`, no que exista o no una politica (la leccion de la 0013: preguntar por
-- una politica con ese nombre sobrevive a que la migracion nunca se aplicara).
select '0083 - aprobaciones solo las escribe el servidor', 'RLS encendida, anon sin nada y authenticated SIN privilegio de insert/update/delete',
       case when to_regclass('public.aprobaciones') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.aprobaciones')) then 'NO'
            when has_table_privilege('anon', 'public.aprobaciones', 'select')
              or has_table_privilege('anon', 'public.aprobaciones', 'insert') then 'NO'
            when has_table_privilege('authenticated', 'public.aprobaciones', 'insert')
              or has_table_privilege('authenticated', 'public.aprobaciones', 'update')
              or has_table_privilege('authenticated', 'public.aprobaciones', 'delete') then 'NO'
            else 'SI' end

union all
-- La 0083: responder_como_staff() acredita el actor desde auth.uid(), nunca desde un
-- parametro (Q2 de Astra). Se pide que exista, que anon no la llame, que authenticated si
-- pueda, y que el cuerpo compruebe tiene_capacidad -- no solo que la funcion exista.
select '0083 - responder_como_staff no deja falsificar el actor', 'función presente, anon sin ejecutar, authenticated sí, y el cuerpo comprueba tiene_capacidad',
       case when to_regprocedure('public.responder_como_staff(text,jsonb)') is null then 'NO'
            when has_function_privilege('anon', 'public.responder_como_staff(text,jsonb)', 'execute') then 'NO'
            when not has_function_privilege('authenticated', 'public.responder_como_staff(text,jsonb)', 'execute') then 'NO'
            when pg_get_functiondef(to_regprocedure('public.responder_como_staff(text,jsonb)')) not like '%tiene_capacidad(''responder_por_asesorado'')%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.responder_como_staff(text,jsonb)')) not like '%search_path = public%' then 'NO'
            else 'SI' end

union all
-- La 0083: RLS aditiva por capacidad en las tablas existentes -- se pide que la politica
-- NUEVA exista (por nombre, que aqui SI es fiable porque se compara contra las 0001/0006
-- que no usan estos nombres) sin comprobar que las viejas sigan ahi: esa garantia la da
-- Postgres solo con CREATE POLICY (nunca hay un DROP POLICY de las anteriores en la 0083),
-- y por eso no hace falta repetirla aqui.
select '0083 - leer_entrenamiento amplia (no sustituye) microciclos/checkins/cuestionarios', 'las cuatro políticas nuevas existen',
       case when (
              select count(*) from pg_policies
               where schemaname = 'public'
                 and (
                   (tablename = 'microciclos'   and policyname = 'microciclos_lee_capacidad') or
                   (tablename = 'checkins'      and policyname = 'checkins_lee_capacidad') or
                   (tablename = 'cuestionarios' and policyname = 'cuestionarios_lee_capacidad') or
                   (tablename = 'respuestas'    and policyname = 'respuestas_lee_capacidad')
                 )
            ) = 4 then 'SI' else 'NO' end

union all
-- La 0084: ordenes.tipo admite reanudar y preparar_firma -- se pide el CHECK real (no un
-- nombre de restriccion adivinado; la migracion la localiza por definicion antes de
-- reemplazarla, por la misma razon).
select '0084 - ordenes.tipo admite reanudar y preparar_firma', 'CHECK de la columna tipo contiene los dos valores nuevos',
       case when not exists (
              select 1 from pg_constraint
               where conrelid = to_regclass('public.ordenes')
                 and contype = 'c'
                 and pg_get_constraintdef(oid) ilike '%reanudar%'
                 and pg_get_constraintdef(oid) ilike '%preparar_firma%'
            ) then 'NO' else 'SI' end

union all
-- La 0084: reanudar exige la MISMA capacidad que detener (decision de Bryan) y
-- preparar_firma exige leer_entrenamiento -- se pide la expresion real de la politica de
-- alta, no solo que exista una politica con ese nombre (la leccion de la 0013).
select '0084 - ordenes: reanudar y preparar_firma piden su capacidad, no cualquier sesion', 'policy ordenes_crear_segun_capacidad menciona las dos capacidades junto a sus tipos',
       case when not exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'ordenes'
                 and policyname = 'ordenes_crear_segun_capacidad'
                 and with_check ilike '%reanudar%' and with_check ilike '%detener_publicacion%'
                 and with_check ilike '%preparar_firma%' and with_check ilike '%leer_entrenamiento%'
            ) then 'NO' else 'SI' end

union all
-- La 0084: casos_firma -- RLS encendida, anon sin nada y authenticated SIN privilegio de
-- escritura (la escribe el equipo de mesa con service_role; el unico avance desde el
-- navegador pasa por la RPC de abajo, security definer).
select '0084 - casos_firma con RLS y sin escritura para authenticated', 'RLS encendida, anon sin acceso, authenticated solo con select',
       case when to_regclass('public.casos_firma') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.casos_firma')) then 'NO'
            when has_table_privilege('anon', 'public.casos_firma', 'select')
              or has_table_privilege('anon', 'public.casos_firma', 'insert') then 'NO'
            when has_table_privilege('authenticated', 'public.casos_firma', 'insert')
              or has_table_privilege('authenticated', 'public.casos_firma', 'update')
              or has_table_privilege('authenticated', 'public.casos_firma', 'delete') then 'NO'
            when not has_table_privilege('authenticated', 'public.casos_firma', 'select') then 'NO'
            else 'SI' end

union all
-- La 0084 (ajuste del equipo de mesa, tras la primera version): tipo es NULLABLE, y el
-- CHECK exige que un tipo NULL vaya SIEMPRE con estado = rechazado -- un caso a medio
-- llenar (preparando/listo_para_firmar/firmado/verificado sin tipo) no puede colarse.
select '0084 - casos_firma.tipo nulo exige estado rechazado', 'CHECK exige tipo in (retiro,recorte) o (tipo is null and estado = rechazado)',
       case when not exists (
              select 1 from pg_constraint
               where conrelid = to_regclass('public.casos_firma')
                 and contype = 'c'
                 and pg_get_constraintdef(oid) ilike '%tipo%is null%'
                 and pg_get_constraintdef(oid) ilike '%rechazado%'
            ) then 'NO' else 'SI' end

union all
-- La 0084: el bucket firmas existe y es PRIVADO -- son decisiones clinicas de una
-- persona concreta, mismo motivo que medios-app (0061).
select '0084 - bucket firmas privado', 'storage.buckets.public = false para el id firmas',
       case when not exists (
              select 1 from storage.buckets where id = 'firmas' and public = false
            ) then 'NO' else 'SI' end

union all
-- La 0084: el navegador solo puede SUBIR un .sig (nunca el .json, nunca reemplazar nada
-- ya subido) -- se pide la expresion real del with_check de la politica de insert, y que
-- no exista ninguna politica de UPDATE sobre storage.objects para este bucket.
select '0084 - firmas: sube solo .sig y nunca reemplaza', 'policy de insert exige name like %.sig, y no hay politica de update para el bucket firmas',
       case when not exists (
              select 1 from pg_policies
               where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'firmas: sube solo la firma .sig'
                 and cmd = 'INSERT'
                 and with_check ilike '%.sig%' and with_check ilike '%firmas%'
            ) then 'NO'
            when exists (
              select 1 from pg_policies
               where schemaname = 'storage' and tablename = 'objects'
                 and cmd = 'UPDATE'
                 and (qual ilike '%firmas%' or with_check ilike '%firmas%')
            ) then 'NO'
            else 'SI' end

union all
-- La 0084: registrar_firma() acredita el actor desde auth.uid(), exige la capacidad y
-- comprueba el estado del caso -- igual que responder_como_staff en la 0083, se pide el
-- cuerpo real de la funcion, no solo que exista.
select '0084 - registrar_firma no deja falsificar el actor ni saltarse el estado', 'función presente, anon sin ejecutar, authenticated sí, search_path fijo y el cuerpo exige listo_para_firmar',
       case when to_regprocedure('public.registrar_firma(uuid)') is null then 'NO'
            when has_function_privilege('anon', 'public.registrar_firma(uuid)', 'execute') then 'NO'
            when not has_function_privilege('authenticated', 'public.registrar_firma(uuid)', 'execute') then 'NO'
            when pg_get_functiondef(to_regprocedure('public.registrar_firma(uuid)')) not like '%auth.uid()%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.registrar_firma(uuid)')) not like '%search_path = public%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.registrar_firma(uuid)')) not like '%SECURITY DEFINER%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.registrar_firma(uuid)')) not like '%listo_para_firmar%' then 'NO'
            else 'SI' end

union all
-- La 0085: la consola lee `perfiles` y `cribado` por capacidad. SOLO lectura: si alguna
-- de las dos politicas no fuera `for select`, abriria escritura a staff.
select '0085 - la consola lee ficha y cribado por capacidad', 'perfiles_lee_capacidad y cribado_lee_capacidad existen, son SELECT y consultan leer_entrenamiento',
       case when (select count(*) from pg_policies
                   where schemaname = 'public'
                     and (tablename, policyname) in (('perfiles', 'perfiles_lee_capacidad'), ('cribado', 'cribado_lee_capacidad'))
                     and cmd = 'SELECT'
                     and qual ilike '%tiene_capacidad%leer_entrenamiento%') = 2 then 'SI'
            else 'NO' end

union all
-- La 0086: capacidad nueva aprobar_primer_plan en el CHECK de capacidades_staff.
select '0086 - capacidad aprobar_primer_plan', 'CHECK de capacidades_staff la admite',
       case when exists (
              select 1 from pg_constraint
               where conrelid = to_regclass('public.capacidades_staff')
                 and contype = 'c'
                 and pg_get_constraintdef(oid) ilike '%aprobar_primer_plan%'
            ) then 'SI' else 'NO' end

union all
-- La 0086: aprobaciones_primer_plan con RLS y SIN escritura para authenticated (lección
-- de la 0084): se decide solo por la RPC.
select '0086 - aprobaciones_primer_plan con RLS y sin escritura para authenticated', 'RLS encendida, anon sin acceso, authenticated solo con select',
       case when to_regclass('public.aprobaciones_primer_plan') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.aprobaciones_primer_plan')) then 'NO'
            when has_table_privilege('anon', 'public.aprobaciones_primer_plan', 'select') then 'NO'
            when has_table_privilege('authenticated', 'public.aprobaciones_primer_plan', 'insert')
              or has_table_privilege('authenticated', 'public.aprobaciones_primer_plan', 'update')
              or has_table_privilege('authenticated', 'public.aprobaciones_primer_plan', 'delete') then 'NO'
            when not has_table_privilege('authenticated', 'public.aprobaciones_primer_plan', 'select') then 'NO'
            else 'SI' end

union all
-- La 0086: decidir_primer_plan acredita el actor con auth.uid() y reserva el riesgo alto a
-- autorizar_excepcion; vencer_primer_plan solo para service_role.
select '0086 - decidir_primer_plan y vencer_primer_plan', 'RPC con auth.uid(), search_path fijo, alto reservado a autorizar_excepcion; vencer sin authenticated',
       case when to_regprocedure('public.decidir_primer_plan(uuid,text,text)') is null then 'NO'
            when to_regprocedure('public.vencer_primer_plan()') is null then 'NO'
            when has_function_privilege('anon', 'public.decidir_primer_plan(uuid,text,text)', 'execute') then 'NO'
            when has_function_privilege('authenticated', 'public.vencer_primer_plan()', 'execute') then 'NO'
            when pg_get_functiondef(to_regprocedure('public.decidir_primer_plan(uuid,text,text)')) not like '%auth.uid()%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.decidir_primer_plan(uuid,text,text)')) not like '%search_path = public%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.decidir_primer_plan(uuid,text,text)')) not like '%autorizar_excepcion%' then 'NO'
            else 'SI' end
union all
-- La 0087: planes_estrategicos.estado coherente con vigente, y el asesorado sin borradores.
select '0087 - planes_estrategicos.estado coherente y sin borradores para el asesorado', 'columna estado not null, check (estado = vigente) = vigente, politica filtra por estado, authenticated sin escritura',
       case when not exists (select 1 from information_schema.columns
                              where table_schema = 'public' and table_name = 'planes_estrategicos'
                                and column_name = 'estado' and is_nullable = 'NO') then 'NO'
            when not exists (select 1 from pg_constraint
                              where conrelid = to_regclass('public.planes_estrategicos')
                                and conname = 'planes_estrategicos_estado_coherente') then 'NO'
            when not exists (select 1 from pg_policies
                              where schemaname = 'public' and tablename = 'planes_estrategicos'
                                and policyname = 'planes_estrategicos_leer'
                                and qual ilike '%estado%vigente%reemplazado%') then 'NO'
            when has_table_privilege('authenticated', 'public.planes_estrategicos', 'update')
              or has_table_privilege('authenticated', 'public.planes_estrategicos', 'insert') then 'NO'
            else 'SI' end

union all
-- La 0087: capacidad nueva aprobar_plan_estrategico en el CHECK de capacidades_staff.
select '0087 - capacidad aprobar_plan_estrategico', 'CHECK de capacidades_staff la admite (y conserva aprobar_primer_plan)',
       case when exists (
              select 1 from pg_constraint
               where conrelid = to_regclass('public.capacidades_staff')
                 and contype = 'c'
                 and pg_get_constraintdef(oid) ilike '%aprobar_plan_estrategico%'
                 and pg_get_constraintdef(oid) ilike '%aprobar_primer_plan%'
            ) then 'SI' else 'NO' end

union all
-- La 0087: aprobaciones_plan_estrategico con RLS y SIN escritura para authenticated.
select '0087 - aprobaciones_plan_estrategico con RLS y sin escritura para authenticated', 'RLS encendida, anon sin acceso, authenticated solo con select',
       case when to_regclass('public.aprobaciones_plan_estrategico') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.aprobaciones_plan_estrategico')) then 'NO'
            when has_table_privilege('anon', 'public.aprobaciones_plan_estrategico', 'select') then 'NO'
            when has_table_privilege('authenticated', 'public.aprobaciones_plan_estrategico', 'insert')
              or has_table_privilege('authenticated', 'public.aprobaciones_plan_estrategico', 'update')
              or has_table_privilege('authenticated', 'public.aprobaciones_plan_estrategico', 'delete') then 'NO'
            when not has_table_privilege('authenticated', 'public.aprobaciones_plan_estrategico', 'select') then 'NO'
            else 'SI' end

union all
-- La 0087: decidir_plan_estrategico acredita el actor con auth.uid() y reserva alto/clínico a
-- autorizar_excepcion; vencer y encender no son para authenticated.
select '0087 - decidir_plan_estrategico y vencer_plan_estrategico', 'RPC con auth.uid(), search_path fijo, alto/clinico reservado a autorizar_excepcion; vencer y encender sin authenticated',
       case when to_regprocedure('public.decidir_plan_estrategico(uuid,text,text)') is null then 'NO'
            when to_regprocedure('public.vencer_plan_estrategico()') is null then 'NO'
            when to_regprocedure('public.encender_plan_estrategico(uuid,text)') is null then 'NO'
            when has_function_privilege('anon', 'public.decidir_plan_estrategico(uuid,text,text)', 'execute') then 'NO'
            when has_function_privilege('authenticated', 'public.vencer_plan_estrategico()', 'execute') then 'NO'
            when has_function_privilege('authenticated', 'public.encender_plan_estrategico(uuid,text)', 'execute') then 'NO'
            when pg_get_functiondef(to_regprocedure('public.decidir_plan_estrategico(uuid,text,text)')) not like '%auth.uid()%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.decidir_plan_estrategico(uuid,text,text)')) not like '%search_path = public%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.decidir_plan_estrategico(uuid,text,text)')) not like '%autorizar_excepcion%' then 'NO'
            when pg_get_functiondef(to_regprocedure('public.decidir_plan_estrategico(uuid,text,text)')) not like '%clinico%' then 'NO'
            else 'SI' end

union all
-- La 0088: tarjetas_vida con RLS, el dueño inserta/lee la suya, y ANON sin acceso.
select '0088 - tarjetas_vida con RLS y el dueño puede insertar/leer la suya', 'RLS encendida, anon sin acceso, authenticated con select e insert',
       case when to_regclass('public.tarjetas_vida') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.tarjetas_vida')) then 'NO'
            when has_table_privilege('anon', 'public.tarjetas_vida', 'select') then 'NO'
            when not has_table_privilege('authenticated', 'public.tarjetas_vida', 'select') then 'NO'
            when not has_table_privilege('authenticated', 'public.tarjetas_vida', 'insert') then 'NO'
            else 'SI' end

union all
-- La 0088: tarjetas_vida NO tiene política de UPDATE ni de DELETE — una tarjeta
-- respondida no se pisa desde el navegador, aunque `authenticated` tenga el privilegio de
-- tabla (Postgres exige además una policy aplicable, o el comando no toca ninguna fila).
select '0088 - tarjetas_vida sin policy de update ni de delete', 'ninguna policy con cmd update o delete sobre tarjetas_vida',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'tarjetas_vida' and cmd in ('UPDATE', 'DELETE', 'ALL')
       ) then 'NO' else 'SI' end

union all
-- La 0088: la política de insert exige que usuario_id sea quien llama (auth.uid()), no un
-- parámetro — la misma trampa de suplantación que ya se comprueba en `responder_como_staff`.
select '0088 - tarjetas_vida_insertar_propia exige auth.uid()', 'el with_check de la policy de insert menciona auth.uid()',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'tarjetas_vida'
            and policyname = 'tarjetas_vida_insertar_propia' and cmd = 'INSERT'
            and coalesce(with_check, '') like '%auth.uid()%'
       ) then 'SI' else 'NO' end

union all
-- La 0088: única por persona y semana — dos respuestas de la misma semana son un
-- conflicto de aplicación, no dos hechos distintos.
select '0088 - tarjetas_vida única por usuario y semana', 'constraint unique (usuario_id, semana_inicio)',
       case when exists (
         select 1 from pg_constraint c
          join pg_class t on t.oid = c.conrelid
         where t.relname = 'tarjetas_vida' and c.contype = 'u'
           and c.conkey = (
             select array_agg(a.attnum order by a.attnum)
               from pg_attribute a
              where a.attrelid = t.oid and a.attname in ('usuario_id', 'semana_inicio')
           )
       ) then 'SI' else 'NO' end

union all
-- La 0088: mensajes_vida con RLS y CERRADA a anon; authenticated sin ningún privilegio de
-- escritura — solo service_role inserta y actualiza enviado_en/detenido_en.
select '0088 - mensajes_vida con RLS, sin escritura para authenticated, anon sin acceso', 'RLS encendida, anon sin select, authenticated solo con select',
       case when to_regclass('public.mensajes_vida') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.mensajes_vida')) then 'NO'
            when has_table_privilege('anon', 'public.mensajes_vida', 'select') then 'NO'
            when has_table_privilege('authenticated', 'public.mensajes_vida', 'insert')
              or has_table_privilege('authenticated', 'public.mensajes_vida', 'update')
              or has_table_privilege('authenticated', 'public.mensajes_vida', 'delete') then 'NO'
            when not has_table_privilege('authenticated', 'public.mensajes_vida', 'select') then 'NO'
            else 'SI' end

union all
-- La 0088: la política de lectura de mensajes_vida exige dueño, ventana cumplida y no
-- detenido — las tres condiciones en el mismo `using`, no repartidas entre la base y la
-- app (que es justo lo que dejaría fugar un mensaje "detenido" a quien mire con curl).
select '0088 - mensajes_vida_leer exige dueño, enviar_despues_de y detenido_en', 'el using de la policy de select menciona las tres condiciones',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'mensajes_vida'
            and policyname = 'mensajes_vida_leer' and cmd = 'SELECT'
            and coalesce(qual, '') like '%auth.uid()%'
            and coalesce(qual, '') like '%enviar_despues_de%'
            and coalesce(qual, '') like '%detenido_en%'
       ) then 'SI' else 'NO' end
union all
-- La 0089: el formulario público de interesados solo INSERTA; anon nunca lee.
select '0089 - formulario de interesados: anon inserta y no lee', 'RLS en piloto_encaje_respuestas y piloto_autorizaciones, anon con insert y sin select/update/delete',
       case when to_regclass('public.piloto_encaje_respuestas') is null
              or to_regclass('public.piloto_autorizaciones') is null then 'NO'
            when exists (select 1 from pg_class c
                          where c.oid in (to_regclass('public.piloto_encaje_respuestas'), to_regclass('public.piloto_autorizaciones'))
                            and not c.relrowsecurity) then 'NO'
            when not has_table_privilege('anon', 'public.piloto_encaje_respuestas', 'insert')
              or not has_table_privilege('anon', 'public.piloto_autorizaciones', 'insert') then 'NO'
            when has_table_privilege('anon', 'public.piloto_encaje_respuestas', 'select')
              or has_table_privilege('anon', 'public.piloto_autorizaciones', 'select')
              or has_table_privilege('anon', 'public.piloto_encaje_respuestas', 'update')
              or has_table_privilege('anon', 'public.piloto_autorizaciones', 'delete') then 'NO'
            when exists (select 1 from pg_policies
                          where schemaname = 'public'
                            and tablename in ('piloto_encaje_respuestas', 'piloto_autorizaciones')
                            and cmd in ('SELECT', 'ALL') and 'anon' = any(roles)) then 'NO'
            else 'SI' end

union all
-- La 0089: la evidencia solo entra con el texto vigente y la fecha la pone el servidor.
select '0089 - piloto_autorizaciones exige la version 0.3 y fecha del servidor', 'with_check de la policy de insert menciona 0.3 y existe el trigger de fecha',
       case when not exists (select 1 from pg_policies
                              where schemaname = 'public' and tablename = 'piloto_autorizaciones'
                                and policyname = 'piloto_autorizacion_insertar_formulario'
                                and coalesce(with_check, '') like '%0.3%') then 'NO'
            when not exists (select 1 from pg_trigger
                              where tgname = 'trg_piloto_autorizacion_fecha' and not tgisinternal) then 'NO'
            else 'SI' end

union all
-- La 0089: la hoja del piloto, cerrada a anon y con RLS en sus siete tablas.
select '0089 - hoja del piloto con RLS y sin nada para anon', 'RLS en las 7 tablas piloto_ de la hoja y anon sin select ni insert',
       case when (select count(*) from pg_class c
                   where c.oid in (to_regclass('public.piloto_codigos'), to_regclass('public.piloto_interesados'),
                                   to_regclass('public.piloto_clientes'), to_regclass('public.piloto_cobros'),
                                   to_regclass('public.piloto_eventos'), to_regclass('public.piloto_saldos_por_recuperar'),
                                   to_regclass('public.piloto_avisos_creador'))
                     and c.relrowsecurity) <> 7 then 'NO'
            when has_table_privilege('anon', 'public.piloto_codigos', 'select')
              or has_table_privilege('anon', 'public.piloto_interesados', 'select')
              or has_table_privilege('anon', 'public.piloto_clientes', 'select')
              or has_table_privilege('anon', 'public.piloto_cobros', 'select')
              or has_table_privilege('anon', 'public.piloto_eventos', 'insert')
              or has_table_privilege('anon', 'public.piloto_saldos_por_recuperar', 'select')
              or has_table_privilege('anon', 'public.piloto_avisos_creador', 'select') then 'NO'
            else 'SI' end

union all
-- La 0089: piloto_eventos es de solo añadir — sin policy de update/delete y con el trigger.
select '0089 - piloto_eventos solo se anade', 'ninguna policy update/delete/all y existe el trigger que bloquea el update',
       case when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'piloto_eventos'
                            and cmd in ('UPDATE', 'DELETE', 'ALL')) then 'NO'
            when not exists (select 1 from pg_trigger
                              where tgname = 'trg_piloto_eventos_solo_se_anaden' and not tgisinternal) then 'NO'
            else 'SI' end
union all
-- La 0089: la purga semanal de encaje existe, no la puede llamar el navegador y está programada.
select '0089 - piloto_purgar_encaje sin execute para anon/authenticated y programada', 'la funcion existe, anon y authenticated sin execute, trabajo piloto-purgar-encaje en cron.job',
       case when to_regprocedure('public.piloto_purgar_encaje()') is null then 'NO'
            when has_function_privilege('anon', 'public.piloto_purgar_encaje()', 'execute')
              or has_function_privilege('authenticated', 'public.piloto_purgar_encaje()', 'execute') then 'NO'
            when to_regclass('cron.job') is null then 'NO'
            else 'SI' end
union all
-- La 0090: las tres tablas del tablero de creadores con RLS, anon sin nada y authenticated
-- SOLO con select (el importador escribe con service_role).
select '0090 - tablero de creadores: RLS, anon sin acceso, authenticated solo lee', 'las 3 tablas creadores_* con RLS; anon sin select; authenticated con select y sin insert/update/delete',
       case when exists (
         select 1 from unnest(array['public.creadores_candidatos', 'public.creadores_revisiones', 'public.creadores_eventos']) t(tabla)
          where to_regclass(t.tabla) is null
             or not (select c.relrowsecurity from pg_class c where c.oid = to_regclass(t.tabla))
             or has_table_privilege('anon', t.tabla, 'select')
             or not has_table_privilege('authenticated', t.tabla, 'select')
             or has_table_privilege('authenticated', t.tabla, 'insert')
             or has_table_privilege('authenticated', t.tabla, 'update')
             or has_table_privilege('authenticated', t.tabla, 'delete')
       ) then 'NO' else 'SI' end
union all
-- La 0090: el check de capacidades admite revisar_creadores y firmar_creadores SIN perder
-- ninguna de las 8 anteriores.
select '0090 - capacidades revisar_creadores y firmar_creadores', 'el check de capacidades_staff contiene las 10',
       case when (select count(*) from unnest(array['leer_entrenamiento', 'responder_por_asesorado', 'detener_publicacion',
                    'reportar_riesgo', 'autorizar_excepcion', 'firmar_politica', 'aprobar_primer_plan',
                    'aprobar_plan_estrategico', 'revisar_creadores', 'firmar_creadores']) cap
                   where exists (select 1 from pg_constraint
                                  where conrelid = 'public.capacidades_staff'::regclass and contype = 'c'
                                    and pg_get_constraintdef(oid) like '%' || cap || '%')) = 10
            then 'SI' else 'NO' end
union all
-- La 0090: el bucket de las hojas de cuadros es privado.
select '0090 - bucket creadores-cuadros privado', 'storage.buckets creadores-cuadros con public = false',
       case when exists (select 1 from storage.buckets where id = 'creadores-cuadros' and public = false)
            then 'SI' else 'NO' end
union all
-- La 0091: la unicidad de creadores_revisiones incluye al creador.
select '0091 - creadores_revisiones única por (revision_id, creador_id, revisor, rol_reel)', 'constraint creadores_revisiones_unica_por_creador y sin el unique viejo sin creador',
       case when exists (select 1 from pg_constraint where conname = 'creadores_revisiones_unica_por_creador' and contype = 'u')
             and not exists (select 1 from pg_constraint where conname = 'creadores_revisiones_revision_id_revisor_rol_reel_key')
            then 'SI' else 'NO' end
union all
-- La 0092: el bucket de las hojas de cuadros existe y es privado aunque ya existiera
-- público antes de la 0090 (su `on conflict do nothing` no lo cambiaba).
select '0092 - bucket creadores-cuadros forzado a privado', 'storage.buckets creadores-cuadros existe y public = false (ninguno público con ese id)',
       case when exists (select 1 from storage.buckets where id = 'creadores-cuadros')
             and not exists (select 1 from storage.buckets where id = 'creadores-cuadros' and public is distinct from false)
            then 'SI' else 'NO' end
union all
-- La 0094: decisiones con RLS, anon sin nada y authenticated SOLO con select (escribe la
-- función anotar_decision, que anon no ejecuta), y la vista con su estado.
select '0094 - decisiones compartidas: RLS, solo lee authenticated, funciones cerradas a anon', 'decisiones con RLS; anon sin select; authenticated solo select; anotar_decision y firmar_decision sin execute para anon; vista decisiones_con_estado',
       case when to_regclass('public.decisiones') is null or to_regclass('public.decisiones_con_estado') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.decisiones')) then 'NO'
            when has_table_privilege('anon', 'public.decisiones', 'select')
              or has_table_privilege('anon', 'public.decisiones_con_estado', 'select') then 'NO'
            when not has_table_privilege('authenticated', 'public.decisiones', 'select')
              or has_table_privilege('authenticated', 'public.decisiones', 'insert')
              or has_table_privilege('authenticated', 'public.decisiones', 'update')
              or has_table_privilege('authenticated', 'public.decisiones', 'delete') then 'NO'
            when to_regprocedure('public.firmar_decision(uuid,text,text)') is null
              or has_function_privilege('anon', 'public.firmar_decision(uuid,text,text)', 'execute')
              or has_function_privilege('anon', 'public.anotar_decision(text,text,text,text,text,bigint,text,date,date,text,text,text,text,text,text,date,uuid,text,date)', 'execute') then 'NO'
            else 'SI' end
union all
select '0094 - capacidad decisiones_compartidas sin perder las anteriores', 'el check de capacidades_staff contiene decisiones_compartidas y las 10 de la 0090',
       case when (select count(*) from unnest(array['leer_entrenamiento', 'responder_por_asesorado', 'detener_publicacion',
                    'reportar_riesgo', 'autorizar_excepcion', 'firmar_politica', 'aprobar_primer_plan',
                    'aprobar_plan_estrategico', 'revisar_creadores', 'firmar_creadores', 'decisiones_compartidas']) cap
                   where exists (select 1 from pg_constraint
                                  where conrelid = 'public.capacidades_staff'::regclass and contype = 'c'
                                    and pg_get_constraintdef(oid) like '%' || cap || '%')) = 11
            then 'SI' else 'NO' end
union all
-- La 0095: comentarios con RLS, anon sin nada, authenticated sin insert/update/delete, la
-- vista mis_comentarios sin campos internos y la purga cerrada a las sesiones.
select '0095 - comentarios de la app: RLS, escribe solo la función, mis_comentarios sin campos internos', 'comentarios_app con RLS; anon sin select; authenticated sin insert/update/delete; enviar_comentario sin execute para anon; mis_comentarios sin contrato_id',
       case when to_regclass('public.comentarios_app') is null or to_regclass('public.mis_comentarios') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.comentarios_app')) then 'NO'
            when has_table_privilege('anon', 'public.comentarios_app', 'select')
              or has_table_privilege('anon', 'public.mis_comentarios', 'select') then 'NO'
            when has_table_privilege('authenticated', 'public.comentarios_app', 'insert')
              or has_table_privilege('authenticated', 'public.comentarios_app', 'update')
              or has_table_privilege('authenticated', 'public.comentarios_app', 'delete') then 'NO'
            when to_regprocedure('public.enviar_comentario(text,text,text,text)') is null
              or has_function_privilege('anon', 'public.enviar_comentario(text,text,text,text)', 'execute')
              or has_function_privilege('authenticated', 'public.purgar_texto_comentarios(integer)', 'execute') then 'NO'
            when exists (select 1 from information_schema.columns where table_name = 'mis_comentarios' and column_name = 'contrato_id') then 'NO'
            else 'SI' end
union all
select '0095 - capacidad triar_comentarios sin perder las anteriores', 'el check de capacidades_staff contiene triar_comentarios y las 10 de la 0090',
       case when (select count(*) from unnest(array['leer_entrenamiento', 'responder_por_asesorado', 'detener_publicacion',
                    'reportar_riesgo', 'autorizar_excepcion', 'firmar_politica', 'aprobar_primer_plan',
                    'aprobar_plan_estrategico', 'revisar_creadores', 'firmar_creadores', 'triar_comentarios']) cap
                   where exists (select 1 from pg_constraint
                                  where conrelid = 'public.capacidades_staff'::regclass and contype = 'c'
                                    and pg_get_constraintdef(oid) like '%' || cap || '%')) = 11
            then 'SI' else 'NO' end
union all
-- La 0096: las dos tablas del buzón con RLS, anon sin nada, authenticated solo lee, y las
-- funciones de responder y de mover la regla cerradas a anon.
select '0096 - buzón de mercadeo: RLS, solo lee authenticated, funciones cerradas a anon', 'mercadeo_preguntas y mercadeo_referencias con RLS; anon sin select; authenticated solo select; responder_buzon_mercadeo y mover_regla_mercadeo sin execute para anon',
       case when exists (
         select 1 from unnest(array['public.mercadeo_preguntas', 'public.mercadeo_referencias']) t(tabla)
          where to_regclass(t.tabla) is null
             or not (select c.relrowsecurity from pg_class c where c.oid = to_regclass(t.tabla))
             or has_table_privilege('anon', t.tabla, 'select')
             or not has_table_privilege('authenticated', t.tabla, 'select')
             or has_table_privilege('authenticated', t.tabla, 'insert')
             or has_table_privilege('authenticated', t.tabla, 'update')
             or has_table_privilege('authenticated', t.tabla, 'delete')
       ) then 'NO'
            when to_regprocedure('public.responder_buzon_mercadeo(uuid,text,jsonb)') is null
              or to_regprocedure('public.mover_regla_mercadeo(uuid,text,text)') is null
              or has_function_privilege('anon', 'public.responder_buzon_mercadeo(uuid,text,jsonb)', 'execute')
              or has_function_privilege('anon', 'public.mover_regla_mercadeo(uuid,text,text)', 'execute') then 'NO'
            else 'SI' end
union all
select '0096 - capacidad responder_mercadeo sin perder las anteriores', 'el check de capacidades_staff contiene responder_mercadeo y las 10 de la 0090',
       case when (select count(*) from unnest(array['leer_entrenamiento', 'responder_por_asesorado', 'detener_publicacion',
                    'reportar_riesgo', 'autorizar_excepcion', 'firmar_politica', 'aprobar_primer_plan',
                    'aprobar_plan_estrategico', 'revisar_creadores', 'firmar_creadores', 'responder_mercadeo']) cap
                   where exists (select 1 from pg_constraint
                                  where conrelid = 'public.capacidades_staff'::regclass and contype = 'c'
                                    and pg_get_constraintdef(oid) like '%' || cap || '%')) = 11
            then 'SI' else 'NO' end
union all
-- La 0097: creadores_eventos limita carril_nuevo y carril_anterior a la lista de carriles.
select '0097 - creadores_eventos solo acepta carriles conocidos', 'existen creadores_eventos_carril_nuevo_conocido y creadores_eventos_carril_anterior_conocido',
       case when (select count(*) from pg_constraint
                   where conrelid = 'public.creadores_eventos'::regclass and contype = 'c'
                     and conname in ('creadores_eventos_carril_nuevo_conocido', 'creadores_eventos_carril_anterior_conocido')) = 2
            then 'SI' else 'NO' end
union all
-- La 0098: plan_items (organizador). RLS, anon sin nada, authenticated sin delete y con la capacidad.
select '0098 - plan_items: RLS, anon sin nada, authenticated sin delete, capacidad organizar_plan', 'plan_items con RLS; anon sin select; authenticated con select/insert/update pero sin delete; plan_dueno_actual sin execute para anon; indice unico de una principal por dia; el check de capacidades contiene organizar_plan',
       case when to_regclass('public.plan_items') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.plan_items')) then 'NO'
            when has_table_privilege('anon', 'public.plan_items', 'select')
              or has_table_privilege('anon', 'public.plan_items', 'insert') then 'NO'
            when not has_table_privilege('authenticated', 'public.plan_items', 'select')
              or has_table_privilege('authenticated', 'public.plan_items', 'delete') then 'NO'
            when to_regprocedure('public.plan_dueno_actual()') is null
              or has_function_privilege('anon', 'public.plan_dueno_actual()', 'execute') then 'NO'
            when to_regclass('public.plan_items_una_principal_por_dia') is null then 'NO'
            when not exists (select 1 from pg_constraint
                              where conrelid = 'public.capacidades_staff'::regclass and contype = 'c'
                                and pg_get_constraintdef(oid) like '%organizar_plan%') then 'NO'
            else 'SI' end
union all
-- La 0099: avisos_plan_enviados (avisos push del organizador). Solo service_role escribe.
select '0099 - avisos_plan_enviados: RLS, solo service_role, un aviso por tarea y dia', 'avisos_plan_enviados con RLS; anon y authenticated sin select ni insert; service_role con insert; indice unico por tarea y dia',
       case when to_regclass('public.avisos_plan_enviados') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.avisos_plan_enviados')) then 'NO'
            when has_table_privilege('anon', 'public.avisos_plan_enviados', 'select')
              or has_table_privilege('authenticated', 'public.avisos_plan_enviados', 'select')
              or has_table_privilege('authenticated', 'public.avisos_plan_enviados', 'insert') then 'NO'
            when not has_table_privilege('service_role', 'public.avisos_plan_enviados', 'insert') then 'NO'
            when to_regclass('public.avisos_plan_enviados_una_por_tarea_y_dia') is null then 'NO'
            else 'SI' end
union all
-- La 0100: las vistas mis_comentarios y decisiones_con_estado con security_invoker (advisor: Security Definer View).
select '0100 - mis_comentarios y decisiones_con_estado con security_invoker', 'las dos vistas con reloptions security_invoker=on; mis_comentarios_datos() security definer sin execute para anon; anon sin select en ninguna vista',
       case when to_regclass('public.mis_comentarios') is null or to_regclass('public.decisiones_con_estado') is null then 'NO'
            when not coalesce((select c.reloptions @> array['security_invoker=on'] from pg_class c where c.oid = to_regclass('public.mis_comentarios')), false)
              or not coalesce((select c.reloptions @> array['security_invoker=on'] from pg_class c where c.oid = to_regclass('public.decisiones_con_estado')), false) then 'NO'
            when to_regprocedure('public.mis_comentarios_datos()') is null
              or has_function_privilege('anon', 'public.mis_comentarios_datos()', 'execute') then 'NO'
            when has_table_privilege('anon', 'public.mis_comentarios', 'select')
              or has_table_privilege('anon', 'public.decisiones_con_estado', 'select') then 'NO'
            else 'SI' end
union all
-- La 0101: checkins_nutricion con security_invoker (advisor: Security Definer View) y sin execute para anon en es_nutricionista/firmo_yo.
select '0101 - checkins_nutricion con security_invoker; es_nutricionista y firmo_yo sin anon', 'la vista con reloptions security_invoker=on sobre checkins_nutricion_datos() (definer, sin execute para anon); anon sin select; es_nutricionista() y firmo_yo() sin execute para anon ni public',
       case when to_regclass('public.checkins_nutricion') is null then 'NO'
            when not coalesce((select c.reloptions @> array['security_invoker=on'] from pg_class c where c.oid = to_regclass('public.checkins_nutricion')), false) then 'NO'
            when to_regprocedure('public.checkins_nutricion_datos()') is null
              or has_function_privilege('anon', 'public.checkins_nutricion_datos()', 'execute') then 'NO'
            when has_table_privilege('anon', 'public.checkins_nutricion', 'select') then 'NO'
            when to_regprocedure('public.es_nutricionista()') is null or to_regprocedure('public.firmo_yo(text)') is null then 'NO'
            when has_function_privilege('anon', 'public.es_nutricionista()', 'execute')
              or has_function_privilege('anon', 'public.firmo_yo(text)', 'execute')
              or has_function_privilege('public', 'public.es_nutricionista()', 'execute')
              or has_function_privilege('public', 'public.firmo_yo(text)', 'execute') then 'NO'
            else 'SI' end
union all
-- La 0102: admin_tablero (área administrativa) y la capacidad ver_administracion. Lee la capacidad; escribe solo service_role.
select '0102 - admin_tablero: RLS, lectura por capacidad ver_administracion, solo service_role escribe', 'admin_tablero con RLS; anon sin select; authenticated con select pero sin insert/update/delete; service_role con insert; unico por seccion y corte; el check de capacidades contiene ver_administracion',
       case when to_regclass('public.admin_tablero') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.admin_tablero')) then 'NO'
            when has_table_privilege('anon', 'public.admin_tablero', 'select') then 'NO'
            when not has_table_privilege('authenticated', 'public.admin_tablero', 'select')
              or has_table_privilege('authenticated', 'public.admin_tablero', 'insert')
              or has_table_privilege('authenticated', 'public.admin_tablero', 'update')
              or has_table_privilege('authenticated', 'public.admin_tablero', 'delete') then 'NO'
            when not has_table_privilege('service_role', 'public.admin_tablero', 'insert') then 'NO'
            when to_regclass('public.admin_tablero_una_por_seccion_y_corte') is null then 'NO'
            when not exists (select 1 from pg_constraint
                              where conrelid = 'public.capacidades_staff'::regclass and contype = 'c'
                                and pg_get_constraintdef(oid) like '%ver_administracion%') then 'NO'
            else 'SI' end
union all
-- La 0103: hallazgos de mercadeo y su hilo. RLS, anon sin nada, authenticated solo lee, comentar por función cerrada a anon.
select '0103 - hallazgos de mercadeo: RLS, solo lee authenticated, comentar por función cerrada a anon', 'mercadeo_hallazgos y mercadeo_hallazgo_comentarios con RLS; anon sin select; authenticated solo select; service_role escribe; comentar_hallazgo_mercadeo sin execute para anon',
       case when exists (
         select 1 from unnest(array['public.mercadeo_hallazgos', 'public.mercadeo_hallazgo_comentarios']) t(tabla)
          where to_regclass(t.tabla) is null
             or not (select c.relrowsecurity from pg_class c where c.oid = to_regclass(t.tabla))
             or has_table_privilege('anon', t.tabla, 'select')
             or not has_table_privilege('authenticated', t.tabla, 'select')
             or has_table_privilege('authenticated', t.tabla, 'insert')
             or has_table_privilege('authenticated', t.tabla, 'update')
             or has_table_privilege('authenticated', t.tabla, 'delete')
             or not has_table_privilege('service_role', t.tabla, 'insert')
       ) then 'NO'
            when to_regprocedure('public.comentar_hallazgo_mercadeo(uuid,text)') is null
              or has_function_privilege('anon', 'public.comentar_hallazgo_mercadeo(uuid,text)', 'execute') then 'NO'
            else 'SI' end
union all
-- La 0104: el autor real de cada comentario de hallazgo. Columna autor_nombre y la función que la rellena.
select '0104 - hallazgos de mercadeo: autor real del comentario', 'mercadeo_hallazgo_comentarios.autor_nombre existe; comentar_hallazgo_mercadeo la escribe; anon sigue sin execute',
       case when not exists (select 1 from information_schema.columns
                              where table_schema = 'public' and table_name = 'mercadeo_hallazgo_comentarios' and column_name = 'autor_nombre') then 'NO'
            when to_regprocedure('public.comentar_hallazgo_mercadeo(uuid,text)') is null
              or has_function_privilege('anon', 'public.comentar_hallazgo_mercadeo(uuid,text)', 'execute')
              or pg_get_functiondef('public.comentar_hallazgo_mercadeo(uuid,text)'::regprocedure) not like '%autor_nombre%' then 'NO'
            else 'SI' end
union all
-- La 0105: la bandeja de preguntas de Praxis existe, con RLS, y anon no tiene nada.
select '0105 - praxis_preguntas_en_espera con RLS y sin nada para anon', 'RLS encendida, anon sin select ni insert, authenticated con select',
       case when to_regclass('public.praxis_preguntas_en_espera') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.praxis_preguntas_en_espera')) then 'NO'
            when has_table_privilege('anon', 'public.praxis_preguntas_en_espera', 'select')
              or has_table_privilege('anon', 'public.praxis_preguntas_en_espera', 'insert') then 'NO'
            when not has_table_privilege('authenticated', 'public.praxis_preguntas_en_espera', 'select') then 'NO'
            else 'SI' end
union all
-- La 0105: la persona solo inserta la suya. La señal mira la EXPRESION de la politica, no
-- su nombre: tiene que mencionar auth.uid().
select '0105 - praxis_preguntas_insertar_propia exige auth.uid()', 'el with_check de la policy de insert menciona auth.uid()',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'praxis_preguntas_en_espera'
            and policyname = 'praxis_preguntas_insertar_propia' and cmd = 'INSERT'
            and coalesce(with_check, '') like '%auth.uid()%'
       ) then 'SI' else 'NO' end
union all
-- La 0105: el tope de dos abiertas vive en un trigger con candado (el de la politica se
-- saltaba con varias filas en una sentencia). La señal mira que el trigger exista y que su
-- funcion tome el candado: un trigger sin candado deja pasar dos inserciones a la vez.
select '0105 - tope de dos abiertas en un trigger con candado', 'existe trg_praxis_pregunta_tope_de_abiertas y su funcion llama a pg_advisory_xact_lock',
       case when not exists (select 1 from pg_trigger
                              where tgname = 'trg_praxis_pregunta_tope_de_abiertas' and not tgisinternal) then 'NO'
            when to_regprocedure('public.praxis_pregunta_tope_de_abiertas()') is null then 'NO'
            when pg_get_functiondef(to_regprocedure('public.praxis_pregunta_tope_de_abiertas()')) not like '%pg_advisory_xact_lock%' then 'NO'
            else 'SI' end
union all
-- La 0105: privilegio EFECTIVO por columna. La persona no escribe el estado ni la respuesta
-- al insertar, no reescribe la pregunta y no borra.
select '0105 - authenticated no decide estado, no reescribe la pregunta y no borra', 'sin insert sobre estado/respuesta, sin update sobre pregunta/usuario_id, sin delete',
       case when to_regclass('public.praxis_preguntas_en_espera') is null then 'NO'
            when has_column_privilege('authenticated', 'public.praxis_preguntas_en_espera', 'estado', 'insert')
              or has_column_privilege('authenticated', 'public.praxis_preguntas_en_espera', 'respuesta', 'insert')
              or has_column_privilege('authenticated', 'public.praxis_preguntas_en_espera', 'vence_en', 'insert') then 'NO'
            when has_column_privilege('authenticated', 'public.praxis_preguntas_en_espera', 'pregunta', 'update')
              or has_column_privilege('authenticated', 'public.praxis_preguntas_en_espera', 'usuario_id', 'update')
              or has_column_privilege('authenticated', 'public.praxis_preguntas_en_espera', 'destinatario', 'update') then 'NO'
            when has_table_privilege('authenticated', 'public.praxis_preguntas_en_espera', 'delete') then 'NO'
            else 'SI' end
union all
-- La 0105: responder es de quien recibe. La politica de update no puede dejar entrar a la
-- duena por ser duena: su expresion no menciona usuario_id y si exige respondida_por.
select '0105 - praxis_preguntas_responder es de coach o nutricionista, nunca de la duena', 'using sin usuario_id, con es_coach y es_nutricionista; with_check exige respondida_por = auth.uid()',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'praxis_preguntas_en_espera'
            and policyname = 'praxis_preguntas_responder' and cmd = 'UPDATE'
            and coalesce(qual, '') like '%es_coach%'
            and coalesce(qual, '') like '%es_nutricionista%'
            and coalesce(qual, '') not like '%usuario_id%'
            and coalesce(with_check, '') like '%respondida_por%'
       ) then 'SI' else 'NO' end
union all
-- La 0105: el contador no se puede llamar sin sesion y el trigger que fija estado y plazo existe.
select '0105 - contador sin execute para anon y trigger que fija estado y plazo', 'praxis_mis_preguntas_abiertas() sin execute para anon, y existe trg_praxis_pregunta_nace_abierta',
       case when to_regprocedure('public.praxis_mis_preguntas_abiertas()') is null then 'NO'
            when has_function_privilege('anon', 'public.praxis_mis_preguntas_abiertas()', 'execute') then 'NO'
            when not exists (select 1 from pg_trigger
                              where tgname = 'trg_praxis_pregunta_nace_abierta' and not tgisinternal) then 'NO'
            else 'SI' end
union all
-- La 0106: dos cuentas de Bryan. El check admite solo_tablero y puesto_de_coach; es_coach() y es_staff()
-- reconocen puesto_de_coach; la función que asigna la cuenta personal solo la ejecuta service_role; y la
-- lista de compañeros de firma excluye solo_tablero.
select '0106 - dos cuentas de Bryan: capacidades nuevas, es_coach por puesto_de_coach y asignar solo para service_role', 'el check admite solo_tablero y puesto_de_coach; es_coach y es_staff mencionan puesto_de_coach; asignar_cuenta_personal_bryan sin execute para anon/authenticated y con execute para service_role; companeros_de_decision excluye solo_tablero',
       case when not exists (select 1 from pg_constraint
                              where conrelid = 'public.capacidades_staff'::regclass and contype = 'c'
                                and pg_get_constraintdef(oid) like '%solo_tablero%'
                                and pg_get_constraintdef(oid) like '%puesto_de_coach%') then 'NO'
            when pg_get_functiondef('public.es_coach()'::regprocedure) not like '%puesto_de_coach%'
              or pg_get_functiondef('public.es_staff()'::regprocedure) not like '%puesto_de_coach%' then 'NO'
            when has_function_privilege('anon', 'public.es_coach()', 'execute')
              or has_function_privilege('anon', 'public.es_staff()', 'execute') then 'NO'
            when to_regprocedure('public.asignar_cuenta_personal_bryan(text)') is null then 'NO'
            when has_function_privilege('anon', 'public.asignar_cuenta_personal_bryan(text)', 'execute')
              or has_function_privilege('authenticated', 'public.asignar_cuenta_personal_bryan(text)', 'execute')
              or not has_function_privilege('service_role', 'public.asignar_cuenta_personal_bryan(text)', 'execute') then 'NO'
            when pg_get_functiondef('public.companeros_de_decision()'::regprocedure) not like '%solo_tablero%' then 'NO'
            else 'SI' end
union all
-- La 0107: el alta de punta a punta. Existe el trigger que crea la fila de aprobacion del primer plan (security
-- definer con search_path fijo, sin execute para anon/authenticated) y la funcion con la que el coach crea la
-- ficha (security definer, sin execute para anon, con execute para authenticated).
select '0107 - alta de punta a punta: la aprobacion del primer plan se crea sola y el coach crea la ficha', 'trigger trg_crear_aprobacion_primer_plan en microciclos; crear_aprobacion_primer_plan secdef sin execute para anon/authenticated; crear_ficha_si_falta(uuid) secdef sin execute para anon y con execute para authenticated',
       case when not exists (select 1 from pg_trigger
                              where tgname = 'trg_crear_aprobacion_primer_plan' and not tgisinternal
                                and tgrelid = 'public.microciclos'::regclass) then 'NO'
            when to_regprocedure('public.crear_aprobacion_primer_plan()') is null
              or to_regprocedure('public.crear_ficha_si_falta(uuid)') is null then 'NO'
            when not (select prosecdef from pg_proc where oid = 'public.crear_aprobacion_primer_plan()'::regprocedure)
              or not (select prosecdef from pg_proc where oid = 'public.crear_ficha_si_falta(uuid)'::regprocedure) then 'NO'
            when has_function_privilege('anon', 'public.crear_aprobacion_primer_plan()', 'execute')
              or has_function_privilege('authenticated', 'public.crear_aprobacion_primer_plan()', 'execute')
              or has_function_privilege('anon', 'public.crear_ficha_si_falta(uuid)', 'execute')
              or not has_function_privilege('authenticated', 'public.crear_ficha_si_falta(uuid)', 'execute') then 'NO'
            else 'SI' end
union all
-- La 0108: los avisos de Praxis al coach. La tabla existe, con RLS, y anon no tiene nada; y NO hay dónde guardar
-- una frase: las únicas columnas de texto son origen y nivel, con lista cerrada.
select '0108 - praxis_avisos_coach con RLS, sin nada para anon y sin columna de texto libre', 'RLS encendida; anon sin privilegios; solo dos columnas de texto (origen y nivel) y sus dos checks cerrados',
       case when to_regclass('public.praxis_avisos_coach') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.praxis_avisos_coach')) then 'NO'
            when has_table_privilege('anon', 'public.praxis_avisos_coach', 'select')
              or has_table_privilege('anon', 'public.praxis_avisos_coach', 'insert')
              or has_table_privilege('anon', 'public.praxis_avisos_coach', 'update')
              or has_table_privilege('anon', 'public.praxis_avisos_coach', 'delete') then 'NO'
            when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'praxis_avisos_coach'
                     and data_type in ('text', 'character varying', 'json', 'jsonb')) <> 2 then 'NO'
            when (select count(*) from pg_constraint
                   where conrelid = to_regclass('public.praxis_avisos_coach') and contype = 'c'
                     and pg_get_constraintdef(oid) like '%origen%praxis%ingreso%') < 1
              or (select count(*) from pg_constraint
                   where conrelid = to_regclass('public.praxis_avisos_coach') and contype = 'c'
                     and pg_get_constraintdef(oid) like '%nivel%vida%pareja%nino%cuidado%salud%') < 1 then 'NO'
            else 'SI' end
union all
-- La 0108: la persona solo inserta avisos propios. La señal mira la EXPRESION de la politica, no su nombre.
select '0108 - praxis_avisos_insertar_propio exige auth.uid()', 'el with_check de la policy de insert menciona auth.uid() y usuario_id',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'praxis_avisos_coach'
            and policyname = 'praxis_avisos_insertar_propio' and cmd = 'INSERT'
            and coalesce(with_check, '') like '%auth.uid()%'
            and coalesce(with_check, '') like '%usuario_id%'
       ) then 'SI' else 'NO' end
union all
-- La 0108: leen el coach y la nutricionista (decision de Bryan, 2-oct), nunca la duena por ser duena: la politica de
-- select menciona es_coach y es_nutricionista y NO usuario_id, y es la unica de select.
select '0108 - solo el coach y la nutricionista leen los avisos, nunca la duena', 'una sola policy de select, con es_coach y es_nutricionista y sin usuario_id',
       case when (select count(*) from pg_policies
                   where schemaname = 'public' and tablename = 'praxis_avisos_coach' and cmd = 'SELECT') <> 1 then 'NO'
            when exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'praxis_avisos_coach' and cmd = 'SELECT'
                 and coalesce(qual, '') like '%es_coach%'
                 and coalesce(qual, '') like '%es_nutricionista%'
                 and coalesce(qual, '') not like '%usuario_id%'
            ) then 'SI' else 'NO' end
union all
-- La 0108: atender es de quien puede leer, sobre un pendiente y a su nombre.
select '0108 - atender es del coach o la nutricionista, sobre un pendiente y a su nombre', 'using con es_coach, es_nutricionista y atendido_en IS NULL; with_check con atendido_por = auth.uid()',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'praxis_avisos_coach'
            and policyname = 'praxis_avisos_atender_coach' and cmd = 'UPDATE'
            and coalesce(qual, '') like '%es_coach%'
            and coalesce(qual, '') like '%es_nutricionista%'
            and coalesce(qual, '') like '%atendido_en IS NULL%'
            and coalesce(with_check, '') like '%es_coach%'
            and coalesce(with_check, '') like '%es_nutricionista%'
            and coalesce(with_check, '') like '%atendido_por%auth.uid()%'
       ) then 'SI' else 'NO' end
union all
-- La 0108: privilegio EFECTIVO por columna (la persona no fija la hora ni el atendido; nadie reescribe de quien es ni
-- el tipo; nadie borra) y el trigger de «no se duplica» con candado y sin execute para anon/authenticated.
select '0108 - authenticated no decide la hora ni el tipo, no borra, y el aviso repetido no se duplica', 'insert solo en usuario_id/origen/nivel; update solo en atendido_en/atendido_por; sin delete; trg_praxis_aviso_nace_limpio con pg_advisory_xact_lock',
       case when to_regclass('public.praxis_avisos_coach') is null then 'NO'
            when has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'creado_en', 'insert')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'atendido_en', 'insert')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'atendido_por', 'insert') then 'NO'
            when has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'usuario_id', 'update')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'nivel', 'update')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'origen', 'update')
              or has_column_privilege('authenticated', 'public.praxis_avisos_coach', 'creado_en', 'update') then 'NO'
            when has_table_privilege('authenticated', 'public.praxis_avisos_coach', 'delete') then 'NO'
            when not exists (select 1 from pg_trigger
                              where tgname = 'trg_praxis_aviso_nace_limpio' and not tgisinternal) then 'NO'
            when to_regprocedure('public.praxis_aviso_nace_limpio()') is null then 'NO'
            when pg_get_functiondef(to_regprocedure('public.praxis_aviso_nace_limpio()')) not like '%pg_advisory_xact_lock%' then 'NO'
            when has_function_privilege('anon', 'public.praxis_aviso_nace_limpio()', 'execute')
              or has_function_privilege('authenticated', 'public.praxis_aviso_nace_limpio()', 'execute') then 'NO'
            else 'SI' end

union all
-- La 0109: el export de la tasa cuenta la confirmacion de cada serie (`confirmada`: tal_cual / editada).
-- Sin ella la revision larga no distingue «lo hizo y lo firmo» de «no se sabe». SIN APLICAR al escribirla.
select '0109 - la tasa lee la confirmacion de la serie', 'el export de la tasa cuenta series_tal_cual, series_editadas y series_sin_bandera',
       case when to_regprocedure('public.tasa_contra_el_plan_export()') is null then 'NO'
            when pg_get_functiondef(to_regprocedure('public.tasa_contra_el_plan_export()')) like '%series_tal_cual%'
             and pg_get_functiondef(to_regprocedure('public.tasa_contra_el_plan_export()')) like '%series_sin_bandera%' then 'SI'
            else 'NO' end
union all
-- La 0110: las respuestas del coach a las preguntas de la cadena. Solo el coach y la nutricionista leen y responden (por
-- la funcion, a su nombre); nadie escribe la tabla directo; anon no tiene nada. SIN APLICAR al escribirla.
select '0110 - las respuestas del coach a la cadena', 'tabla con RLS solo lectura para coach/nutricionista; responder_pregunta_coach security definer, sin anon',
       case when to_regclass('public.respuestas_coach_cadena') is null then 'NO'
            when not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.respuestas_coach_cadena')) then 'NO'
            when has_table_privilege('anon', 'public.respuestas_coach_cadena', 'select') then 'NO'
            when has_table_privilege('authenticated', 'public.respuestas_coach_cadena', 'insert')
              or has_table_privilege('authenticated', 'public.respuestas_coach_cadena', 'update')
              or has_table_privilege('authenticated', 'public.respuestas_coach_cadena', 'delete') then 'NO'
            when to_regprocedure('public.responder_pregunta_coach(text,uuid,integer,text,text)') is null then 'NO'
            when not (select p.prosecdef from pg_proc p
                       where p.oid = to_regprocedure('public.responder_pregunta_coach(text,uuid,integer,text,text)')) then 'NO'
            when has_function_privilege('anon', 'public.responder_pregunta_coach(text,uuid,integer,text,text)', 'execute') then 'NO'
            else 'SI' end
union all
-- La 0093: las tres tablas de salud del celular con RLS, sin escritura para nadie con sesion
-- y sin nada para anon. Diria NO si alguna tabla no existe, sin RLS, o si un usuario puede escribir.
select '0093 - salud del celular: tablas con RLS y sin escritura desde el navegador', 'RLS en salud_consentimientos, salud_muestras y salud_atajo_tokens; authenticated sin insert/update/delete; anon sin select',
       case when (select count(*) from pg_class c
                   where c.oid in (to_regclass('public.salud_consentimientos'), to_regclass('public.salud_muestras'),
                                   to_regclass('public.salud_atajo_tokens'))
                     and c.relrowsecurity) <> 3 then 'NO'
            when has_table_privilege('authenticated', 'public.salud_muestras', 'insert')
              or has_table_privilege('authenticated', 'public.salud_muestras', 'update')
              or has_table_privilege('authenticated', 'public.salud_muestras', 'delete')
              or has_table_privilege('authenticated', 'public.salud_consentimientos', 'insert')
              or has_table_privilege('authenticated', 'public.salud_consentimientos', 'update')
              or has_table_privilege('authenticated', 'public.salud_consentimientos', 'delete')
              or has_table_privilege('authenticated', 'public.salud_atajo_tokens', 'insert')
              or has_table_privilege('authenticated', 'public.salud_atajo_tokens', 'update')
              or has_table_privilege('authenticated', 'public.salud_atajo_tokens', 'delete') then 'NO'
            when has_table_privilege('anon', 'public.salud_muestras', 'select')
              or has_table_privilege('anon', 'public.salud_consentimientos', 'select')
              or has_table_privilege('anon', 'public.salud_atajo_tokens', 'select') then 'NO'
            else 'SI' end

union all
-- La 0093: el hash del codigo del atajo no sale por la API, ni para su duena (SELECT por columna).
select '0093 - salud del celular: el hash del codigo no se puede leer', 'authenticated puede leer usuario_id de salud_atajo_tokens pero no token_hash',
       case when to_regclass('public.salud_atajo_tokens') is null then 'NO'
            when has_column_privilege('authenticated', 'public.salud_atajo_tokens', 'token_hash', 'select') then 'NO'
            when not has_column_privilege('authenticated', 'public.salud_atajo_tokens', 'usuario_id', 'select') then 'NO'
            else 'SI' end

union all
-- La 0093: las dos funciones de la Edge Function son solo de service_role.
select '0093 - salud del celular: salud_atajo_autorizar/guardar solo para service_role', 'existen; service_role con execute; anon y authenticated sin execute',
       case when to_regprocedure('public.salud_atajo_autorizar(text)') is null
              or to_regprocedure('public.salud_atajo_guardar(uuid,jsonb)') is null then 'NO'
            when has_function_privilege('anon', 'public.salud_atajo_autorizar(text)', 'execute')
              or has_function_privilege('authenticated', 'public.salud_atajo_autorizar(text)', 'execute')
              or has_function_privilege('anon', 'public.salud_atajo_guardar(uuid,jsonb)', 'execute')
              or has_function_privilege('authenticated', 'public.salud_atajo_guardar(uuid,jsonb)', 'execute') then 'NO'
            when not has_function_privilege('service_role', 'public.salud_atajo_autorizar(text)', 'execute')
              or not has_function_privilege('service_role', 'public.salud_atajo_guardar(uuid,jsonb)', 'execute') then 'NO'
            else 'SI' end

union all
-- La 0093: las funciones de la persona existen, authenticated las ejecuta y anon no.
select '0093 - salud del celular: funciones de la persona solo para authenticated', 'salud_estado, salud_dar_consentimiento, salud_revocar_consentimiento, salud_atajo_generar_token y salud_atajo_revocar_token: authenticated con execute, anon sin execute',
       case when to_regprocedure('public.salud_estado()') is null
              or to_regprocedure('public.salud_dar_consentimiento(text,boolean)') is null
              or to_regprocedure('public.salud_revocar_consentimiento(boolean)') is null
              or to_regprocedure('public.salud_atajo_generar_token()') is null
              or to_regprocedure('public.salud_atajo_revocar_token()') is null then 'NO'
            when has_function_privilege('anon', 'public.salud_estado()', 'execute')
              or has_function_privilege('anon', 'public.salud_dar_consentimiento(text,boolean)', 'execute')
              or has_function_privilege('anon', 'public.salud_revocar_consentimiento(boolean)', 'execute')
              or has_function_privilege('anon', 'public.salud_atajo_generar_token()', 'execute')
              or has_function_privilege('anon', 'public.salud_atajo_revocar_token()', 'execute') then 'NO'
            when not has_function_privilege('authenticated', 'public.salud_estado()', 'execute')
              or not has_function_privilege('authenticated', 'public.salud_atajo_generar_token()', 'execute') then 'NO'
            else 'SI' end

union all
-- La 0093: la lectura de salud es del dueno o de quien tiene leer_entrenamiento (EXPRESION viva).
select '0093 - salud del celular: lee el dueno o leer_entrenamiento', 'la policy salud_muestras_leer menciona auth.uid y leer_entrenamiento',
       case when not exists (select 1 from pg_policies
                              where schemaname = 'public' and tablename = 'salud_muestras' and policyname = 'salud_muestras_leer'
                                and cmd = 'SELECT'
                                and coalesce(qual, '') like '%leer_entrenamiento%'
                                and coalesce(qual, '') like '%auth.uid()%') then 'NO'
            else 'SI' end

union all
-- La 0093: la tabla de muestras exige unidad/rango por tipo y un dato por persona, dia, tipo y fuente.
select '0093 - salud del celular: salud_muestras exige unidad, rango y unicidad', 'CHECK con los seis tipos y UNIQUE (usuario_id, fecha, tipo, fuente)',
       case when to_regclass('public.salud_muestras') is null then 'NO'
            when not exists (select 1 from pg_constraint
                              where conrelid = to_regclass('public.salud_muestras') and contype = 'c'
                                and pg_get_constraintdef(oid) like '%minutos_ejercicio%'
                                and pg_get_constraintdef(oid) like '%fc_reposo%') then 'NO'
            when not exists (select 1 from pg_constraint
                              where conrelid = to_regclass('public.salud_muestras') and contype = 'u'
                                and pg_get_constraintdef(oid) like '%(usuario_id, fecha, tipo, fuente)%') then 'NO'
            else 'SI' end

union all
-- La 0093: la casilla E llego al formulario publico: columna nueva y la politica acepta el texto 0.4.
select '0093 - salud del celular: piloto_autorizaciones lleva casilla_e y acepta el texto 0.4', 'columna casilla_e y with_check de la policy de insert menciona 0.4',
       case when not exists (select 1 from information_schema.columns
                              where table_schema = 'public' and table_name = 'piloto_autorizaciones' and column_name = 'casilla_e') then 'NO'
            when not exists (select 1 from pg_policies
                              where schemaname = 'public' and tablename = 'piloto_autorizaciones'
                                and policyname = 'piloto_autorizacion_insertar_formulario'
                                and coalesce(with_check, '') like '%0.4%') then 'NO'
            else 'SI' end

order by migracion, senal;
