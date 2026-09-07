-- ¿Hay algún `cues` que describa la excepción de OTRA semana?
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE.
--
-- POR QUÉ EXISTE. El molde de carga hereda el `cues` de un microciclo al
-- siguiente, y desde el 2026-09-05 además se puede cambiar pasándolo en el
-- ajuste. Heredarlo es lo correcto **casi siempre**: medido ese mismo día, 465
-- de 465 ejercicios activos lo llevan y solo 2 parecen describir una excepción
-- puntual («última serie: parciales…», «medio rango…»).
--
-- Esos 2 son el riesgo: una excepción escrita para la prescripción de la semana
-- pasada sobrevive a una prescripción nueva, y el asesorado lee una instrucción
-- que ya no aplica. No se puede decidir automáticamente —hace falta leerlas— así
-- que esto no las arregla: las pone delante.
--
-- LA SEÑAL NO ES «existe un cues». Es «existe un cues CON FORMA DE EXCEPCIÓN».
-- Un check que contara cues a secas daría 465 y no diría nada.

-- 1 · Los que tienen forma de excepción, en microciclos ACTIVOS.
select 'senal 1 · cues con forma de excepcion (activos)' as senal,
       u.nombre,
       m.numero as micro,
       ej->>'nombre' as ejercicio,
       ej->>'cues'   as cues,
       ej->>'prescripcion' as prescripcion
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
     , jsonb_array_elements(m.datos->'sesiones') s
     , jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) ej
 where m.estado = 'activo'
   and ej->>'cues' ~* 'parcial|ultima serie|última serie|medio rango|solo si|excepc|drop ?set|rest ?pause'
 order by u.nombre, m.numero;

-- 2 · Cuántos hay en total, para ver si la proporción se mueve.
--     Si «con forma de excepción» empieza a crecer, el `cues` está cambiando de
--     uso y la decisión de heredarlo hay que volver a mirarla.
select 'senal 2 · proporcion' as senal,
       m.estado,
       count(*) as ejercicios,
       count(*) filter (where coalesce(ej->>'cues','') <> '') as con_cues,
       count(*) filter (where ej->>'cues' ~* 'parcial|ultima serie|última serie|medio rango|solo si|excepc|drop ?set|rest ?pause') as con_forma_de_excepcion
  from public.microciclos m,
       jsonb_array_elements(m.datos->'sesiones') s,
       jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) ej
 group by m.estado
 order by m.estado;

-- Medido el 2026-09-05: activos 465 ejercicios · 465 con cues · 2 con forma de
-- excepción. Cerrados 2.641 · 2.641 · 11.
