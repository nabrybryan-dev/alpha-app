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
