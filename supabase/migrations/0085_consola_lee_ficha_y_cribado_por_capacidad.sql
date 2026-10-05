-- 0085 · La consola: quien tiene `leer_entrenamiento` lee la ficha y el cribado.
--
-- POR QUÉ. La 0083 abrió por capacidad (no por rol) microciclos, check-ins, cuestionarios,
-- respuestas, corridas y planes. Faltaron dos tablas que la consola pinta en la cabecera y
-- en la ficha: `perfiles` (objetivo, edad, días, medidas) y `cribado` (PAR-Q). Con ellas
-- cerradas a `es_coach()`, Manuela veía «tu permiso no alcanza» en la ficha de toda la
-- cartera. Decisión de Bryan (2026-09-26): que las lea quien tenga la capacidad.
--
-- SOLO LECTURA. Son políticas `for select`: no se añade ninguna de insert/update/delete, así
-- que escribir sigue igual que antes (el asesorado sus medidas por RPC, el coach el resto; el
-- trigger `proteger_perfil` de la 0008 no se toca). Las políticas se SUMAN a las existentes
-- (`perfiles_leer`, `cribado_lee_lo_suyo`): RLS combina las permisivas con OR.
--
-- `cribado_vigente` es una vista con `security_invoker = true` (0062): aplica la RLS de
-- `cribado` con los permisos de quien consulta, así que no necesita nada propio.
--
-- Firmar y autorizar excepciones NO cambian: siguen siendo solo de Bryan.

begin;

drop policy if exists perfiles_lee_capacidad on public.perfiles;
create policy perfiles_lee_capacidad on public.perfiles
  for select to authenticated
  using ((select public.tiene_capacidad('leer_entrenamiento')));

drop policy if exists cribado_lee_capacidad on public.cribado;
create policy cribado_lee_capacidad on public.cribado
  for select to authenticated
  using ((select public.tiene_capacidad('leer_entrenamiento')));

commit;
