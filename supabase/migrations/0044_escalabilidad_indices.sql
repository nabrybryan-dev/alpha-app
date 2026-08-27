-- Índice para el listado de consultas del coach.
--
-- `leerConsultas` (src/features/coach/consultasNube.ts) pide las últimas N
-- consultas SIN filtrar por usuario:
--
--   select ... from consultas_chat order by creado_en desc limit N
--
-- El índice que ya existe -`consultas_chat_usuario_idx (usuario_id, creado_en
-- desc)`, de la 0010- no sirve para eso: su primera columna es `usuario_id`,
-- así que una consulta sin ese filtro no puede recorrerlo en orden y Postgres
-- acaba en seq scan + sort de la tabla entera para devolver N filas.
--
-- Este ordena por `creado_en` a secas, que es justo lo que la pantalla pide.
create index if not exists consultas_chat_por_fecha
  on public.consultas_chat (creado_en desc);

analyze public.consultas_chat;

-- ── Lo que NO va aquí, y por qué ─────────────────────────────────────────────
--
-- El borrador de esta migración traía otros tres índices. Los tres sobraban:
--
--   · registro_comida (asesorado_id) where not borrado
--       ya existe: `registro_comida_vivas` (0017), y además lleva
--       `momento desc`, así que cubre estrictamente más.
--
--   · perfil_alimentario_veto (asesorado_id) where not borrado
--       ya existe: `perfil_alimentario_veto_vivos` (0035). Idéntico.
--
--   · registro_item (registro_id)
--       ya existe: `registro_item_por_registro` (0015).
--
-- Un índice duplicado no acelera nada: ocupa disco y encarece cada INSERT.
--
-- Nota sobre CONCURRENTLY: el borrador lo usaba. No se puede, porque
-- `create index concurrently` no corre dentro de un bloque de transacción y
-- el SQL Editor de Supabase envía el script entero como una. A esta escala
-- el lock de un `create index` normal sobre esta tabla es de milisegundos.
