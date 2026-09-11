-- ============================================================================
-- COMPROBAR 0055 · la ventana de la mesa va por fecha
-- ============================================================================
--
-- Contrato: CERO filas. Cualquier fila que salga es un fallo con su nombre.
--
-- ⚠ ESTAS SEÑALES SE VIERON EN ROJO A PROPÓSITO antes de darlas por buenas,
--   corriéndolas contra la función de la 0054. La señal 1 sacaba 6 personas y la
--   señal 2 sacaba a Juan Andrés Bolaño. Un guardián que solo se ha visto en
--   verde no está comprobado.
-- ============================================================================

-- ── SEÑAL 1 · nadie con la ventana en un bloque más viejo que el actual ──────
-- La comprobación de fondo: los tres que mira la mesa tienen que ser los tres
-- más recientes POR FECHA. Se calculan los dos conjuntos y se comparan.
with act as (
  select u.id, u.nombre
    from public.usuarios_app u
    join public.microciclos m on m.usuario_id = u.id and m.estado = 'activo'),
por_num as (
  select a.id, array_agg(m.numero order by m.numero desc) v
    from act a join lateral (
      select numero from public.microciclos
       where usuario_id = a.id order by numero desc limit 3) m on true
   group by 1),
por_fecha as (
  select a.id, array_agg(m.numero order by m.ini desc, m.numero desc) v
    from act a join lateral (
      select numero, (datos->>'fechaInicio')::date ini from public.microciclos
       where usuario_id = a.id
       order by (datos->>'fechaInicio')::date desc, numero desc limit 3) m on true
   group by 1)
select 'SEÑAL 1 · la ventana por número y por fecha traen microciclos DISTINTOS'
       as fallo, a.nombre, p.v as por_numero, f.v as por_fecha
  from act a join por_num p on p.id = a.id join por_fecha f on f.id = a.id
 where (select array_agg(x order by x) from unnest(p.v) x)
    is distinct from
       (select array_agg(x order by x) from unnest(f.v) x);

-- ── SEÑAL 2 · el conteo de la mesa cuadra con la ventana por fecha ───────────
-- La de arriba mira QUÉ microciclos entran; esta mira que el NÚMERO que sale de
-- la función sea el de esos microciclos. Si la función se cambiara y la señal 1
-- siguiera verde por casualidad, esta lo caza igual.
with esperado as (
  select u.nombre,
         count(*) as ejercicios,
         count(*) filter (where jsonb_array_length(coalesce(e->'series','[]'::jsonb)) > 0) as con_serie
    from public.usuarios_app u
    join public.microciclos act on act.usuario_id = u.id and act.estado = 'activo'
    join lateral (
      select datos from public.microciclos
       where usuario_id = u.id
       order by (datos->>'fechaInicio')::date desc, numero desc limit 3) v on true,
      lateral jsonb_array_elements(v.datos->'sesiones') s,
      lateral jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
   group by 1),
dice as (
  select f->>'nombre' nombre,
         (f->>'ejercicios_3m')::int ejercicios,
         (f->>'con_serie_3m')::int con_serie
    from json_array_elements(public.mesa_del_sabado()) f)
select 'SEÑAL 2 · la mesa cuenta distinto de la ventana por fecha' as fallo,
       e.nombre, e.ejercicios as esperados, d.ejercicios as dice_la_mesa,
       e.con_serie as con_serie_esperado, d.con_serie as con_serie_mesa
  from esperado e join dice d on d.nombre = e.nombre
 where e.ejercicios is distinct from d.ejercicios
    or e.con_serie is distinct from d.con_serie;

-- ── SEÑAL 3 · la mesa no pierde a nadie ─────────────────────────────────────
-- Un arreglo de la ventana no puede cambiar CUÁNTA gente sale. Si esta señal se
-- enciende, el `join` de la ventana está descartando filas.
select 'SEÑAL 3 · la mesa trae menos personas que microciclos activos' as fallo,
       (select count(*) from public.microciclos where estado = 'activo') as activos,
       (select count(*) from json_array_elements(public.mesa_del_sabado())) as en_la_mesa
 where (select count(*) from public.microciclos where estado = 'activo')
    <> (select count(*) from json_array_elements(public.mesa_del_sabado()));
