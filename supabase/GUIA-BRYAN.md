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

### 12.1 · Correr la migración 0012

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

> **Ojo con este 401:** no distingue "el arreglo funciona" de "falta la clave".
> Para validar el token, la función usa `SUPABASE_ANON_KEY` (o
> `SUPABASE_PUBLISHABLE_KEY` si el proyecto ya migró al formato nuevo de
> claves). Si ninguna de las dos está puesta, **todo** devuelve 401, también
> las peticiones legítimas de la app — y el chat se queda sin respuestas de
> Alpha sin ningún error a la vista. Falla del lado seguro, pero falla. Por eso
> la prueba que vale es la de la app con sesión iniciada: si desde ahí llega
> respuesta, las dos cosas están bien.

### 12.4 · La app ya no manda el usuario, y es a propósito

Si miras el cuerpo que envía la app, verás que solo lleva `{ "mensaje": ... }`.
No es un olvido: **mandar el usuario es justamente el agujero**. Quien pregunta
se decide con el token de sesión y con nada más. Si alguna vez alguien propone
volver a aceptarlo "por si acaso", la respuesta es no.

### 12.5 · PENDIENTE antes de que esto funcione de punta a punta

Falta una decisión tuya. La respuesta de Alpha entra en el hilo firmada con
**tu id de coach** (la tabla `mensajes` exige que `de_id` sea un usuario real) y
marcada `origen = 'alpha'`. Pero la política de seguridad de `mensajes` dice:

```sql
create policy mensajes_enviar on public.mensajes
  for insert with check (de_id = auth.uid());
```

Es decir: **una asesorada no puede insertar una fila firmada por ti.** Con eso,
la respuesta de Alpha se ve al instante en su teléfono pero no se guarda en la
base: se reintenta 8 veces, se descarta, y desaparece la próxima vez que la app
sincroniza. Además, mientras reintenta, **bloquea la cola** y retrasa la subida
de sus series y check-ins.

Hay dos salidas y la elección es tuya:

- **(A) Que la escriba la función.** La Edge Function ya corre con
  `service_role` y se salta las políticas: puede insertar ella misma la fila en
  `mensajes`. Es lo más limpio y no abre nada. Requiere un cambio más en la
  función y en la app.
- **(B) Abrir una política nueva** que deje a la asesorada insertar filas con
  `origen = 'alpha'` dirigidas a ella misma. Es menos trabajo, pero le permite
  fabricar mensajes firmados con tu id. Quedarían marcados como `'alpha'`, no
  como tuyos, pero **serían filas reales atribuidas a tu cuenta**. En una app con
  datos de salud eso no es un detalle menor.

Mi recomendación es **(A)**. No conectes el chat en producción hasta decidirlo.
