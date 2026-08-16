-- App Alpha Athletics · Migración 0040 · Un veto sin motivo deja de poder guardarse
-- Pegar completo en: Supabase → SQL Editor → New query → Run
--
-- POR QUÉ
-- `perfil_alimentario_veto.motivo` admite NULL desde que nació la tabla (0016).
-- Un veto decide qué NO come una persona con datos de salud de por medio, y hoy
-- se puede grabar sin decir por qué.
--
-- Cuando dentro de tres meses alguien pregunte por qué a esta asesorada no se le
-- propone el huevo, la respuesta tiene que estar en la fila. No en la memoria de
-- quien lo tecleó, ni en un mensaje de chat que ya nadie encuentra.
--
-- Es el mismo principio que el detector de código huérfano (PR #43): no prohíbe
-- nada, obliga a escribir el motivo. «Pendiente» no es un motivo.
--
-- POR QUÉ AHORA
-- La tabla tiene 0 filas —medido el 2026-08-16, justo antes de escribir esto—.
-- Sin datos que rellenar, esto son dos sentencias. En cuanto Manuela codifique el
-- primer veto, la misma migración necesita un backfill y una decisión incómoda
-- sobre las filas viejas: inventarles un motivo o dejarlas fuera de la regla.
-- La ventana se cierra sola, y probablemente esta semana.
--
-- LO QUE NO HACE
-- No toca la app. Hoy nada escribe en esta tabla desde `src/` -el panel de vetos
-- de la PR #42 lee, y la carga inicial va por SQL- así que esto no puede romper
-- un formulario que no existe. Cuando se escriba, el `check` estará esperando y
-- la UI tendrá que pedir el motivo, que es el orden que se quiere.

-- Red de seguridad. Si entre que esto se escribió y se corre alguien codificó
-- vetos, la migración se planta con un mensaje claro en vez de reventar en el
-- `alter` con un error de Postgres que no dice qué hacer.
do $$
declare sin_motivo int;
begin
  select count(*) into sin_motivo
  from public.perfil_alimentario_veto
  where motivo is null or length(trim(motivo)) = 0;

  if sin_motivo > 0 then
    raise exception
      'Hay % vetos sin motivo. Rellénalos antes de correr la 0040, o esta migración los volvería inválidos.',
      sin_motivo;
  end if;
end $$;

alter table public.perfil_alimentario_veto
  alter column motivo set not null;

-- Tres caracteres es el umbral de «escribió algo» frente a «puso un punto para
-- salir del paso». No pretende juzgar la calidad del motivo: eso no lo hace una
-- base de datos. Solo cierra la puerta al vacío y al espacio en blanco.
alter table public.perfil_alimentario_veto
  add constraint perfil_alimentario_veto_motivo_escrito
  check (length(trim(motivo)) >= 3);

comment on column public.perfil_alimentario_veto.motivo is
  'Por qué esta persona no puede comer esto. Obligatorio desde la 0040: un veto sin '
  'motivo es una decisión clínica sin trazabilidad.';

-- ===== Comprobación =====
-- La señal de abajo está en comprobar-migraciones.sql. Corrida ANTES de aplicar
-- esta migración devuelve NO —comprobado el 2026-08-16—, que es lo que se le pide
-- a una señal: poder fallar.
--
-- Para verlo a mano:
--   select is_nullable from information_schema.columns
--    where table_schema='public' and table_name='perfil_alimentario_veto'
--      and column_name='motivo';        -- tiene que decir NO
--
--   select conname from pg_constraint
--    where conname='perfil_alimentario_veto_motivo_escrito';   -- tiene que salir
--
-- Y que de verdad rechaza, que es lo único que prueba que sirve:
--   insert into perfil_alimentario_veto (asesorado_id, alimento_id, motivo)
--   values ('<uuid>', 'res-higado-crudo', '  ');   -- debe fallar
