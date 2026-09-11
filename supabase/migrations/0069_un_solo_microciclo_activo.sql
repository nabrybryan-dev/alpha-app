-- 0069 · Un solo microciclo activo por persona, garantizado por la base.
--
-- POR QUE ES 0069 Y NACIO SIENDO 0068. Se aplico a la base como `0068` a las 03:35 del
-- 11-sep y otra sesion fusiono su `0068_el_video_no_sale_sin_firma` veinte minutos despues.
-- El guardian de `pruebas/migraciones-con-senal.test.ts` lo cazo -en un caso real, el mismo
-- dia que se escribio- y su regla es la correcta: renumera el TUYO, nunca uno ya aplicado.
-- El numero se mueve sin riesgo porque la base NO se guia por el: Supabase anota cada
-- aplicacion con su propia marca de tiempo, asi que las dos quedaron registradas por
-- separado (`20260911033532` y `20260911035550`) y aqui no hay nada que volver a correr.
--
-- QUE CIERRA. Hasta hoy nada lo impedia. El unico indice unico de `microciclos` era su
-- clave primaria, sobre `id`; `microciclos_usuario` (0001) NO es unico. Y el unico candado
-- del servidor era el trigger de la `0021`, cuya propia cabecera declara el hueco: «Solo
-- aplica a UPDATE. En INSERT el estado que venga es el bueno», y ademas se apaga cuando
-- `auth.uid()` es nulo — que es exactamente el contexto de servicio con el que escribe la
-- tuberia.
--
-- Es `R-01` de la auditoria, y `REC-04`.
--
-- POR QUE PARCIAL. Solo restringe las filas activas. Los cerrados y los propuestos siguen
-- pudiendo ser tantos como pida el historial: una persona con 24 microciclos cerrados es lo
-- normal, no un error. Un unico sobre `(usuario_id, estado)` prohibiria eso y ademas dejaria
-- pasar dos activos si alguno cambiara de estado a mitad.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE ESTO NO SE PUDO APLICAR HASTA HOY, que es lo que merece contarse
-- ─────────────────────────────────────────────────────────────────────────────
-- Esta migracion estaba escrita desde el 2026-09-07 y BLOQUEADA, y el motivo no era que
-- hubiera datos sucios: no los habia. Era que **las dos vias que activan un microciclo
-- abrian el nuevo ANTES de cerrar el viejo**:
--
--   · la app       `sync.ts` encolaba abrir y cerrar como dos operaciones sueltas
--   · la carga     `plantilla-carga-microciclo.sql` insertaba 'activo' y cerraba despues
--
-- Un indice unico NO se puede diferir —Postgres difiere restricciones, y una restriccion
-- unica no puede ser parcial—, asi que el choque salta en la sentencia, no al confirmar.
-- Traducido: con el indice puesto, la carga semanal habria abortado para las 23 personas
-- con activo, y la activacion desde la app habria fallado, reintentado ocho veces, se
-- habria apartado, y SOLO ENTONCES habria corrido el cerrar — dejando a esa persona con
-- CERO activos. Peor que el problema.
--
-- Lo que lo desbloquea, y por eso entra hoy y no antes:
--   · `activar_microciclo` (0060, y reescrita en la 0066) cierra y abre en la MISMA
--     transaccion, y la app la llama como una sola operacion.
--   · La plantilla de carga cierra todos los activos de la persona antes de insertar.
--
-- MEDIDO CONTRA LA BASE REAL justo antes de aplicar (2026-09-10):
--   · 23 microciclos activos, de 23 personas distintas, CERO con dos.
--   · Ningun indice unico sobre la tabla salvo `microciclos_pkey`.
--   · Y el agujero, visto abierto: abrir un segundo activo dentro de una transaccion
--     deshecha despues SALIO BIEN (`activos_ahora = 2`). Sin esa comprobacion, el «cero
--     filas» de despues se cumpliria igual si la migracion no se hubiera aplicado nunca.
--
-- LO QUE ESTA MIGRACION LE PIDE A QUIEN ACTIVE. La app es una PWA con trabajador de
-- servicio: un navegador con la version vieja cacheada seguiria mandando las dos escrituras
-- sueltas, y contra este indice la primera falla. Solo afecta al staff —la `0021` y la
-- propia `activar_microciclo` impiden que un asesorado toque el estado—, y se cierra
-- cerrando y abriendo la app en ese dispositivo. Decision de Bryan el 2026-09-10: candado
-- limpio que falla A LA VISTA, en vez de una red que cierre sola y tape en silencio a quien
-- abra el microciclo equivocado.
--
-- SE DESHACE con `drop index if exists public.microciclos_un_activo_por_usuario;`.
-- Inmediato y sin tocar un solo dato.

create unique index if not exists microciclos_un_activo_por_usuario
  on public.microciclos (usuario_id)
  where estado = 'activo';

comment on index public.microciclos_un_activo_por_usuario is
  'R-01 / REC-04: una persona no puede tener dos microciclos activos. Parcial a proposito: '
  'los cerrados y los propuestos no se limitan. Requiere que quien active cierre y abra en '
  'la misma transaccion (activar_microciclo, 0060/0066).';

-- No se da por buena: si el indice no quedo puesto, esta transaccion no se confirma.
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename  = 'microciclos'
       and indexname  = 'microciclos_un_activo_por_usuario'
  ) then
    raise exception '0069: el indice no quedo creado';
  end if;
end;
$$;
