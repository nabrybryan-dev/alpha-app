-- 0016 · Perfil alimentario del asesorado
--
-- Guarda las respuestas del cuestionario de una sola vez (doce preguntas) que
-- alimenta herramientas/base-alimentos/filtro_persona.py. Fuente del
-- cuestionario: docs/revisiones/2026-07-31-cuestionario-asesorado.md, en el
-- repo Cerebro Alpha (hermano de este, no dentro de app/).
--
-- Sin esta migración el motor de recomendaciones (0014) está construido,
-- probado y cargado con 1.195 alimentos, y no filtra nada: el perfil de cada
-- asesorado está vacío.
--
-- DOS TABLAS:
--   - perfil_alimentario: una fila por asesorado, con lo declarado + lo que
--     filtro_persona.PerfilAlimentario realmente consume.
--   - perfil_alimentario_veto: los alimentos vetados uno por uno (además del
--     veto de caza/silvestres de perfiles.py), con motivo — el equivalente
--     relacional del diccionario SILVESTRES: dict[id, motivo] de ese módulo.
--
-- QUÉ NO HACE ESTA MIGRACIÓN. No deriva `sin_acceso` a partir de ciudad, ni
-- `condiciones_medicas` (etiquetas) a partir del texto libre de la pregunta 2.
-- Esa traducción es criterio humano (hoy: del coach), igual que el catálogo
-- de etiquetas de alimentos se cura a mano en etiquetas.py — no hay un
-- vocabulario cerrado de etiquetas en la base de datos, así que tampoco hay
-- un CHECK que enumere valores válidos para alergias/excluye/no_le_gustan/
-- sin_acceso: ese vocabulario vive y crece en herramientas/base-alimentos/,
-- no en el esquema.
--
-- POR QUÉ COLUMNAS Y NO UN JSONB (a diferencia de public.perfiles, 0001). Con
-- columnas propias, la app guarda cada sección del cuestionario con un UPDATE
-- que solo toca SUS columnas y dos preguntas se pueden contestar en momentos
-- distintos sin arriesgar pisar las demás. Con un jsonb de documento entero
-- (como perfiles.datos) ese mismo riesgo obligó a un trigger dedicado
-- (proteger_perfil(), 0008) para que un guardado parcial no borrara el resto.
-- Aquí no hace falta: la propia forma de la tabla ya evita el problema.

begin;

-- ── Perfil ──────────────────────────────────────────────────────────────────
create table if not exists public.perfil_alimentario (
  -- Contra usuarios_app, no contra auth.users: la referencia que usa el resto
  -- del esquema (perfiles, registro_comida, prueba_calibracion...).
  asesorado_id uuid primary key references public.usuarios_app (id) on delete cascade,

  -- ── Seguridad (preguntas 1 y 2, obligatorias) ──────────────────────────
  -- LA ASIMETRÍA: NULL y '{}' NO significan lo mismo aquí, y es la razón de
  -- que estas columnas no lleven "not null default '{}'". NULL = todavía no
  -- se preguntó (dato desconocido: la app no debería ofrecer ninguna
  -- recomendación mientras estas dos sigan NULL). '{}' = se preguntó y
  -- contestó "ninguna". Traducido a filtro_persona.PerfilAlimentario, las dos
  -- hoy hidratan el mismo frozenset() vacío -el dataclass no distingue-, así
  -- que la distinción es responsabilidad de la app al leer esta fila, no del
  -- dataclass. Sin esto en la base, "no declaró" y "declaró que no tiene"
  -- serían indistinguibles desde el instante en que se guardan.
  alergias                     text[],
  -- Selección múltiple de la pregunta 1 más "otra ¿cuál?" en texto libre.
  alergias_otras                text,
  -- A diferencia de alergias, condiciones_medicas es ÍNTEGRAMENTE pregunta
  -- abierta (pregunta 2: "Campo abierto. Diabetes, hipertensión..."), sin
  -- checkboxes. El array queda para las etiquetas que, con el tiempo, el
  -- coach cure a partir de condiciones_medicas_detalle -hoy etiquetas.py no
  -- tiene ninguna etiqueta de condición médica todavía, así que puede quedar
  -- vacío aunque el texto libre sí tenga contenido: es el estado esperado,
  -- no un hueco.
  condiciones_medicas           text[],
  condiciones_medicas_detalle   text,

  -- ── Elección propia y gustos (preguntas 3, 4, 5) ───────────────────────
  -- Aquí NULL y '{}' se comportan igual para evaluar(): un perfil vacío no
  -- bloquea nada en ninguno de los dos casos (test_un_perfil_vacio_no_
  -- bloquea_nada, test_filtro_persona.py). La distinción NULL/'{}' se
  -- conserva de todas formas, por consistencia con las columnas de arriba y
  -- porque le sirve a la app para saber qué secciones del cuestionario
  -- todavía no se contestaron.
  --
  -- Pregunta 3 aparte y sin colapsar en una etiqueta: es, según el propio
  -- cuestionario, "la pregunta más rentable de todo el cuestionario", y su
  -- respuesta intermedia ("solo algunas") no reduce limpio a "excluir la
  -- etiqueta viscera sí/no" -- perdería la matriz si solo viviera dentro de
  -- excluye.
  come_visceras     text check (come_visceras in ('si', 'algunas', 'no')),
  -- Pregunta 4 (decisión propia: vegetariano, vegano, sin cerdo, sin res...)
  -- más lo que la pregunta 3 traduzca ("viscera", cuando la respuesta es no).
  excluye            text[],
  excluye_otras      text,
  -- Pregunta 5 (pescado, mariscos, huevo, lácteos, leguminosas, verduras de
  -- hoja, picante) más su campo abierto.
  no_le_gustan        text[],
  no_le_gustan_otras  text,

  -- ── Acceso (preguntas 6, 7, 8, 9) ───────────────────────────────────────
  -- Ciudad, lugar de compra y presupuesto son hechos crudos, no etiquetas:
  -- ninguno de los tres es, por sí mismo, una etiqueta que etiquetar() pueda
  -- producir para un alimento. `sin_acceso` es la columna que de verdad
  -- consume filtro_persona.PerfilAlimentario, y hoy se llena a mano a partir
  -- de estos tres datos -mismo patrón que condiciones_medicas arriba-.
  ciudad                text,
  lugar_compra           text check (lugar_compra in
                          ('plaza_mercado', 'supermercado', 'tienda_barrio', 'domicilio', 'mezcla')),
  -- Pregunta 8: decide si tiene sentido preguntar por aceite/sal (eso se
  -- captura por comida en registro_comida.aceite_g/sal_g, 0015, no aquí).
  frecuencia_cocina      text check (frecuencia_cocina in ('casi_siempre', 'a_veces', 'casi_nunca')),
  -- Pregunta 9: el propio cuestionario deja abierto si esta pregunta se hace
  -- o se infiere de la 7, y no fija los rangos ("Rangos." sin más detalle).
  -- Texto libre y sin CHECK a propósito, para no inventar cortes de
  -- presupuesto que el negocio todavía no decidió.
  presupuesto_semanal    text,
  sin_acceso              text[],

  -- ── Herramientas de medición (preguntas 10 y 11) ───────────────────────
  -- Capacidades, no preferencias: deciden si el asesorado entra a la fase de
  -- báscula y con qué método se estima su grasa corporal
  -- (herramientas/composicion/composicion.py:Medidas).
  tiene_bascula          text check (tiene_bascula in ('si', 'puede_conseguir', 'no')),
  metodo_medicion_grasa   text check (metodo_medicion_grasa in
                          ('plicometro', 'cinta_metrica', 'bascula_bioimpedancia', 'ninguna')),

  -- ── Ciclo menstrual (pregunta 12) ───────────────────────────────────────
  -- Dato clínico sensible: mismas reglas de RLS que el resto de esta tabla
  -- (ver más abajo), nada especial por columna. Solo aplica a mujeres, pero
  -- eso lo decide la UI: usuarios_app no tiene hoy una columna de género
  -- contra la que condicionar esta pregunta a nivel de base de datos.
  ciclo_menstrual  text check (ciclo_menstrual in
                    ('regular', 'irregular', 'ausente', 'anticoncepcion_hormonal', 'prefiere_no_decir')),

  -- ── Veto de caza/silvestres (perfiles.py) ──────────────────────────────
  -- Default true == perfil_urbano(): un asesorado nuevo arranca urbano, con
  -- la caza vetada (perfiles.SILVESTRES). Pasarlo a false es el equivalente
  -- en base de datos de "usar PerfilAlimentario directamente y no
  -- perfil_urbano()" -la única vía que el propio módulo documenta para quien
  -- sí consigue estos alimentos-. Los vetos adicionales, uno por alimento,
  -- viven en perfil_alimentario_veto, no aquí.
  aplica_veto_caza boolean not null default true,

  actualizado_en timestamptz not null default now(),

  -- El "otra" libre no tiene sentido si la sección que completa nunca se
  -- contestó: si hay texto, la columna estructurada tiene que ser al menos
  -- '{}' (contestada), no NULL (no preguntada).
  constraint perfil_alimentario_alergias_otras_ok
    check (alergias_otras is null or alergias is not null),
  constraint perfil_alimentario_condiciones_detalle_ok
    check (condiciones_medicas_detalle is null or condiciones_medicas is not null),
  constraint perfil_alimentario_excluye_otras_ok
    check (excluye_otras is null or excluye is not null),
  constraint perfil_alimentario_no_le_gustan_otras_ok
    check (no_le_gustan_otras is null or no_le_gustan is not null)
);

-- Sin índice adicional: asesorado_id ya es la primary key, y cargar el
-- perfil completo de un asesorado es exactamente ese lookup por PK.

-- ── Vetos individuales ──────────────────────────────────────────────────────
-- El equivalente relacional de perfiles.SILVESTRES: dict[id, motivo], pero
-- por asesorado en vez de fijo en código. "Se decide y se escribe, con el
-- motivo al lado" (perfiles.py) — motivo es opcional para no bloquear un
-- rechazo rápido desde la app, pero si viene, no puede ser una cadena vacía.
create table if not exists public.perfil_alimentario_veto (
  id            bigint generated always as identity primary key,
  asesorado_id  uuid not null references public.usuarios_app (id) on delete cascade,
  -- cascade y no restrict (a diferencia de registro_item.alimento_id, 0015):
  -- un veto no es un registro histórico que auditar, así que si el alimento
  -- desaparece del catálogo el veto deja de tener sentido.
  alimento_id   text not null references public.alimentos (id) on delete cascade,
  motivo        text check (motivo is null or length(trim(motivo)) > 0),
  creado_en     timestamptz not null default now(),
  unique (asesorado_id, alimento_id)
);

-- FK sin indexar aparte para asesorado_id: el unique de arriba ya es un
-- índice con asesorado_id como columna líder, así que "todos los vetos de
-- este asesorado" (la consulta real) ya lo usa. alimento_id sí necesita su
-- propio índice: es la columna de cola de ese mismo unique, así que un
-- delete/update en alimentos recorrería esta tabla entera sin él (mismo
-- razonamiento que registro_item_por_alimento, 0015).
create index if not exists perfil_alimentario_veto_por_alimento
  on public.perfil_alimentario_veto (alimento_id);

-- ── Seguridad ────────────────────────────────────────────────────────────────
-- Datos personales de salud y de acceso. Cada quien ve y escribe lo suyo; el
-- staff (coach y nutricionista, es_staff()) ve y escribe todo; anon no ve
-- nada. Una sola política por tabla para insert/update/delete/select: no hay
-- una lectura más permisiva que la escritura ni al revés.

alter table public.perfil_alimentario       enable row level security;
alter table public.perfil_alimentario_veto  enable row level security;

revoke all on public.perfil_alimentario, public.perfil_alimentario_veto from anon;

-- (select auth.uid()) / (select public.es_staff()), las dos envueltas: el
-- planificador las trata como initplan (se evalúan una vez por consulta) en
-- vez de volver a llamarlas por cada fila. Patrón de rendimiento de Supabase
-- para RLS, igual que 0015 -allí solo auth.uid() quedó envuelta en el código
-- final aunque el comentario prometía las dos; aquí se envuelven ambas de
-- verdad-.
create policy perfil_alimentario_propio on public.perfil_alimentario
  for all to authenticated
  using (asesorado_id = (select auth.uid()) or (select public.es_staff()))
  with check (asesorado_id = (select auth.uid()) or (select public.es_staff()));

create policy perfil_alimentario_veto_propio on public.perfil_alimentario_veto
  for all to authenticated
  using (asesorado_id = (select auth.uid()) or (select public.es_staff()))
  with check (asesorado_id = (select auth.uid()) or (select public.es_staff()));

commit;
