-- ===========================================================================
-- Las 14 tablas de respaldo dicen, desde hoy, para que existen y hasta cuando.
--
-- POR QUE. El 28-ago eran 2. Hoy son 14, con 29 filas de datos de salud reales
-- dentro. No se acumulan por descuido: se acumulan porque **una tabla que no
-- dice que protege no se puede tirar nunca**. Ante una caja sin rotular todo el
-- mundo hace lo prudente, que es no tirarla.
--
-- Y no se pueden limpiar por antiguedad: comparadas contra lo vivo, **16 de las
-- 17 filas de microciclo difieren de verdad**, o sea que cada tabla es la unica
-- copia de un «antes». (Ojo: en crudo salian 17 de 17 y era artefacto de la
-- `0066`, que el 10-sep quito la clave `estado` de los 155 microciclos. Hay que
-- comparar `datos - 'estado'`.)
--
-- ESTA MIGRACION NO BORRA NADA. Solo rotula. El borrado se decide cuando cada
-- una caduque, y quien avisa es `comprobar-respaldos.sql` (señales 6 y 7).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DE DONDE SALE CADA ROTULO — ninguno es una suposicion
-- ─────────────────────────────────────────────────────────────────────────────
--   · 5 lo traian escrito DENTRO, en una columna `motivo`: se copia literal.
--       juliana_lados, juliana_rodilla, snake_case, tatiana_lunes, tatiana_m22
--   · 2 estan documentadas en `0051_respaldos_que_ya_cumplieron.sql`:
--       lina_m27 («es de hoy, demasiado reciente») y tipo_zona2 («por duda
--       honesta: su fila difiere en las cinco sesiones pero no se pudo
--       determinar que cambio»).
--   · 3 son de la restauracion de Camilo del 11-sep, documentada aparte.
--   · 4 NO aparecian en ningun sitio —ni repo, ni migracion, ni diario—. Su
--     rotulo se DEDUJO comparando la copia contra lo vivo: la diferencia entre
--     las dos ES el cambio que la copia protegia. Se lista abajo que clave
--     cambio en cada una.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA CADUCIDAD: 30 DIAS DESDE EL DIA DE LA COPIA
-- ─────────────────────────────────────────────────────────────────────────────
-- Un respaldo es leche, no vino: existe para deshacer un cambio concreto si
-- sale mal, asi que su vida util dura lo que tarde el cambio en demostrarse
-- bueno. 30 dias da margen de sobra para eso.
--
-- **La fecha del NOMBRE no vale para contar.** Cuatro tablas se llaman `...0906`
-- y sus filas se guardaron el **07**. Y dos no tienen ninguna columna de fecha
-- de copia (`camilo_m26`, `camilo_perfil`): ahi se usa la del nombre, que es la
-- unica que hay. Tampoco vale `actualizado_en`: esa es la fecha del DATO, no la
-- de la copia — `lina_m27` marca 24-ago en el dato y se copio el 27.
--
-- La unica que caduca HOY es `perfiles_notas`: Bryan confirmo el 11-sep que los
-- objetivos reescritos son los buenos, asi que esa copia ya cumplio.
-- ===========================================================================

begin;

-- ── Las cinco que traian el motivo dentro ────────────────────────────────────

comment on table public.respaldo_juliana_lados_20260906 is
  'M16 tal y como se cargo, con IZQUIERDA como pierna debil. Bryan corrige el 6-sep: la fracturada es la DERECHA y la que duele es la IZQUIERDA. (motivo original, columna motivo) · copia 2026-09-06 · caduca 2026-10-06';

comment on table public.respaldo_juliana_rodilla_20260906 is
  'Antes de retirar del M15 vivo la extension de rodilla (120 kg), la sentadilla bulgara y el circuito del sabado, por molestia infrarrotuliana derecha del 6-sep. Se respalda porque la retirada borra series que ella SI hizo, y eso es evidencia. (motivo original) · copia 2026-09-06 · caduca 2026-10-06';

comment on table public.respaldo_snake_case_20260906 is
  'Antes de pasar escenarios.rojo de snake_case a camelCase: 70 ejercicios salieron en snake y su rama roja no la leia nadie. (motivo original) · copia 2026-09-07 · caduca 2026-10-07';

comment on table public.respaldo_tatiana_lunes_20260907 is
  'Antes de subir el LUNES de 2 a 5 ejercicios (Bryan, 7-sep). Sus 6 series de las 07:06 quedan intactas. (motivo original) · copia 2026-09-07 · caduca 2026-10-07';

comment on table public.respaldo_tatiana_m22_20260907 is
  'Antes de sustituir las sesiones 2-5 del M22 vivo (12 ejercicios / 30 series) por la semana de su plan (23 / 59). El lunes se conserva con sus 4 series. (motivo original) · copia 2026-09-07 · caduca 2026-10-07';

-- ── Las dos que documento la 0051 ───────────────────────────────────────────

comment on table public.respaldo_lina_m27_20260827 is
  'M27 de Lina. La 0051 (27-ago) la dejo viva por ser «de hoy, demasiado reciente para tocarla». Ya no lo es. · copia 2026-08-27 · caduca 2026-09-26';

comment on table public.respaldo_tipo_zona2_20260825 is
  'Conservada POR DUDA HONESTA (0051): su fila difiere de la viva en las cinco sesiones, asi que un cambio se aplico, pero no se pudo determinar cual — el campo tipo sale nulo en las dos versiones, asi que la hipotesis que dio nombre a la tabla no se sostiene. 48 kB. · copia 2026-08-25 · caduca 2026-09-24';

-- ── Las tres de la restauracion de Camilo (11-sep) ──────────────────────────

comment on table public.respaldo_camilo_m26_20260911 is
  'Antes de restaurar los microciclos de Camilo recortados a un dia por una «regla 1» que no existia: M24, M25 y M26 eran el mismo lunes copiado. Cargas intactas. · copia 2026-09-11 (del nombre: la tabla no tiene columna de fecha) · caduca 2026-10-11';

comment on table public.respaldo_camilo_m26_textos_20260911 is
  'Textos del M26 de Camilo antes de la misma restauracion del 11-sep. · copia 2026-09-11 · caduca 2026-10-11';

comment on table public.respaldo_camilo_perfil_20260911 is
  'Perfil de Camilo antes de la restauracion del 11-sep. · copia 2026-09-11 (del nombre: la tabla no tiene columna de fecha) · caduca 2026-10-11';

-- ── Las cuatro mudas: rotulo DEDUCIDO de la diferencia contra lo vivo ────────
--
-- El metodo, para que se pueda repetir: una copia se hace justo ANTES de
-- cambiar algo, asi que la diferencia entre la copia y lo vivo es el cambio que
-- protegia. Se compara clave a clave con `jsonb_each` sobre `datos - 'estado'`.

comment on table public.respaldo_estado_json_20260906 is
  'DEDUCIDO el 11-sep (no habia motivo escrito en ningun sitio): 3 microciclos; en m-bolano-b2-3-m4 y m-laura-b2-6-m7 lo unico que cambio despues fue la clave «sesiones»; m-jcduran-1-prop2 esta identica a lo vivo y ya no protege nada. Copia previa a una edicion de sesiones de los B2. · copia 2026-09-07 (el nombre dice 0906) · caduca 2026-10-07';

comment on table public.respaldo_juliana_m16_20260906 is
  'DEDUCIDO el 11-sep (no habia motivo escrito): M16 de Juliana; cambiaron «ajusteClinico» y «sesiones». Misma operacion y mismo dia que respaldo_juliana_lados y respaldo_juliana_rodilla, que si llevan el motivo: la correccion de pierna debil y la retirada por la rodilla. · copia 2026-09-07 (el nombre dice 0906) · caduca 2026-10-07';

comment on table public.respaldo_operativo_20260902 is
  'DEDUCIDO el 11-sep (no habia motivo escrito): M15 de Juliana; cambiaron «ajusteClinico», «cadenciaDias» y «sesiones». Copia previa a un cambio de cadencia con ajuste clinico. El nombre «operativo» no dice nada de esto. · copia 2026-09-02 · caduca 2026-10-02';

comment on table public.respaldo_perfiles_notas_20260906 is
  'DEDUCIDO el 11-sep (no habia motivo escrito): perfiles de 11 asesorados; de todo lo que guardan cambio UNA sola clave en las 11, «objetivos». Copia previa a reescribir los objetivos. CUMPLIDA: Bryan confirmo el 11-sep que los objetivos nuevos son los buenos. · copia 2026-09-07 (el nombre dice 0906) · caduca 2026-09-11';

-- Guarda: si alguna tabla se quedo sin rotulo, esta migracion no vale para nada
-- y es mejor saberlo ahora que descubrirlo cuando la señal 6 siga en rojo.
do $$
declare sin_rotulo int;
begin
  select count(*) into sin_rotulo
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%'
     and (obj_description(c.oid) is null
          or obj_description(c.oid) !~ 'caduca [0-9]{4}-[0-9]{2}-[0-9]{2}');
  if sin_rotulo > 0 then
    raise exception '0071: quedan % tabla(s) de respaldo sin rotulo con fecha', sin_rotulo;
  end if;
end $$;

commit;

-- Comprobacion: `supabase/comprobar-0071.sql`
-- Y el detector que vive con el borrado, en el otro repo:
--   cerebro-alpha-agentes/tuberia/sql/comprobar-respaldos.sql (señales 6 y 7)
