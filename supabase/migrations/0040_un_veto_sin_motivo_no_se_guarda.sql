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
-- ⛔ NO APLICAR TODAVÍA. ROMPE EL PANEL DE VETOS.
--
-- Este bloque decía que la app no escribe en esta tabla. ERA FALSO, y la
-- migración se aplicó el 2026-08-16 creyéndoselo. Hubo que revertirla el mismo
-- día. Lo que hay de verdad:
--
--   SheetVetados.tsx:119   db.vetados.vetar({ usuarioId, alimentoId })   ← sin motivo
--   sync.ts:328            motivo: veto.motivo?.trim() || null           ← lo manda NULL
--   types.ts:383           motivo?: string                               ← opcional en el tipo
--
-- Es el panel que la PR #42 desplegó para la nutricionista. Con el NOT NULL
-- puesto, su primer veto falla — y falla por el peor camino: la operación se
-- encola, el upsert revienta, y la cola de descartados tiene tope. Se pierde en
-- silencio.
--
-- No lo notó nadie porque la tabla estaba en 0 filas. Se descubrió leyendo
-- `sync.ts` para otra cosa.
--
-- EL ORDEN CORRECTO, que esta misma migración ya decía y se hizo al revés:
--
--   1. `SheetVetados` pide el motivo, con su test.
--   2. Desplegar.
--   3. Entonces sí, aplicar esto.
--   4. Señal a SI, y comprobar que rechaza de verdad.
--
-- La lección, que es la de siempre en este repo: se comprobó que nadie LEÍA la
-- tabla desde `src/` y se dio por hecho que nadie la escribía. La cadena de
-- escritura no pasa por la pantalla, pasa por `sync.ts`, y ahí no se miró.

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
-- Y que de verdad rechaza, que es lo único que prueba que sirve.
--
-- CUIDADO CON QUÉ SE PRUEBA. Esta columna tiene DOS checks:
--
--   perfil_alimentario_veto_motivo_check      (0016)  motivo IS NULL OR length(trim(motivo)) > 0
--   perfil_alimentario_veto_motivo_escrito    (0040)  length(trim(motivo)) >= 3
--
-- El de la 0016 ya rechazaba el motivo en blanco —lo que dejaba pasar era el
-- NULL—, así que probar con '  ' choca contra ÉL y no demuestra nada de esta
-- migración: habría fallado igual antes de aplicarla. Es el mismo error que las
-- señales ciegas de la 0013 (ver PR #47): una prueba que no distingue el mundo
-- de antes del mundo de después.
--
-- Las dos que sí aíslan esta migración, corridas contra producción el
-- 2026-08-16 y fallando las dos, como debe ser:
--
--   -- 'ok' pasa el check de la 0016 (no está vacío) y choca contra el de la 0040:
--   insert into perfil_alimentario_veto (asesorado_id, alimento_id, motivo)
--   values ('<uuid>', 'res-higado-crudo', 'ok');
--   -- ERROR 23514 ... viola «perfil_alimentario_veto_motivo_escrito»
--
--   -- el NULL que la 0016 dejaba entrar:
--   insert into perfil_alimentario_veto (asesorado_id, alimento_id, motivo)
--   values ('<uuid>', 'res-higado-crudo', null);
--   -- ERROR 23502 ... viola la restricción not-null
--
-- Los dos inserts fallan, así que no dejan basura: la tabla se quedó en 0 filas.
-- Con un uuid inventado basta — los CHECK se evalúan antes que la FK.
