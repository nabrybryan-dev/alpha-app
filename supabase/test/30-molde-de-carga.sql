-- ¿El molde de carga sabe cambiar el `cues` de un ejercicio?
--
-- POR QUÉ ESTA PRUEBA EXISTE. `tmp_nuevo_micro` es un CLONADOR: coge el `datos`
-- del microciclo anterior y produce el siguiente aplicando `p_ajustes`. Sus
-- llaves eran seis —`sets`, `rir`, `reps`, `carga`, `unidad`, `nota`— y **`cues`
-- no estaba entre ellas**. Consecuencia: el consejo técnico se HEREDABA sin que
-- hubiera forma de cambiarlo. No se perdía; se quedaba el viejo, que en un
-- clonador es peor, porque no se nota.
--
-- Es la misma familia que el `escenarios` heredado (arreglado el 2026-09-04):
-- lo que el ③ escribe y el molde no tiene dónde poner, desaparece en silencio.
-- El propio comando del ④ ya avisaba de esto para `cues` desde agosto.
--
-- LO QUE ESTA PRUEBA **NO** EXIGE, y es una decisión medida: que un `nota` nuevo
-- BORRE el `cues` heredado. El contrato dice que ahí va «la excepción, no la
-- norma», pero la realidad de la cartera dice otra cosa — medido el 2026-09-05
-- sobre producción: **465 de 465 ejercicios activos tienen `cues`, y solo 2
-- parecen una excepción** («última serie: parciales…»). Se usa como nota técnica
-- del EJERCICIO, no de la prescripción. Borrar 465 notas útiles para hacer
-- cumplir una cláusula que nadie sigue sería un arreglo peor que el problema.
--
--   Queda anotado el riesgo que sí es real: en esos 2 casos, un `cues` que
--   describe una excepción de la semana pasada sobrevive a una prescripción
--   nueva. Se caza con `supabase/comprobar-cues.sql`.
--
-- Corre sobre la base de pruebas del CI, después de las migraciones.

\set ON_ERROR_STOP on

begin;

-- El molde vive en `supabase/plantilla-carga-microciclo.sql` y NO es una
-- migración: se pega a mano en el editor. Aquí se cargan solo las dos funciones
-- que hacen falta, copiadas de esa plantilla — si divergen, esta prueba deja de
-- probar el molde de verdad y hay que traerlas otra vez.
\i supabase/plantilla-carga-microciclo.sql

-- ─────────────────── El microciclo de partida ───────────────────
create temporary table molde_previo (datos jsonb);
insert into molde_previo values ($json$
{
  "id": "m-prueba-1",
  "numero": 1,
  "estado": "activo",
  "cadenciaDias": 8,
  "fechaInicio": "2026-09-01",
  "sesiones": [{
    "id": "s1", "nombre": "LEG A", "orden": 1, "dia": "LUNES",
    "ejercicios": [
      {
        "id": "e1", "categoria": "SENTADILLA", "nombre": "PRENSA 45 GRADOS",
        "cues": "CONSEJO VIEJO: rodillas fuera",
        "prescripcion": "80KG A 10 REPS; 3 SERIES (RIR 2).",
        "descansoMin": 2, "sets": 3, "rango": "8-10", "repsDiana": 10,
        "rirObjetivo": 2, "cargaKg": 80, "unidadCarga": "kg", "series": []
      },
      {
        "id": "e2", "categoria": "EXTENSIÓN DE RODILLA", "nombre": "EXTENSION DE RODILLA",
        "cues": "CONSEJO QUE SE QUEDA",
        "prescripcion": "35KG A 12 REPS; 3 SERIES (RIR 1).",
        "descansoMin": 2, "sets": 3, "rango": "12-15", "repsDiana": 12,
        "rirObjetivo": 1, "cargaKg": 35, "unidadCarga": "kg", "series": []
      }
    ]
  }]
}
$json$::jsonb);

-- ─────────────────── 1 · Un `cues` nuevo TIENE que llegar ───────────────────
do $$
declare
  v jsonb;
  v_cues text;
begin
  select public.tmp_nuevo_micro(
           datos, 2, '2026-09-09',
           jsonb_build_object('PRENSA', jsonb_build_object(
             'nota', '90KG A 8 REPS; 3 SERIES (RIR 2).',
             'cues', 'CONSEJO NUEVO: media pausa abajo'))
         ) into v
    from molde_previo;

  select e->>'cues' into v_cues
    from jsonb_array_elements(v->'sesiones') s,
         jsonb_array_elements(s->'ejercicios') e
   where e->>'nombre' = 'PRENSA 45 GRADOS';

  if v_cues is distinct from 'CONSEJO NUEVO: media pausa abajo' then
    raise exception
      'El molde no sabe escribir `cues`: llego "%" y se esperaba el consejo nuevo. '
      'Es el patron del `escenarios` heredado: lo que el (3) escribe y el molde no '
      'tiene donde poner, se queda con el valor viejo y nadie se entera.', v_cues;
  end if;
end $$;

-- ─────────── 2 · Y el que NO se ajusta conserva el suyo (a propósito) ───────────
do $$
declare
  v jsonb;
  v_cues text;
begin
  select public.tmp_nuevo_micro(
           datos, 2, '2026-09-09',
           jsonb_build_object('PRENSA', jsonb_build_object('cues', 'otro'))
         ) into v
    from molde_previo;

  select e->>'cues' into v_cues
    from jsonb_array_elements(v->'sesiones') s,
         jsonb_array_elements(s->'ejercicios') e
   where e->>'nombre' = 'EXTENSION DE RODILLA';

  if v_cues is distinct from 'CONSEJO QUE SE QUEDA' then
    raise exception
      'Un ejercicio SIN ajuste perdio su `cues` (llego "%"). Heredarlo es lo correcto: '
      'medido el 2026-09-05, 465 de 465 ejercicios activos lo usan como nota tecnica '
      'del ejercicio y solo 2 como excepcion de la semana.', v_cues;
  end if;
end $$;

-- ────────── 3 · El ajuste explícito manda sobre lo derivado de la frase ──────────
do $$
declare
  v jsonb;
  v_carga numeric;
begin
  select public.tmp_nuevo_micro(
           datos, 2, '2026-09-09',
           jsonb_build_object('PRENSA', jsonb_build_object(
             'nota', '90KG A 8 REPS; 3 SERIES (RIR 2).',
             'cues', 'x'))
         ) into v
    from molde_previo;

  select (e->>'cargaKg')::numeric into v_carga
    from jsonb_array_elements(v->'sesiones') s,
         jsonb_array_elements(s->'ejercicios') e
   where e->>'nombre' = 'PRENSA 45 GRADOS';

  -- Sin esto, la prueba 1 pasaria aunque `cues` hubiera roto el resto del ajuste.
  if v_carga is distinct from 90 then
    raise exception 'Anadir `cues` rompio la derivacion de la frase: cargaKg = %', v_carga;
  end if;
end $$;

-- ────── 4 · `tmp_sesion_en_limpio` no hereda la ejecución del cardio ──────
--
-- `duracionRealMin`, `distanciaKm` y `fcMedia` (`BloqueCardio`, 2026-09-27) son la misma
-- familia que `hechoEn`: lo que el asesorado registró en el microciclo VIEJO, no algo que
-- el nuevo pueda nacer con puesto. Sin esta prueba, el fósil de julio (`preparacion` y
-- `bloquesCardio` heredando `hechoEn`) podía volver a colarse por una puerta nueva sin que
-- ningún test lo notara: los tres campos son opcionales, así que una sesión que los pierde
-- se ve exactamente igual que una que nunca los tuvo.
do $$
declare
  v_limpia jsonb;
begin
  v_limpia := public.tmp_sesion_en_limpio($json$
    {
      "id": "s1", "nombre": "ZONA 2", "orden": 1, "dia": "MARTES",
      "ejercicios": [],
      "bloquesCardio": [{
        "id": "c1", "titulo": "Caminadora", "indicaciones": "Zona 2, 30 min",
        "duracionMin": 30,
        "hechoEn": "2026-09-20T10:00:00Z",
        "duracionRealMin": 32.5, "distanciaKm": 3.1, "fcMedia": 128
      }]
    }
  $json$::jsonb);

  if (v_limpia->'bloquesCardio'->0) ? 'hechoEn' then
    raise exception 'tmp_sesion_en_limpio no quito `hechoEn` del bloque de cardio: %', v_limpia;
  end if;
  if (v_limpia->'bloquesCardio'->0) ? 'duracionRealMin' then
    raise exception 'tmp_sesion_en_limpio hereda `duracionRealMin`: el fosil de julio con otro nombre: %', v_limpia;
  end if;
  if (v_limpia->'bloquesCardio'->0) ? 'distanciaKm' then
    raise exception 'tmp_sesion_en_limpio hereda `distanciaKm`: el fosil de julio con otro nombre: %', v_limpia;
  end if;
  if (v_limpia->'bloquesCardio'->0) ? 'fcMedia' then
    raise exception 'tmp_sesion_en_limpio hereda `fcMedia`: el fosil de julio con otro nombre: %', v_limpia;
  end if;
  -- Lo pautado (duracionMin) SÍ se hereda: es prescripción, no ejecución.
  if (v_limpia->'bloquesCardio'->0->>'duracionMin')::numeric is distinct from 30 then
    raise exception 'tmp_sesion_en_limpio se llevo por delante `duracionMin`, que es prescripcion: %', v_limpia;
  end if;
end $$;

rollback;
