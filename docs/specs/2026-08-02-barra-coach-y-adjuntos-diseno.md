# Barra "Escríbele a tu coach" y envío real de adjuntos

**Fecha:** 2026-08-02
**Estado:** propuesta, pendiente de revisión
**Proyecto 1 de 3** — le siguen *Niveles* y *Overlay de microciclo nuevo*.

---

## 1. Por qué

### El problema visible
El panel del coach existe, pero vive al final de Hoy, después del álbum, el radar y el mapa
de fatiga ([HoyPage.tsx:206](../../src/features/hoy/HoyPage.tsx)). Para escribirle hay que
recorrer la pantalla entera. En la práctica, no se ve.

### El problema invisible, que es peor
**El botón de adjuntar finge.** Guarda el nombre del archivo y envía un mensaje de texto
con ese nombre; el archivo nunca sale del teléfono
([Conversacion.tsx:183](../../src/features/chat/Conversacion.tsx)). El asesorado cree que
mandó el video de su sentadilla. Al coach le llega la cadena `video-sentadilla.mp4` y nada
más. La etiqueta "(adjunto simulado en etapa 1)" está en pantalla, pero explica el fallo
después de que la persona ya eligió el archivo.

### Por qué ahora
La valoración de técnica es la compuerta del ascenso de nivel (proyecto 2), y la técnica se
valora **viendo ejecutar**. Los asesorados son remotos. Sin recepción real de video, esa
compuerta no puede abrirse nunca. Ver
[clasificación de nivel y educación](../../../wiki/conocimiento/clasificacion-nivel-y-educacion.md).

---

## 2. Alcance

**Entra:**
- Barra destacada en la parte superior de Hoy, con envío rápido de texto e imagen/video.
- Subida real a Supabase Storage, con sus políticas.
- Cola de archivos que sobrevive a quedarse sin señal y a cerrar la app.
- Render del adjunto dentro del hilo, para el asesorado y para el coach.
- Retirada del adjunto simulado.

**No entra:**
- Audios de voz.
- Anotar o dibujar sobre el video.
- Adjuntos en el chat del coach hacia varios asesorados a la vez.
- Compresión de video (ver §6).

---

## 3. Las tres piezas

```
BarraCoach (Hoy)  ──envía──►  db.mensajes.enviarConAdjunto()
                                      │
                        ┌─────────────┴──────────────┐
                        ▼                            ▼
              almacén local (localStorage)   depósito de archivos (IndexedDB)
                 fila del mensaje                  bytes del adjunto
                        │                            │
                        └──────────► procesador ◄────┘
                                          │
                                    Supabase Storage  →  path
                                          │
                                    upsert mensajes.adjunto_path
```

### 3.1 `BarraCoach` — `features/hoy/BarraCoach.tsx`

Va **arriba**, justo bajo el saludo y antes de la tarjeta de check-in: es lo primero
accionable de la pantalla. Sustituye a `MensajeCoach`, que se retira del final.

Contenido:
- Avatar del coach + rótulo **"Escríbele a tu coach"**.
- Si hay mensajes sin leer: contador y una línea del último mensaje.
- Campo de texto de una línea + botón de cámara + botón de enviar.

**La barra tendrá más de un estado.** El ciclo de revisiones
([su spec](2026-08-02-ciclo-de-revisiones-diseno.md)) vive aquí dentro: cuando se acerca
una revisión, la barra cambia de cara y muestra la cuenta atrás y los temas. Este proyecto
**no** construye ese estado, pero deja el componente preparado para tenerlo: la barra
recibe qué mostrar en lugar de decidirlo por su cuenta, para que añadir el estado de
revisión después no obligue a reescribirla.

Comportamiento:
- Enviar desde la barra escribe el mensaje y **navega a `/chat`**, para que la persona vea
  su mensaje en el hilo y pueda seguir. Cumple las dos mitades de lo pedido: envío rápido,
  y al interactuar se entra al chat completo.
- Tocar la barra fuera del campo abre `/chat` directamente.
- Elegir un archivo muestra la miniatura dentro de la barra antes de enviar, con opción de
  quitarlo. Nada se sube hasta pulsar enviar.

Superficie: es la única tarjeta de acento de la parte alta de Hoy. Usa el tratamiento
destacado que ya existe (`glass-destacada`, hairline rojo + halo) para que gane la
jerarquía sin inventar estilo nuevo.

### 3.2 Depósito de archivos — `lib/depositoAdjuntos.ts`

**Por qué IndexedDB y no la cola que ya existe.** La cola guarda operaciones en
`localStorage` ([cola.ts](../../src/data/nube/cola.ts)), y todo el almacén local de la app
vive en **una sola clave** de `localStorage` ([mockDb.ts:30](../../src/data/mockDb.ts)).
Una foto en base64 son ~250 KB y un video de 15 segundos varios megas; el límite del
origen ronda los 5 MB. Meter bytes ahí no arriesga la foto: arriesga **el almacén
completo** —microciclos, series, nutrición— porque al desbordar la cuota se pierde la
clave entera. IndexedDB tiene cuota propia, mucho mayor, y guarda `Blob` sin convertir a
texto.

API mínima, sin lógica de negocio:

| Función | Qué hace |
|---|---|
| `guardar(id, blob, duenio)` | Deja el archivo pendiente de subir |
| `leer(id)` | Devuelve el `Blob` |
| `borrar(id)` | Lo elimina tras confirmar la subida |
| `pendientesDe(usuarioId)` | Los que quedaron por subir de esa persona |

El campo `duenio` replica la regla de la cola: en un móvil compartido, los archivos de una
persona **nunca** se suben con la sesión de la siguiente.

IndexedDB es API del navegador: no añade dependencia ni binario nativo, así que no choca
con la restricción WDAC del equipo.

### 3.3 Subida — `data/nube/adjuntos.ts` + enganche en `procesador.ts`

Orden de operaciones, y el orden importa:

1. El mensaje se escribe **primero** en el almacén local, con `adjuntoEstado: 'subiendo'`.
   La persona ve su mensaje en el hilo inmediatamente, con o sin señal.
2. El `Blob` va al depósito.
3. El procesador, cuando hay red, sube el archivo al bucket y **después** encola el
   `upsert` de la fila con el `path` devuelto.
4. Confirmada la fila, se borra el `Blob` del depósito.

Si algo falla, se reintenta con el mismo esquema de intentos que la cola
(`MAX_INTENTOS = 8`). El archivo no se borra hasta que la fila está arriba: es el mismo
principio que ya protege las series en el sótano del gimnasio.

---

## 4. Datos y almacenamiento

### Migración `0022_adjuntos_chat.sql`

**Bucket privado `adjuntos-chat`.** Privado, no público: son imágenes de cuerpos, dato de
salud. Ruta `{usuario_id_remitente}/{mensaje_id}.{ext}`, para que las políticas puedan
decidir por prefijo.

Políticas:
- **INSERT** — solo sobre el prefijo propio: la primera carpeta de la ruta debe ser el
  `auth.uid()` de quien sube.
- **SELECT** — permitido a quien envió y a quien recibió el mensaje, resuelto contra la
  tabla `mensajes`. Nadie más, staff incluido salvo que sea el destinatario.
- **DELETE** — nadie desde el cliente.

### Cambio en `mensajes`

`adjunto_url` hoy guarda un nombre de archivo inventado. Pasa a guardarse el **path del
objeto** en `adjunto_path`, más `adjunto_tipo` (`imagen` | `video`). La columna vieja se
deja quieta: contiene texto sin valor de mensajes ya enviados y borrarla no aporta.

En el dominio, `Mensaje` cambia igual: `adjuntoUrl` sale, entran `adjuntoPath` y
`adjuntoTipo`. Se añade además `adjuntoEstado` (`'subiendo' | 'listo'`), que es **solo
local** y no viaja a la base: describe si el archivo de este dispositivo ya está arriba, y
para cualquier otro dispositivo la respuesta siempre es sí.

> **Ojo:** las migraciones de este repo se aplican a mano en el SQL Editor. Hay que añadir
> la señal de la 0022 a `supabase/comprobar-migraciones.sql`.

### Lectura

El bucket es privado, así que el hilo no puede usar una URL fija. Al pintar un adjunto se
pide una **URL firmada de vida corta** (1 hora). No se guarda en el almacén local: se pide
cuando se va a mostrar y se deja caducar.

---

## 5. Privacidad

Aplica lo que ya rige en el proyecto, con un añadido propio:

1. **Bucket privado y URLs firmadas y caducas.** Nunca una URL pública: una URL pública de
   Supabase Storage es un enlace permanente a la foto de alguien.
2. **Aislamiento entre asesorados.** La política de SELECT se resuelve contra `mensajes`,
   no contra el rol. Es la propiedad que ya se rompió dos veces en esta app.
3. **Nada de nombres reales** en tests ni en el seed: se usa el seed ficticio.
4. **El path no lleva el nombre del archivo original**, que suele traer el nombre de la
   persona o la fecha. Se renombra al id del mensaje.

---

## 6. Compresión y límites

**Imágenes.** Se redimensionan en el cliente antes de subir: lado mayor máximo 1.600 px,
JPEG de calidad 0,8. Se hace con `canvas`, sin librerías. Esto resuelve de paso lo que ya
se había anotado del Álbum Alfa: hoy se sirven fotos de 591×1280 para pintarlas a 122 px.

**Video.** No se comprime en el cliente: hacerlo bien exige transcodificar, y las
soluciones de navegador son pesadas y frágiles. En su lugar, **límite de 25 MB** y aviso
claro antes de elegir. Un video de técnica de 10–20 segundos cabe de sobra.

**Rechazo explícito.** Si el archivo excede o el tipo no está permitido, se dice antes de
enviar, no después. El fallo silencioso es justo lo que estamos arreglando.

---

## 7. Casos borde

| Caso | Comportamiento |
|---|---|
| Sin señal al enviar | Mensaje visible en el hilo marcado "subiendo"; sube al recuperar red |
| Cierra la app con subida a medias | El `Blob` sigue en IndexedDB; se retoma al volver a entrar |
| Cierra sesión con adjuntos pendientes | Quedan sellados con su dueño; solo se rescatan cuando vuelve esa persona |
| IndexedDB no disponible o llena | Se avisa y no se deja adjuntar; el texto sigue funcionando |
| Sube y el `upsert` falla | Reintentos; el archivo no se borra hasta confirmar la fila |
| El coach abre un adjunto ya caducado | Se pide una URL firmada nueva al vuelo |
| Modo demo (sin Supabase) | El adjunto se guarda local y se pinta desde el `Blob`; no hay subida |

---

## 8. Tests

Empezando por los que documentan el fallo actual, según el patrón del repo:

**Rojo primero**
- El adjunto de hoy no envía archivo: el mensaje solo lleva el nombre.

**Del depósito** (`lib/depositoAdjuntos.test.ts`)
- Guardar y recuperar un `Blob`.
- Los pendientes de una persona no aparecen para otra.
- Sin IndexedDB, falla de forma limpia y no rompe el envío de texto.

**De la subida** (`data/nube/adjuntos.test.ts`)
- La fila no se encola hasta que la subida devuelve el path.
- Si la subida falla, el archivo sobrevive y se reintenta.
- Si la fila falla tras subir, el archivo tampoco se borra.

**De la barra** (`features/hoy/BarraCoach.test.tsx`)
- Enviar texto lo escribe en el hilo y navega al chat.
- Un archivo que excede el límite se rechaza antes de enviar.
- El contador de no leídos sale del hilo real.

**De aislamiento**
- Ampliar los tests existentes: un adjunto de una persona no es legible por otra.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Las políticas de Storage se aplican a mano y no hay registro de versiones | Añadir señal a `comprobar-migraciones.sql` y verificar contra el proyecto real antes de dar por hecho nada |
| Un video grande en datos móviles gasta el plan del asesorado | Aviso de tamaño antes de subir; subir solo al pulsar enviar |
| IndexedDB es nuevo en este código | Se aísla en un único módulo con API de cuatro funciones y sus tests |
| Coste de almacenamiento en Supabase | La compresión de imágenes lo acota; el video queda topado a 25 MB por pieza |

---

## 10. Fuera de alcance, anotado para después

- Retirar de la app las imágenes sobredimensionadas del Álbum Alfa (mismo problema, otra
  pantalla).
- Caducidad o archivado de adjuntos viejos.
- Que el coach pueda responder con video desde su panel.
