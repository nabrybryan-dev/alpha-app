-- 0019 · Las respuestas de la encuesta, en crudo
--
-- POR QUE HACE FALTA. La 0016 guarda el perfil ALIMENTARIO -alergias, acceso,
-- gustos- porque es lo que se consulta para filtrar recomendaciones. Pero la
-- encuesta pregunta ademas lo que necesitan las formulas: peso, altura, los
-- perimetros, la fecha de nacimiento, el genero y los pasos diarios. Eso no
-- cabe en ninguna columna de la 0016 y sin ello no se puede calcular nada.
--
-- POR QUE EN CRUDO Y NO EN COLUMNAS. De estas respuestas NO se guarda ninguna
-- cifra derivada: ni el % de grasa, ni el TDEE, ni los macros. Se recalculan
-- siempre, igual que las kcal de una comida se recalculan desde `alimento_id` +
-- gramos. Guardar el crudo es lo que permite que, el dia que se corrija una
-- formula, los perfiles viejos se corrijan solos en vez de arrastrar para
-- siempre un numero hecho con la version anterior.
--
-- CUAL MANDA SI SE CONTRADICEN. `respuestas` es la fuente de verdad; las
-- columnas de la 0016 son una PROYECCION suya que existe para poder consultar
-- ("dame los que no comen lacteos") sin abrir el jsonb de cada uno. Las dos se
-- escriben a la vez desde el mismo sitio. Si algun dia difieren, gana el crudo.

begin;

alter table public.perfil_alimentario
  add column if not exists respuestas jsonb;

-- Cuando termino de responder. Sin esto, la encuesta sigue pendiente y la
-- compuerta de Nutricion no se abre.
alter table public.perfil_alimentario
  add column if not exists completada_en timestamptz;

comment on column public.perfil_alimentario.respuestas is
  'Respuestas de la encuesta tal cual. Fuente de verdad: las demas columnas son su proyeccion.';

/*
 * A quien hay que mirar antes de ensenarle sus cifras.
 *
 * El estado NO se guarda en ningun sitio: se deduce. Alguien esta en espera
 * cuando su encuesta levanto una senal y nadie ha decidido todavia. Un estado
 * derivado no se puede quedar desincronizado del dato que lo justifica, y ese
 * era el riesgo real: la app del movil no puede escribir
 * `visibilidad_nutricion` -es solo del staff, para que el asesorado no se
 * encienda sus propios interruptores-, asi que si el estado hubiera que
 * guardarlo, nadie podria marcarlo.
 *
 * `security_invoker` por lo mismo que en la 0018: sin el, la vista correria con
 * los permisos de su duenio y devolveria a todos los asesorados a cualquiera.
 */
create or replace view public.cifras_por_revisar
  with (security_invoker = true) as
  select p.asesorado_id,
         u.nombre,
         p.ciclo_menstrual,
         p.completada_en
    from public.perfil_alimentario p
    join public.usuarios_app u on u.id = p.asesorado_id
    left join public.visibilidad_nutricion v on v.asesorado_id = p.asesorado_id
   where p.ciclo_menstrual in ('irregular', 'ausente')
     and (v.estado is null or v.estado <> 'decidido');

revoke all on public.cifras_por_revisar from anon;

comment on view public.cifras_por_revisar is
  'Asesorados con una senal en la encuesta y sin decision de la nutricionista.';

commit;
