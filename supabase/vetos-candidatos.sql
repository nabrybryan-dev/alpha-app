-- Candidatos de veto a partir de lo que cada persona declaró en la encuesta.
--
-- Pegar en: Supabase → SQL Editor. Los bloques 1 y 2 SOLO LEEN.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ ES Y QUÉ NO ES
-- ─────────────────────────────────────────────────────────────────────────────
-- NO decide vetos. Propone CANDIDATOS para que la nutricionista confirme, que es
-- distinto: qué no puede comer alguien es criterio clínico, y este archivo no lo
-- tiene. Lo que hace es convertir su trabajo de «pensar en todos los alimentos
-- del catálogo» a «revisar esta lista».
--
-- El repo se niega desde siempre a traducir solo el texto de las alergias
-- —«mariscos» no está en ningún nombre del catálogo, y «leche» casa con «leche
-- de coco»— y este archivo NO cambia esa regla. La cambia de sitio: en vez de
-- que ella busque a ciegas en 1.198 alimentos, revisa una lista corta que ya
-- viene con los falsos positivos apartados.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LOS FALSOS POSITIVOS QUE YA VAN FUERA, Y POR QUÉ
-- ─────────────────────────────────────────────────────────────────────────────
-- Medidos contra el catálogo el 2026-08-17, no supuestos:
--
-- LÁCTEOS. El grupo `lacteos` trae 55 alimentos, pero CINCO son bebidas
-- vegetales: leche de almendras, de avena, de coco, de soya y avena en caja.
-- Vetar el grupo entero a alguien con alergia a la lactosa le quitaría
-- exactamente sus sustitutos. Van fuera.
--
--   (Y eso es, además, un problema del catálogo: una leche de almendras
--   clasificada como lácteo va a morder otra vez en otro sitio. Anotado abajo.)
--
-- GLUTEN. El patrón por nombre caza 107 alimentos, de los cuales DIECISÉIS no
-- llevan gluten: harina de maíz, de yuca, de arroz, de papa, de plátano, de
-- quinua, pan de yuca. Básicos de la cocina de aquí, todos seguros para un
-- celíaco. Van fuera.
--
-- Un veto de más no lo reclama nadie: la comida simplemente desaparece del plan
-- en silencio. Por eso los falsos positivos pesan tanto como los que faltan.

-- === 1 · QUIÉN DECLARÓ QUÉ (solo lee) ======================================
-- El punto de partida. Sin esto no se sabe a quién le toca.

select u.nombre,
       coalesce(p.respuestas->'alergias', '[]'::jsonb) as alergias,
       coalesce(p.respuestas->'excluye', '[]'::jsonb)  as excluye,
       coalesce(p.respuestas->>'noLeGustan', '')       as no_le_gustan,
       (select count(*) from perfil_alimentario_veto v
         where v.asesorado_id = p.asesorado_id and not v.borrado) as vetos_ya_puestos
from perfil_alimentario p
join usuarios_app u on u.id = p.asesorado_id
where p.respuestas->'alergias' @> '["lacteos"]'
   or p.respuestas->'alergias' @> '["gluten"]'
   or p.respuestas->'alergias' @> '["otra"]'
   or p.respuestas->'excluye'  @> '["pescado"]'
   or p.respuestas->'excluye'  @> '["cerdo"]'
   or p.respuestas->'excluye'  @> '["otra"]'
order by u.nombre;


-- === 2 · LOS CANDIDATOS, PERSONA POR PERSONA (solo lee) ====================
-- Una fila por cada alimento que habría que revisar, con el término que lo
-- trajo. REVISAR ANTES DE INSERTAR: son candidatos, no decisiones.

with terminos as (
  -- Lácteos por GRUPO, que es exacto, menos las bebidas vegetales.
  select 'lacteos'::text as termino, a.id as alimento_id, a.nombre
    from alimentos a
   where a.grupo = 'lacteos'
     and a.id !~ 'coco|almendra|soya|avena|arroz'
  union all
  -- Gluten por nombre, quitando lo que no lleva.
  select 'gluten', a.id, a.nombre
    from alimentos a
   where a.id ~ 'trigo|avena|cebada|centeno|harina|pan-|pasta|galleta'
     and a.id !~ 'maiz|yuca|arroz|papa|platano|quinua'
  union all
  select 'pescado', a.id, a.nombre
    from alimentos a
   where a.id ~ 'pescado|atun|salmon|trucha|tilapia|bagre|mojarra|sardina|bacalao|robalo|pargo'
  union all
  select 'cerdo', a.id, a.nombre
    from alimentos a
   where a.id ~ 'cerdo|tocino|chorizo|jamon'
),
declarado as (
  select p.asesorado_id, u.nombre as persona, t.valor as termino,
         case when p.respuestas->'alergias' @> to_jsonb(array[t.valor]) then 'alergia' else 'exclusion' end as origen
  from perfil_alimentario p
  join usuarios_app u on u.id = p.asesorado_id,
       lateral (values ('lacteos'),('gluten'),('pescado'),('cerdo')) as t(valor)
  where p.respuestas->'alergias' @> to_jsonb(array[t.valor])
     or p.respuestas->'excluye'  @> to_jsonb(array[t.valor])
)
select d.persona, d.origen, d.termino, t.alimento_id, t.nombre,
       exists (select 1 from perfil_alimentario_veto v
                where v.asesorado_id = d.asesorado_id
                  and v.alimento_id = t.alimento_id and not v.borrado) as ya_vetado
from declarado d
join terminos t on t.termino = d.termino
order by d.persona, d.termino, t.nombre;


-- === 3 · INSERTAR LO REVISADO (escribe) ====================================
-- Correr SOLO con la lista del bloque 2 ya revisada, y término por término.
--
-- El motivo es OBLIGATORIO desde la 0040 y con mínimo de tres caracteres. No es
-- burocracia: dentro de tres meses, cuando alguien pregunte por qué a esta
-- persona no se le propone el queso, la respuesta tiene que estar en la fila.
--
-- `on conflict do nothing`: se puede correr dos veces sin duplicar ni pisar un
-- motivo ya escrito.

-- insert into perfil_alimentario_veto (asesorado_id, alimento_id, motivo)
-- select p.asesorado_id, a.id,
--        'Alergia a lácteos declarada en la encuesta'      -- ← el motivo real
--   from perfil_alimentario p
--   cross join alimentos a
--  where p.respuestas->'alergias' @> '["lacteos"]'
--    and a.grupo = 'lacteos'
--    and a.id !~ 'coco|almendra|soya|avena|arroz'
-- on conflict (asesorado_id, alimento_id) do nothing;


-- === LO QUE ESTE ARCHIVO NO PUEDE RESOLVER =================================
--
-- «OTRA», SIN DÓNDE DECIR CUÁL. La encuesta ofrece «Otra» en alergias y en
-- exclusiones, y NO tiene campo para especificarla. Medido el 2026-08-17: una
-- persona con alergia «otra» y cuatro con exclusión «otra». Para esas seis
-- declaraciones no hay nada que proponer aquí — hay que preguntarles.
--
-- Es un hueco de la encuesta, no de este archivo: una alergia declarada que el
-- sistema no puede accionar es peor que no haberla preguntado, porque parece
-- recogida.
--
-- EL CATÁLOGO CLASIFICA COMO LÁCTEO LO QUE NO LO ES. Cinco bebidas vegetales
-- están en el grupo `lacteos`:
--
--   leche-de-almendras-endulzada     leche-de-coco-bebida-en-caja
--   leche-de-avena                   leche-de-soya-endulzada
--   avena-en-caja
--
-- Aquí van apartadas a mano, pero cualquier otra cosa que filtre por
-- `grupo = 'lacteos'` —un intercambio, un cálculo de macros por grupo— se va a
-- tropezar con lo mismo. Merece arreglarse en el catálogo.
