# Plan — Etapa 2a: Supabase (auth + datos reales + despliegue)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Login real, datos en Supabase con aislamiento por fila (RLS), y la misma app
navegable de la etapa 1 funcionando contra la nube, desplegada a una URL pública.

**Arquitectura elegida — "hidratar + escribir a través" (offline-first):**
La UI de la etapa 1 no se toca. El almacén local (localStorage) sigue siendo la
fuente de lectura síncrona; al iniciar sesión se **hidrata** desde Supabase
(snapshot del usuario), y cada mutación local se **replica en segundo plano** a
Supabase (cola con reintentos). Ventajas: cero refactor de pantallas, y la app
funciona en gimnasios con mala señal.

**Modelo de datos (Postgres):** tablas por agregado con JSONB para las estructuras
anidadas: `perfiles(usuario_id, datos jsonb)`, `microciclos(id, usuario_id, numero,
estado, datos jsonb)`, `checkins`, `adherencias`, `mensajes`, `respuestas`,
`cuestionarios`, `contenidos`, `premiaciones`, `planes_nutricionales`. Tabla
`usuarios_app(id = auth.uid(), nombre, rol)` con rol `asesorado|coach`.

**RLS:** cada asesorado solo lee/escribe filas con su `usuario_id`; el rol coach
lee todo y escribe prescripciones/cuestionarios/contenidos/premiaciones. Los
mensajes: solo emisor y receptor.

**Etapa 2b (después):** push notifications (Edge Function + Web Push), subida de
archivos a Storage (contenidos y adjuntos del chat), constructor de cuestionarios
del coach, invitaciones de asesorados por correo.

## Tareas

1. **Dependencias y configuración** — `@supabase/supabase-js`; `.env.example` con
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; modo `mock` automático cuando
   faltan las variables (la demo de la etapa 1 sigue funcionando sin backend).
2. **Migración SQL** — `supabase/migrations/0001_esquema.sql`: tablas, índices,
   RLS activado y políticas; función `es_coach()`; trigger que crea `usuarios_app`
   al registrarse. Bryan la pega en el SQL Editor de Supabase.
3. **Cliente y sesión** — `src/data/supabase.ts` (cliente singleton);
   `AuthProvider` con login por correo/contraseña, pantalla de login con la marca,
   logout; `SessionProvider` pasa a derivar el usuario de la sesión real (en modo
   mock conserva el conmutador actual).
4. **Hidratación** — al iniciar sesión: descargar snapshot (según rol) → construir
   el estado local → `localStorage`. Indicador de "sincronizando…" en TopBar.
5. **Write-through** — interceptar mutaciones del almacén local y encolarlas a
   Supabase (upserts por agregado); reintentos con backoff; badge de "pendiente de
   sincronizar" cuando no hay conexión.
6. **Seed en la nube** — script `scripts/seed-supabase.mjs` que sube los datos de
   Valentina/Mateo/Sara + cuentas de prueba (contraseñas las define Bryan al
   ejecutarlo él).
7. **Verificación** — flujo completo con dos navegadores (asesorada y coach),
   aislamiento RLS probado (asesorada no ve datos ajenos), tests en verde.
8. **Despliegue** — build estático a Vercel o Netlify (cuenta la crea Bryan);
   PWA instalable desde la URL pública; revisión de seguridad antes de invitar
   asesorados reales.

**Bloqueo actual:** URL + anon key del proyecto Supabase de Bryan (tarea suya).
Tareas 1-2 y el grueso de 3-6 se pueden construir sin eso.
