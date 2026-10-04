# Cómo crear el atajo de Apple que manda tu Salud a Alpha

**Para:** Bryan · **Fase A de salud del celular** · **Fecha:** 28-sep-2026
**Estado:** guía escrita sin iPhone a mano. Todo lo que dependa de cómo se ve o se comporta la app **Atajos** de Apple lleva la marca **[NO VERIFICADO SIN iPHONE]**. Lo que corre en Alpha (la Edge Function, la migración y la pantalla de la app) sí está probado: pruebas de la función, la prueba SQL 110 contra un Postgres real y las de la pantalla.

> Diseño y razones: `vigia-codex/estilo-de-vida/COSTOS-APP-NATIVA-Y-SALUD.md` (§3 Fase 1 y §5 lo legal).
> Qué recibe el servidor, con todos los detalles: cabecera de `supabase/functions/salud-atajo/index.ts`.

---

## 0. Antes de tocar el iPhone (lo que tiene que estar hecho)

Sin esto el atajo se construye, pero no llega nada. Es lo que te toca a ti, en este orden:

1. **Aplicar la migración `0093_salud_del_celular_atajo.sql`** en el SQL Editor de Supabase. Exige que la 0083 y la 0089 ya estén aplicadas; si falta una, se detiene sola con un mensaje. Después, correr `supabase/comprobar-migraciones.sql`: las siete filas que empiezan por `0093 - salud del celular` tienen que decir **SI**.
2. **Darte la capacidad `leer_entrenamiento`** (bloque comentado al final de la 0083) si quieres leer los datos desde la consola. Las tablas de salud solo las lee su dueño o quien tenga esa capacidad; el rol de coach, por sí solo, no basta.
3. **Desplegar la función `salud-atajo`** con **«Verify JWT» apagado** (el atajo no tiene sesión de Supabase; se identifica con su propio código). Se pega `supabase/functions/salud-atajo/index.ts` tal cual en Edge Functions, «Via Editor», y se comprueba con `get_edge_function` que lo desplegado es lo mismo (el despliegue por el MCP se come los escapes; este archivo no usa ninguno).
4. **Fusionar la rama `feat/salud-atajo` DESPUÉS de aplicar la migración, no antes.** El formulario público de interesados ya manda la casilla E (`casilla_e`, texto 0.4) y solo la 0093 la acepta: si el código sale primero, ese formulario falla. Lo que sí es seguro es que la tarjeta «Salud de tu celular» de Bienestar no aparece mientras la migración no esté aplicada.
5. En la app, sección **Bienestar → Salud de tu celular**: marcar la casilla E, aceptar la declaración y **Generar mi código**. Copiarlo (se muestra una sola vez).

### Probar la función sin el iPhone (recomendado antes de construir nada)

Desde el PowerShell de tu PC, con **tu** código y la URL de tu proyecto (la misma que `VITE_SUPABASE_URL`, más `/functions/v1/salud-atajo`):

```powershell
$cuerpo = '{"muestras":[{"fecha":"2026-09-28","tipo":"pasos","valor":"8123"},{"fecha":"2026-09-28","tipo":"peso","valor":"72,4"}]}'
Invoke-RestMethod -Method Post -Uri "https://<TU-PROYECTO>.supabase.co/functions/v1/salud-atajo" `
  -Headers @{ "x-alpha-token" = "sa_<tu código>" } -Body $cuerpo -ContentType "text/plain"
```

Tiene que responder `ok: True, guardadas: 2, descartadas: 0`. Si responde otra cosa, la tabla de errores de la sección 6 dice qué falta. (Si copias esto, cambia la fecha por una de los últimos 14 días.)

---

## 1. Lo que el atajo tiene que mandar

Una petición **POST** a `https://<TU-PROYECTO>.supabase.co/functions/v1/salud-atajo`, con:

- **Cabecera** `x-alpha-token`: el código de la persona (`sa_` y 40 letras/números). **Nunca en la URL.**
- **Cuerpo**: un JSON con una lista `muestras`, una fila por **día y dato**. Lo más simple, y lo que perdona más, es mandar **todo como texto entre comillas**:

```json
{"muestras":[
  {"fecha":"2026-09-28","tipo":"pasos","valor":"8123"},
  {"fecha":"2026-09-28","tipo":"sueno","valor":"7,5"},
  {"fecha":"2026-09-28","tipo":"fc_reposo","valor":"58"},
  {"fecha":"2026-09-28","tipo":"vfc","valor":"42,3"},
  {"fecha":"2026-09-28","tipo":"minutos_ejercicio","valor":"35"},
  {"fecha":"2026-09-28","tipo":"peso","valor":"72,4"}
]}
```

| `tipo` | Qué es | Unidad (la pone la función) | Rango que acepta |
|---|---|---|---|
| `pasos` | suma de pasos del día | pasos | 0 – 100.000 |
| `sueno` | horas dormidas (también acepta `"unidad":"min"` con minutos) | h | 0 – 20 |
| `fc_reposo` | frecuencia cardiaca en reposo | lpm | 25 – 140 |
| `vfc` | variabilidad de la frecuencia cardiaca (en el iPhone es **SDNN**) | ms | 5 – 300 |
| `minutos_ejercicio` | minutos de ejercicio | min | 0 – 600 |
| `peso` | último peso del día | kg | 25 – 300 |

Reglas que el atajo se puede saltar sin miedo, porque la función las cubre:

- **Fecha:** `AAAA-MM-DD`. También vale una fecha ISO completa (`2026-09-28T07:00:00-05:00`): se toma el día del teléfono. Solo se aceptan los **últimos 14 días** y como mucho mañana.
- **Números:** vale `8123`, `"8123"`, `"8.123"` y `"8,123"` (pasos, FC, minutos), y `"7,5"` o `"7.5"` (sueño, peso, VFC). El formato de Colombia (coma decimal, punto de miles) se entiende.
- **Dato que falta** (no hubo pasos ese día): manda `"valor":""`. Esa fila se **descarta** y el resto se guarda. No hace falta ningún «Si» en el atajo.
- **Repetido** (el mismo día y tipo dos veces en un envío): gana el último.
- **Enviar de más no daña:** reenviar el mismo día **actualiza**, no duplica. Por eso el atajo manda **hoy y los dos días anteriores** en cada envío: si un día no corrió (teléfono bloqueado), el siguiente lo recupera.
- **Nada más se guarda.** Cualquier otra clave (un comentario, una ubicación) se ignora. Y jamás mandes rutas, ubicación ni mediciones sueltas: solo el resumen del día.

Límites: 16 KB por envío, 120 filas, **20 envíos por hora y código**. Un envío diario de 18 filas (3 días × 6 datos) está muy por debajo.

---

## 2. Construir el atajo en el iPhone

Abre la app **Atajos** → pestaña **Atajos** → **+** (arriba a la derecha) → toca el nombre («Atajo sin título») → **Renombrar**: `Alpha Salud`.

Los nombres de las acciones van en español de la app y, entre paréntesis, en inglés por si tu iPhone está en otro idioma. **[NO VERIFICADO SIN iPHONE]** los nombres exactos y el orden de los campos cambian un poco entre versiones de iOS; lo importante es la acción, no la palabra.

> **Cómo agregar una acción:** en la barra de abajo, toca **Buscar acciones** (o el `+`), escribe el nombre y toca el resultado. Para poner una variable en un campo, toca el campo y elige la variable en la barra que aparece sobre el teclado.

### Paso 1 · El código

1. Acción **Texto** (Text). Escribe dentro exactamente `PEGA-TU-CODIGO-AQUI`.
2. Toca su etiqueta de salida y ponle nombre: mantén el dedo sobre la burbuja de resultado → **Renombrar** → `Codigo`.

*Captura descrita:* una tarjeta gris con el título «Texto» y, dentro, el texto `PEGA-TU-CODIGO-AQUI`.

Esta tarjeta es la **pregunta de importación** (paso 8): quien instale el atajo pegará aquí su propio código.

### Paso 2 · La lista de días

1. Acción **Texto**. Escribe tres líneas (Enter entre cada una): `0`, `1`, `2`. Son «hace 0, 1 y 2 días».
2. Acción **Dividir texto** (Split Text) → «Nuevas líneas» (New Lines). Su resultado es una lista de tres elementos.
3. Acción **Repetir con cada elemento** (Repeat with Each). A partir de aquí, **todo lo que sigue va dentro** de este bloque, hasta el paso 4. El elemento actual se llama `Elemento de la repetición` (Repeat Item).

*Captura descrita:* el bloque «Repetir con cada elemento en (Texto dividido)» con «Fin de repetición» más abajo; las acciones nuevas entran entre las dos líneas.

### Paso 3 · Dentro del bloque: las fechas de ese día

1. **Fecha actual** (Current Date).
2. **Ajustar fecha** (Adjust Date): **Restar** · valor: *Elemento de la repetición* · unidad: **Días**. Resultado: `Dia`.
3. **Ajustar fecha**: sobre `Dia` → **Obtener inicio del día** (Get Start of Day). Resultado: `Inicio`.
4. **Ajustar fecha**: sobre `Inicio` → **Sumar** · 1 · **Días**. Resultado: `Fin`.
5. **Dar formato a fecha** (Format Date) sobre `Inicio` → formato de fecha **Personalizado** (Custom) → `yyyy-MM-dd`. Resultado: `Fecha`.

*Captura descrita:* cinco tarjetas seguidas; la última muestra «Dar formato a fecha · Inicio · Personalizado · yyyy-MM-dd». Al ejecutarla debe salir, por ejemplo, `2026-09-28`.

**[NO VERIFICADO SIN iPHONE]:** que el campo numérico de «Restar» acepte una variable de texto («0», «1», «2») sin convertirla a número. Si no la acepta, agrega antes **Obtener números de la entrada** (Get Numbers from Input) sobre el elemento de la repetición y usa ese resultado.

### Paso 4 · Dentro del bloque: un dato por cada uno de los seis

Cada dato son tres acciones y se repite seis veces. Te doy el primero (pasos) completo y, de los demás, solo lo que cambia.

**Pasos**

1. **Encontrar muestras de Salud** (Find Health Samples):
   - Tipo (Type) es **Pasos** (Steps)
   - Fecha de inicio (Start Date) **está en el rango** · de `Inicio` a `Fin` (o «es posterior a `Inicio`» y «es anterior a `Fin`»)
   - Resultado: `MuestrasPasos`
2. **Calcular estadísticas** (Calculate Statistics): **Suma** (Sum) de `MuestrasPasos`. Resultado: `ValorPasos`.
3. **Texto**: escribe esto (las variables van en las llaves; en Atajos las insertas desde la barra de variables):

   `{"fecha":"[Fecha]","tipo":"pasos","valor":"[ValorPasos]"}`

4. **Añadir a variable** (Add to Variable) → la variable se llama `Filas`.

*Captura descrita:* tras «Calcular estadísticas» aparece un número grande (los pasos del día); el texto de la tarjeta 3 muestra `Fecha` y `ValorPasos` como dos «pastillas» de color dentro de las comillas.

**Lo que cambia en los otros cinco** (el mismo esquema: Encontrar → Calcular → Texto → Añadir a `Filas`):

| Dato | Tipo en «Encontrar muestras de Salud» | Estadística | `"tipo"` en el texto |
|---|---|---|---|
| Sueño | **Sueño** (Sleep) | ver la nota de abajo | `sueno` |
| FC en reposo | **Frecuencia cardiaca en reposo** (Resting Heart Rate) | **Promedio** (Average) | `fc_reposo` |
| VFC | **Variabilidad de la frecuencia cardiaca** (Heart Rate Variability) | **Promedio** | `vfc` |
| Minutos de ejercicio | **Minutos de ejercicio** (Exercise Time / Apple Exercise Minutes) | **Suma** | `minutos_ejercicio` |
| Peso | **Peso corporal** (Body Mass / Weight) | **Último** (ordena por fecha de inicio, más reciente primero, límite 1, y toma su **Valor**) | `peso` |

Notas por dato, todas **[NO VERIFICADO SIN iPHONE]**:

- **Sueño.** Apple guarda el sueño como muestras por fase (En cama, Dormido, REM, Núcleo, Profundo, Despierto). Para las horas dormidas hay que sumar la **duración** de las fases de dormido y **no** la de «En cama» ni «Despierto». Lo más probable es que «Encontrar muestras de Salud» deje filtrar por **Valor** (Value); si lo permite, filtra «Valor es Dormido/Núcleo/REM/Profundo». Se asigna al día en que **termina** el sueño (la noche de ayer cuenta para hoy), así que el filtro de fecha para este dato es sobre la **Fecha de finalización** (End Date). La estadística es **Suma** de la propiedad **Duración**, que sale en horas o en minutos según el iPhone; si sale en minutos, agrega `"unidad":"min"` al texto: `{"fecha":"[Fecha]","tipo":"sueno","valor":"[ValorSueno]","unidad":"min"}`. Si el iPhone no deja filtrar por fase, **empieza sin sueño** (omite este dato) y déjalo para una segunda vuelta.
- **FC en reposo y VFC.** Ambas necesitan un Apple Watch (u otro aparato que escriba en Salud). Sin reloj no hay muestras: el promedio sale vacío y esa fila se descarta sola.
- **Minutos de ejercicio.** Apple no publica qué tipos entrega la acción «Encontrar muestras de Salud» (`COSTOS` §2.2). Si en la lista de tipos **no aparece**, omite este dato; no es imprescindible para arrancar.
- **Peso.** Si no hay peso ese día, la búsqueda devuelve vacío y esa fila se descarta. Comprueba en **Salud → Perfil → Unidades** que el peso está en **kg**.

### Paso 5 · Fuera del bloque: armar el cuerpo

Después de «Fin de repetición»:

1. **Combinar texto** (Combine Text) sobre `Filas` → separador **Personalizado** (Custom) → una coma `,`. Resultado: `ListaFilas`.
2. **Texto**: `{"muestras":[ListaFilas]}` (la variable dentro de los corchetes). Resultado: `Cuerpo`.

*Captura descrita:* el texto de la última tarjeta empieza por `{"muestras":[` y termina en `]}`, con una pastilla `ListaFilas` en medio.

### Paso 6 · Mandarlo

1. **Obtener contenido de URL** (Get Contents of URL):
   - URL: `https://<TU-PROYECTO>.supabase.co/functions/v1/salud-atajo`
   - Toca **Mostrar más** (Show More) → **Método** (Method): **POST**
   - **Encabezados** (Headers) → **Agregar nuevo encabezado**: clave `x-alpha-token`, valor = la variable `Codigo`
   - **Encabezados** → otro: clave `Content-Type`, valor `application/json`
   - **Cuerpo de la solicitud** (Request Body): **Archivo** (File) → valor = la variable `Cuerpo`
2. **Obtener valor del diccionario** (Get Dictionary Value): «Valor de» → clave `guardadas` de *Contenidos de URL*. **[NO VERIFICADO SIN iPHONE]** si el resultado de la URL se trata como diccionario automáticamente; si no, antes agrega **Obtener diccionario de la entrada** (Get Dictionary from Input).
3. **Mostrar notificación** (Show Notification): «Salud enviada a Alpha: [valor] datos». Sirve para las pruebas; después se puede quitar (paso 9).

**[NO VERIFICADO SIN iPHONE]:** que «Cuerpo de la solicitud: Archivo» con un **Texto** mande el texto tal cual. Es la forma más simple de mandar un JSON armado a mano, pero la app trata un texto como archivo de texto plano. La función lee el cuerpo como texto y **no mira** el `Content-Type`, así que debería funcionar. Si responde `400 cuerpo_invalido`:

- *Plan B:* agrega, antes de «Obtener contenido de URL», la acción **Obtener diccionario de la entrada** sobre `Cuerpo` (convierte el texto en un diccionario) y usa **ese diccionario** como el «Archivo» del cuerpo. Atajos lo manda como JSON.
- *Plan C:* cuerpo tipo **JSON** con un solo campo `muestras` de tipo **Lista/Array** y las filas como diccionarios armados con **Diccionario**. Más largo de construir.

### Paso 7 · Primera prueba a mano

1. Toca el **triángulo de reproducir** dentro del atajo, con el código real pegado en el paso 1.
2. La primera vez, iOS pide permisos, uno por cada tipo de Salud: **Permitir** los que quieras mandar (los seis, si decidiste mandarlos). Si niegas uno, ese dato llegará vacío.
3. La primera vez que llama a la URL, iOS pregunta si **permite mandar datos** a `supabase.co`: **Permitir siempre**.
4. Debe salir la notificación «Salud enviada a Alpha: N datos». Comprueba en la app (Bienestar → Salud de tu celular): dice «Último envío: …» y «Último día con datos».

*Captura descrita de la respuesta esperada (Contenidos de URL):* `ok: true`, `guardadas: 18`, `descartadas: 0` (o algunas descartadas si faltan datos).

### Paso 8 · Preparar la pregunta de importación (para poder compartirlo)

Es lo que hace que cada persona pegue **su** código en vez del tuyo.

1. En el atajo, toca **ⓘ** (Detalles) abajo o arriba a la derecha → pestaña **Configuración** (Setup) → **Preguntas de importación** (Import Questions) → **Agregar pregunta** (Add Question).
2. Elige la acción del **paso 1** (la tarjeta «Texto» con `PEGA-TU-CODIGO-AQUI`).
3. Pregunta: `Pega aquí tu código de Alpha (lo generas en la app, en Bienestar → Salud de tu celular)`.
4. **[NO VERIFICADO SIN iPHONE]** la ruta exacta de menús: en algunas versiones la pregunta se agrega tocando la acción y luego «Agregar pregunta de importación».
5. **Antes de compartir, comprueba que el Texto del paso 1 dice `PEGA-TU-CODIGO-AQUI` y no tu código real.** Lo que tenga el atajo al compartirlo viaja en el enlace. Si probaste con tu código, bórralo y vuelve a poner el marcador.

### Paso 9 · Dejarlo listo para todos los días

Quita la notificación de prueba del paso 6 (o déjala: «Salud enviada» una vez al día no molesta). Deja el atajo así.

---

## 3. La automatización diaria

Crea una que lo ejecute **sola**, una vez al día.

1. En Atajos, pestaña **Automatización** → **+** → **Automatización personal** (Personal Automation).
2. Elige **Hora del día** (Time of Day) → una hora **en que tu teléfono suele estar desbloqueado y en uso**, por ejemplo **8:00 a. m.** o **12:30 p. m.** → **Repetir: Diariamente** (Daily) → **Siguiente**.
3. **Agregar acción** → **Ejecutar atajo** (Run Shortcut) → elige `Alpha Salud`.
4. En la pantalla final: **Ejecutar inmediatamente** (Run Immediately) en vez de «Preguntar antes de ejecutar», y **apaga «Notificar cuando se ejecute»** si no quieres el aviso de iOS.
5. **Listo** (Done).

**Por qué la hora importa.** Salud está cifrada con el teléfono bloqueado y se vuelve a cerrar unos 10 minutos después de bloquearlo (`COSTOS` §2.2). Un atajo programado de madrugada, con el teléfono bloqueado, falla. Si en ese día no corre, **no se pierde nada**: el siguiente envío manda de nuevo los dos días anteriores.

**Alternativa si a esa hora el teléfono está bloqueado:** una automatización del tipo **App** → «Al abrir» una app que uses a diario (por ejemplo, la de mensajes) → ejecutar `Alpha Salud`. Con «Ejecutar inmediatamente». Correría cada vez que la abras. Elige una app que abras pocas veces al día: el tope es de 20 envíos por hora y código, y los sobrantes reciben un 429 (no se pierde nada, pero iOS puede mostrar un aviso de error).

**[NO VERIFICADO SIN iPHONE]:** la ubicación de «Ejecutar inmediatamente» en tu versión de iOS (iOS 27 movió pantallas de automatización, según `COSTOS` §2.2). Y que la automatización de **Hora del día** pueda abrir Salud sin que la persona toque nada: es justamente lo que hay que comprobar durante la semana de prueba.

---

## 4. Compartirlo por enlace de iCloud

1. En la lista de **Atajos**, mantén el dedo sobre `Alpha Salud` → **Compartir** (Share) → **Copiar enlace de iCloud** (Copy iCloud Link).
2. iOS puede advertir que el atajo contiene acciones que envían datos; acepta.
3. El enlace tiene la forma `https://www.icloud.com/shortcuts/…` (letras y números).
4. **Pégalo en la constante `ENLACE_ATAJO_ICLOUD`** de `src/domain/salud/atajo.ts`, entre las comillas, y súbelo a `main`. La pantalla pinta entonces el botón «Abrir el atajo». Una prueba (`atajo.test.ts`) verifica que lo pegado tenga la forma de un enlace de atajo de iCloud y nada más.
5. **Prueba el enlace como si fueras otra persona:** ábrelo en otro iPhone (o con otro Apple ID). Tiene que pedir el código al importar (la pregunta del paso 8), no traer el tuyo.
6. **Higiene:** después de compartir, **genera un código nuevo en la app** (Bienestar → Salud de tu celular → Generar otro código). El anterior, que pudo haber viajado en el enlace, deja de funcionar al instante.

**[NO VERIFICADO SIN iPHONE]:**
- Que un enlace de iCloud siga apuntando a la versión que compartiste aunque cambies el atajo después. Si cambias algo, comparte de nuevo y **actualiza la constante**: quienes ya lo instalaron deberán reinstalar (según `COSTOS`, cada cambio obliga a reinstalar).
- Que la pregunta de importación aparezca antes de agregar el atajo. Es lo que hace `Obtener atajo` en un atajo compartido con «Preguntas de importación».

---

## 5. Lo que ve cada persona (el recorrido completo)

1. Abre la app → **Bienestar** → **Salud de tu celular**.
2. Lee la casilla **E** y los seis datos, marca **Sí, lo autorizo** y **Acepto la declaración** (nada viene marcado) → **Autorizar**.
3. **Generar mi código** → **Copiar**.
4. **Abrir el atajo** → **Obtener atajo** → pega el código cuando lo pida.
5. Ejecuta el atajo una vez; acepta los permisos de Salud.
6. Crea la automatización diaria (sección 3). *Un paso más que el atajo no puede hacer por sí mismo: iOS no deja que un atajo compartido cree su propia automatización.* **[NO VERIFICADO SIN iPHONE]**
7. Para **revocar**: la misma tarjeta → **Revocar mi permiso**. El código se apaga al instante; la persona decide si también borra lo ya enviado. Debe borrar el atajo de su iPhone si quiere.

Tiempo estimado por persona (`COSTOS`): unos 5 minutos.

---

## 6. Si algo falla

La función responde siempre con `ok`, `error` y un `mensaje` en español (que puedes mostrar con «Mostrar resultado»).

| Respuesta | `error` | Qué pasó | Qué hacer |
|---|---|---|---|
| 200 | — | Entró. `guardadas` = filas guardadas; `descartadas` = filas que no valían (con `detalle`: qué fila y por qué, **sin el valor**). | Nada. Si `descartadas` es alto, revisa `detalle`: `fuera_de_rango`, `valor_invalido` (dato vacío), `tipo_desconocido` (nombre del tipo mal escrito), `fecha_antigua` … |
| 401 | `token_invalido` | Falta el código, está mal escrito, se revocó o generaste otro. | Generar uno nuevo y pegarlo en el atajo. En la cabecera va **`x-alpha-token`**, no `Authorization`. |
| 403 | `sin_consentimiento` | El código existe pero la persona **no tiene la casilla E vigente** (la revocó). | Volver a autorizar en la app. |
| 405 | `metodo` | El atajo mandó GET. | En «Obtener contenido de URL», **Método: POST**. |
| 413 | `demasiado_grande` | Más de 16 KB o 120 filas. | Reducir a 3 días × 6 datos. |
| 429 | `limite` | Más de 20 envíos en una hora con el mismo código. | Esperar una hora. Si es una automatización desbocada, revisar que solo corra una vez al día. |
| 400 | `cuerpo_invalido` / `sin_muestras` | El cuerpo no es JSON con «muestras». | Mostrar el `Cuerpo` (una acción «Mostrar resultado» antes de mandarlo) y compararlo con el ejemplo de la sección 1; probar el plan B del paso 6. |
| 422 | `todas_descartadas` | Ninguna fila era válida. | Mismo `detalle` que en el 200. |
| 500 | `servidor` | Falla de la función o de la base. | Revisar que la 0093 esté aplicada (señales `0093 - salud del celular` en SI) y los registros de la función (solo llevan estado y conteos; nunca datos). |

Si la app dice «Todavía no ha llegado ningún envío» pero el atajo dice que mandó, mira en el atajo la respuesta de «Obtener contenido de URL».

---

## 7. Qué NO se pudo verificar sin un iPhone (resumen)

Todo esto es lo que hay que comprobar en el iPhone de Bryan o de Manuela durante la **primera semana**:

1. Nombres y orden exactos de las acciones de Atajos en la versión de iOS del teléfono de prueba.
2. «Restar» días con una variable de texto (y el plan alterno del paso 3).
3. El filtro por **fase** del sueño y la unidad de la **Duración** (horas o minutos).
4. Que «Minutos de ejercicio» sea un tipo disponible en «Encontrar muestras de Salud».
5. Que «Cuerpo de la solicitud: Archivo» con un Texto mande el JSON tal cual (y los planes B y C).
6. Que la automatización de **Hora del día** con «Ejecutar inmediatamente» consiga leer Salud sin tocar el teléfono, y a qué hora conviene.
7. La ruta de menús de las **preguntas de importación** y que el enlace de iCloud las pida al instalar.
8. Que el enlace compartido no lleve tu código (el paso 8.5 y el 4.6 lo cubren, pero hay que verlo con otro Apple ID).

Si alguno falla, el resto de la cadena (pantalla, código, función, base) ya está probado; lo que se ajusta es solo el atajo.

## 8. Después de la semana de prueba

Las señales para decidir si se pasa a la app nativa están en `COSTOS-APP-NATIVA-Y-SALUD.md` (§3, «El umbral para dar el paso»): si el dato le cambia una recomendación a la mitad de quienes mandan, si llegan menos de 5 de cada 7 días, o si hay 25 o más iPhone. La tabla `salud_muestras` (fuente `atajo`) y la función se reutilizan tal cual con la fuente `nativa`.
