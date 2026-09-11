-- 0070 - La revision semanal puede ser audio, no solo video.
--
-- APLICADA EL 11-SEP ANTES DE ESTAR FUSIONADA, y conviene que quede dicho porque es un
-- error del que se aprende: este archivo estaba SUELTO en un arbol de trabajo compartido,
-- sin subir a ninguna rama. Se leyo creyendo que era codigo fusionado y se aplico a la base
-- con esa suposicion. Durante unas horas la base tuvo una columna que el repositorio no
-- tenia -el mismo desajuste que llevamos dias cazando, pero del otro lado-.
--
-- Se sube tal cual para que base y repositorio digan lo mismo. La columna estaba bien; lo
-- que estaba mal era darla por revisada.
--
-- OJO CON EL `default 'video'`: hace que olvidarse de escribir el tipo no falle, MIENTA.
-- Una revision de audio sin `tipo` explicito queda marcada como video y nadie se entera.
-- Por eso el publicador lo escribe SIEMPRE (ver `domain/video/publicacion.ts`).

alter table videos_semanales
  add column if not exists tipo text not null default 'video'
  check (tipo in ('audio', 'video'));

comment on column videos_semanales.tipo is
  'Formato de la revisión semanal. audio es la versión inicial; video queda para un medio aprobado posterior.';
