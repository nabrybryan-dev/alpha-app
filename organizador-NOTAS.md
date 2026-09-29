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

## Avisos: qué existe y qué no (siguiente paso)

La app YA tiene el permiso de avisos del navegador y la suscripción (`src/features/avisos/suscripcion.ts`, tabla
`suscripciones_push` de la 0061, `PedirPermiso` en Mi día). **No existe ningún servicio que ENVÍE un push**: `supabase/functions`
solo tiene `responder-chat`, y el propio spec de la revisión semanal deja «la fontanería del empuje» aparcada. Por eso esta rama
NO inventa uno: el aviso es el banner dentro de la app.

Siguiente paso, cuando Bryan lo quiera (no está hecho):
1. Una Edge Function `enviar-aviso-plan` (web-push con claves VAPID en secretos) que lea `suscripciones_push` del dueño.
2. Un disparador programado (cron de Supabase o el vigía) a la hora del bloque del día y a las 2 días sin moverse
   (`estaAtascada` ya define la regla en `src/domain/planOrganizador.ts`; habría que llevarla a SQL o al agente).
3. El texto lo arma la habilidad `organizador-bryan` (resumen de la mañana y de la noche); el envío por Telegram/WhatsApp sigue
   apagado por defecto hasta que Bryan configure el token.

## Dudas para Bryan

- **Umbrales de intensidad** (la espec no da números): baja < 6 h planeadas, media 6 a 10 h, alta >= 10 h por semana
  (constantes `HORAS_INTENSIDAD_*`).
- **Delegar**: la pregunta «se hace, se delega o se borra» solo ofrece borrar desde la app; delegar a la otra persona es
  hablar con ella, porque la RLS no deja escribir filas con el dueño ajeno. Si se quiere delegar desde la app, hace falta una
  función `security definer` que reasigne el dueño.
- **«Movida 2 veces»** aproxima «arrastrada 2 semanas» con el contador `veces_movida`; el agente del lunes es quien lo
  reinicia al replanificar.
- El importador de la propuesta semanal del agente (`semana-<lunes>.json`, dry-run y `--aplicar`) no está en este trabajo.
