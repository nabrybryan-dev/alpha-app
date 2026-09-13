-- ¿Se guarda de verdad el cribado de salud que la persona contesta en la app?
--
-- POR QUÉ ESTA PRUEBA EXISTE. La 0062 reescribió `contestar_cribado()` y perdió los
-- `::boolean` de los tres `parq_*` que la 0058 sí tenía. `p_cribado->>'parq_…'` es
-- TEXTO y la columna es BOOLEAN, así que la función revienta con 42883
-- («operator does not exist: boolean = text») en cuanto se planifica, para
-- cualquier persona y con cualquier respuesta. PostgREST traduce 42883 a un 404, la
-- app lo lee como «función inexistente», reintenta ocho veces, lo aparta, lo rescata
-- dos veces más… y el formulario vuelve a salir en «Hoy» porque arriba nunca hay fila.
--
-- Medido en producción el 2026-09-12: CERO cribados con `fuente = 'app'` en toda la
-- tabla, y 37 intentos fallidos en 24 h de dos asesorados reales. El CI estaba verde
-- porque ninguna prueba llamaba a la función: esta es la que faltaba.
--
-- Son las MISMAS claves que manda `src/data/nube/sync.ts` (payload `p_cribado`), con
-- los doce campos que exige el CHECK `cribado_de_la_app_esta_completo`.
--
-- Corre como `authenticated` con el uid puesto a mano, así que la RLS de `cribado`
-- (alta solo de lo suyo y solo con `fuente = 'app'`) se evalúa igual que arriba.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla mínima ───────────────────
-- Un uuid propio para no chocar con las personas de las otras pruebas.
insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'cribado@ejemplo.test')
on conflict (id) do nothing;

-- `do update` y no `do nothing`: el trigger de la 0001 ya creó la fila con el rol por
-- defecto al insertar en `auth.users` (ver 10-escrituras-del-asesorado.sql).
insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('44444444-4444-4444-4444-444444444444', 'Asesorada del cribado', 'asesorado', 'AC')
on conflict (id) do update set
  nombre = excluded.nombre,
  rol = excluded.rol,
  avatar_iniciales = excluded.avatar_iniciales;

-- ─────────────────── Como la asesorada ───────────────────
select pruebas.soy('44444444-4444-4444-4444-444444444444');
set role authenticated;
select pruebas.exigir_rls();

-- 1. La primera respuesta entra. Es la llamada que hoy revienta con 42883: si alguien
--    vuelve a comparar un `parq_*` con texto, esta línea tumba el CI.
select pruebas.afirmar(
  public.contestar_cribado($json$
  {
    "fecha": "2026-09-12",
    "diagnostico": "ausente",
    "quien_lo_lleva": "ausente",
    "tratamiento_activo": "ausente",
    "medicacion_cronica": "ausente",
    "autorizacion_sanitaria": "no_declarado",
    "restricciones_explicitas": "ausente",
    "sintomas_con_esfuerzo": "ausente",
    "nivel_funcional": "ausente",
    "que_le_han_dicho_que_no_haga": "ausente",
    "parq_enfermedad_cardiaca": false,
    "parq_medicamento_presion": false,
    "parq_huesos_articulaciones": false,
    "detalle": {}
  }
  $json$::jsonb) is true,
  'la primera respuesta del cribado no se guardó'
);

select pruebas.afirmar(
  (select count(*) from public.cribado
    where usuario_id = '44444444-4444-4444-4444-444444444444' and fuente = 'app') = 1,
  'contestar_cribado devolvió true pero no hay fila'
);

-- Lo que se guarda es un BOOLEANO de verdad, no un texto que se pareciera: `false` es
-- «se preguntó y dijo que no», y `null` sería «no se preguntó».
select pruebas.afirmar(
  (select parq_enfermedad_cardiaca is false
      and parq_medicamento_presion is false
      and parq_huesos_articulaciones is false
     from public.cribado
    where usuario_id = '44444444-4444-4444-4444-444444444444'),
  'los tres parq_* no quedaron guardados como false'
);

-- 2. La MISMA respuesta el mismo día no es una respuesta nueva: devuelve false y no
--    duplica. Este camino es el que compara columna a columna, incluidos los parq_*.
select pruebas.afirmar(
  public.contestar_cribado($json$
  {
    "fecha": "2026-09-12",
    "diagnostico": "ausente",
    "quien_lo_lleva": "ausente",
    "tratamiento_activo": "ausente",
    "medicacion_cronica": "ausente",
    "autorizacion_sanitaria": "no_declarado",
    "restricciones_explicitas": "ausente",
    "sintomas_con_esfuerzo": "ausente",
    "nivel_funcional": "ausente",
    "que_le_han_dicho_que_no_haga": "ausente",
    "parq_enfermedad_cardiaca": false,
    "parq_medicamento_presion": false,
    "parq_huesos_articulaciones": false,
    "detalle": {}
  }
  $json$::jsonb) is false,
  'el doble toque con la misma respuesta no se reconoció como duplicado'
);

select pruebas.afirmar(
  (select count(*) from public.cribado
    where usuario_id = '44444444-4444-4444-4444-444444444444') = 1,
  'la misma respuesta del mismo día se guardó dos veces'
);

-- 3. Un cambio en UN solo parq_* sí es una respuesta nueva. Si la comparación
--    ignorara los booleanos, este «sí» a la pregunta cardiaca se perdería.
select pruebas.afirmar(
  public.contestar_cribado($json$
  {
    "fecha": "2026-09-12",
    "diagnostico": "ausente",
    "quien_lo_lleva": "ausente",
    "tratamiento_activo": "ausente",
    "medicacion_cronica": "ausente",
    "autorizacion_sanitaria": "no_declarado",
    "restricciones_explicitas": "ausente",
    "sintomas_con_esfuerzo": "ausente",
    "nivel_funcional": "ausente",
    "que_le_han_dicho_que_no_haga": "ausente",
    "parq_enfermedad_cardiaca": true,
    "parq_medicamento_presion": false,
    "parq_huesos_articulaciones": false,
    "detalle": {"parq_enfermedad_cardiaca": "soplo diagnosticado de niña"}
  }
  $json$::jsonb) is true,
  'un cambio en la pregunta cardiaca no se guardó como respuesta nueva'
);

select pruebas.afirmar(
  (select count(*) from public.cribado
    where usuario_id = '44444444-4444-4444-4444-444444444444'
      and parq_enfermedad_cardiaca is true) = 1,
  'el «sí» cardiaco no quedó guardado como true'
);

reset role;

rollback;
