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
-- de cardio y sin test post. NO toca ejercicios (de eso se encarga quien llama).
create or replace function public.tmp_sesion_en_limpio(p_s jsonb)
returns jsonb language sql immutable as $fn$
  select (
           case when con_cardio ? 'preparacion'
                then jsonb_set(con_cardio, '{preparacion}',
                               public.tmp_sin_marcas(con_cardio->'preparacion'))
                else con_cardio
           end
         ) - 'testPost'          -- inofensivo si la clave no está
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
  v_uid uuid; v_num int; v_datos jsonb; v_id text;
begin
  select u.id into v_uid from public.usuarios_app u where u.nombre = p_nombre;
  if v_uid is null then return 'NO ENCONTRADO: ' || p_nombre; end if;

  select m.numero, m.datos into v_num, v_datos
    from public.microciclos m
   where m.usuario_id = v_uid
   order by m.numero desc limit 1;

  if v_num is null then return 'SIN MICROCICLO: ' || p_nombre; end if;

  v_id := 'm-' || p_slug || '-' || (v_num + 1);

  insert into public.microciclos (id, usuario_id, numero, estado, datos, actualizado_en)
  values (v_id, v_uid, v_num + 1, 'activo',
          public.tmp_nuevo_micro(v_datos, v_num + 1, p_inicio, p_ajustes)
            || jsonb_build_object('id', v_id),
          now())
  on conflict (id) do update
     set datos = excluded.datos, estado = 'activo', actualizado_en = now();

  -- Cierra el anterior en la COLUMNA y en el JSON (la app lee el JSON).
  update public.microciclos
     set estado = 'cerrado', datos = jsonb_set(datos, '{estado}', '"cerrado"')
   where usuario_id = v_uid and numero = v_num;

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
<<<<<<< Updated upstream
=======
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

-- ----------------------------------------------------------------------------
-- §7.1 · LOS DOS PUNTOS CIEGOS DE LA COMPROBACIÓN DE ARRIBA (2026-08-18)
-- ----------------------------------------------------------------------------
-- La comprobación 2-4 se ancla en `current_date`, igual que `armarSemana`. Eso
-- está bien para auditar la semana que se está corriendo, pero falla en dos
-- casos, y los dos aparecieron el mismo día:
--
--   A. MICROCICLOS QUE AÚN NO HAN ARRANCADO.
--      Marca TODAS sus sesiones como huérfanas, porque las evalúa contra la
--      semana actual y su fechaInicio todavía es futura. El 18-ago dio 8 falsos
--      positivos: las 4 de Bolaño (arranca el 25) y las 4 de Laura Valentina
--      (arranca el 24), estando las 8 bien colocadas.
--
--   B. CADENCIA DISTINTA DE 8.
--      Un microciclo de 15 días ocupa TRES semanas de calendario, así que una
--      sesión puede ser legítima aunque no quepa en la primera. A Juliana
--      (cadencia 15, arranca martes 11-ago) su sesión de LUNES le cae el 17 y el
--      24, las dos dentro de su ventana. Anclar la comprobación en la semana de
--      su fechaInicio la marca como huérfana y NO LO ESTÁ.
--
-- La versión de abajo arregla las dos: se ancla en la ventana real del propio
-- microciclo, y solo exige "todo en la primera semana" cuando la cadencia <= 8.
-- Tiene que dar CERO filas.
--
--   with cfg as (
--     select u.nombre, m.id mid, m.datos, (m.datos->>'fechaInicio')::date ini,
--            (m.datos->>'cadenciaDias')::int cad,
--            case when extract(dow from (m.datos->>'fechaInicio')::date)::int = 0 then 'DOMINGO'
--                 when extract(dow from (m.datos->>'fechaInicio')::date)::int = 1 then 'LUNES'
--                 when exists (select 1 from jsonb_array_elements(m.datos->'sesiones') s
--                               where s->>'dia' = 'DOMINGO') then 'DOMINGO'
--                 else 'LUNES' end inicio_sem
--       from public.microciclos m join public.usuarios_app u on u.id = m.usuario_id
--      where m.estado = 'activo'),
--   ses as (
--     select c.*, s->>'dia' dia, s->>'nombre' sesion
--       from cfg c, jsonb_array_elements(c.datos->'sesiones') s
--      where s->>'dia' is not null
--        and jsonb_array_length(coalesce(s->'ejercicios','[]'::jsonb)) > 0),
--   ventana as (
--     select se.*, (se.ini + i) f,
--            (array['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'])[
--              extract(dow from (se.ini + i))::int + 1] dn
--       from ses se, generate_series(0, greatest(se.cad,7) - 1) i),
--   alcance as (
--     select nombre, mid, ini, cad, inicio_sem, dia, sesion,
--            min(case when dn = dia then f end) primera
--       from ventana group by 1,2,3,4,5,6,7)
--   select nombre, mid, ini "arranca", cad, dia, sesion, primera, motivo from (
--     select a.*,
--            case when primera is null then 'INALCANZABLE en toda la ventana'
--                 when cad <= 8 and primera >= ini - extract(dow from ini)::int
--                      + (case when inicio_sem = 'DOMINGO' then 0 else 1 end) + 7
--                      then 'Cae fuera de la primera semana (cadencia<=8)'
--            end motivo
--       from alcance a) t
--    where motivo is not null;
--
-- CÓMO SE ARREGLA UNA HUÉRFANA DE VERDAD, con el caso real de Laura Valentina:
-- su M1 arrancaba el martes 25 con sesiones MARTES/JUEVES/SÁBADO/LUNES. La de
-- LUNES caía el 24, un día antes de empezar. Su aviso le prometía "un día sí y
-- un día no, 48 horas entre sesiones", así que la solución NO era mover esa
-- sesión a miércoles o viernes —rompía el ritmo prometido— sino CORRER EL
-- ARRANQUE AL LUNES 24 y recolocar las cuatro a LUNES/MIÉRCOLES/VIERNES/DOMINGO.
-- Mismo ritmo de 48 h, las cuatro dentro de la ventana, y es el patrón que ya
-- funciona en producción con Mara. Se tocaron a la vez las TRES cosas: el campo
-- `dia`, el día dentro del `nombre`, y la frase del aviso en perfiles.objetivos.
-- ============================================================================
>>>>>>> Stashed changes
