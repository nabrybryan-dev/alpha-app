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

update storage.buckets
set file_size_limit = 150 * 1024 * 1024
where id = 'medios-app';
