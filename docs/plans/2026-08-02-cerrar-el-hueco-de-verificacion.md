# Cerrar el hueco entre «los tests pasan» y «el dato llegó» — plan

> **Para quien ejecute:** los pasos usan casillas (`- [ ]`). Cada tarea termina en
> verde y en un commit: se puede parar entre tareas sin dejar el repo roto.

**Origen:** el registro de comidas estuvo roto desde que existe la función y nadie
lo notó. Caso completo en el cerebro técnico:
`Cerebro Programacion Alpha/wiki/incidentes/2026-08-02-comidas-que-nunca-subieron.md`.

**El problema, en una frase:** los tests corren siempre en modo demo (forzado en
`vitest.config.ts`), así que **todo lo que vive del lado del servidor es invisible
para la suite**: RLS, triggers, `ON CONFLICT`, tipos de columna. Y cuando una
subida falla, la app la descarta en silencio para proteger el registro local. Las
dos cosas juntas hacen que un fallo de escritura pueda durar semanas sin dar señal.

**No es un hueco, son tres:**

| # | Hueco | Se cierra con |
|---|---|---|
| A | **Contrato**: lo que `sync.ts` manda vs. lo que la tabla acepta | Test estático que lee las migraciones |
| B | **Comportamiento**: RLS, triggers, `ON CONFLICT` | Postgres real. No se puede simular |
| C | **Observabilidad**: el fallo no deja rastro visible | Que se vea, en la app y en el panel |

**El dato que lo hace viable:** el CI corre en `ubuntu-latest`, es decir en los
runners de GitHub, **no en esta máquina**. La restricción de binarios nativos
(WDAC) que obliga a `esbuild-wasm` y dejó inservible a `oxlint` **no aplica allí**.
En CI se puede levantar un Postgres de verdad.

**Orden recomendado:** 1 → 2 → 3 → 4. Está ordenado por valor entre esfuerzo, no
por pureza técnica: las dos primeras tareas son las que habrían convertido este
fallo de semanas en horas, y cuestan una tarde entre las dos.

---

## Tarea 1 · Salud de datos en el panel del coach

**Por qué primero.** No previene el fallo: lo hace **visible al día siguiente**.
Es lo más barato del plan y lo que más habría cambiado esta historia. Con esto,
«registro de comidas: 0 registros, nunca» salta a la cara la primera vez que
alguien registra.

**Viabilidad comprobada:** la política `registro_comida_propio` (migración 0015)
incluye `or public.es_staff()`, así que el coach ya puede leer el registro de
todos. No hace falta migración.

**Archivos:**
- Crear: `src/domain/saludDeDatos.ts` + `src/domain/saludDeDatos.test.ts`
- Crear: `src/features/coach/SaludDeDatos.tsx`
- Modificar: `src/features/coach/AsesoradosPage.tsx`

**Pasos:**
- [ ] `saludDeDatos.ts`: dado el snapshot local, devolver por cada familia de dato
      (comidas, check-ins, adherencia, mensajes, pruebas de calibración) el número
      de registros de los últimos 7 días y la fecha del último. Lógica pura.
- [ ] Marcar en **ámbar** lo que lleva más de 3 días sin un registro nuevo y en
      **rojo** lo que está a cero. El umbral es de presentación, no clínico:
      documentarlo en el módulo.
- [ ] Tests: familia vacía, familia al día, familia que se quedó atrás, y el caso
      límite de un equipo recién creado (todo vacío no debe pintarse en rojo).
- [ ] Bloque en el panel del coach, arriba del listado de asesorados.

**Verificación:** con el seed, la salud debe salir en verde. Vaciando la lista de
comidas del seed, en rojo.

---

## Tarea 2 · Que lo descartado se vea

**Por qué.** El descarte silencioso es una decisión **correcta** para los datos —
existe para no perder el registro local— pero se tomó junto con «y no se lo
cuentes a nadie», que es una decisión distinta. El teléfono sabe que tiene
operaciones apartadas; hoy no lo dice.

**Archivos:**
- Modificar: `src/data/nube/cola.ts` (exponer un contador de descartes)
- Modificar: `src/data/nube/sync.ts` (reexportar)
- Crear: `src/features/hoy/AvisoSinSincronizar.tsx` + test
- Modificar: `src/features/hoy/HoyPage.tsx`

**Pasos:**
- [ ] Exportar `descartesPendientes(usuarioId?)`: cuántas operaciones hay
      apartadas que pertenezcan a esa persona.
- [ ] Aviso discreto en Hoy cuando haya alguna: **"N registros no han llegado al
      servidor"**, con un botón que fuerce `recuperarDescartes`.
- [ ] El texto no debe alarmar ni culpar: el dato del asesorado **no se ha
      perdido**, está en su teléfono. Decirlo así.
- [ ] Sumar el contador a la salud de datos de la Tarea 1, para que el coach lo
      vea agregado.

**Verificación:** con la cola vacía, el aviso no existe. Metiendo una operación
falsa en el montón de descartes, aparece y el botón la reencola.

**Ojo:** el montón guarda **20 operaciones como máximo** (`MAX_DESCARTES`) y hace
**2 rescates** (`MAX_RESCATES`). El aviso puede quedarse corto respecto a lo
realmente perdido; el texto no debe prometer que están todos.

---

## Tarea 3 · Un Postgres real en CI

**Por qué.** Es el único que cierra la clase entera. Las tareas 1 y 2 detectan;
esta **impide**. Este fallo habría muerto en el primer PR.

**Coste honesto:** una tarde. Postgres a secas no trae el esquema de Supabase, así
que hay que suplantar lo mínimo (`auth.uid()`, `auth.users`, el rol
`authenticated`) para que las políticas RLS se puedan evaluar.

**Archivos:**
- Modificar: `.github/workflows/ci.yml` (servicio `postgres:16`)
- Crear: `supabase/test/00-suplantar-supabase.sql` (stubs de `auth`)
- Crear: `scripts/aplicar-migraciones.mjs`
- Crear: `src/test/servidor/escrituras-reales.test.ts` (solo corre si hay `DATABASE_URL`)

**Pasos:**
- [ ] Servicio Postgres en el workflow, con su `DATABASE_URL`.
- [ ] Stubs: esquema `auth`, `auth.uid()` leyendo de una variable de sesión, rol
      `authenticated`, y `public.es_staff()` si no lo crean las migraciones.
- [ ] Script que aplique **todas** las migraciones en orden sobre la base limpia.
      Si una falla, el CI se cae: eso ya vale por sí solo, porque hoy nadie
      comprueba que la 0001→0023 corran seguidas.
- [ ] Test que, **como asesorado** (fijando `auth.uid()`), ejecute las mismas
      escrituras que hace `sync.ts`: abrir comida, añadir ítem, prueba de
      calibración, check-in, mensaje. Con `on conflict` incluido.
- [ ] Test de aislamiento: el asesorado A **no** puede leer ni escribir filas de B.
      Esa propiedad ya se rompió dos veces y hoy solo la protegen tests en demo.
- [ ] Los tests del servidor se saltan si no hay `DATABASE_URL`, para que
      `npm run verify` siga funcionando en esta máquina sin Postgres.

**Verificación:** revertir la migración 0023 en una rama de prueba y comprobar que
el CI se pone rojo por el `ON CONFLICT`, no por otra cosa.

---

## Tarea 4 · Test de contrato entre `sync.ts` y el esquema

**Por qué al final.** Es barato, pero una vez existe la Tarea 3 su valor baja
mucho: el Postgres real ya detecta el desajuste al escribir de verdad. Sigue
valiendo la pena porque **falla en segundos y sin base de datos**, así que atrapa
el error mientras se escribe el código.

**Archivos:**
- Crear: `src/test/contrato-payloads.test.ts`

**Pasos:**
- [ ] Extraer de `sync.ts` cada `encolar({ tabla, payload })` con sus claves.
- [ ] Reconstruir de las migraciones el esquema **vigente** de cada tabla
      (`create table` + los `alter table add column` posteriores).
- [ ] Afirmar: toda clave del payload existe como columna; y toda columna
      `not null` sin `default` está en el payload de los `insert`/`upsert`.
- [ ] Reutilizar el lector de migraciones de `indices-onconflict.test.ts` en vez de
      duplicarlo — sacarlo a un helper compartido en `src/test/`.

---

## Lo que este plan NO resuelve

**Que las migraciones se apliquen a mano.** Sigue sin haber registro de versiones:
el repo no sabe qué corrió en producción. `comprobar-migraciones.sql` lo mitiga,
pero depende de que alguien se acuerde de correrlo. La solución de fondo —el CLI
de Supabase con `supabase db push`, que lleva su propio registro— quedó como
decisión pendiente en el incidente de la 0013 y **sigue pendiente**. Ojo: el CLI
es un binario nativo, así que habría que comprobar si WDAC lo permite en esta
máquina, o correrlo solo desde CI.
