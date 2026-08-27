-- ¿Cuánto se baja el coach en cada refresco, y cuánto se bajaría con N usuarios?
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ EXISTE
-- ─────────────────────────────────────────────────────────────────────────────
-- La app no se degrada poco a poco al crecer la cartera: se rompe por UNA
-- persona. Para una asesorada, RLS acota a lo suyo y su hidratación es pequeña
-- pase lo que pase. Para el coach, `es_coach()` es cierto y RLS no acota nada:
-- se lleva la cartera entera cada 45 segundos, por pestaña abierta.
--
-- Y el problema no se ve contando filas. `microciclos` son 4,7 por asesorado
-- —nada— pero cada una es un blob JSON con todas las sesiones, ejercicios y
-- series: ~21 kB. Hay que PESARLAS, no contarlas.
--
-- Cambia `objetivo` para proyectar a otro tamaño de cartera.

with parametros as (
  select 1000::numeric as objetivo,        -- a cuántos asesorados proyectar
         45::numeric   as segundos_refresco -- SessionProvider.tsx
),
hoy as (
  select (select count(*)::numeric from usuarios_app where rol = 'asesorado') as asesorados,
         (select sum(octet_length(datos::text))::numeric from microciclos)    as bytes_microciclos,
         (select count(*)::numeric from microciclos)                          as filas_microciclos,
         -- Lo que una LISTA necesita de verdad: quién, qué número, en qué
         -- estado, desde cuándo y cuántas sesiones. Sin las sesiones dentro.
         (select sum(octet_length(
            jsonb_build_object(
              'id', m.id, 'usuario_id', m.usuario_id, 'numero', m.numero,
              'estado', m.estado, 'fechaInicio', m.datos ->> 'fechaInicio',
              'sesiones', jsonb_array_length(coalesce(m.datos -> 'sesiones', '[]'::jsonb))
            )::text))::numeric
          from microciclos m)                                                 as bytes_resumen
)
select
  h.asesorados                                                        as asesorados_hoy,
  round(h.filas_microciclos / h.asesorados, 1)                        as microciclos_por_persona,
  round(h.bytes_microciclos / h.filas_microciclos)                    as bytes_por_microciclo,

  pg_size_pretty(h.bytes_microciclos::bigint)                         as se_baja_hoy,
  pg_size_pretty((h.bytes_microciclos / h.asesorados * p.objetivo)::bigint)
                                                                      as se_bajaria_completo,
  pg_size_pretty((h.bytes_resumen / h.asesorados * p.objetivo)::bigint)
                                                                      as se_bajaria_resumen,
  round(h.bytes_microciclos / nullif(h.bytes_resumen, 0))             as veces_mas_pequeno,

  round(h.bytes_microciclos / h.asesorados * p.objetivo
        / p.segundos_refresco / 1024 / 1024, 2)                       as mb_por_segundo,
  round(h.bytes_microciclos / h.asesorados * p.objetivo
        * (86400 / p.segundos_refresco) / 1024 / 1024 / 1024, 1)      as gb_al_dia_un_coach
from hoy h, parametros p;

-- ─────────────────────────────────────────────────────────────────────────────
-- Y con qué frecuencia cambia, que es lo que decide si la firma (0049) sirve
-- ─────────────────────────────────────────────────────────────────────────────
--
-- El salto por tabla solo ahorra si la tabla ESTÁ QUIETA entre dos refrescos.
-- Para la asesorada lo está: sus microciclos cambian cuando ella entrena. Para
-- el coach no, porque le cambia cuando entrena CUALQUIERA de la cartera.
--
-- Si `cambios_por_dia_con_1000` sale por encima de ~1.900, hay más de un cambio
-- cada 45 s y la firma no le ahorrará nada al coach: se lo bajará todo igual.

select s.relname as tabla,
       s.n_tup_ins + s.n_tup_upd + s.n_tup_del as cambios_medidos,
       round(extract(epoch from (now() - d.stats_reset)) / 86400.0, 1) as dias_midiendo,
       round((s.n_tup_ins + s.n_tup_upd + s.n_tup_del)
             / greatest(extract(epoch from (now() - d.stats_reset)) / 86400.0, 0.01), 1)
         as cambios_por_dia,
       round((s.n_tup_ins + s.n_tup_upd + s.n_tup_del)
             / greatest(extract(epoch from (now() - d.stats_reset)) / 86400.0, 0.01)
             / (select count(*)::numeric from usuarios_app where rol = 'asesorado')
             * 1000)
         as cambios_por_dia_con_1000
from pg_stat_user_tables s, pg_stat_database d
where s.schemaname = 'public'
  and d.datname = current_database()
  and s.relname in ('microciclos', 'checkins', 'adherencias', 'registro_comida',
                    'registro_item', 'mensajes', 'hidratacion')
order by cambios_medidos desc;
