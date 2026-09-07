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

commit;

-- Señal: `0058 - el cribado vive en la base` en supabase/comprobar-migraciones.sql
