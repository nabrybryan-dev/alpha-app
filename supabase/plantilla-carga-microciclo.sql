-- ============================================================================
-- PLANTILLA · construir el microciclo siguiente clonando el vigente
-- ----------------------------------------------------------------------------
-- Este archivo SÍ va al repo: no lleva nombres, cargas ni notas de nadie.
-- Las cargas reales (`_app-cargar-*.sql`, `*.local.sql`) siguen fuera de git.
--
-- POR QUÉ EXISTE
-- Las cargas de julio de 2026 clonaban el microciclo vigente con
--   jsonb_set(s,'{ejercicios}', <ejercicios con series=[]>)
-- que reescribe SOLO `ejercicios`. Todo lo demás del objeto sesión sobrevive
-- literal, y ahí viven tres cosas que son del microciclo VIEJO:
--   · `preparacion[].hechoEn`    -> ítems de calentamiento/movilidad ya tildados
--   · `bloquesCardio[].hechoEn`  -> bloques de cardio ya tildados
--   · `testPost`                 -> el test de la sesión anterior, ya relleno
-- El asesorado abría el microciclo nuevo con la sesión medio hecha. Y de paso
-- envenenaba cualquier consulta forense: una marca con hora dejaba de probar
-- que alguien estuvo, porque podía ser un fósil heredado.
--
-- Afectó a ~14 asesorados (el cargador de flota del 2026-07-27 más las cargas
-- sueltas). Se limpió con `_app-limpiar-fosiles.local.sql`.
--
-- LA REGLA
-- Un microciclo nuevo NACE SIN RASTRO DE EJECUCIÓN. Lo que se hereda es la
-- PRESCRIPCIÓN (ejercicios, cargas, reps, RIR, notas); lo que el asesorado
-- HIZO no se hereda nunca. Si añades un campo de ejecución a `Sesion` en
-- `src/domain/types.ts`, añádelo también a `tmp_sesion_en_limpio()`.
--
-- DOS AVISOS DE USO
-- 1. Las funciones son TEMPORALES y van con prefijo `tmp_`: se crean, se usa la
--    carga y se borran al final (§5). Es la práctica que ya seguían las cargas.
-- 2. `create function` concede `EXECUTE` a `PUBLIC` por defecto, y todo lo que
--    vive en `public` queda expuesto como RPC a `anon`. `tmp_cargar_siguiente`
--    ESCRIBE microciclos: sin el `revoke` que va debajo de cada función,
--    cualquiera con la anon key podría llamarla. Es el mismo agujero que
--    documenta GUIA-BRYAN.md §10 con `buscar_ficha`. No quites los `revoke`.
-- ============================================================================


-- ── 1 · Helpers · dejar la sesión sin rastro de ejecución ──────────────────

-- Quita `hechoEn` de cada ítem marcable, conservando el ítem entero.
create or replace function public.tmp_sin_marcas(p_items jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce((
    select jsonb_agg((i - 'hechoEn') order by ord)
      from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality as t(i, ord)
  ), '[]'::jsonb);
$fn$;
revoke execute on function public.tmp_sin_marcas(jsonb) from public;

-- Deja una sesión lista para estrenar: sin marcas de preparación, sin marcas
-- de cardio, sin test post y SIN FECHA. NO toca ejercicios (de eso se encarga
-- quien llama).
--
-- `fecha` entró en `Sesion` el 2026-09-04 y es un campo de ejecución de pleno
-- derecho: dice el día en que la persona apareció. Heredarla sería el fósil de
-- julio otra vez y con la peor cara de todas — una semana que nadie ha empezado
-- naciendo con el día del martes pasado escrito, y el cruce del check-in con la
-- sesión emparejando dos días distintos sin que nada falle a la vista.
create or replace function public.tmp_sesion_en_limpio(p_s jsonb)
returns jsonb language sql immutable as $fn$
  select (
           case when con_cardio ? 'preparacion'
                then jsonb_set(con_cardio, '{preparacion}',
                               public.tmp_sin_marcas(con_cardio->'preparacion'))
                else con_cardio
           end
         ) - 'testPost'          -- inofensivo si la clave no está
           - 'fecha'             -- el día en que se tocó la sesión ANTERIOR
    from (
      select case when p_s ? 'bloquesCardio'
                  then jsonb_set(p_s, '{bloquesCardio}',
                                 public.tmp_sin_marcas(p_s->'bloquesCardio'))
                  else p_s
             end
    ) as t(con_cardio);
$fn$;
revoke execute on function public.tmp_sesion_en_limpio(jsonb) from public;


-- ── 1b · Los campos salen de la frase ──────────────────────────────────────
-- Lee la cabecera canónica y devuelve los campos que anuncia. Es el gemelo en
-- SQL de `parsearPrescripcion` (`src/domain/prescripcion.ts`), y comparte sus
-- dos reglas:
--
--   · **Anclada al principio.** Lo que venga después es nota del coach, aunque
--     lleve números, «TOTAL» o «KG». Un ejercicio de peso corporal cuya nota
--     dice «te quedó registrado 20KG» no tiene 20 kg de carga pautada.
--   · **Lo que no se puede leer no se inventa.** Sin cabecera reconocible
--     devuelve `{}` y el clonador hereda, que es lo único honesto.
--
-- Existe por el incidente del 2026-08-12: el clonador escribía `sets`, `rir` y
-- `reps` solo cuando el ajuste los traía, así que una carga que pasaba la frase
-- nueva sin pasarlos dejaba los campos con los de la semana anterior. 170
-- ejercicios de 15 asesorados leían una cosa mientras la app operaba con otra.
--
-- DEUDA CONOCIDA: esto y `prescripcion.ts` son dos implementaciones de la misma
-- regla y pueden separarse. Quien las mantiene honestas es
-- `comprobar-alineacion.sql`, que se corre después de cada carga. La solución de
-- fondo es mover la carga a un script Node que use el parser de verdad.
create or replace function public.tmp_campos_de_frase(p_frase text)
returns jsonb language sql immutable as $fn$
  with patron as (
    select '^\s*(\d+(?:[.,]\d+)?)\s*KGS?\y'
        || '(?:\s+(TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?'
        || '\s+A\s+(\d+)(?:\s*-\s*\d+)?\s*REPS?'
        || '(?:\s+(TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?'
        || '\s*;\s*(\d+)\s*SERIES?'
        || '(?:\s*\(([^)]*)\))?'
        || '\s*\.?\s*' as p
  ),
  leido as (
    select regexp_match(coalesce(p_frase, ''), p, 'i') as g, p from patron
  ),
  -- Los ondulados no llevan cabecera con kilos: su carga vive serie a serie.
  -- Pero el número de series SÍ se puede contar, y es justo el que se quedaba
  -- heredado y cerraba el ejercicio antes de la serie tope.
  escalones as (
    select case
             when coalesce(p_frase,'') ~* '^\s*ONDULACI[ÓO]N\s+ASCENDENTE:'
             then (select count(*) from regexp_matches(p_frase, '\d+(?:[.,]\d+)?\s*KG\s*[×x]\s*\d+', 'gi'))
           end as n
  )
  select case
           when l.g is not null then jsonb_strip_nulls(jsonb_build_object(
             'cargaKg',     replace(l.g[1], ',', '.')::numeric,
             'unidadCarga', case
                              when upper(coalesce(l.g[2], l.g[4], '')) like 'TOTAL%'   then 'total'
                              when upper(coalesce(l.g[2], l.g[4], '')) = 'POR MANO'    then 'por mano'
                              when upper(coalesce(l.g[2], l.g[4], '')) in
                                   ('POR PIERNA','POR LADO','CADA LADO')               then 'por lado'
                              else 'kg'
                            end,
             'repsDiana',   l.g[3]::int,
             'sets',        l.g[5]::int,
             -- `(RIR 2-3)` e `(ISOMETRÍA)` no son un número y no se fuerzan:
             -- fingir que lo son es lo que abortaba la carga entera.
             'rirObjetivo', case when l.g[6] ~* '^\s*RIR\s+\d+\s*$'
                                 then (regexp_match(l.g[6], '\d+'))[1]::int end,
             'notaCoach',   nullif(trim(regexp_replace(p_frase, l.p, '', 'i')), '')
           ))
           when e.n is not null and e.n > 0 then jsonb_build_object('sets', e.n)
           else '{}'::jsonb
         end
    from leido l, escalones e;
$fn$;
revoke execute on function public.tmp_campos_de_frase(text) from public;


-- ── 2 · El clonador ────────────────────────────────────────────────────────
-- `p_ajustes` es un objeto
--   {PREFIJO_DE_EJERCICIO -> {sets, rir, reps, carga, unidad, nota}}.
-- Gana la clave más larga que haga prefijo, para poder afinar un ejercicio
-- concreto sin romper la regla general.
--
-- LA CARGA VA EN `carga`, NO DENTRO DE `nota`
-- Desde que la carga se separó de la frase (`src/domain/prescripcion.ts`), el
-- ejercicio lleva `cargaKg`, `unidadCarga` y `notaCoach` además de la frase que
-- se lee. `carga` y `unidad` escriben los dos primeros; `nota` sigue siendo la
-- frase entera, tal como se pega desde el Excel.
--
-- POR QUÉ UN AJUSTE CON `nota` BORRA LOS CAMPOS
-- Si llega una frase nueva sin `carga`, los campos heredados describen la frase
-- VIEJA. Y ahora mandan ellos: `cargaSugerida` lee `cargaKg` antes que nada, así
-- que el asesorado abriría la serie con los kilos de la semana pasada mientras
-- lee los de esta. Se borran, y el ejercicio queda con la frase como única
-- verdad hasta que `scripts/rellenar-carga.mjs` vuelva a poblarlos en seco.
--
-- Y un ejercicio ajustado PIERDE `seriesPrescritas`: esa ondulación se calculó
-- sobre la prescripción vieja, y es lo primero que mira el stepper. Los
-- ejercicios sin ajuste la conservan, porque su prescripción no ha cambiado.
--
-- LOS CAMPOS SALEN DE LA FRASE
-- Desde el 2026-08-12, pasar `nota` **deriva** `sets`, `repsDiana`,
-- `rirObjetivo`, `cargaKg`, `unidadCarga` y `notaCoach` de esa frase
-- (`tmp_campos_de_frase`, §1b). Ya no hace falta repetirlos en el ajuste, y
-- sobre todo: **ya no se quedan heredados de la semana anterior**, que es lo que
-- provocó el incidente de los 170 ejercicios. Los ajustes explícitos siguen
-- valiendo y ganan sobre lo derivado: son la salida para las frases que el
-- patrón no sabe leer (porcentajes, peso corporal, tiempo).
--
-- LÍMITE QUE QUEDA
-- Cambiar `reps`, `rir` o `sets` SIN pasar `nota` deja la frase diciendo los
-- valores viejos, porque aquí no se puede componer: `componerPrescripcion` vive
-- en TypeScript. Pasa siempre `nota` junto a cualquier cambio estructural, que
-- además es lo natural: la frase nueva se pega del Excel de todos modos.
-- `comprobar-alineacion.sql` lo caza si se olvida.
create or replace function public.tmp_nuevo_micro(
  p_datos   jsonb,
  p_num     int,
  p_inicio  text,
  p_ajustes jsonb default '{}'::jsonb
) returns jsonb language sql stable as $fn$
  select jsonb_set(
    jsonb_set(
      jsonb_set(jsonb_set(p_datos, '{numero}', to_jsonb(p_num)),
                '{estado}', '"activo"'),
      '{fechaInicio}', to_jsonb(p_inicio)
    ),
    '{sesiones}',
    coalesce((
      select jsonb_agg(
               -- ↓↓↓ ESTE ENVOLTORIO ES EL ARREGLO. Sin él se heredan las
               --     marcas de ejecución del microciclo anterior.
               public.tmp_sesion_en_limpio(
                 jsonb_set(s, '{ejercicios}', coalesce((
                   select jsonb_agg(
                     ( jsonb_set(e, '{series}', '[]'::jsonb)   -- sin lo registrado
                       -- La ondulación guardada era de la prescripción vieja:
                       -- si este ejercicio se ajusta, deja de valer.
                       - (case when aj.v is null then '' else 'seriesPrescritas' end)
                       -- Y LAS ESCALERAS, por lo mismo y con más filo. Un
                       -- `techoCargaKg` se calcula CONTRA UNA CARGA CONCRETA:
                       -- heredado sobre otra deja de ser un techo. Probado en
                       -- seco el 2026-09-04 — bajando de 100 a 80 kg, el techo
                       -- viejo de 112,5 seguía puesto: pasaba de autorizar un
                       -- 12,5 % a autorizar un 40 %. Es el fósil de julio otra
                       -- vez, y hoy no ha mordido solo porque en producción
                       -- todavía no hay ni un ejercicio con escaleras.
                       - (case when aj.v is null then '' else 'escenarios' end)
                       -- Con frase nueva, los campos que la describían dejan de
                       -- valer. Se borran y se vuelven a derivar de la frase
                       -- justo debajo; los que no se puedan leer quedan fuera,
                       -- que es preferible a heredar un número que miente.
                       - (case when aj.v ? 'nota'
                               then array['cargaKg','unidadCarga','notaCoach']
                               else array[]::text[] end)
                       -- ↓↓↓ LOS CAMPOS SALEN DE LA FRASE, no del microciclo
                       --     anterior. Sin esto, una carga que pasa `nota` sin
                       --     pasar `sets`/`rir`/`reps` deja los campos viejos y
                       --     el asesorado lee una cosa mientras la app hace otra
                       --     (incidente del 2026-08-12, 170 ejercicios).
                       || case when aj.v ? 'nota'
                               then public.tmp_campos_de_frase(aj.v->>'nota')
                               else '{}'::jsonb end
                       -- El ajuste explícito manda sobre lo derivado: es la
                       -- salida para las frases que el patrón no sabe leer.
                       || case when aj.v ? 'sets'   then jsonb_build_object('sets', (aj.v->>'sets')::int) else '{}'::jsonb end
                       || case when aj.v ? 'rir'    then jsonb_build_object('rirObjetivo', (aj.v->>'rir')::int) else '{}'::jsonb end
                       || case when aj.v ? 'reps'   then jsonb_build_object('repsDiana', (aj.v->>'reps')::int) else '{}'::jsonb end
                       || case when aj.v ? 'carga'  then jsonb_build_object('cargaKg', (aj.v->>'carga')::numeric) else '{}'::jsonb end
                       || case when aj.v ? 'unidad' then jsonb_build_object('unidadCarga', aj.v->>'unidad') else '{}'::jsonb end
                       || case when aj.v ? 'nota'   then jsonb_build_object('prescripcion', aj.v->>'nota') else '{}'::jsonb end
                       -- LAS ESCALERAS DEL BUCLE DEL DÍA, traducidas al pasar.
                       --
                       -- El ③ las escribe en el vocabulario del contrato
                       -- (`techo_carga_kg`) y la app las lee en el suyo
                       -- (`techoCargaKg`). La traducción vive AQUÍ, en la única
                       -- costura por la que pasan, y no en los dos lados: dos
                       -- vocabularios que se traducen en dos sitios divergen.
                       --
                       -- Lo que no venga se queda fuera en vez de ir a null: un
                       -- `serieExtra: null` diría «no hay serie extra» y lo que
                       -- pasa es que nadie lo dijo. Y el verde puede faltar
                       -- entero (B-7, Bryan 2026-08-28: con la carga vetada no
                       -- hay subida que preautorizar), el rojo no.
                       || case when aj.v ? 'escenarios' then jsonb_build_object('escenarios',
                            (case when aj.v->'escenarios' ? 'verde' then jsonb_build_object('verde',
                               (case when aj.v->'escenarios'->'verde' ? 'delta_carga_kg'
                                     then jsonb_build_object('deltaCargaKg', aj.v->'escenarios'->'verde'->'delta_carga_kg') else '{}'::jsonb end)
                            || (case when aj.v->'escenarios'->'verde' ? 'serie_extra'
                                     then jsonb_build_object('serieExtra', aj.v->'escenarios'->'verde'->'serie_extra') else '{}'::jsonb end)
                            || jsonb_build_object('techoCargaKg', aj.v->'escenarios'->'verde'->'techo_carga_kg')
                            ) else '{}'::jsonb end)
                         || jsonb_build_object('rojo',
                               jsonb_build_object('deltaRir', aj.v->'escenarios'->'rojo'->'delta_rir',
                                                  'sueloRir', aj.v->'escenarios'->'rojo'->'suelo_rir')
                            || (case when aj.v->'escenarios'->'rojo' ? 'quitar_ultima_serie'
                                     then jsonb_build_object('quitarUltimaSerie', aj.v->'escenarios'->'rojo'->'quitar_ultima_serie') else '{}'::jsonb end))
                          ) else '{}'::jsonb end
                     ) order by ord)
                   from jsonb_array_elements(s->'ejercicios') with ordinality as t(e, ord)
                   left join lateral (
                     select value as v from jsonb_each(p_ajustes)
                      where upper(t.e->>'nombre') like upper(key) || '%'
                      order by length(key) desc limit 1
                   ) aj on true
                 ), '[]'::jsonb))
               )
               order by so)
        from jsonb_array_elements(p_datos->'sesiones') with ordinality as q(s, so)
    ), '[]'::jsonb)
  );
$fn$;
revoke execute on function public.tmp_nuevo_micro(jsonb, int, text, jsonb) from public;


-- ── 3 · Motor de carga por asesorado ───────────────────────────────────────
create or replace function public.tmp_cargar_siguiente(
  p_nombre  text,
  p_slug    text,
  p_inicio  text,
  p_ajustes jsonb default '{}'::jsonb
) returns text language plpgsql as $fn$
declare
  v_uid uuid; v_num int; v_datos jsonb; v_id text; v_src_id text; v_activos int;
  v_ambiguas text;
begin
  select u.id into v_uid from public.usuarios_app u where u.nombre = p_nombre;
  if v_uid is null then return 'NO ENCONTRADO: ' || p_nombre; end if;

  -- POR `estado`, NUNCA por `numero desc`. Con dos bloques conviviendo, el
  -- número más alto es el del bloque VIEJO: Karin tenía el M3 activo y un M20
  -- del bloque 1, y Laura un M3 activo con un M25. Clonar por `numero desc`
  -- creaba M21 y M26 — el bogus que hubo que borrar a mano el 2026-08-09 y que
  -- volvió a aparecer en el ensayo del 2026-08-16, porque el molde nunca se
  -- arregló, solo el resultado.
  --
  -- Y se cuenta ANTES de leer. `select into` de plpgsql **no falla con varias
  -- filas: se queda con una cualquiera, en silencio**. Con los 18 fantasmas del
  -- 2026-08-16 (columna 'cerrado', JSON 'activo') había gente con dos activos, y
  -- este clonador habría copiado el que le diera la gana sin avisar. Se cuenta
  -- por la columna Y por el JSON, porque la app lee el JSON.
  select count(*) into v_activos
    from public.microciclos m
   where m.usuario_id = v_uid
     and (m.estado = 'activo' or m.datos->>'estado' = 'activo');

  if v_activos = 0 then return 'SIN ACTIVO: ' || p_nombre; end if;
  if v_activos > 1 then
    return 'ABORTA · ' || p_nombre || ' tiene ' || v_activos ||
           ' microciclos activos. Resolver a mano antes de cargar.';
  end if;

  select m.id, m.numero, m.datos into v_src_id, v_num, v_datos
    from public.microciclos m
   where m.usuario_id = v_uid
     and (m.estado = 'activo' or m.datos->>'estado' = 'activo');

  -- ── UNA CLAVE DE AJUSTE QUE CASA CON DOS EJERCICIOS DE IGUAL NOMBRE ────
  -- `p_ajustes` empareja por PREFIJO DE NOMBRE. Si el microciclo lleva dos
  -- ejercicios con el mismo nombre y un ajuste apunta a ese nombre, **la misma
  -- carga se escribe en los dos** y no hay manera de afinar uno sin tocar el
  -- otro. Silencioso: la carga devuelve OK.
  --
  -- La auditoria del 2026-08-24 encontro 16 casos en 8 personas. Los congelados
  -- no corrian riesgo porque clonan sin ajustes; Karin, Maria Isabel y Karen si
  -- llevaban ajustes sobre nombres duplicados. Y las dos instancias NO son
  -- intercambiables: a Maria Isabel la misma «Sentadilla» le iba a 30 kg un dia
  -- y a 52,5 otro. Aplanarlas le habria puesto 52,5 en el dia ligero.
  --
  -- Solo aborta cuando el nombre duplicado esta REALMENTE apuntado por un
  -- ajuste. Un nombre repetido que nadie ajusta se clona igual y no molesta. Y
  -- una clave ancha que casa con varios ejercicios DISTINTOS sigue siendo
  -- legitima: para eso esta la regla de que gana la clave mas larga.
  --
  -- COMO SE SALE: renombrar una de las dos instancias en el microciclo ORIGEN
  -- antes de cargar (p. ej. anadiendole el dia), o alargar la clave del ajuste
  -- hasta que solo case con una.
  select string_agg(distinct d.nom, ' | ') into v_ambiguas
    from (
      select upper(e->>'nombre') as nom
        from jsonb_array_elements(v_datos->'sesiones') s,
             jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
       group by 1 having count(*) > 1
    ) d
   where exists (select 1 from jsonb_each(p_ajustes) a
                  where d.nom like upper(a.key) || '%');

  if v_ambiguas is not null then
    return 'ABORTA · ' || p_nombre || ' tiene ejercicios con el nombre repetido a los que '
        || 'apunta un ajuste, y ese ajuste les escribiria lo mismo a los dos: ' || v_ambiguas;
  end if;

  v_id := 'm-' || p_slug || '-' || (v_num + 1);

  -- El id destino no puede existir ya. Si existe, es de otro bloque con la misma
  -- numeración (`m-karin-5` del bloque 1 contra el M5 del bloque 2) y el
  -- `on conflict do update` lo sobrescribiría sin dejar rastro.
  if exists (select 1 from public.microciclos where id = v_id and id <> v_src_id
                                                and usuario_id is distinct from v_uid) then
    return 'ABORTA · el id ' || v_id || ' ya existe y es de otro usuario.';
  end if;

  insert into public.microciclos (id, usuario_id, numero, estado, datos, actualizado_en)
  values (v_id, v_uid, v_num + 1, 'activo',
          public.tmp_nuevo_micro(v_datos, v_num + 1, p_inicio, p_ajustes)
            || jsonb_build_object('id', v_id),
          now())
  on conflict (id) do update
     set datos = excluded.datos, estado = 'activo', actualizado_en = now();

  -- Cierra el anterior en la COLUMNA y en el JSON (la app lee el JSON).
  -- Las dos, siempre. El 2026-08-16 aparecieron **18 microciclos de julio con la
  -- columna en 'cerrado' y el JSON en 'activo'**, de 17 asesorados: alguna carga
  -- vieja cerró solo la columna. Como la app lee el JSON, esas 17 personas
  -- arrastraban un microciclo fantasma abierto, y la comprobación de «un solo
  -- activo» no lo veía porque contaba por la columna. Se corrigieron en bloque.
  --
  -- Se cierra POR ID, no por `numero`. Con dos bloques conviviendo hay números
  -- repetidos —el M5 del bloque 1 y el M5 del bloque 2 de la misma persona— y
  -- cerrar por número tumbaba los dos.
  update public.microciclos
     set estado = 'cerrado', datos = jsonb_set(datos, '{estado}', '"cerrado"')
   where id = v_src_id and id <> v_id;

  -- Red de seguridad: después de cargar tiene que quedar exactamente uno activo.
  -- Si no, se revienta la transacción entera en vez de dejar el fantasma puesto.
  select count(*) into v_activos
    from public.microciclos m
   where m.usuario_id = v_uid
     and (m.estado = 'activo' or m.datos->>'estado' = 'activo');

  if v_activos <> 1 then
    raise exception 'ABORTA · % quedó con % microciclos activos tras la carga',
      p_nombre, v_activos;
  end if;

  return 'OK ' || p_slug || ' -> M' || (v_num + 1);
end;
$fn$;
revoke execute on function public.tmp_cargar_siguiente(text, text, text, jsonb) from public;


-- ── 4 · Cómo se usa ────────────────────────────────────────────────────────
-- En la carga real (archivo `_app-cargar-*.sql`, que NO va al repo):
--
--   begin;
--   select public.tmp_cargar_siguiente('<NOMBRE EN usuarios_app>', '<slug>', '<YYYY-MM-DD>',
--     jsonb_build_object(
--       'PREFIJO DEL EJERCICIO',
--       jsonb_build_object('reps',8,'rir',2,'carga',62.5,'nota','<prescripción>')
--     ));
--   commit;
--
-- `carga` son kilos, en número: 62.5, no '62.5KG'. `unidad` solo hace falta
-- cuando ese número no es lo que marca la barra — 'total', 'por lado' o 'por
-- mano'—; sin ella se asume 'kg'. Confundirlas duplica o parte en dos la carga
-- la próxima vez que el motor progrese ese ejercicio.
--
-- El nombre tiene que coincidir EXACTO con `usuarios_app.nombre`, tildes
-- incluidas. Si no existe, la función devuelve 'NO ENCONTRADO: <nombre>' en vez
-- de fallar: lee la salida de cada llamada, una carga silenciosa que no cargó
-- nada se parece mucho a una que sí.


-- ── 5 · Borrar las funciones temporales (SIEMPRE, al terminar) ─────────────
-- drop function if exists public.tmp_cargar_siguiente(text, text, text, jsonb);
-- drop function if exists public.tmp_nuevo_micro(jsonb, int, text, jsonb);
-- drop function if exists public.tmp_campos_de_frase(text);
-- drop function if exists public.tmp_sesion_en_limpio(jsonb);
-- drop function if exists public.tmp_sin_marcas(jsonb);


-- ── 6 · Verificación OBLIGATORIA después de cargar ─────────────────────────
-- Las tres columnas de rastro tienen que dar CERO en el microciclo recién
-- creado. Si alguna no da cero, el clonador heredó ejecución: no repartas la
-- semana hasta arreglarlo.
--
--   select u.nombre, m.numero,
--          (select count(*) from jsonb_array_elements(m.datos->'sesiones') s,
--                  jsonb_array_elements(coalesce(s->'preparacion','[]'::jsonb)
--                                    || coalesce(s->'bloquesCardio','[]'::jsonb)) x
--            where x->>'hechoEn' is not null)                        as marcas,
--          (select count(*) from jsonb_array_elements(m.datos->'sesiones') s
--            where s->'testPost' is not null)                        as tests,
--          (select count(*) from jsonb_array_elements(m.datos->'sesiones') s,
--                  jsonb_array_elements(s->'ejercicios') e,
--                  jsonb_array_elements(e->'series') x)              as series
--     from public.microciclos m
--     join public.usuarios_app u on u.id = m.usuario_id
--    where m.estado = 'activo'
--    order by u.nombre;
--
-- Es lo mismo que comprueba `comprobar-fosiles.sql`, que además distingue
-- fósil de marca real por fecha.
--
-- Y correr también `comprobar-alineacion.sql`: compara la frase con los campos y
-- tiene que dar CERO FILAS. Es el árbitro entre `tmp_campos_de_frase` (§1b) y
-- `src/domain/prescripcion.ts`, que son dos implementaciones de la misma regla y
-- podrían separarse sin que nadie lo notara.
--
-- Y una más, añadida el 2026-08-16 porque las anteriores no la veían: el estado
-- de la COLUMNA y el del JSON tienen que coincidir en toda la tabla.
--
--   select count(*) from public.microciclos
--    where estado is distinct from (datos->>'estado');   -- tiene que dar 0
--
-- Contar activos por la columna daba «uno por persona» mientras 17 asesorados
-- tenían un microciclo de julio con el JSON en 'activo'. La app lee el JSON.


-- ============================================================================
-- §7 · EL CAMPO `dia` · cuatro reglas, escritas el 2026-08-17
-- ----------------------------------------------------------------------------
-- `armarSemana` (domain/rutaEntrenamiento.ts) coloca PRIMERO las sesiones que
-- traen `dia` y solo reparte por `orden`, desde el lunes, las que no. O sea que
-- **el campo `dia` manda sobre el orden**. Eso lo hace potente y silencioso a la
-- vez: cuando está mal no falla, coloca la sesión en otro día y nadie se entera.
--
-- Las cuatro fallaron el mismo día. Las cuatro tienen que dar CERO filas.
--
-- 1. SI EL NOMBRE DICE EL DÍA, EL CAMPO TIENE QUE DECIR LO MISMO.
--    46 sesiones decían «(JUEVES)» con el campo vacío: el asesorado leía una cosa
--    y el calendario le ponía otra.
--    COROLARIO: si una función toca el nombre, tiene que tocar el campo. El
--    reordenador cambiaba el día dentro del nombre y no el campo, así que mover
--    la prevención de hombro de Karin al lunes NO SURTIÓ EFECTO y nadie lo vio.
--
-- 2. NINGÚN DÍA PUEDE CAER ANTES DE `fechaInicio`.
--    16 asesorados tenían sesiones fechadas antes de arrancar su bloque —
--    empezaba el miércoles con sesiones etiquetadas lunes y martes. El volumen se
--    recupera a los 8 días; el ORDEN no, y el orden es decisión clínica.
--
-- 3. SI HAY SESIÓN EN DOMINGO, EL MICROCICLO NO ARRANCA A MEDIA SEMANA.
--    `inicioSemanaDe` toma el domingo como primer día en cuanto existe una sesión
--    en domingo. Con arranque en martes, esa sesión se va al domingo ANTERIOR.
--
-- 4. SI SE MUEVE EL ARRANQUE DE ALGUIEN, HAY QUE RECOLOCARLE LOS DÍAS.
--    Mover la fecha sin mover los días deja su primera sesión en el pasado.
--
-- ── Comprobación 1: nombre y campo dicen lo mismo ───────────────────────────
--
--   select u.nombre, s->>'nombre', s->>'dia'
--     from public.microciclos m join public.usuarios_app u on u.id = m.usuario_id,
--          jsonb_array_elements(m.datos->'sesiones') s
--    where m.estado = 'activo'
--      and substring(s->>'nombre' from '(LUNES|MARTES|MIÉRCOLES|JUEVES|VIERNES|SÁBADO|DOMINGO)') is not null
--      and s->>'dia' is distinct from
--          substring(s->>'nombre' from '(LUNES|MARTES|MIÉRCOLES|JUEVES|VIERNES|SÁBADO|DOMINGO)');
--
-- ── Comprobación 2-4: ninguna sesión cae antes de arrancar ──────────────────
-- Replica lo que hace `armarSemana`. Cubre las reglas 2, 3 y 4 de una vez.
--
--   with cfg as (
--     select u.nombre, m.id mid, m.datos, (m.datos->>'fechaInicio')::date ini,
--            case when extract(dow from (m.datos->>'fechaInicio')::date)::int = 0 then 'DOMINGO'
--                 when extract(dow from (m.datos->>'fechaInicio')::date)::int = 1 then 'LUNES'
--                 when exists (select 1 from jsonb_array_elements(m.datos->'sesiones') s
--                               where s->>'dia' = 'DOMINGO') then 'DOMINGO'
--                 else 'LUNES' end inicio_sem
--       from public.microciclos m join public.usuarios_app u on u.id = m.usuario_id
--      where m.estado = 'activo'),
--   slots as (
--     select c.*, (current_date - (case when c.inicio_sem='DOMINGO' then 2 else 1 end) + i) fecha,
--            (array['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'])[
--              extract(dow from (current_date - (case when c.inicio_sem='DOMINGO' then 2 else 1 end) + i))::int + 1] dia_nom
--       from cfg c, generate_series(0,6) i)
--   select sl.nombre, sl.ini "arranca", sl.fecha "cae", s->>'nombre' "sesion huerfana"
--     from slots sl, jsonb_array_elements(sl.datos->'sesiones') s
--    where s->>'dia' = sl.dia_nom and sl.fecha < sl.ini
--      and jsonb_array_length(coalesce(s->'ejercicios','[]'::jsonb)) > 0;
-- ============================================================================
