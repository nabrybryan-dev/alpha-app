# Contrato del mapa de vida

Fuente: `docs/specs/2026-09-10-revision-semanal-en-video.md`, encargo
`mapa-de-vida` (dentro de «Los diez encargos»).

## Qué es

Una encuesta que le pregunta al asesorado **cómo vive** — no cuánto durmió hoy
(eso ya lo pregunta `CheckinForm.tsx` en Bienestar), sino sus palancas
circadianas de fondo: si le da el sol al despertar, cuándo hace su primera y su
última comida, a qué hora entrena casi siempre, cuánta cafeína toma y cómo es
su estrés en un día normal.

El propósito no es acumular datos: es que cada respuesta habilite un **recado**
que le llega a la persona en el momento en que le sirve, en vez de a la hora
que nos venga bien a nosotros. Por eso el tipo `PreguntaMapaDeVida` obliga a
que toda pregunta lleve escrito qué mensaje dispara (`mensajeQueDispara`) y
alrededor de qué hora tiene sentido mandarlo (`horaBase`). Una pregunta sin eso
no compila.

## El tipo

```ts
interface PreguntaMapaDeVida {
  id: string                    // clave estable; con ella se guarda/lee la respuesta
  texto: string                 // la pregunta tal como la lee el asesorado
  tipo: 'si_no' | 'hora' | 'opcion_multiple' | 'escala_1_5'
  opciones?: readonly string[]  // solo si tipo === 'opcion_multiple'
  mensajeQueDispara: string     // obligatorio: qué recado habilita esta respuesta
  horaBase: string               // obligatorio: 'HH:MM', el ancla del recado
}
```

`mensajeQueDispara` y `horaBase` son campos obligatorios de la interfaz, no
opcionales. Borrar cualquiera de los dos de la interfaz rompe `tsc -b` en cada
entrada de `PREGUNTAS_MAPA_DE_VIDA` (error TS2353, «object literal may only
specify known properties») — comprobado a mano el 2026-09-10 borrando
`mensajeQueDispara` y viendo ocho errores, uno por pregunta y dos en el test.

Que el campo esté presente **y no vacío en tiempo de ejecución** (`''` pasa el
tipo) lo cierra `preguntas.test.ts`, que recorre `PREGUNTAS_MAPA_DE_VIDA` y
falla si algún `mensajeQueDispara.trim()` queda vacío. Visto fallar a
propósito el 2026-09-10 con una pregunta de señuelo; se retiró antes de este
commit.

## Dónde vive la respuesta — sin migración nueva de tabla, con una nueva sí

Se comprobó primero si esto podía viajar como los campos de sueño en
`CheckinDiario` (dentro de un `jsonb` ya existente, sin migración). **No es el
mismo caso**: los campos de sueño se añadieron a una fila que YA EXISTE cada
día (el check-in), así que ampliar su `datos jsonb` no toca el esquema. El mapa
de vida no tiene una fila anfitriona: es una encuesta de una vez (por ahora),
no diaria, y no encaja en `checkins` sin forzar una fecha que no significa
nada aquí.

Se evaluó también reusar la tabla genérica `respuestas` (migración `0019`,
pensada para los `Cuestionario` que arma el coach desde el panel). Se
descartó: `respuestas.cuestionario_id` tiene `references public.cuestionarios
(id)`, y `cuestionarios.asignado_a` es un `uuid[]` que el coach llena a mano
por persona — el mapa de vida es para TODOS los asesorados, mantener esa lista
al día por cada alta/baja es trabajo que no aporta nada aquí.

Por eso sí hace falta una tabla nueva, mínima, con el mismo patrón que
`perfil_alimentario`/`PerfilNutricion`: **una fila por asesorado**, con las
respuestas dentro de un `jsonb` (`valores`) — así que si el día de mañana se
añade una séptima pregunta, no hace falta nueva migración, solo tocar
`preguntas.ts`. La migración nueva es de **esquema** (la tabla en sí), no de
**datos** (las respuestas, que sí viajan en el jsonb sin volver a tocar SQL).

Ver `supabase/migrations/0064_mapa_de_vida.sql`.

## Flujo de datos

1. `src/features/mapa/EncuestaMapa.tsx` pinta `PREGUNTAS_MAPA_DE_VIDA` y junta
   las respuestas en `Record<string, string>` (clave = `id` de la pregunta).
2. Al enviar, llama a `onGuardar(valores)` — mismo patrón que `CheckinForm`: el
   componente no habla con la base, quien lo monta decide.
3. `db.mapaDeVida.guardar(usuarioId, valores)` (`src/data/repos.ts` /
   `mockDb.ts`) guarda localmente y, en modo nube, `src/data/nube/sync.ts` lo
   encola contra la tabla `mapa_de_vida_respuestas`.

## Lo que NO entra en esta tarea (a propósito)

- La segunda mitad del mapa (trabajo, pantallas, viajes) — spec, sección «Qué
  NO entra en esta obra».
- El disparo real de los recados (`mensajeQueDispara` es solo el
  identificador; construir el mensaje y mandarlo es `empuje-y-disparador`,
  otro encargo, con su propia migración).
- Descargar la respuesta guardada desde el servidor al abrir la app en un
  dispositivo nuevo (hidratación): hoy la respuesta sube, pero `hidratar.ts`
  no la baja todavía. Queda para cuando exista una pantalla que la lea de
  vuelta.
- Montar `EncuestaMapa` en una ruta de la app: este encargo entrega el
  componente y su cableado a la base, no la navegación hacia él.

## Privacidad

Ninguna pregunta ni prueba de este módulo menciona a un asesorado real. Las
pruebas usan valores inventados; el único nombre que puede aparecer en este
árbol es el seed ficticio de Valentina, y solo si se necesita un `usuarioId`
de ejemplo.
