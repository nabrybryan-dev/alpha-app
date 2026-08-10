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
-- LÍMITE CONOCIDO
-- Cambiar `reps`, `rir` o `sets` SIN pasar `nota` deja la frase diciendo los
-- valores viejos, porque aquí no se puede componer: `componerPrescripcion` vive
-- en TypeScript. Pasa siempre `nota` junto a cualquier cambio estructural, que
-- además es lo natural: la frase nueva se pega del Excel de todos modos.
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
                       -- La nota vieja no sobrevive a una frase nueva: la nota
                       -- es lo que va DESPUÉS de la cabecera de esa frase, y
                       -- `componerPrescripcion` la volvería a pegar al final.
                       - (case when aj.v ? 'nota' then 'notaCoach' else '' end)
                       -- Frase nueva sin carga nueva = la carga heredada miente,
                       -- y ahora manda ella sobre lo que se propone en el stepper.
                       - (case when aj.v ? 'nota' and not (aj.v ? 'carga')
                               then array['cargaKg','unidadCarga']
                               else array[]::text[] end)
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
