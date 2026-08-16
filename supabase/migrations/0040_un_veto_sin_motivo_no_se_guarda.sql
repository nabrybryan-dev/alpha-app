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
-- ⚠️ APLICAR SOLO DESPUÉS DE DESPLEGAR EL PASO 1. Ver abajo.
--
-- HISTORIA, PARA QUE NO SE REPITA
-- Este bloque decía que la app no escribe en esta tabla. ERA FALSO, y la
-- migración se aplicó el 2026-08-16 creyéndoselo. Hubo que revertirla el mismo
-- día. Con el NOT NULL puesto y la pantalla de entonces, el primer veto de
-- Manuela fallaba por el peor camino: la operación se encola, el upsert
-- revienta, y la cola de descartados tiene tope. Se perdía en silencio, y ella
-- lo veía marcado en su pantalla.
--
-- No lo notó nadie porque la tabla estaba en 0 filas. Se descubrió leyendo
-- `sync.ts` para otra cosa. La lección, que es la de siempre en este repo: se
-- comprobó que nadie LEÍA la tabla desde `src/` y se dio por hecho que nadie la
-- escribía. La cadena de escritura no pasa por la pantalla, pasa por `sync.ts`,
-- y ahí no se miró.
--
-- EL ORDEN CORRECTO
--   1. `SheetVetados` pide el motivo, con su test.   ← HECHO el 2026-08-16
--   2. Desplegar.                                    ← ¿ya está en producción?
--   3. Entonces sí, aplicar esto.
--   4. Señal a SI, y comprobar que rechaza de verdad.
--
-- ESTADO DEL PASO 1 (2026-08-16)
-- La app ya no puede escribir un veto sin motivo, y no por disciplina:
--
--   repos.ts        vetar(veto: VetoAlimento & { motivo: string })  ← no compila sin él
--   SheetVetados    pide el motivo antes de vetar, y lo MUESTRA en la lista
--   motivoDeVeto.ts misma regla que el check de abajo: trim >= 3
--
-- El tipo es lo que de verdad cierra el agujero: cualquier sitio nuevo que
-- intente grabar un veto sin decir por qué falla al compilar. Cuando se cambió,
-- el compilador destapó los 4 sitios que lo hacían.
--
-- El mínimo de `motivoDeVeto.ts` y el `check` de esta migración son el MISMO
-- número por obligación. Si la pantalla fuera más permisiva, la escritura
-- pasaría la validación local y moriría contra el constraint. Hay un test que
-- compara los dos veredictos caso por caso.
--
-- ANTES DE PEGAR ESTO: comprueba que el paso 2 está hecho. Si la versión en
-- producción es anterior al despliegue de hoy, vuelve a romperse igual.

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
