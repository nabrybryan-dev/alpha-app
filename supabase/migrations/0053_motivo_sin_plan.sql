-- 0053 · Por qué esta persona no tiene plan
--
-- Hasta hoy, «sin microciclo activo» era UN estado con DOS significados opuestos:
--
--   · el coach lo pausó a propósito  -> no hay que hacer nada
--   · se le cortó por no suministrar -> hay que llamarlo
--
-- Los dos se ven idénticos en `microciclos` —la ausencia de una fila con
-- `estado='activo'`—, así que la revisión del sábado los mezclaría en la misma
-- fila y trataría igual dos casos que piden lo contrario. **El estado no lleva su
-- porqué, y el porqué es lo único accionable.** Es el mismo argumento por el que
-- `confianza_faltan` existe al lado de `confianza: parcial`: saber QUE falta algo
-- no dice qué hacer; saber CUÁL, sí.
--
-- Los dos casos son reales y ya conviven desde el 2026-09-05: ese día se cerraron
-- cuatro microciclos por decisión de Bryan (asesorados inactivos), y ese mismo día
-- se decidió que el bloque a ciegas corta el plan a los 4 microciclos sin datos.
--
-- VOCABULARIO CERRADO a propósito, como `grupo` y `categoria` en los contratos de
-- los agentes: un motivo en prosa no se puede contar ni cruzar, y acaba siendo un
-- campo que hay que leer entre líneas.
--
-- LA FILA SOLO SIGNIFICA ALGO MIENTRAS LA PERSONA NO TIENE ACTIVO. Si vuelve a
-- tener microciclo, la fila queda vieja y NO se lee: la mesa la consulta solo para
-- quien hoy no tiene plan. Al pausar otra vez se sobrescribe con su fecha nueva.
-- **LIMITACIÓN DECLARADA:** no se guarda historial de pausas. Si hiciera falta,
-- esto pasa a ser una tabla de filas y no de una por persona — y entonces la clave
-- primaria deja de ser `usuario_id`.
--
-- SEGURIDAD: solo staff, ni siquiera lectura para el asesorado. `es_staff()` es la
-- misma función que ya usan las políticas de `visibilidad_nutricion`. El aviso de
-- que se le va a cortar el plan NO viaja por aquí: viaja por el chat.

begin;

create table if not exists public.motivo_sin_plan (
  usuario_id      uuid primary key references public.usuarios_app(id) on delete cascade,
  motivo          text not null check (motivo in (
                    'inactivo_por_decision',   -- el coach lo pausó; no hay que hacer nada
                    'corte_sin_suministro',    -- se agotó el bloque a ciegas sin un solo dato
                    'alta_sin_programar',      -- dado de alta y aún sin su primer microciclo
                    'baja'                     -- dejó el servicio
                  )),
  desde           date not null default current_date,
  nota            text,
  registrado_por  text not null default 'coach' check (registrado_por in ('coach','sistema')),
  actualizado_en  timestamptz not null default now()
);

alter table public.motivo_sin_plan enable row level security;

create policy motivo_sin_plan_lee_el_staff on public.motivo_sin_plan
  for select to authenticated using ((select public.es_staff()));

create policy motivo_sin_plan_escribe_el_staff on public.motivo_sin_plan
  for insert to authenticated with check ((select public.es_staff()));

create policy motivo_sin_plan_actualiza_el_staff on public.motivo_sin_plan
  for update to authenticated using ((select public.es_staff()));

create policy motivo_sin_plan_borra_el_staff on public.motivo_sin_plan
  for delete to authenticated using ((select public.es_staff()));

revoke all on public.motivo_sin_plan from anon, public;
grant select, insert, update, delete on public.motivo_sin_plan to authenticated;

commit;

-- Comprobación: supabase/comprobar-0053.sql
-- Aplicada a producción el 2026-09-05 con `apply_migration`, y sus seis señales
-- en OK. Dos de ellas vistas ROJAS a propósito antes de darlas por buenas.
