-- ¿Algún microciclo vigente o propuesto tiene el blob sin `usuarioId`, o con otro distinto al de la
-- columna? Cero filas. La app filtra por `datos.usuarioId`: sin él, la persona ve «todavía no tienes
-- microciclo activo» aunque la fila exista y `estado` diga `activo` (31-oct-2026).
select m.id, m.estado, m.usuario_id, m.datos->>'usuarioId' as usuario_en_datos
  from public.microciclos m
 where m.estado in ('activo', 'propuesto')
   and (m.datos->>'usuarioId') is distinct from m.usuario_id::text;
