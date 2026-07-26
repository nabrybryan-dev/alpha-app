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
