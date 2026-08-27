# Qué trabajo pesado sacar de la interacción, y qué no

**Fecha:** 2026-08-27
**Estado:** auditoría + la primera pieza implementada

---

## Antes de la lista: aquí no hay petición que acortar

La pregunta habitual —«saca las operaciones pesadas de la petición del usuario y
encólalas»— da por hecho un servidor propio: una petición web que hay que
contestar rápido, y un *worker* aparte que sigue trabajando.

**Esta app no tiene eso.** Es un SPA de Vite servido por Vercel que habla directo
con Supabase. No hay proceso nuestro corriendo en ningún sitio: ni Node, ni
Python, ni nada donde vivan BullMQ, Celery o Sidekiq. La «petición del usuario»
es un toque en la pantalla, y lo que hay que proteger no es un tiempo de
respuesta HTTP: es **el hilo principal del navegador**, que es lo que congela la
interfaz de alguien que está en mitad de una serie.

Así que la lista se lee en otra clave:

| lo que pide el manual | lo que aquí significa |
|---|---|
| sacar de la petición | sacar del hilo principal |
| cola + worker (Redis) | la cola que ya existe, en `localStorage` |
| cron del servidor | `pg_cron`, activo desde la 0048 |
| trabajo en segundo plano en el servidor | Edge Functions de Supabase |

## Y la cola ya está construida

`src/data/nube/cola.ts` y `src/data/nube/procesador.ts` son exactamente lo que
pide el prompt de infraestructura, y llevan tiempo en producción:

- **Encolar sin esperar** — `encolar()` escribe en `localStorage` y lanza el
  procesado con `void procesarCola()`, sin bloquear a quien pulsó.
- **Reintentos** — `MAX_INTENTOS = 8` (`cola.ts:59`), contando los intentos por
  operación.
- **Sin duplicar el efecto** — las operaciones llevan `cliente_id` y suben con
  `upsert ... on conflict`, así que reintentar la misma escritura no crea una
  segunda fila. Es el requisito de «no mandar el mismo correo dos veces»,
  resuelto con idempotencia en la base y no con memoria del proceso.
- **Cola de descartes** — `apartarDescartadas()` recoge lo que falla de forma
  persistente en vez de perderlo, que es lo que hace una *dead-letter*.
- **Releer antes de cada paso** — `drenar()` vuelve a leer `localStorage` en
  cada vuelta, porque durante una subida lenta la persona sigue usando la app.

Montar Redis y un *worker* al lado sería sustituir algo probado, que además
funciona **sin conexión** —el caso real: un gimnasio con mal wifi—, por algo que
necesita servidor. No se hace.

---

## La lista

| operación | dónde | ¿bloquea? | qué hacer |
|---|---|---|---|
| **Compresión de foto** | `lib/comprimirImagen.ts` | **Sí, hilo principal.** `createImageBitmap` + `<canvas>` sobre una foto de 4000×3000 | **Moverla a un Web Worker** ← la primera, implementada |
| **Análisis de vídeo del encoder** | `encoder/useCaptura.ts` + `nucleo/*.js` | **Sí**, fotograma a fotograma con `requestVideoFrameCallback` | Worker con `OffscreenCanvas`. **No ahora**: el núcleo está vendorizado y con guardián propio (`nucleo/ORIGEN.md`); tocarlo pide su propia tanda |
| **Subida del adjunto** | `enviarRapido.ts` → `subirAdjunto` | **No.** Ya escribe el mensaje en local con `adjuntoEstado: 'subiendo'` y sube después | Nada. Ya está bien resuelto |
| **Escrituras a la nube** | `cola.ts` / `procesador.ts` | **No.** `encolar` no espera | Nada. Es la cola |
| **Respuesta del asistente** | `chat/asistente.ts` → Edge Function | Espera, con indicador | **No mover.** Ver abajo |
| **Refresco del ranking** | RPC `ranking_disciplina` | **Ya no.** Vista materializada + `pg_cron` cada 10 min (0048) | Hecho |
| **Export CSV del encoder** | `EncoderPage.tsx:229` | No: son unas decenas de filas | Nada |

### Por qué el asistente NO se encola

Es el candidato que más se parece a «API lenta que hay que sacar de la
petición», y sería un error moverlo:

1. **Ya no bloquea nada crítico.** Cuando se llama, el mensaje de la asesorada
   **ya salió hacia el coach**. La respuesta de Alpha es un añadido; si falla, no
   pasa nada visible y el chat sigue.
2. **La persona quiere leerla ahora.** Convertirla en «te avisamos cuando esté»
   empeora el producto para ahorrar una espera que ella eligió tener.
3. **No es idempotente.** La Edge Function **escribe una fila en `mensajes`**.
   Reintentar a ciegas duplicaría la respuesta en el hilo. Encolarlo exigiría una
   llave de idempotencia que hoy no existe.

El límite del prompt —«solo para lo que de verdad tarda o conviene reintentar»—
lo excluye por los dos lados.

---

## La primera, de punta a punta: la compresión de foto

### Qué pasaba

`comprimirSiEsImagen` corre en el hilo principal. Una foto de móvil son ~4.000 ×
3.000 píxeles: `createImageBitmap`, `drawImage` a tamaño reducido y `toBlob` con
JPEG al 80 %. Durante esos cientos de milisegundos **la interfaz no responde**:
ni el cronómetro de descanso, ni el scroll, ni el botón de la serie siguiente.

Y ocurre en el peor momento posible: la asesorada acaba de hacer una foto para
mandársela al coach, en mitad del entreno.

### Qué se hace

Se mueve a un Web Worker con `OffscreenCanvas`. El hilo principal solo manda el
archivo y recibe el `Blob` reducido.

### La cadena de vuelta atrás, que es lo que lo hace seguro

Tres niveles, y ninguno pierde la foto:

1. **Worker** — si hay `Worker` y `OffscreenCanvas`.
2. **Hilo principal** — el código de antes, intacto, si el navegador no los
   tiene o el worker falla.
3. **El archivo original** — si tampoco se puede comprimir ahí.

Es la misma regla que ya tenía el módulo, escrita en su encabezado: *perder la
foto por no poder encogerla sería peor que subirla grande*.

### Cómo se sabe que terminó

No hace falta avisar de nada, y esa es la gracia. El mensaje **ya está en el
hilo** desde antes de comprimir, con `adjuntoEstado: 'subiendo'`
(`enviarRapido.ts`), y pasa a `'listo'` cuando la subida acaba. El estado ya
existía; mover la compresión no lo toca.

Ese es justo el punto 3 del prompt —«cómo sabe el usuario que ya terminó»—
resuelto sin notificaciones ni *polling*: la fila optimista con su estado ya
estaba.
