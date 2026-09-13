-- 0077 · El cribado vuelve a guardarse: los tres parq_* se comparan y se guardan como booleanos.
--
-- QUÉ SE ROMPIÓ. La 0062 reescribió `contestar_cribado()` para que guardara la historia
-- en vez de descartar la segunda respuesta, y al copiar el cuerpo se le cayeron los
-- `::boolean` que la 0058 sí tenía en el insert. `p_cribado->>'parq_…'` devuelve TEXTO y
-- las tres columnas son BOOLEAN, así que la función falla al planificarse —con cualquier
-- persona y con cualquier respuesta— con 42883: «operator does not exist: boolean = text».
--
-- CÓMO SE VEÍA DESDE FUERA, y por qué nadie lo vio. PostgREST traduce 42883 a un 404, que
-- es también lo que devuelve para una función que no existe; la app lo reintenta ocho
-- veces cada 30 s, lo aparta, lo rescata dos veces al volver a entrar, y mientras tanto el
-- formulario de salud sigue arriba en «Hoy» porque en la base nunca llega a haber fila.
-- Medido en producción el 2026-09-12: **cero** cribados con `fuente = 'app'` en toda la
-- tabla (los ocho que hay son `wiki`), y 37 intentos fallidos en 24 h de dos asesorados
-- reales. El CI estaba verde porque ninguna prueba llamaba a la función; la llama ahora
-- `supabase/test/40-el-cribado-se-guarda.sql`, que se vio caer con 42883 antes de este
-- arreglo.
--
-- QUÉ CAMBIA. Solo los tres `parq_*`, en los dos sitios donde se usan: la comparación del
-- duplicado exacto y el insert. Todo lo demás es el cuerpo de la 0062 letra por letra
-- —misma firma, mismo `security invoker`, mismo `search_path`, mismos permisos—, así que
-- no cambia qué se guarda ni quién puede guardarlo.
--
-- SE PUEDE APLICAR SIN MIEDO. `create or replace` sobre la misma firma: no toca la tabla
-- ni una fila, y no hay nada que migrar porque no se guardó nada desde la app. Las
-- respuestas que la gente ya contestó siguen apartadas en su teléfono; la app las vuelve a
-- mandar sola la próxima vez que entren (hasta dos rescates por respuesta).
--
-- ORDEN DE DESPLIEGUE: da igual. El cliente de producción ya manda `p_cribado` con estas
-- claves; en cuanto esta función esté aplicada, su siguiente reintento entra.

begin;

create or replace function public.contestar_cribado(p_cribado jsonb)
returns boolean
language plpgsql
security invoker
set search_path = public
as $contestar$
declare
  quien uuid := auth.uid();
  ya_igual boolean;
begin
  if quien is null then
    raise exception 'Solo con sesión iniciada';
  end if;

  -- Un duplicado exacto del mismo día no es una respuesta nueva.
  select exists (
    select 1 from public.cribado c
    where c.usuario_id = quien
      and c.fecha = coalesce((p_cribado->>'fecha')::date, current_date)
      and c.fuente = 'app'
      and c.diagnostico                  is not distinct from p_cribado->>'diagnostico'
      and c.quien_lo_lleva               is not distinct from p_cribado->>'quien_lo_lleva'
      and c.tratamiento_activo           is not distinct from p_cribado->>'tratamiento_activo'
      and c.medicacion_cronica           is not distinct from p_cribado->>'medicacion_cronica'
      and c.autorizacion_sanitaria       is not distinct from p_cribado->>'autorizacion_sanitaria'
      and c.restricciones_explicitas     is not distinct from p_cribado->>'restricciones_explicitas'
      and c.sintomas_con_esfuerzo        is not distinct from p_cribado->>'sintomas_con_esfuerzo'
      and c.nivel_funcional              is not distinct from p_cribado->>'nivel_funcional'
      and c.que_le_han_dicho_que_no_haga is not distinct from p_cribado->>'que_le_han_dicho_que_no_haga'
      -- EL ARREGLO: las tres columnas son boolean y `->>` da texto. Sin el cast, esta
      -- comparación no existe en Postgres y la función entera falla con 42883.
      and c.parq_enfermedad_cardiaca     is not distinct from (p_cribado->>'parq_enfermedad_cardiaca')::boolean
      and c.parq_medicamento_presion     is not distinct from (p_cribado->>'parq_medicamento_presion')::boolean
      and c.parq_huesos_articulaciones   is not distinct from (p_cribado->>'parq_huesos_articulaciones')::boolean
  ) into ya_igual;

  if ya_igual then
    return false;
  end if;

  insert into public.cribado (
    usuario_id, fecha, fuente,
    diagnostico, quien_lo_lleva, tratamiento_activo, medicacion_cronica,
    autorizacion_sanitaria, restricciones_explicitas, sintomas_con_esfuerzo,
    nivel_funcional, que_le_han_dicho_que_no_haga,
    parq_enfermedad_cardiaca, parq_medicamento_presion, parq_huesos_articulaciones,
    detalle
  )
  values (
    quien,
    coalesce((p_cribado->>'fecha')::date, current_date),
    'app',
    p_cribado->>'diagnostico', p_cribado->>'quien_lo_lleva',
    p_cribado->>'tratamiento_activo', p_cribado->>'medicacion_cronica',
    p_cribado->>'autorizacion_sanitaria', p_cribado->>'restricciones_explicitas',
    p_cribado->>'sintomas_con_esfuerzo', p_cribado->>'nivel_funcional',
    p_cribado->>'que_le_han_dicho_que_no_haga',
    -- EL ARREGLO, segunda mitad: los mismos tres casts que tenía la 0058.
    (p_cribado->>'parq_enfermedad_cardiaca')::boolean,
    (p_cribado->>'parq_medicamento_presion')::boolean,
    (p_cribado->>'parq_huesos_articulaciones')::boolean,
    coalesce(p_cribado->'detalle', '{}'::jsonb)
  );

  return true;
end;
$contestar$;

-- Igual que la 0058 y la 0062: una función de `public` que ESCRIBE datos de salud no puede
-- quedar al alcance de la clave pública.
revoke execute on function public.contestar_cribado(jsonb) from public, anon;
grant execute on function public.contestar_cribado(jsonb) to authenticated;

commit;

-- Señal: `0077 - el cribado vuelve a guardarse` en supabase/comprobar-migraciones.sql
