# Guía de configuración de Supabase (la haces tú, ~10 min)

Pasos en el panel de tu proyecto en supabase.com. Hazlos en orden.

## 1 · Crear las tablas

1. Menú lateral → **SQL Editor** → **New query**.
2. Abre el archivo `supabase/migrations/0001_esquema.sql` de esta carpeta,
   copia TODO su contenido, pégalo y presiona **Run**.
3. Debe decir "Success. No rows returned".

## 2 · Cerrar el registro público (seguridad)

1. Menú → **Authentication** → **Sign In / Up** (o "Providers").
2. En **Email**: desactiva **"Allow new users to sign up"**.
   Así SOLO tú creas cuentas; nadie puede registrarse por su lado.
3. Guarda.

## 3 · Crear tu cuenta de coach

1. Menú → **Authentication** → **Users** → **Add user** → "Create new user".
2. Correo: el tuyo. Contraseña: una fuerte que solo tú conozcas.
   Marca **Auto Confirm User**.
3. Vuelve al **SQL Editor** y corre esto (con TU correo) para darte rol de coach:

```sql
update public.usuarios_app
set rol = 'coach', nombre = 'Bryan', avatar_iniciales = 'B'
where id = (select id from auth.users where email = 'TU-CORREO@AQUI.com');
```

## 4 · Crear una asesorada de prueba

1. **Authentication → Users → Add user**: otro correo tuyo (o uno inventado tipo
   `prueba+valentina@tucorreo.com` si usas Gmail), contraseña de prueba,
   **Auto Confirm User**.
2. Opcional, para ponerle nombre:

```sql
update public.usuarios_app
set nombre = 'Valentina Prueba', avatar_iniciales = 'VP'
where id = (select id from auth.users where email = 'CORREO-DE-PRUEBA@AQUI.com');
```

## 5 · Darme los datos de conexión

**Project Settings → API** → copia y pégame en el chat:

- Project URL (`https://xxxx.supabase.co`)
- anon public key (larga, empieza por `eyJ` — es pública por diseño)

**Nunca compartas** la `service_role key` ni la contraseña de la base de datos.

## 6 · Cargar los datos de prueba (después del paso 1)

1. Abre `supabase/migrations/0002_semilla.sql` de esta carpeta.
2. **Edita las dos líneas de correos** al inicio (sección CONFIGURA): pon el
   correo de tu cuenta de coach y el de la asesorada de prueba que creaste.
3. Copia TODO, pégalo en SQL Editor → New query → **Run**.
4. Debe decir "Success". Es seguro correrlo varias veces: borra y recarga los
   datos de prueba (perfil, microciclos M21-M22, check-ins, plan nutricional,
   chat, cuestionarios, contenidos y premiación de Valentina).

> Si cambio los datos de demostración, yo regenero este archivo con
> `npm run semilla` y tú solo lo vuelves a pegar.

## Qué sigue después (lo hago yo contigo)

- Configuro la app con esos valores (`.env.local`) y probamos el login real.
- Desplegamos a una URL pública (necesitarás crear cuenta en vercel.com igual de
  rápida) y la instalas como app en tu celular.

## 7 · Habilitar la hidratación (migración 0003)

1. Menú → **SQL Editor** → **New query**.
2. Abre `supabase/migrations/0003_hidratacion.sql` de esta carpeta, copia TODO,
   pégalo y presiona **Run**. Debe decir "Success. No rows returned".
3. Listo: el registro de agua de cada asesorado se guardará en la nube.

> Mientras no corras este paso la app NO se rompe: la hidratación se guarda
> solo en el dispositivo y empieza a sincronizarse en cuanto la tabla exista.

## 8 · Habilitar el ranking del equipo (migración 0004)

1. Menú → **SQL Editor** → **New query**.
2. Abre `supabase/migrations/0004_ranking.sql` de esta carpeta, copia TODO,
   pégalo y presiona **Run**. Debe decir "Success. No rows returned".
3. Listo: en Logros aparecerá el "Ranking Equipo Alpha".

> Privacidad: la función solo entrega cumplimiento agregado (sesiones
> completas, días de nutrición cumplidos, check-ins y puntos). Ningún
> asesorado puede ver el ánimo, las cargas ni las notas de otro.
> Mientras no corras este paso, la sección simplemente no se muestra.

## 9 · Ranking multi-categoría (migración 0005)

1. Menú → **SQL Editor** → **New query**.
2. Abre `supabase/migrations/0005_ranking_categorias.sql` de esta carpeta,
   copia TODO, pégalo y presiona **Run**. Debe decir "Success. No rows returned".
3. Listo: el ranking de Logros muestra las 6 categorías (General, Disciplina,
   Sesiones, Cargas, Progresión y Preguntas) con podio de los 3 primeros.

> Reemplaza a la función del paso 8 (la borra y la crea de nuevo con más
> columnas). Sigue entregando SOLO rendimiento agregado: jamás estados de
> ánimo, cargas concretas, notas ni datos personales. Si corres este paso,
> el paso 8 ya no es necesario; si aún no lo corres, el ranking funciona
> con las categorías básicas y las nuevas aparecen en cero.

## 10 · Centro de Respuestas (migración 0010)

Esta migración crea el banco de fichas de respuesta con búsqueda semántica
(`fichas_respuesta`) y la bitácora de preguntas del chat (`consultas_chat`).

### Antes de correr la migración: comprobar que no hay una `buscar_ficha` vieja

`create or replace function` solo reemplaza la función si los tipos de sus
argumentos coinciden exactamente. Si en algún momento se probó a mano en el
SQL Editor una versión de `buscar_ficha` con otra firma (por ejemplo con un
argumento de más, o un tipo distinto), esa versión **sobrevive** a la
migración con su propio permiso de `EXECUTE` para `PUBLIC` — y el `revoke`
de la migración, que apunta a la firma exacta `(extensions.vector, int)`, no
la alcanza. Antes de pegar la migración, en el SQL Editor corre:

```sql
select p.oid::regprocedure,
       has_function_privilege('anon', p.oid, 'execute') as anon_ejecuta
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'buscar_ficha';
```

- Si no devuelve filas: no hay ninguna versión previa, sigue tranquilo.
- Si devuelve **más de una fila**, o alguna fila con `anon_ejecuta = true`:
  hay una firma vieja con permiso de `anon`. Antes de continuar, revócala
  explícitamente usando la firma exacta que muestre `regprocedure` para esa
  fila, por ejemplo:

  ```sql
  revoke execute on function public.buscar_ficha(<firma exacta de la fila>) from anon, public;
  ```

  Solo cuando la consulta anterior devuelva cero filas con `anon_ejecuta = true`
  (idealmente una sola fila, la de la migración) sigue con el paso 1.

1. Menú → **SQL Editor** → **New query**.
2. En una terminal, dentro de la carpeta `app/`, copia la migración completa
   al portapapeles con este comando (pegar directo desde el chat puede
   partir el texto a la mitad, por eso se pasa por el portapapeles):

   ```powershell
   powershell -Command "Get-Content 'supabase/migrations/0010_centro_respuestas.sql' -Raw -Encoding UTF8 | Set-Clipboard; (Get-Clipboard).Length"
   ```

   Verifica que el número que imprime se parece al tamaño del archivo.
3. En el SQL Editor: **Ctrl+A → Delete → Ctrl+V → Run**. Debe decir
   "Success. No rows returned".
4. Comprueba que la tabla quedó vacía y lista para publicar:

   ```sql
   select count(*) from public.fichas_respuesta;
   ```

   Debe dar **0** — todavía no se ha publicado ninguna ficha.

### Publicar las fichas

1. En tu máquina define tres variables de entorno: `OPENAI_API_KEY`,
   `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` (esta última es la *service role
   key* del proyecto: se salta la seguridad de fila por completo, así que
   vive **solo en tu entorno local**, nunca en Vercel ni en un commit).
2. Desde `app/`:

   ```bash
   npm run publicar-fichas
   ```

   Lee los `.md` de `wiki/centro-respuestas/`, pide los vectores a OpenAI y
   hace upsert de las 50 fichas en Supabase.
3. Cada vez que cambies cualquier ficha del Cerebro, antes de publicar corre
   siempre:

   ```bash
   npm run validar-fichas
   ```

   Solo si sale "0 con errores", corre `npm run publicar-fichas` de nuevo
   para que la ficha corregida quede al día en Supabase.

> `OPENAI_API_KEY`, `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` viven **solo en
> tu entorno local**. Nunca en Vercel, nunca en un commit. Si alguna se
> filtra, se rota desde el panel del proveedor correspondiente.

## 11 · Desplegar el motor de respuesta (Edge Function `responder-chat`)

Es la función que recibe el mensaje del asesorado en el chat y devuelve la
ficha correcta rellenada con sus datos. Hazlo **después** de haber publicado
las fichas (paso 10).

### 11.0 · Correr la migración 0011 (obligatorio, va primero)

1. Menú → **SQL Editor** → **New query**.
2. Pega el contenido de `supabase/migrations/0011_grant_buscar_ficha_service_role.sql`
   y **Run**.

> Por qué: la migración 0010 le quitó a `public` el permiso de ejecutar
> `buscar_ficha` para cerrar el acceso anónimo, y de paso se lo quitó a
> `service_role`, que es con quien llama la Edge Function. Sin este paso la
> función despliega bien pero **toda respuesta cae a "se la paso a tu coach"**,
> porque la búsqueda de ficha devuelve permiso denegado.

### 11.1 · Dar de alta el secreto

1. Menú → **Edge Functions** → **Secrets** (o *Manage secrets*).
2. **Add new secret**: nombre `OPENAI_API_KEY`, valor tu clave de OpenAI.

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` **ya vienen puestas** por
> Supabase en todas las Edge Functions. No las agregues ni las toques: si
> creas una con el mismo nombre puedes romper la que ya funciona.

### 11.2 · Desplegar la función

1. Menú → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre de la función: exactamente `responder-chat`.
3. Borra el ejemplo que trae el editor (**Ctrl+A → Delete**) y pega el
   contenido completo de `supabase/functions/responder-chat/index.ts`.

   Como en el paso 10, pásalo por el portapapeles para que no se parta a la
   mitad. Desde la carpeta `app/`:

   ```powershell
   powershell -Command "Get-Content 'supabase/functions/responder-chat/index.ts' -Raw -Encoding UTF8 | Set-Clipboard; (Get-Clipboard).Length"
   ```

   Verifica que el número que imprime se parece al tamaño del archivo, y en
   el editor pega con **Ctrl+V**.
4. **Deploy**.

### 11.3 · Probarla desde el panel

Con el probador que trae el editor (*Test*/*Invoke*), manda este cuerpo:

```json
{ "usuario_id": "<un uuid real de usuarios_app>", "mensaje": "hasta donde bajo en la sentadilla" }
```

Debe devolver `via: "ficha"` y el texto de la ficha de profundidad.

> **Si ya vas por el paso 12, este cuerpo ya no aplica.** La función dejó de
> aceptar el `usuario_id` del cuerpo; usa el de la sección 12.3.

Para sacar un uuid real, en el SQL Editor:

```sql
select id, nombre from public.usuarios_app limit 5;
```

### 11.4 · Aviso importante sobre el editor del panel

El editor del panel **no tiene versionado ni rollback**: lo que pegas
reemplaza lo anterior y no hay forma de volver atrás desde ahí. La copia
buena y con historial es la del repo (`supabase/functions/responder-chat/index.ts`).
Si algo se rompe, se vuelve a pegar desde el repo.

Por lo mismo: **nunca edites el código directamente en el panel.** Se cambia
en el repo, se prueba con `npm test`, y recién ahí se pega.

---

## 12 · Cerrar el agujero y conectar el chat (migración 0012 + redespliegue)

Hasta ahora la función se creía el `usuario_id` que le llegaba en el cuerpo de
la petición. Como la app todavía no la llamaba, nadie podía aprovecharlo — pero
conectar el chat sin arreglar eso sí lo haría: un asesorado podía mandar el uuid
de otro y **leer sus datos** (microciclo, check-in de bienestar, hidratación) y
**escribir en su historial**, incluidas banderas rojas falsas que te llegarían a
ti atribuidas a alguien que nunca escribió eso.

Ahora el usuario sale del **token de sesión**, validado contra Supabase Auth.

### 12.1 · Correr la migración 0012 (va PRIMERO, antes del redespliegue)

**El orden importa.** La función nueva escribe la columna `origen` al guardar la
respuesta en el chat. Si redespliegas antes de correr la migración, esa columna
todavía no existe y el guardado falla: la asesorada vería la respuesta pero no
quedaría en su hilo. Primero la migración, después el redespliegue.


1. Menú → **SQL Editor** → **New query**.
2. Pega el contenido de `supabase/migrations/0012_origen_mensajes.sql` y **Run**.

Agrega la columna `origen` a `mensajes` (`'humano'` o `'alpha'`). Las filas que
ya existen quedan como `'humano'`, así que nada de lo que ya está escrito
cambia. Sirve para que la app pinte distinto la respuesta automática: el
asesorado tiene que saber si le habló la app o le hablaste tú.

Comprobación rápida:

```sql
select origen, count(*) from public.mensajes group by origen;
```

### 12.2 · Redesplegar `responder-chat` (sin esto el arreglo NO está activo)

El código nuevo está en el repo, pero la función que corre en Supabase sigue
siendo la vieja hasta que la vuelvas a pegar. **Mientras no hagas este paso, el
agujero sigue abierto.**

1. Menú → **Edge Functions** → `responder-chat` → editar.
2. Borra todo (**Ctrl+A → Delete**) y pega de nuevo el archivo completo, igual
   que en el paso 11.2. Desde la carpeta `app/`:

   ```powershell
   powershell -Command "Get-Content 'supabase/functions/responder-chat/index.ts' -Raw -Encoding UTF8 | Set-Clipboard; (Get-Clipboard).Length"
   ```

3. **Deploy**.

### 12.3 · Probar que el arreglo quedó activo

Con el probador del panel, manda el mismo mensaje de antes **pero ya sin
`usuario_id`**:

```json
{ "mensaje": "hasta donde bajo en la sentadilla" }
```

Desde el panel no hay sesión de asesorado, así que **debe responder `401`** con
`{ "error": "Falta la sesion" }` o `{ "error": "Sesion invalida" }`.

**Ese 401 es la señal de que el arreglo funciona.** Si te devuelve una respuesta
de ficha, el redespliegue no tomó: repite el 12.2.

Para probarla de verdad hay que hacerlo desde la app con una cuenta iniciada,
que es lo que pasa cuando una asesorada escribe en su chat.

> **Si en vez de 401 te sale un 500** que dice `Falta SUPABASE_ANON_KEY (o
> SUPABASE_PUBLISHABLE_KEY) en la funcion`, el problema no es la sesión: es que
> la función no tiene con qué validar el token. Ese caso devuelve 500 justamente
> para que no lo confundas con un 401 y busques donde no es. Añade la clave
> pública del proyecto como secreto y vuelve a probar.

### 12.4 · La app ya no manda el usuario, y es a propósito

Si miras el cuerpo que envía la app, verás que solo lleva `{ "mensaje": ... }`.
No es un olvido: **mandar el usuario es justamente el agujero**. Quien pregunta
se decide con el token de sesión y con nada más. Si alguna vez alguien propone
volver a aceptarlo "por si acaso", la respuesta es no.

### 12.5 · Quién escribe la respuesta en el hilo (y por qué no la app)

La respuesta de Alpha entra en el chat firmada con **tu id de coach**: la tabla
`mensajes` exige que `de_id` sea un usuario real, así que no hay un "remitente
Alpha". Lo que la distingue es la columna `origen = 'alpha'` de la 0012, y con
eso la app la pinta rotulada y en plano — la asesorada ve de un vistazo que no
se la escribiste tú, y en tu bandeja tú también.

**La fila la escribe la función, no la app.** La política de la 0001 dice:

```sql
create policy mensajes_enviar on public.mensajes
  for insert with check (de_id = auth.uid());
```

O sea: el teléfono de la asesorada **no puede** insertar una fila firmada por ti,
y está bien que no pueda — si pudiera, podría fabricar mensajes atribuidos a tu
cuenta. Por eso la inserta la Edge Function, que corre con `service_role` y se
salta las políticas. Es el mismo criterio que con el usuario: **el servidor es
dueño de lo que firma.**

La función devuelve el id de esa fila (`mensaje_id`) y la app la pinta con ese
mismo id, para que al sincronizar no aparezca duplicada. Si el guardado fallara,
la respuesta se muestra igual y solo se pierde al recargar: que la persona la
lea importa más que quede registrada.

No hay que abrir ninguna política nueva para esto. Si alguna vez se propone una
que deje al cliente insertar filas `origen = 'alpha'`, la respuesta es no: es la
misma clase de agujero que cerró esta etapa.

Comprobación después de probar desde la app:

```sql
select id, de_id, para_id, origen, left(texto, 40) as texto
from public.mensajes
where origen = 'alpha'
order by fecha_iso desc
limit 5;
```

## 13 · Que las banderas rojas te suenen en el teléfono (Telegram)

Hasta ahora una bandera roja se quedaba marcada en el panel de consultas: si
alguien escribía a las 3 de la madrugada, esperaba a que tú abrieras el panel.
Con esto te llega un aviso al teléfono en el momento.

### 13.1 · Crear el bot y sacar los dos datos

1. Doble clic en **`CONFIGURAR AVISOS.bat`** (está en la carpeta `app`, al lado
   de `PUBLICAR FICHAS.bat`).
2. Sigue lo que dice en pantalla: crear el bot con **@BotFather**, copiar el
   token, y escribirle algo al bot desde tu Telegram.
3. Al final te muestra el **`TELEGRAM_CHAT_ID`**. El token no lo muestra nunca:
   sigue en tu portapapeles, que es de donde lo tomó.

### 13.2 · Guardar los dos secretos en Supabase

1. Menú → **Edge Functions** → **Secrets** → añadir dos:

   | Name | Value |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | el token que te dio @BotFather |
   | `TELEGRAM_CHAT_ID` | el número que te mostró el ayudante |

2. El `chat_id` no es secreto y por eso el ayudante te lo enseña. **El token
   sí**: no lo pegues en ningún chat, ni siquiera conmigo.

### 13.3 · Redesplegar `responder-chat`

**Sin esto no se envía nada.** El código del aviso está en el archivo, pero la
función que corre en Supabase sigue siendo la vieja hasta que la vuelvas a
pegar. Mismo procedimiento del paso 12.2:

```powershell
powershell -Command "Get-Content 'supabase/functions/responder-chat/index.ts' -Raw -Encoding UTF8 | Set-Clipboard; (Get-Clipboard).Length"
```

Edge Functions → `responder-chat` → editar → **Ctrl+A → Delete** → pegar →
**Deploy**.

### 13.4 · Probar

Desde la app, con una cuenta de asesorado, escribe en el chat:

> me duele la rodilla al bajar

Debe llegarte el aviso a Telegram en unos segundos. Fíjate en que **no trae el
texto del mensaje**: solo el tipo, el nombre de pila, y el enlace al panel.

### 13.5 · Por qué el aviso no trae lo que escribió la persona

Un mensaje con bandera roja puede decir *"se me escapa la orina al saltar"* o
*"se me retrasó la regla"*. Mandar eso a Telegram sacaría **datos de salud de
personas reales fuera de Supabase**, a un servidor de terceros. El aviso lleva
solo tipo, nombre de pila y enlace; el contenido se lee en el panel, que está
dentro de tu propia base.

El teléfono te suena igual, que es todo lo que hacía falta. Si alguna vez se
propone meter el mensaje dentro del aviso "para no tener que abrir el panel",
la respuesta es no.

### 13.6 · Si no configuras esto, no se rompe nada

Si los dos secretos no están, la función **funciona exactamente igual**: la
asesorada recibe su respuesta, la consulta queda registrada y la bandera roja
sigue apareciendo en el panel. Simplemente no suena el teléfono.

Lo mismo si Telegram se cae o tarda: el envío se corta a los pocos segundos y la
respuesta al asesorado sale igual. **Un aviso que no sale nunca le cuesta a
nadie su contestación.**

### 13.7 · Si empieza a sonar demasiado

Las banderas de salud incluyen cosas corrientes como "me duele la rodilla". Con
19 asesorados podrían ser varios avisos al día, y un coach que recibe demasiados
deja de mirarlos — que es justo lo que esto intenta evitar.

Todavía no se pone ningún límite, a propósito: no sabemos el volumen real.
`consultas_chat` lo dirá en una semana. Si resulta ruidoso, la salida es separar
la crisis (que siempre suene) de la bandera de salud (un resumen diario), **no
bajar el listón de lo que se marca**.
