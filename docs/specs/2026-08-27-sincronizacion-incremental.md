# Sincronización incremental de la hidratación

**Fecha:** 2026-08-27
**Estado:** propuesta, sin aplicar
**Origen:** auditoría de escalabilidad de 10 → 1.000 usuarios (PR #121)

---

## El problema

`hidratarDesdeNube` (`src/data/nube/hidratar.ts`) hace **21 consultas sin `LIMIT`**
y descarga todo lo que RLS deja ver. Corre en cada refresco: cada **45 segundos**
por pestaña abierta, más cada `visibilitychange` (`SessionProvider.tsx:191`).

Las migraciones 0045–0048 quitaron lo que costaba **por fila** en el servidor —de
~1.100 barridos de `usuarios_app` por hidratación a ~20— pero no tocaron lo que
se **descarga**. Y ahí está el muro:

- Para un asesorado, RLS acota a lo suyo y el volumen es pequeño.
- **Para el coach, RLS no acota nada**: `es_coach()` es cierto, así que cada
  refresco le baja el historial completo de toda la cartera. Hoy son 26 personas
  y ~1.500 filas. A 1.000 usuarios son cientos de miles, cada 45 segundos.

Ningún índice arregla esto: un índice acelera *encontrar* filas, no reduce
cuántas viajan por la red.

## Lo que NO se va a hacer, y por qué

**Delta por fila** —pedir solo las filas con `updated_at > última_sync`— es la
respuesta de manual. Aquí está mal, por dos hallazgos medidos contra la base
real el 2026-08-27:

### 1. Diecisiete de las veintiuna tablas permiten borrado real

Solo `mensajes`, `respuestas`, `consultas_chat` y `usuarios_app` no tienen
política de `DELETE` ni de `ALL`. Las otras diecisiete sí. Y solo cuatro
—`registro_comida`, `registro_item`, `perfil_alimentario_veto`, `despensa`—
tienen borrado lógico (`borrado`).

Una fila borrada **no aparece en ningún delta**: no se modificó, dejó de existir.
Con delta por fila, todo lo que el coach borre se queda en el dispositivo de la
asesorada **para siempre**, con toda la apariencia de ser real.

Esto no es hipotético en este repo. Es la misma familia de fallo que el clonador
de microciclos heredando ejecución, o el `.select()` de una columna inexistente
degradado a instantánea local: **no da error, da datos creíbles y equivocados**.

Arreglarlo exigiría lápidas (tabla de borrados + trigger `AFTER DELETE` en 17
tablas + política de retención). Es mucha maquinaria nueva en la ruta más
delicada de la app.

### 2. La columna de fecha que ya existe no sirve

Siete tablas tienen `actualizado_en`. Parecía media solución. No lo es:

> **No hay un solo trigger que la mantenga.** Los únicos cuatro triggers de
> `public` son `trg_proteger_estado_microciclo`, `trg_proteger_perfil`,
> `registro_item_resolver_comida` y `trg_proteger_rol` — todos de protección,
> ninguno de sello de tiempo.

`actualizado_en` se rellena a mano en algunos scripts de carga. **Las escrituras
de la app no la tocan.** Es decorativa desde el punto de vista de sincronizar, y
un diseño que se fíe de ella nace roto.

## Lo que sí se propone: firma por tabla

En vez de preguntar *qué filas cambiaron*, preguntar *si esta tabla cambió*. Si
no cambió, no se descarga.

**Firma de una tabla = `(count(*), max(actualizado_en))`**, calculada bajo el RLS
de quien pregunta.

Detecta los tres casos, y esto es lo que la hace correcta:

| qué pasó | `count(*)` | `max(actualizado_en)` | ¿se detecta? |
|---|---|---|---|
| alta | sube | sube | sí, por las dos |
| modificación | igual | sube | sí |
| **borrado** | **baja** | puede no moverse | **sí, por el conteo** |
| alta y borrado a la vez | igual | sube (el alta es de ahora) | sí |

El borrado —que es justo lo que rompe el delta por fila— lo caza el conteo. Sin
lápidas, sin tabla nueva, sin retención que mantener.

### Cómo queda el refresco

1. Una llamada al RPC `firma_de_sincronizacion()`, que devuelve una fila por
   tabla: nombre, conteo y último cambio.
2. Se compara con la firma guardada de la última hidratación.
3. **Solo se descargan las tablas cuya firma cambió.** Las demás conservan lo que
   ya hay en la instantánea local.

En el caso corriente —nadie tocó nada en 45 segundos— se pasa de **21 descargas
de tabla entera a una consulta pequeña**.

### Por qué esto sí puede fusionar sin romper

`aplicarSnapshot` reemplaza el estado entero, así que saltarse tablas exige
mezclar. La maquinaria ya existe a medias: `hidratar.ts` ya cae a
`instantaneaLocal()` **por tabla** cuando una consulta falla (líneas 408, 423,
458, 472, 487). Saltarse una tabla por firma sin cambios es el mismo camino, con
otro motivo.

## Lo que hay que construir

### Migración

1. `actualizado_en timestamptz not null default now()` en las tablas hidratadas
   que no la tengan.
2. **Una** función `public.marcar_actualizado()` y un trigger `before update` en
   las 21. El `default now()` cubre el alta; el trigger cubre la modificación.
   Sin esto la firma miente, que es exactamente el fallo del apartado 2.
3. RPC `firma_de_sincronizacion()` devolviendo `(tabla, filas, ultimo_cambio)`.

**El RPC NO puede ser `security definer`.** Tiene que correr con el RLS de quien
llama, porque la firma de un coach y la de una asesorada son distintas por
definición: si se calculara como superusuario, la asesorada compararía su copia
contra el conteo de toda la cartera y se rehidrataría siempre.

### Cliente

4. Guardar la firma junto a la instantánea (misma clave, `alpha-db-v2`).
5. `hidratarDesdeNube` pide la firma primero y solo consulta las tablas que
   cambiaron.
6. La firma se descarta al cambiar `epocaSesion()`: otra persona en el
   dispositivo no hereda la comparación de la anterior.

## Coste, dicho por delante

El RPC hace un `count(*)` por tabla bajo RLS, y eso es un barrido. A la escala de
hoy es irrelevante frente a lo que ahorra en red y en parseo del cliente. A
escala grande, el paso siguiente sería un registro de cambios por usuario
mantenido por trigger, que evita contar. **No hace falta todavía, y meterlo ahora
sería complejidad sin medición que la respalde.**

## Cómo se comprueba

- La firma tiene que decir «cambió» tras un alta, tras una modificación **y tras
  un borrado**. La tercera es la que importa: es la que el delta por fila falla.
- Dos hidrataciones seguidas sin tocar nada: la segunda no descarga ninguna tabla
  y el estado local queda idéntico.
- Borrar una fila en el servidor y rehidratar: **tiene que desaparecer del
  dispositivo**.
- Aislamiento: la firma de una asesorada no puede moverse porque otra registre
  algo. Va con los tests de aislamiento que ya existen
  (`SessionProvider.aislamiento.test.tsx`, `data/nube/perdida-datos.test.ts`).
