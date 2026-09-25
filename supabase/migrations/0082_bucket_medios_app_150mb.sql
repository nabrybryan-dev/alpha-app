-- 0082 · El cajón medios-app admite hasta 150 MB, no el límite del proyecto por defecto.
--
-- Renombrada de 0078 a 0082 al fusionar el PR #299 (24-sep-2026): el número 0078 ya lo
-- había tomado en `main` otra migración fusionada antes (`0078_la_app_cuenta_lo_que_le_falla`,
-- desplegada el 14-sep). El contenido de este archivo no cambió, solo su número.
--
-- QUÉ SE ROMPIÓ. La revisión LARGA (2-3 min, cara clonada de Alpha Estudio, 14-sep)
-- produce mp4 de 76-96 MB. El bucket `medios-app` tenía `file_size_limit = null`, que cae
-- al límite global del proyecto — y ese límite rechazó la subida con «The object exceeded
-- the maximum allowed size» al publicar las 8 revisiones largas de la semana, ya pasado
-- el TOPE_BYTES del dominio (subido a 150 MB en el mismo día, PR #299 de alpha-app:
-- src/domain/video/publicacion.ts). Los dos topes tenían que subir juntos: uno vive en el
-- código, el otro en la configuración del proyecto, y coincidir de tamaño es a propósito.
--
-- QUÉ CAMBIA. Solo el límite de ESTE bucket, a 150 MB — el mismo número que TOPE_BYTES,
-- para que los dos rechacen exactamente lo mismo y ninguno sorprenda al otro.
--
-- APLICADA A MANO el 2026-09-14 vía el SQL Editor / MCP, antes de que este archivo
-- existiera: este migration es el registro, no el primer disparo.
--
-- ROBUSTA a propósito (24-sep-2026, a pedido del director): el CI de este repo
-- (`base-de-datos`, job de `.github/workflows/ci.yml`) aplica las migraciones desde cero
-- sobre un `pgvector/pgvector:pg16` puro, sin el esquema real de Storage de Supabase — ahí
-- `storage.buckets` no existe o no tiene `file_size_limit`, y el UPDATE de abajo reventaba
-- ese check para CUALQUIER PR que lo heredara después de fusionar. Se envuelve en un
-- `do $$ … $$` que solo escribe si el esquema, la tabla y la columna existen de verdad; si
-- no, avisa con `raise notice` y no hace nada. En producción el efecto es el mismo UPDATE
-- de siempre, y sigue siendo idempotente.

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'storage'
       and table_name = 'buckets'
       and column_name = 'file_size_limit'
  ) then
    update storage.buckets
       set file_size_limit = 150 * 1024 * 1024
     where id = 'medios-app';
  else
    raise notice '0082: storage.buckets.file_size_limit no existe en este entorno (sin Storage real de Supabase) — nada que hacer aquí.';
  end if;
end
$$;
