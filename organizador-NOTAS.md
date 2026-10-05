# Organizador de Bryan y Manuela: borrador de PR (parte de la app)

Rama `feat/organizador-plan` (sobre `feat/administracion-tablas`, e87e81c). Sin push, sin PR, sin migración aplicada.
Especificación: `bola-de-nieve/organizador/ESPEC-ORGANIZADOR.md`.

## Qué trae

- **Migración 0098** (`supabase/migrations/0098_plan_items.sql`): tabla `plan_items` (objetivo -> hito -> tarea), capacidad
  `organizar_plan` (Bryan y Manuela), `plan_dueno_actual()`, RLS con `revoke all ... from anon, authenticated, public` antes de
  conceder. Cada dueño crea y edita lo suyo; el coach lee también lo de Manuela; nadie borra (descartar es un estado).
  Checks e índice único: 1 principal viva por dueño y día, tarea <= 50 min, padre del nivel correcto, máximo 3 tareas vivas por
  dueño y día (trigger). `update` solo sobre columnas de trabajo (no nivel, padre, dueño ni origen).
- **Prueba SQL** `supabase/test/160-plan-items.sql` + paso en `.github/workflows/ci.yml` + señal `0098` en
  `supabase/comprobar-migraciones.sql`. **No se pudo correr aquí (no hay Postgres/psql en esta máquina): la primera vuelta
  real es el CI.**
- **Datos** `src/data/consola/planItems.ts` (lectura con `Lectura`, escrituras que comprueban que cambió una fila) y **dominio**
  `src/domain/planOrganizador.ts` (reglas del cupo, atasco de 2 días, carga semanal, intensidad, avance, temporizador).
- **Pantalla** `src/features/plan/`: «Mi plan» con Hoy / Semana / 90 días; entrada en Mi día y en Estrategia (Manuela), enlace
  «Mi plan» en el panel del coach (Bryan, `/coach/mi-plan`; Manuela usa `/mi-plan`). Bryan ve la carga y los objetivos de Manuela
  en solo lectura. Banner al abrir si la principal de hoy sigue pendiente.

## Aplicar la migración (lo hace Bryan, no este trabajo)

Pegar `0098_plan_items.sql` en el SQL Editor y correr después `supabase/comprobar-migraciones.sql`: la fila 0098 debe decir SI.
Los `insert` de `capacidades_staff` solo casan con los UUID reales de Bryan y Manuela.

## Avisos push: el emisor (migración 0099 + Edge Function `avisos-plan`)

Construido, **sin desplegar ni aplicar**. La tabla de suscripciones real es `permisos_de_aviso` (0063: `endpoint`, `p256dh`, `auth`,
una fila por persona), no `suscripciones_push`.

- `supabase/functions/avisos-plan/decidir.ts`: decisión pura (probada en `src/domain/avisosPlan.test.ts`, como hace el repo con
  `responder-chat`). `index.ts`: lee suscripciones, plan y avisos ya enviados por REST con la clave de servicio, reserva la fila en
  `avisos_plan_enviados` ANTES de enviar (índice único tarea+día), envía con `npm:web-push` y, si el push responde 404/410, deja
  la suscripción inactiva (borra endpoint y claves de `permisos_de_aviso`; `dijo_si` no se toca).
- Casos: (1) inicio de bloque: principal de hoy en `pendiente`, desde la hora fijada (08:00 Bogotá por defecto); (2) atascada:
  tarea abierta con día <= hoy, 2 días sin `actualizado_en` o `veces_movida` >= 2. Máximo 1 aviso por tarea y día. Texto: título + primer paso.
- Service worker: `public/push-sw.js` (cargado con `workbox.importScripts` en `vite.config.ts`) muestra la notificación y al
  tocarla abre `/coach/mi-plan` (Bryan) o `/mi-plan` (Manuela).
- Migración `0099_avisos_plan_enviados.sql`, prueba `supabase/test/170-avisos-plan-enviados.sql` (paso en CI) y señal 0099 en
  `comprobar-migraciones.sql`. No se pudo correr aquí (sin Postgres ni Deno); la primera vuelta real es el CI.

### Pasos para Bryan (no ejecutados)

1. Aplicar la 0098 y luego la 0099 (SQL Editor) y correr `supabase/comprobar-migraciones.sql`: 0098 y 0099 deben decir SI.
2. Generar las claves VAPID: `npx web-push generate-vapid-keys`.
3. La clave pública ya viene por defecto en la app (`src/features/avisos/clavePublica.ts`; `VITE_VAPID_PUBLIC_KEY` solo la sobrescribe).
   Guardar los secretos de la función:
   `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@correo`
   Opcionales: `AVISOS_HORA_BRYAN=08:00`, `AVISOS_HORA_MANUELA=08:00`. `SUPABASE_URL` y la service role ya las inyecta Supabase.
4. Desplegar: `supabase functions deploy avisos-plan` (o pegar `index.ts` y `decidir.ts` en el editor). La función solo acepta la
   service role en `Authorization`.
5. Cada dueño abre la app desplegada y acepta el aviso (así queda su fila en `permisos_de_aviso` con endpoint).
6. Programar el cron (pg_cron + pg_net, cada 30 min de 07:00 a 20:00 Bogotá = 12:00 a 01:00 UTC):
   `select cron.schedule('avisos-plan', '*/30 12-23,0 * * *', $$ select net.http_post(url := 'https://<proyecto>.supabase.co/functions/v1/avisos-plan', headers := jsonb_build_object('Authorization', 'Bearer ' || '<SERVICE_ROLE>', 'Content-Type', 'application/json'), body := '{}'::jsonb) $$);`
   (mejor guardar la clave en Vault y leerla de ahí; o crear el programa desde Integrations > Cron del panel).
7. Probar una vez a mano con `curl -X POST` y la service role; la respuesta dice cuántos enviados, caducadas y fallos.

## Dudas para Bryan

- **Umbrales de intensidad** (la espec no da números): baja < 6 h planeadas, media 6 a 10 h, alta >= 10 h por semana
  (constantes `HORAS_INTENSIDAD_*`).
- **Delegar**: la pregunta «se hace, se delega o se borra» solo ofrece borrar desde la app; delegar a la otra persona es
  hablar con ella, porque la RLS no deja escribir filas con el dueño ajeno. Si se quiere delegar desde la app, hace falta una
  función `security definer` que reasigne el dueño.
- **«Movida 2 veces»** aproxima «arrastrada 2 semanas» con el contador `veces_movida`; el agente del lunes es quien lo
  reinicia al replanificar.
- El importador de la propuesta semanal del agente (`semana-<lunes>.json`, dry-run y `--aplicar`) no está en este trabajo.
