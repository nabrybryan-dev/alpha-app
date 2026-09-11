# Pulso y pasos en el salón — objetivo en curso

**Abierto el 2026-09-10.** Encargo de Bryan, con su plan por fases. Este documento es el
objetivo vivo: se actualiza según se avanza, y dice en cada momento qué está hecho, qué está
medido y qué espera una decisión suya.

## La meta, en una frase

> Durante un entrenamiento, el asesorado puede ver su frecuencia cardíaca sabiendo **de dónde
> viene y de cuándo es**. Al terminar, la revisa junto con la sesión que hizo y, si lo
> autoriza, la comparte con el coach. Y sus **pasos del día** entran solos, en vez de
> anotarse a mano.

Dos capacidades que se demuestran **por separado**, porque confundirlas es el fallo típico:

| Capacidad | Qué es | Qué NO es |
|---|---|---|
| Historial sincronizado | Traer mediciones ya guardadas y atarlas a un entrenamiento | No es pulso en vivo |
| Lectura durante la sesión | Enseñar mediciones recientes de un dispositivo conectado | No es historial |

**Y los pasos van con el pulso, no después.** No por juntar cosas: es que en esta casa los
pasos ya están prescritos —«8.000 PASOS AL DÍA», «10.000 como piso»— y hoy se anotan **a
mano** en el check-in. El campo existe (`CheckinDiario.pasos`) y el objetivo del perfil
también (`pasosObjetivo`). Así que integrar pasos no es inventar un modelo nuevo: es **llenar
solo un campo que ya se usa y decir de dónde vino**, que es exactamente el mismo problema de
procedencia y actualidad que el pulso. Comparten la mitad del trabajo.

---

## FASE A · Diagnóstico — HECHA (2026-09-10)

Contestada contra el repo, no de memoria.

### 1. No hay aplicación nativa: es una PWA

`vite-plugin-pwa` con `registerType: 'autoUpdate'`. No existen `ios/`, `android/` ni
Capacitor. **Esto manda sobre todo lo demás**: ni HealthKit ni Health Connect se pueden leer
desde una web. Sin una capa nativa no hay lectura de salud, y ninguna cantidad de trabajo en
el salón lo arregla.

Las salidas posibles, y hay que elegir una antes de escribir código de integración:

| Camino | Qué cuesta | Qué se gana |
|---|---|---|
| Envoltorio nativo (Capacitor) sobre la PWA que ya existe | Un proyecto móvil, firmas, tiendas | HealthKit y Health Connect completos |
| App nativa pequeña que solo sincroniza, y la PWA sigue igual | Menos superficie, dos artefactos que mantener | Lo mismo, con menos riesgo para la app |
| Que el asesorado exporte y suba | Nada de nativo | Ni pulso en vivo ni pasos automáticos: es lo de hoy con otro nombre |

**Decisión de Bryan, y es la primera.** Va junto con la del dispositivo: iPhone + Apple Watch,
o Android + reloj compatible.

### 2. La identidad ya está resuelta, y bien

`auth.users` + `usuarios_app`, con RLS por tabla y **pruebas dedicadas al aislamiento entre
asesorados** (`SessionProvider.aislamiento.test.tsx`, `data/nube/perdida-datos.test.ts`). El
requisito «una medición nunca aparece en la sesión de otro» tiene ya dónde apoyarse, y hay
guardianes que lo vigilan. **El nombre del dispositivo no se usará como identidad**, como pide
el plan.

### 3. La sesión NO tiene hora de inicio ni de fin — y esto es lo que falta

Lo que hay hoy:

- `Sesion.fecha`: el **día local** en que la persona tocó la sesión por primera vez. Un día,
  no una hora.
- El cronómetro de sesión vive en **`localStorage`** (`alpha-crono-<sesionId>`), con el
  acumulado y el instante de arranque. **No sube a la nube.**

Para atar una medición a un entrenamiento hace falta un **intervalo con horas**, y hoy no
existe en la base. Así que la primera pieza de datos del objetivo no es el pulso: es que la
sesión tenga inicio y fin. Sin eso, cualquier asociación sería por proximidad de día, que es
justo lo que el plan prohíbe.

### 4. Los pasos ya viven en el check-in, a mano

`CheckinDiario.pasos` (número) y `Perfil.pasosObjetivo`. Viajan dentro del `datos` jsonb del
check-in, **así que no necesitan migración**: la nube guarda el objeto entero. Lo que sí hace
falta es un campo de **procedencia** —a mano, del reloj, del teléfono— porque un 10.000
escrito a mano y un 10.000 medido no valen lo mismo, y hoy no se distinguen.

### 5. Dónde se guardaría

Supabase, tablas con RLS y migraciones numeradas a mano (la última aplicada es `0060`).
**Antes de elegir número hay que mirar la carpeta**: dos ramas ya cogieron el mismo y una tuvo
que renumerarse después de estar aplicada.

---

## FASE B · Contratos y permisos — PROPUESTA, sin aplicar

### El registro de una medición

Con los campos que pide el plan, y ninguno inventado:

| Campo | Por qué |
|---|---|
| `usuarioId` | De quién es. Con RLS, como todo lo demás |
| `fuente` y `dispositivo` | De dónde viene; ausentes si la plataforma no los da |
| `medidoEn` | Cuándo ocurrió, con zona horaria |
| `recibidoEn` | Cuándo llegó: la resta es el retraso, y el retraso es lo que decide si algo es «actual» |
| `valor` y `unidad` | Lo observado |
| `origenId` | El identificador de la plataforma, cuando exista: es lo que evita duplicados |
| `sesionId` | Nullable **a propósito**: sin evidencia suficiente la asociación queda PENDIENTE |
| `calidad` | Solo si la fuente la entrega. No se inventa una puntuación |

**El mismo registro sirve para los pasos**, cambiando `valor`/`unidad` y con `sesionId`
normalmente vacío: los pasos son del día, no de la sesión.

### Lo que hay que decidir antes de escribir la tabla

1. **Qué es «reciente»** para una lectura en vivo. El plan dice —y tiene razón— que no puede
   ser un número arbitrario igual para todos: sale de medir el retraso real de la integración
   elegida. Hasta que no haya un dispositivo, no hay umbral honesto.
2. **Política de dos fuentes** (reloj y teléfono a la vez): cuál gana, y si se guardan las dos.
3. **Compartir con el coach**: permiso aparte del de leer, y revocable.

---

## Lo que se puede avanzar SIN dispositivo, y lo que no

**Sí se puede, y es trabajo de verdad:**

- Que la sesión tenga **inicio y fin** en la nube (hoy el cronómetro es local). Es la pieza
  que falta para atar cualquier medición, y además arregla algo que ya duele: no se sabe
  cuánto duró una sesión de verdad.
- La **procedencia de los pasos** en el check-in: distinguir lo anotado a mano de lo medido.
- Los **estados de la pantalla** —sin conexión, esperando, reciente, desactualizado,
  desconectado, no disponible— se pueden construir y probar con una fuente de mentira, y así
  el día que llegue el reloj lo único nuevo es el reloj.

**No se puede sin dispositivo, y fingirlo sería el error que el plan viene a evitar:**

- El umbral de «reciente».
- El consumo de batería, la recuperación en segundo plano y el comportamiento con la app
  cerrada.
- Nada del piloto.

---

## Estado

| Fase | Estado |
|---|---|
| A · Diagnóstico | **Hecha** (este documento) |
| A.1 · La sesión tiene horas | **Hecha** (2026-09-10). `empezadaEn` y `ultimaMarcaEn` en `Sesion`, escritas por el mismo embudo que ya sellaba `fecha`, fuera del clonador (`tmp_sesion_en_limpio`) y vigiladas por `comprobar-fosiles.sql` (`ventanas_fosiles`). Sin migración: viajan en el `datos` jsonb |
| B · Contratos y permisos | Propuesta escrita; espera la decisión de dispositivo |
| C · Historial | Bloqueada por A (capa nativa) |
| D · Lectura en sesión | Bloqueada por C |
| E · Resumen | Bloqueada por C |
| F · Pruebas y piloto | Bloqueada |
| G · Interpretación del coach | Bloqueada, y es la última a propósito |

**Lo siguiente que no depende de nadie:** la procedencia de los pasos en el check-in —
distinguir lo anotado a mano de lo medido— y los estados de pantalla con una fuente de mentira.
**Lo siguiente que depende de Bryan:** iPhone o Android, y si se monta envoltorio nativo.

## Bitácora

- **2026-09-10 · A** — Diagnóstico contra el repo. Tres hallazgos: no hay app nativa (PWA), la
  sesión no tenía horas, la identidad ya está resuelta y con guardianes.
- **2026-09-10 · A.1** — La sesión ya tiene su ventana con horas. Es la primera pieza de datos
  del objetivo y la única que no dependía de ningún dispositivo.
