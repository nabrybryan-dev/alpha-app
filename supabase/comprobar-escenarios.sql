-- Comprobación de las escaleras del bucle del día. **Cero filas** en las cuatro.
--
-- Se corre DESPUÉS DE CADA CARGA, con las demás `comprobar-*.sql`.
--
-- POR QUÉ HACE FALTA. Un `techoCargaKg` no es un número suelto: **se calcula
-- contra una carga concreta**. Heredado sobre otra deja de ser un techo y pasa a
-- ser un cheque en blanco, que es exactamente lo que un techo existe para
-- impedir. Probado en seco el 2026-09-04 sobre el clonador de entonces: bajando
-- un ejercicio de 100 a 80 kg, el techo viejo de 112,5 seguía puesto — pasaba de
-- autorizar un 12,5 % a autorizar un 40 %. Es el fósil de julio con otra cara.
--
-- El molde ya no lo hereda (borra `escenarios` cuando el ejercicio se ajusta) y
-- sabe escribirlo traduciendo del vocabulario del ③. Esto vigila que siga así.

-- ── 1 · Un techo por DEBAJO de su propia carga ──────────────────────────────
-- No es un umbral: es una imposibilidad. Un techo bajo la prescripción significa
-- que el techo se calculó para otra carga, o que la carga cambió después.
select 'senal 1' as senal, u.nombre, e->>'nombre' as ejercicio,
       (e->>'cargaKg')::numeric as carga,
       (e->'escenarios'->'verde'->>'techoCargaKg')::numeric as techo
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
  cross join lateral jsonb_array_elements(m.datos->'sesiones') s
  cross join lateral jsonb_array_elements(s->'ejercicios') e
 where e->'escenarios'->'verde' ? 'techoCargaKg'
   and (e->>'cargaKg') ~ '^-?[0-9.]+$'
   and (e->'escenarios'->'verde'->>'techoCargaKg')::numeric <= (e->>'cargaKg')::numeric;

-- ── 2 · Vocabulario del contrato que se coló sin traducir ───────────────────
-- El ③ escribe `techo_carga_kg` y la app lee `techoCargaKg`. Si aparece el
-- primero dentro de `microciclos.datos`, alguien cargó saltándose el molde y la
-- app ve el ejercicio SIN escaleras sin que nada falle: el peor de los silencios.
select 'senal 2' as senal, u.nombre, e->>'nombre' as ejercicio,
       e->'escenarios' as escenarios_en_crudo
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
  cross join lateral jsonb_array_elements(m.datos->'sesiones') s
  cross join lateral jsonb_array_elements(s->'ejercicios') e
 where e->'escenarios'->'verde' ? 'techo_carga_kg'
    or e->'escenarios'->'rojo'  ? 'suelo_rir'
    or e->'escenarios'->'rojo'  ? 'delta_rir';

-- ── 3 · Un verde sin techo, o un rojo sin suelo ─────────────────────────────
-- Los dos son obligatorios y por el mismo motivo: sin ellos el camino deja de
-- estar acotado. El verde puede FALTAR entero (B-7, Bryan 2026-08-28: con la
-- carga vetada no hay subida que preautorizar); lo que no puede es estar a medias.
select 'senal 3' as senal, u.nombre, e->>'nombre' as ejercicio,
       case when e->'escenarios' ? 'verde' and not (e->'escenarios'->'verde' ? 'techoCargaKg')
            then 'verde sin techo' else 'rojo sin suelo o sin rojo' end as que_falta
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
  cross join lateral jsonb_array_elements(m.datos->'sesiones') s
  cross join lateral jsonb_array_elements(s->'ejercicios') e
 where e ? 'escenarios'
   and ( (e->'escenarios' ? 'verde' and not (e->'escenarios'->'verde' ? 'techoCargaKg'))
      or not (e->'escenarios' ? 'rojo')
      or not (e->'escenarios'->'rojo' ? 'sueloRir') );

-- ── 4 · Escaleras en kg sobre un ejercicio que no tiene kg ──────────────────
-- Un techo en kilos sobre un ejercicio sin carga asignada no acota nada. Ojo con
-- el cero: `cargaKg: 0` es PESO CORPORAL y es un dato legítimo — lo que no vale
-- es el ausente.
select 'senal 4' as senal, u.nombre, e->>'nombre' as ejercicio
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
  cross join lateral jsonb_array_elements(m.datos->'sesiones') s
  cross join lateral jsonb_array_elements(s->'ejercicios') e
 where e->'escenarios'->'verde' ? 'techoCargaKg'
   -- OJO CON EL NULO, y este check nació sin proteger nada por esto (2026-09-04).
   -- `"cargaKg": null` en el JSON NO es un SQL NULL: `e->'cargaKg' is null` da
   -- falso, y `e->>'cargaKg' = 'null'` da **NULL**, no `true`. Un nulo no entra
   -- en un `where`, así que el señuelo pasaba limpio. Se pregunta al revés —«no
   -- es un número»— que cubre el ausente y el nulo con la misma frase.
   and coalesce(e->>'cargaKg', '') !~ '^-?[0-9.]+$';
