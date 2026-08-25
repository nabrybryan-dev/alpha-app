# Los vídeos de técnica que «no estaban disponibles»

**Fecha:** 2026-08-24 · **Reportado por:** varios asesorados, vía Bryan.

## El síntoma

Asesorados que dicen que los vídeos que explican los patrones de movimiento y las
diferencias entre ejercicios «no están disponibles» en la app.

## Las tres causas, y ninguna era el vídeo

### 1. El botón «Técnica» dependía de un campo que casi nadie rellena

`TarjetaEjercicio.tsx` resolvía la demo así:

```ts
ejercicio.contenidoDemoId ? db.contenidos.byId(ejercicio.contenidoDemoId) : undefined
```

`contenidoDemoId` lo tiene que escribir **quien carga el microciclo**. El seed de
Valentina lo trae en 16 de 28 ejercicios, pero **los microciclos que se cargan
desde el plan del coach no lo traen**: la plantilla de carga no lo pide y el plan
en markdown no lo tiene. Para esos asesorados el botón sencillamente no existía —
y no existir se lee igual que estar roto.

Y un segundo filo del mismo corte: si el id apuntaba a una ficha borrada o no
hidratada, `byId` devolvía `undefined` y el botón desaparecía **sin decir nada**.

### 2. El visor no sabía leer un Short

`idDeYoutube` sólo reconocía `watch?v=` y `youtu.be/`. Las fichas de técnica se
pegan desde el móvil, y el móvil comparte **Shorts**. Con una URL de Shorts el
iframe no se montaba y la ficha salía sin vídeo.

### 3. Sin embebido no había salida

El enlace «Abrir video →» sólo se pintaba cuando **no** se había podido leer el
id. Si el dueño del vídeo tiene el embebido desactivado, el iframe pinta «vídeo no
disponible» dentro de la ficha y el asesorado se quedaba mirando eso, sin enlace.

## Qué se hizo

- **`src/domain/demos.ts`** (nuevo). `demoDeEjercicio` respeta el
  `contenidoDemoId` cuando resuelve y, cuando no, cae a la biblioteca **por
  patrón de movimiento**. La categoría del ejercicio ya es el nombre del patrón
  (`EMPUJE HORIZONTAL`, `DOMINANTE DE CADERA`…), así que **no hace falta tocar ni
  un dato**: los microciclos ya cargados empiezan a tener vídeo solos, para todos
  los asesorados a la vez. Tabla de alias para lo que no se llama igual en las dos
  listas (las dos tracciones comparten vídeo; los nombres por músculo se traducen
  al patrón). `demoDePreparacion` hace lo propio con la movilidad.
- **`src/lib/youtube.ts`** (nuevo). `idDeYoutube` lee `watch?v=`, `youtu.be/`,
  `shorts/`, `embed/`, `live/`, el dominio móvil, los parámetros que añade el
  botón de compartir, y un id pelado.
- **`VisorContenido.tsx`**. El enlace a YouTube se pinta **siempre** que haya
  vídeo, no sólo cuando falla la lectura del id.

`CORE` y `AISLAMIENTO` siguen sin demo: no hay patrón que enseñar ahí. Si se
quiere cubrirlos, es contenido nuevo en la biblioteca, no código.

## Verificación

`npm run verify` en verde — 163 archivos, 2004 tests. Tests nuevos:
`src/domain/demos.test.ts` (8) y `src/lib/youtube.test.ts` (7), los dos escritos
documentando el fallo.

## Lo que este arreglo NO cubre

Si un vídeo concreto de la biblioteca está privado, borrado o con restricción de
país en YouTube, sigue saliendo «no disponible» — eso está en la cuenta de
YouTube, no en la app. Ahora al menos hay enlace para abrirlo fuera. Conviene
repasar las URLs de `contenidos` en la base contra la lista de la biblioteca.
