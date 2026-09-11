-- ===========================================================================
-- El primer respaldo que cumplió y se va: `respaldo_perfiles_notas_20260906`.
--
-- QUÉ GUARDABA. El perfil de 11 asesorados ANTES de reescribir sus `objetivos`
-- el 7-sep-2026. De todo lo que guarda un perfil, la comparación contra lo vivo
-- dijo que cambió **una sola clave en las once personas: `objetivos`**. Nada más.
--
-- POR QUÉ SE VA. Bryan confirmó el 2026-09-11 que los objetivos reescritos son
-- los buenos. Un respaldo existe para deshacer un cambio concreto si sale mal;
-- confirmado el cambio, la copia ya no protege nada. Es la primera que cumple su
-- `caduca` de la `0071`, y es también la prueba de que ese mecanismo cierra el
-- ciclo en vez de limitarse a rotular.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL PARACAÍDAS ESTÁ FUERA, Y ESO ES LO QUE HACE QUE ESTO SEA REVERSIBLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Antes de borrar, las 11 filas se volcaron a
-- `C:\Users\ASUS\dev\respaldos\perfiles-objetivos-antes-del-7sep-2026-09-11.json`
-- —fuera de la base y fuera de git, que es donde vive el paracaídas de verdad—.
--
-- Y se verificó, que es la parte que se salta todo el mundo: **md5 de
-- `datos->>'objetivos'` por persona, calculado en la base y sobre el fichero.
-- Las once huellas y las once longitudes coincidieron.** Con control negativo:
-- cambiando UNA palabra del texto, la huella cambia — o sea que la comparación
-- distingue, no dice «sí» a todo.
--
-- Por eso esta migración no es una pérdida: es un traslado comprobado.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA GUARDA, Y POR QUÉ NO ES DECORACIÓN
-- ─────────────────────────────────────────────────────────────────────────────
-- El volcado cubre **exactamente 11 filas**. Si la tabla tuviera hoy otra cosa
-- —alguien escribió en ella después del volcado— el paracaídas estaría
-- incompleto y borrar sería perder dato de verdad. Así que se cuenta antes y se
-- aborta si no son 11. Una migración que borra sin mirar lo que borra no es una
-- migración, es un descuido con número.
-- ===========================================================================

begin;

do $$
declare filas int;
begin
  if to_regclass('public.respaldo_perfiles_notas_20260906') is null then
    raise notice '0072: la tabla ya no existe, no hay nada que borrar';
    return;
  end if;

  select count(*) into filas from public.respaldo_perfiles_notas_20260906;

  if filas <> 11 then
    raise exception '0072: la tabla tiene % fila(s) y el volcado verificado cubre 11. No se borra: el paracaidas estaria incompleto.', filas;
  end if;

  execute 'drop table public.respaldo_perfiles_notas_20260906';
  raise notice '0072: borradas % filas, ya volcadas y verificadas fuera de la base', filas;
end $$;

commit;

-- Comprobación: `supabase/comprobar-0072.sql` y la señal en
-- `supabase/comprobar-migraciones.sql`.
--
-- Y lo que queda después de esto, medido: 13 tablas de respaldo, las 13 con su
-- rótulo y su fecha. Las dos siguientes en cumplir vencen el 24 y el 26 de
-- septiembre — `respaldo_tipo_zona2_20260825` y `respaldo_lina_m27_20260827`—,
-- y las dos las dejó vivas la `0051` por motivos que siguen sin resolverse.
