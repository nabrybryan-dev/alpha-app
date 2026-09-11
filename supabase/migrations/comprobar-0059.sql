-- Comprobación de la 0059 (el mapa de vida). Se corre APARTE, después de
-- aplicarla, en el SQL Editor.
--
-- Lo que importa: que la tabla exista con RLS encendido y que el asesorado NO
-- pueda leer ni escribir el mapa de vida de otra persona -es la propiedad más
-- importante de este repo (CLAUDE.md §4.2)-, y que ninguna fila quede con
-- respuestas vacías (una fila así diría "contestó" sin que nadie contestara
-- nada, y el recado se dispararía sobre un jsonb `{}`).

select 'la tabla existe' as comprueba,
       case when exists (
              select 1 from information_schema.tables
               where table_schema = 'public' and table_name = 'mapa_de_vida_respuestas')
       then 'SI' else 'NO' end as sale,
       'SI' as tiene_que_dar

union all
select 'RLS está encendido',
       case when exists (
              select 1 from pg_class c
                join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'mapa_de_vida_respuestas'
                 and c.relrowsecurity)
       then 'SI' else 'NO' end,
       'SI'

union all
-- Sin esto, cualquier persona autenticada leería el mapa de vida de toda la
-- cartera. Se cuenta cuántas políticas de SELECT hay (tiene que haber
-- exactamente una: dueño o coach).
select 'hay política de lectura',
       count(*)::text,
       '1'
from pg_policies
where schemaname = 'public' and tablename = 'mapa_de_vida_respuestas' and cmd = 'SELECT'

union all
-- El coach NO escribe esta encuesta en nombre de nadie: solo debe existir
-- política de escritura para el propio dueño (insert y update), nunca "for all".
select 'las políticas de escritura son solo del dueño (sin "for all")',
       case when exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'mapa_de_vida_respuestas'
                 and cmd = 'ALL')
       then 'NO' else 'SI' end,
       'SI'

union all
-- Cero filas esperadas: ninguna respuesta guardada puede llegar vacía.
select 'filas con valores vacíos ({} o null)',
       count(*)::text,
       '0'
from public.mapa_de_vida_respuestas
where valores is null or valores = '{}'::jsonb

union all
-- Cero filas esperadas: la FK a usuarios_app ya lo impediría, pero se deja
-- escrito porque es la comprobación que de verdad importa si algún día la FK
-- se quita sin darse cuenta.
select 'filas sin usuario en usuarios_app',
       count(*)::text,
       '0'
from public.mapa_de_vida_respuestas m
where not exists (select 1 from public.usuarios_app u where u.id = m.usuario_id);
