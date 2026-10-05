# Mensajes de estilo de vida: el contrato entre la cola y la app

2026-09-27. Migración `0088_tarjeta_semanal_y_mensajes_de_vida.sql`.

## Qué es esto

`mensajes_vida` es la proyección legible, dentro de Supabase, de la cola de mensajes que
escribe el agente de estilo de vida (`cerebro-alpha`, rama `planes/estilo-de-vida-2`,
`agentes/cola_mensajes_vida.py`). Hoy esa cola escribe archivos JSON en
`ALPHA_ESTADO_DIR/cola_mensajes_vida/<id>.json`, fuera de cualquier base de datos. Esta
tabla es el sitio donde esa misma cola puede escribir con la clave de servicio para que la
app del asesorado pueda leer con RLS, sin que el asesorado tenga que confiar en un archivo
al que no llega.

Esta migración **no cambia** `cola_mensajes_vida.py` ni el formato de sus archivos. Un
futuro trabajo de sincronización (fuera de este repo) es quien traduce un mensaje de la
cola a una fila de esta tabla — ver «Qué falta» más abajo.

## El contrato de columnas

| Columna | Tipo | Quién la escribe | Qué significa |
|---|---|---|---|
| `id` | `uuid` (PK) | `service_role` | Identificador de la fila. No es el mismo `id` (`mv-<16 hex>`) del archivo de la cola — ver «Diferencias con el contrato de la cola». |
| `usuario_id` | `uuid`, FK a `usuarios_app` | `service_role` | A quién va el mensaje. |
| `texto` | `text`, no vacío | `service_role` | El mensaje tal cual se le muestra a la persona. Máximo 400 caracteres en el contrato de la cola (`mensaje_vida.schema.json`); esta tabla no repite ese límite — confía en quien escribe. |
| `tipo` | `text`, `prescripcion_vida` \| `ayuda_animo` | `service_role` | Mismo enum que `mensaje_vida.schema.json`. `ayuda_animo` es el mensaje con la línea de ayuda verificada (Línea 106); `prescripcion_vida` es cualquier otro. |
| `enviar_despues_de` | `timestamptz`, no nulo | `service_role` | El instante a partir del cual la persona puede leerlo. Lo decide `cola_mensajes_vida.py::retraso_de` (0 h para `ayuda_animo`, 2 h para `prescripcion_vida`) — esta tabla no repite esa lógica, solo guarda el resultado. |
| `enviado_en` | `timestamptz`, nulo | `service_role` | Cuándo se le entregó de verdad (push, WhatsApp — lo que sea que exista el día que el envío real se construya). Nulo mientras nadie lo haya entregado por ese canal; la app puede mostrarlo aunque `enviado_en` sea nulo, porque la condición de lectura es `enviar_despues_de`, no `enviado_en`. |
| `detenido_en` | `timestamptz`, nulo | `service_role` | Puesto cuando alguien (Bryan, desde la consola u otra vía) detiene el mensaje. Un mensaje detenido nunca vuelve a aparecer para el asesorado, ni siquiera si `detenido_en` se borra después — quien reanuda lo hace `set detenido_en = null`, y a partir de ahí vuelve a mirarse `enviar_despues_de` normalmente. |
| `creado_en` | `timestamptz`, no nulo, `default now()` | `service_role` | Cuándo se insertó la fila. |

## Quién puede hacer qué (RLS)

- **Nadie con sesión de usuario inserta, actualiza ni borra.** `anon` y `authenticated`
  pierden todos los privilegios por defecto (`revoke all ... from anon, public`) y solo se
  concede `select` a `authenticated`. Únicamente `service_role` (que además bypassa RLS)
  escribe. Es la misma regla que ya usan `cadena_corridas` y `planes_estrategicos`
  (migración `0083`): estas tres tablas son proyecciones que un proceso de servidor
  alimenta, no formularios que el navegador rellena.
- **El asesorado lee exactamente lo suyo, y solo lo que ya toca.** La política
  `mensajes_vida_leer` exige las tres condiciones en el mismo `using`:
  `usuario_id = auth.uid() and enviar_despues_de <= now() and detenido_en is null`. Las
  tres en la base, no repartidas con la app: un mensaje detenido no llega ni con
  `select *` hecho a mano contra la API, así que un cliente que no filtre bien no puede
  filtrar un mensaje que no debía mostrar — porque nunca lo recibe.
- **`leer_entrenamiento` no aplica aquí.** A diferencia de `tarjetas_vida`, esta tabla es
  una bandeja **personal**, no una proyección de la consola del coach: el staff con esa
  capacidad no lee los mensajes de vida de otra persona. Si en el futuro el coach necesita
  verlos (para saber qué le ha llegado a alguien antes de hablarle), eso es una política
  nueva y una decisión de Bryan aparte — no algo que esta migración da por hecho.

## Diferencias con el contrato de la cola (`mensaje_vida.schema.json`)

Esta tabla es un **recorte**, no una copia 1:1 del JSON de la cola:

- **No están** `clave_persona`, `slug`, `semana` ni `fuentes`. Son internos del agente
  (`clave_persona`/`slug` identifican a la persona en el corpus de `cerebro-alpha`, que no
  tiene por qué coincidir con cómo la app la identifica; `semana` es de qué semana salió el
  mensaje, no de cuándo se lee; `fuentes` es la cita verificada que ya viaja dentro de
  `texto` cuando aplica). Si algún día la app necesita mostrar la fuente por separado,
  añadir una columna es un `alter table`, no un rediseño.
- **No está** `ordenes` (el array de detener/reanudar con actor y motivo). Esta tabla
  guarda el **resultado** de esas órdenes (`detenido_en`), no su historial. Quien necesite
  auditar quién detuvo qué y por qué sigue mirando el archivo de la cola o
  `public.ordenes` (la tabla de la consola, `0083`), no esta proyección.
- **`id` es un `uuid` de Postgres**, no el `mv-<16 hex>` que genera
  `cola_mensajes_vida.py::id_mensaje`. El trabajo de sincronización (ver «Qué falta») puede
  guardar el id de la cola dentro de `texto`… no: mejor, si hace falta trazar de vuelta al
  archivo de origen, es una columna `id_cola text` que esta migración no incluyó porque hoy
  nada la necesita — añadirla cuando exista un consumidor real, no antes (mismo criterio
  que ya sigue este repo con el código huérfano).
- **`enviado_en`** no tiene equivalente directo en el schema de la cola (que solo tiene
  `estado: pendiente | detenido | enviado`). Aquí se prefirió una marca de tiempo a un
  enum: dice CUÁNDO se entregó, no solo que se entregó, y `detenido_en is null and
  enviar_despues_de <= now()` ya cubre "vigente" sin necesitar un tercer estado.

## Qué falta (a propósito, fuera de esta migración)

- **El trabajo que traduce un archivo de la cola a una fila de `mensajes_vida`.** Esta
  migración da la tabla y sus permisos; no escribe el sincronizador. `cola_mensajes_vida.py`
  ya documenta "EN SECO: nada de aquí ENVÍA" — esta tabla tampoco envía, solo permite que
  la app lea lo que alguien más decida escribir aquí.
- **El envío real** (push, WhatsApp). Ni la cola ni esta tabla lo hacen hoy.
- **Una bandeja del coach.** Ver el punto de `leer_entrenamiento` arriba.

## La otra tabla de esta migración: `tarjetas_vida`

Guarda las 7 preguntas semanales (V1..V7, `catalogo-vida-v2.json` en `cerebro-alpha`; V7
es la de rendimiento laboral/académico, añadida el 26-sep). A diferencia de
`mensajes_vida`, aquí el ASESORADO escribe: inserta la suya (`usuario_id = auth.uid()` en
el `with check`) y la lee; quien tenga `leer_entrenamiento` (o sea coach) lee todas. No hay
política de `update` ni de `delete` — una tarjeta ya respondida no se pisa desde el
navegador — y es única por persona y semana (`unique (usuario_id, semana_inicio)`).
`respuestas` es `jsonb` de forma abierta a propósito: el catálogo de preguntas vive
versionado en `cerebro-alpha`, y esta tabla no quiere tener que migrar cada vez que ese
catálogo suba de versión.
