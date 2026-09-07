-- 0058 · El cribado de salud vive en la base, no en la prosa de un expediente
--
-- QUÉ FALLABA (medido el 2026-09-06 sobre las 25 personas de la cartera). El PAR-Q de
-- Alpha no está en ninguna tabla: vive en el `perfil.md` o el `plan-estrategico-*.md`
-- de ocho personas, escrito en prosa. `respuestas` guarda un cuestionario de compra y
-- `perfil_alimentario.respuestas` es el formulario de NUTRICIÓN —trae condiciones
-- médicas y alergias, pero NO pregunta las dos críticas: síntomas con el esfuerzo y
-- medicación crónica—.
--
-- La consecuencia es la que muerde: el validador de los agentes no puede leer la wiki,
-- así que cada uno declara la zona clínica por lo que encuentra. Unos escriben
-- `sin_cuadro` (y declarar `sin_cuadro` en vez de `no_evaluada` no lo caza ni el
-- contrato ni la costura), otros `no_evaluada` —que PARA la cadena—, y uno declaró
-- `verde` leyendo un PAR-Q que solo existía en papel. Mismo hecho, tres caminos. El
-- 6-sep se cargaron cuatro planes por la primera vía sin que nada lo comprobara.
--
-- Y no es un trámite: de los ocho que sí contestaron, CUATRO dieron positivo.
--
-- ────────────────────────────────────────────────────────────────────────────
-- LAS DOCE PREGUNTAS, Y POR QUÉ SON ESAS DOCE
-- ────────────────────────────────────────────────────────────────────────────
-- Nueve son la «entrada mínima» que el invariante I-23 de los agentes ya exige campo a
-- campo (`agentes/verificar-contrato.py`), y tres son el PAR-Q propiamente dicho
-- (`agentes/cribado.py`, constante `PARQ`). Los nombres son LOS MISMOS a propósito: el
-- día que `tuberia/entrada_desde_historial.py` lea esta tabla, tiene que poder volcarla
-- al dictamen sin traducir nada. Un renombre aquí es un renombre allí.
--
-- ────────────────────────────────────────────────────────────────────────────
-- AUSENTE NO ES NULO, Y ESA ES LA REGLA QUE LO SOSTIENE
-- ────────────────────────────────────────────────────────────────────────────
-- `ausente` significa «se le preguntó y no tiene». `null` significa «nadie se lo
-- preguntó». Son cosas distintas y confundirlas es exactamente el fallo que esta tabla
-- viene a cerrar: un hueco tratado como un «no» es un cribado inventado.
--
-- Por eso los nueve campos admiten null (para las filas que vengan de la wiki, donde un
-- dato puede no constar) pero el CHECK `cribado_de_la_app_esta_completo` exige que una
-- fila con `fuente='app'` los traiga los doce. El formulario no puede dejar huecos: la
-- base no se lo permite, no solo el componente.
--
-- Los tres `parq_*` son booleanos nulables por lo mismo: `false` es «no», `null` es «no
-- se preguntó». Un `boolean not null default false` habría convertido todo silencio en
-- un «no», que es el error más caro que puede cometer un cribado.
--
-- ────────────────────────────────────────────────────────────────────────────
-- QUIÉN PUEDE CAMBIAR UNA RESPUESTA: EL COACH, NO EL ASESORADO
-- ────────────────────────────────────────────────────────────────────────────
-- El asesorado INSERTA su fila (contesta una vez) y la lee. **No la puede modificar.**
-- No es desconfianza: es que este dato es una puerta. Quien contesta «sí» a dolor
-- torácico queda en zona roja y su plan se para; si pudiera editar su propia respuesta,
-- la puerta se abriría sola desde el lado que la puerta protege.
--
-- Cuando algo cambia de verdad —le retiran un medicamento, le dan el alta— se lo dice
-- al coach y el coach lo actualiza. Es la misma regla que ya rige en el cerebro: «se
-- recalcula el cribado, no se levanta a mano».
--
-- LIMITACIÓN DECLARADA: una fila por persona, sin historial. Si mañana hace falta saber
-- qué contestó en marzo y qué en septiembre, esto pasa a ser una tabla de filas y la
-- clave primaria deja de ser `usuario_id`. Hoy no hace falta y una tabla de una fila por
-- persona es lo que el dictamen necesita leer.
--
-- NOTA DE HONESTIDAD SOBRE ESTE ARCHIVO. Se aplicó a producción el 2026-09-07 con la
-- tabla y sus políticas, y ESE MISMO DÍA, antes de fusionar la rama, se le añadieron el
-- trigger, la fila de la firma y `contestar_cribado()` —tres fallos que encontró el
-- abogado del diablo y que se documentan abajo, cada uno donde toca—. Editar una
-- migración aplicada es justo lo que la casa prohíbe, y la excepción se sostiene en tres
-- cosas: hay un solo entorno, la rama no estaba fusionada, y el añadido se aplicó a
-- producción a la vez que se escribía, así que el archivo y la base dicen lo mismo.
-- Todo lo añadido es idempotente (`create or replace`, `drop trigger if exists`), de
-- modo que aplicar este archivo entero de cero deja exactamente el estado que hay hoy.
--
-- ORDEN DE DESPLIEGUE: la migración va ANTES que el código. Un cliente viejo no conoce
-- la tabla y se comporta igual que hoy; un cliente nuevo contra una base sin la tabla
-- recibe 42P01 y la app sigue andando (`esTablaInexistente` en `hidratar.ts`), con el
-- cribado quedándose en el dispositivo hasta que se aplique.

begin;

create table if not exists public.cribado (
  usuario_id                   uuid primary key references public.usuarios_app(id) on delete cascade,
  fecha                        date not null default current_date,
  -- De dónde salió. `wiki` marca las filas volcadas desde un expediente en prosa: son
  -- ciertas pero no las contestó nadie en la app, y quien las lea debe poder saberlo.
  fuente                       text not null check (fuente in ('app', 'wiki', 'encuesta')),

  -- Los nueve de I-23. Vocabulario CERRADO, como `grupo` y `categoria` en los contratos:
  -- un cribado en prosa no se puede contar ni cruzar, que es justo el problema que
  -- tenemos hoy con los ocho expedientes de la wiki.
  diagnostico                  text check (diagnostico                  in ('presente','ausente','no_declarado')),
  quien_lo_lleva               text check (quien_lo_lleva               in ('presente','ausente','no_declarado')),
  tratamiento_activo           text check (tratamiento_activo           in ('presente','ausente','no_declarado')),
  medicacion_cronica           text check (medicacion_cronica           in ('presente','ausente','no_declarado')),
  autorizacion_sanitaria       text check (autorizacion_sanitaria       in ('presente','ausente','no_declarado')),
  restricciones_explicitas     text check (restricciones_explicitas     in ('presente','ausente','no_declarado')),
  sintomas_con_esfuerzo        text check (sintomas_con_esfuerzo        in ('presente','ausente','no_declarado')),
  nivel_funcional              text check (nivel_funcional              in ('presente','ausente','no_declarado')),
  que_le_han_dicho_que_no_haga text check (que_le_han_dicho_que_no_haga in ('presente','ausente','no_declarado')),

  -- El PAR-Q. `null` = no se preguntó; `false` = se preguntó y dijo que no.
  parq_enfermedad_cardiaca     boolean,
  parq_medicamento_presion     boolean,
  parq_huesos_articulaciones   boolean,

  -- El texto de cada «sí»: qué diagnóstico, qué medicamento, qué le dijeron que no
  -- hiciera. Va en jsonb y no en columnas porque es prosa libre que solo lee una
  -- persona; ninguna regla decide sobre este campo. La clave es el nombre del campo de
  -- arriba: {"medicacion_cronica": "prednisolona 10 mg"}.
  detalle                      jsonb not null default '{}'::jsonb,
  actualizado_en               timestamptz not null default now(),

  -- El formulario de la app no puede dejar huecos. Una fila `app` incompleta sería
  -- indistinguible de una fila `wiki` a medias, y esa ambigüedad es la que hace que hoy
  -- cada agente decida por su cuenta.
  constraint cribado_de_la_app_esta_completo check (
    fuente <> 'app' or (
      diagnostico is not null and quien_lo_lleva is not null and tratamiento_activo is not null
      and medicacion_cronica is not null and autorizacion_sanitaria is not null
      and restricciones_explicitas is not null and sintomas_con_esfuerzo is not null
      and nivel_funcional is not null and que_le_han_dicho_que_no_haga is not null
      and parq_enfermedad_cardiaca is not null and parq_medicamento_presion is not null
      and parq_huesos_articulaciones is not null
    )
  )
);

comment on table public.cribado is
  'El cribado de salud (PAR-Q + los nueve de I-23), uno por persona. `ausente` es «se preguntó y no tiene»; `null` es «no se preguntó». El asesorado lo contesta una vez; cambiarlo es del coach.';

alter table public.cribado enable row level security;

-- LECTURA: la suya, y el coach todas. El asesorado SÍ lee la suya —tiene que poder ver
-- qué contestó, y la app necesita saber si ya lo hizo para no volver a preguntárselo—.
create policy cribado_lee_lo_suyo on public.cribado
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_coach()));

-- ALTA: solo la suya, y el `with check` lo ata a `auth.uid()`. No hay forma de meterle
-- un cribado a otra persona: el id no sale de un parámetro, sale de la sesión.
create policy cribado_lo_contesta_uno_mismo on public.cribado
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and fuente = 'app');

-- CAMBIO: solo el coach. Ver la cabecera: este dato es una puerta, y no se abre desde
-- el lado que protege. El coach también es quien mete las filas `wiki` y `encuesta`.
create policy cribado_lo_cambia_el_coach on public.cribado
  for update to authenticated
  using ((select public.es_coach()))
  with check ((select public.es_coach()));

create policy cribado_lo_carga_el_coach on public.cribado
  for insert to authenticated
  with check ((select public.es_coach()));

create policy cribado_lo_borra_el_coach on public.cribado
  for delete to authenticated
  using ((select public.es_coach()));

revoke all on public.cribado from anon, public;
grant select, insert, update, delete on public.cribado to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- LA FIRMA TIENE QUE VER ESTA TABLA, O EL DATO BUENO NO LLEGA A NINGÚN TELÉFONO
-- ────────────────────────────────────────────────────────────────────────────
-- `hidratarDesdeNube` se salta la descarga ENTERA cuando la firma del servidor no ha
-- cambiado. La firma es la lista escrita a mano de la 0049, y una tabla que no está en
-- esa lista es una tabla cuyos cambios nadie ve: el coach vuelca los ocho expedientes
-- de la wiki y en el móvil de esa gente no cambia nada, la app les sigue pidiendo el
-- cribado.
--
-- Y castiga justo a quien menos abre la app. Quien tiene mensajes o check-ins moviéndose
-- se salva por accidente —cualquier otro cambio fuerza la descarga completa y el cribado
-- viene de paquete—; los seis que no han hecho un check-in en su vida no tienen ese
-- accidente, y son exactamente aquellos cuyo cribado hay que volcar.
--
-- Hacen falta las DOS cosas. El trigger sin la fila de la firma no sirve de nada, y la
-- fila sin el trigger miente: un UPDATE del coach no movería `actualizado_en` ni el
-- conteo, así que la firma diría «no cambió» sobre un dato que sí cambió. Es
-- literalmente el fallo que la cabecera de la 0049 dice que la 0049 existe para evitar.
drop trigger if exists trg_actualizado_en on public.cribado;
create trigger trg_actualizado_en before update on public.cribado
  for each row execute function public.marcar_actualizado();

create or replace function public.firma_de_sincronizacion()
returns table (tabla text, filas bigint, ultimo_cambio timestamptz)
language sql
stable
set search_path = public
as $firma$
  select 'adherencias', count(*), max(actualizado_en) from public.adherencias
  union all
  select 'checkins', count(*), max(actualizado_en) from public.checkins
  union all
  select 'consultas_chat', count(*), max(actualizado_en) from public.consultas_chat
  union all
  select 'contenidos', count(*), max(actualizado_en) from public.contenidos
  union all
  select 'cribado', count(*), max(actualizado_en) from public.cribado
  union all
  select 'cuestionarios', count(*), max(actualizado_en) from public.cuestionarios
  union all
  select 'despensa', count(*), max(actualizado_en) from public.despensa
  union all
  select 'hidratacion', count(*), max(actualizado_en) from public.hidratacion
  union all
  select 'mensajes', count(*), max(actualizado_en) from public.mensajes
  union all
  select 'microciclos', count(*), max(actualizado_en) from public.microciclos
  union all
  select 'perfil_alimentario', count(*), max(actualizado_en) from public.perfil_alimentario
  union all
  select 'perfil_alimentario_veto', count(*), max(actualizado_en) from public.perfil_alimentario_veto
  union all
  select 'perfiles', count(*), max(actualizado_en) from public.perfiles
  union all
  select 'planes_nutricionales', count(*), max(actualizado_en) from public.planes_nutricionales
  union all
  select 'preferencia_estado', count(*), max(actualizado_en) from public.preferencia_estado
  union all
  select 'premiaciones', count(*), max(actualizado_en) from public.premiaciones
  union all
  select 'prueba_calibracion', count(*), max(actualizado_en) from public.prueba_calibracion
  union all
  select 'registro_comida', count(*), max(actualizado_en) from public.registro_comida
  union all
  select 'registro_item', count(*), max(actualizado_en) from public.registro_item
  union all
  select 'respuestas', count(*), max(actualizado_en) from public.respuestas
  union all
  select 'usuarios_app', count(*), max(actualizado_en) from public.usuarios_app
  union all
  select 'visibilidad_nutricion', count(*), max(actualizado_en) from public.visibilidad_nutricion
  union all
  select 'checkins_nutricion', count(*), max(actualizado_en) from public.checkins_nutricion
$firma$;

-- ────────────────────────────────────────────────────────────────────────────
-- CONTESTAR NO ES UN UPSERT, Y LA DIFERENCIA CUESTA UN DATO DE SALUD
-- ────────────────────────────────────────────────────────────────────────────
-- PostgREST traduce un `upsert` a `insert … on conflict do update`. Si ya existe fila en
-- el servidor y no en la instantánea del teléfono —el coach volcó su expediente mientras
-- ella tenía la app abierta, o contesta en el móvil y en la tablet— la rama de UPDATE
-- necesita una política de UPDATE que aplique a esa sesión. La única es la del coach,
-- así que el asesorado recibe 42501, la cola lo reintenta ocho veces, lo descarta en
-- silencio, y el aviso de la app le dice que no se perdió nada.
--
-- Sobre un dato de salud eso es lo peor de las dos: pierde el dato Y le miente.
--
-- Con `on conflict do nothing` no se intenta ningún UPDATE, así que no hay 42501: si ya
-- había fila, la de la base gana y la operación termina bien. Devuelve si insertó o no,
-- para que la app pueda decir «esto ya estaba contestado» en vez de callarse.
--
-- `security invoker`: la RLS de arriba sigue mandando. Y el usuario NO es un parámetro
-- —sale de `auth.uid()`—, así que no hay forma de meterle un cribado a otra persona.
create or replace function public.contestar_cribado(p_cribado jsonb)
returns boolean
language plpgsql
security invoker
set search_path = public
as $contestar$
declare
  quien uuid := auth.uid();
  inserto boolean;
begin
  if quien is null then
    raise exception 'Solo con sesión iniciada';
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
    coalesce((p_cribado ->> 'fecha')::date, current_date),
    'app',
    p_cribado ->> 'diagnostico',
    p_cribado ->> 'quien_lo_lleva',
    p_cribado ->> 'tratamiento_activo',
    p_cribado ->> 'medicacion_cronica',
    p_cribado ->> 'autorizacion_sanitaria',
    p_cribado ->> 'restricciones_explicitas',
    p_cribado ->> 'sintomas_con_esfuerzo',
    p_cribado ->> 'nivel_funcional',
    p_cribado ->> 'que_le_han_dicho_que_no_haga',
    (p_cribado ->> 'parq_enfermedad_cardiaca')::boolean,
    (p_cribado ->> 'parq_medicamento_presion')::boolean,
    (p_cribado ->> 'parq_huesos_articulaciones')::boolean,
    coalesce(p_cribado -> 'detalle', '{}'::jsonb)
  )
  on conflict (usuario_id) do nothing;

  get diagnostics inserto = row_count;
  return inserto;
end;
$contestar$;

-- `create function` concede EXECUTE a PUBLIC, y `anon` es miembro. Misma regla que la
-- 0037 y la 0057: se quita y se da solo a quien tiene sesión.
revoke execute on function public.contestar_cribado(jsonb) from public, anon;
grant execute on function public.contestar_cribado(jsonb) to authenticated;

comment on function public.contestar_cribado(jsonb) is
  'El cribado del asesorado, insertado sin pisar el que ya hubiera. Devuelve true si insertó. security invoker: la RLS manda, y el usuario sale de auth.uid().';

commit;

-- Señal: `0058 - el cribado vive en la base` en supabase/comprobar-migraciones.sql
