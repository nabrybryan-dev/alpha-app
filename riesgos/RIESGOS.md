# Dónde se rompe el salón con gente real dentro

Abogado del diablo sobre la rama `salon/entrenar-4d`. Aquí no se propone rediseño ninguno:
cada apartado dice qué ve el asesorado, cómo se provoca, y la línea de código que lo permite.

**Qué he podido medir y qué no.** He leído los archivos nuevos y los que tocan
(`src/data/mockDb.ts`, `src/data/nube/*`, `supabase/migrations/0037…`), he corrido
`npx tsc --noEmit` (limpio) y he **medido** el tamaño de la escena por fotograma con un
script propio contra el código real (ver riesgo 5). Lo que **no** he hecho: abrir la app en
un navegador ni en un teléfono. No hay dispositivo aquí, y el salón ya sí es el contenido
de `/entrenar` (riesgo 12), así que a partir de ahora esto es abrible y la falta es solo
de dispositivo. Cuando un apartado dependa de píxeles lo digo con estas palabras: *sin ver
en pantalla*, y digo al lado qué haría falta para verlo —qué teléfono, qué gesto, qué
medida.

**Revisión del 2026-08-29.** Este documento se escribió contra un árbol anterior. Al
repasarlo se han corregido las citas que ya no decían la verdad: el aviso que se citaba de
`capas/nivelesAnatomicos.ts` fue retirado del archivo por la capa motor tras comprobar los
niveles contra `motor.ts` y `malla.ts` (riesgo 7 reescrito con la evidencia de hoy); las
paredes y el registro perdieron el desenfoque y llevan fondo opaco (riesgo 14); y el salón
dejó de estar suelto y se enchufó a la ruta (riesgo 12, invertido). Las líneas citadas se
han vuelto a comprobar una por una contra el árbol de hoy.

Orden: de lo que corrompe o pierde datos, a lo que solo molesta.

---

## 1 · Dos pestañas o dos dispositivos: la última que guarda borra las series de la otra

**Gravedad: CRITICO**

### Qué pasa

El asesorado tiene la app abierta en el móvil y la deja abierta también en la tablet del
gimnasio (o dos pestañas del mismo navegador, que es lo normal en una PWA que se abre desde
el icono y desde el enlace). Registra la serie 1 en el móvil y la serie 2 en la tablet. Al
final del entreno una de las dos series no existe: ni en la pantalla, ni en la base local, ni
en el servidor. Nadie ve un error.

### Cómo se provoca

1. Abrir `/entrenar` en dos pestañas (A y B), las dos con la misma persona.
2. En A, guardar la serie 1 del press. A escribe el blob entero de la base en `localStorage`
   y encola una llamada con el array `[serie1]`.
3. En B —que cargó su copia en memoria **antes** y no se ha enterado de nada— guardar la
   serie 2. B escribe su blob, en el que la serie 1 no existe, y encola una llamada con el
   array `[serie2]`.
4. La segunda llamada **sustituye** a la primera en la cola, porque las dos comparten
   `claveRpc`. La serie 1 no llega al servidor ni queda en descartes.

El mismo mecanismo, más lento, entre dos dispositivos distintos: la función del servidor
reemplaza el array completo de series del ejercicio con el que le manda el último cliente.

### Evidencia

- `src/data/mockDb.ts:97` — `let referencia: { actual: SeedDb } | undefined`: la base viva es
  una copia **en memoria por pestaña**.
- `src/data/mockDb.ts:52-79` — `guardar()` serializa el estado entero y lo escribe en la
  clave `alpha-db-v2`. Escribe el blob completo, no una rama.
- No hay ni un `addEventListener('storage', …)` en `src/`: lo comprobé con grep sobre el
  árbol y sale vacío. Una pestaña no se entera nunca de que la otra escribió.
- `src/data/nube/sync.ts:808-826` — `subirSeries()` manda `p_series: ejercicio.series`, el
  array completo leído del estado local de esa pestaña.
- `src/data/nube/cola.ts:148-169` — `integrarEnCola()` + `claveDeFila()`: dos llamadas con la
  misma `claveRpc` (`rpc:fijar_series_ejercicio:<micro>:<ejercicio>`) se colapsan en una, y
  gana la última. El comentario del propio archivo lo dice: «la última gana y las anteriores
  sobran».
- `supabase/migrations/0037_escrituras_quirurgicas_de_microciclo.sql:29-57` —
  `jsonb_set(e, '{series}', coalesce(p_series, '[]'::jsonb))`: el servidor **reemplaza**, no
  fusiona.
- `src/features/entrenar/salon/registro/RegistroSerieSalon.tsx:100` — el salón entra por ese
  mismo camino.

### Por qué el salón lo empeora aunque el mecanismo sea viejo

Hasta ahora solo se registraban series desde `/entrenar/sesion/:id`. El salón pone un botón
de guardar en **la pantalla de aterrizaje** de la pestaña Entrenar
(`SalonEntrenar.tsx:272-286`). Con eso, «el salón abierto en una pestaña y la sesión en otra»
deja de ser un caso raro y pasa a ser el flujo normal: son dos pantallas distintas de la
misma app escribiendo el mismo array.

### Qué lo evitaría

Que la escritura de una serie no mande nunca el array completo (una llamada de «añade esta
serie con este orden» en vez de «el array del ejercicio es este»), o que la pestaña relea el
estado del disco justo antes de construir el envío en vez de fiarse de su copia en memoria.
Mientras el contrato sea «mando el array entero», cualquier segundo escritor pisa al primero.

---

## 2 · «Guardar serie» puede no escribir nada, borra el borrador igual y no avisa

**Gravedad: CRITICO**

### Qué pasa

El asesorado teclea 82,5 kg × 8 a RIR 2, pulsa el botón rojo, y no pasa **nada**: ni un
cambio, ni un aviso, ni un error. El botón sigue diciendo «Guardar serie 1». Vuelve a
pulsar. Otra vez nada. Los kilos que había tecleado ya no están guardados ni siquiera como
borrador, porque el borrador se borró al primer toque.

### Cómo se provoca

Cualquier situación en la que el id del ejercicio o el del microciclo que el salón lleva en
las props no coincida con lo que hay en la base en ese instante:

1. El coach carga el microciclo nuevo (los ids de ejercicio cambian) mientras el asesorado
   tiene el salón abierto.
2. `hidratarDesdeNube()` aplica la foto del servidor y reemplaza la base local entera
   (`mockDb.ts:154-159`), con otros ids.
3. El asesorado, que no ha recargado, pulsa Guardar.

### Evidencia

- `src/data/mockDb.ts:161-170` — `actualizarMicrociclo()` hace
  `microciclos.map(m => m.id === microcicloId ? transformar(m) : m)`. Si no encuentra el
  microciclo, **devuelve el estado igual**. Sin excepción, sin valor de retorno, sin señal.
- `src/data/mockDb.ts:345-364` — `registrarSerie` devuelve `void`; si el `ejercicioId` no está
  en ninguna sesión, el `map` interior tampoco encuentra nada y no escribe.
- `src/data/nube/sync.ts:814` — `if (!ejercicio) return`: la subida también se calla.
- `src/features/entrenar/salon/registro/RegistroSerieSalon.tsx:100-102`:
  ```
  db.microciclos.registrarSerie(microcicloId, ejercicio.id, serie)
  borrarClave(clave) // ya quedó en la base; el borrador deja de hacer falta
  onGuardado?.(serie)
  ```
  El comentario afirma «ya quedó en la base». Nada en el código lo comprueba: la llamada no
  devuelve nada y no se mira si escribió. El borrador se borra siempre.

### Agravante: el salón no se refresca solo

`RegistroSerieSalon` no llama a `useDbVersion()`, y `SalonEntrenar` tampoco
(`SalonEntrenar.tsx:105-107` recibe `microciclo` y `sesion` por props). Que el botón pase de
«Guardar serie 1» a «Guardar serie 2» depende por completo de que el componente que lo monte
se haya suscrito (`src/data/dbInstance.ts:12-23`). Cuando esto se escribió no lo montaba
nadie y quedó como pregunta abierta. **Ya tiene respuesta, y es buena**: el llamante es
`RutaPage` (riesgo 12), y `RutaPage.tsx:48` llama a `useDbVersion()` antes de leer nada de
la base. Así que hoy el refresco llega y el botón sí avanza de serie.

Lo que queda de agravante es más fino, y es de diseño: la suscripción vive en el llamante y
no en el salón, así que **nada impide montar `SalonEntrenar` desde otro sitio sin ella** —no
hay un test que lo prohíba ni un tipo que lo exija—, y el día que eso pase el fallo será
exactamente el descrito: botón congelado en la serie 1, cada toque reescribiendo la misma
serie, y ningún error en consola. La defensa actual es una línea en un archivo distinto del
que la necesita.

### Qué lo evitaría

Que `registrarSerie` diga si escribió (devolver la serie escrita, o lanzar cuando el id no
existe) y que el borrador solo se borre con esa confirmación en la mano. Y un acuse visible
en pantalla —hoy no hay ninguno: ni un cambio de color, ni un `aria-live`, ni un botón que se
desactive.

---

## 3 · La serie se registra en el ejercicio que el salón eligió, no en el que se está haciendo

**Gravedad: CRITICO**

### Qué pasa

El asesorado hace la sesión en el orden que le deja la sala: empieza por el remo porque el
banco está ocupado. Registra sus tres series. Al terminar, las tres están apuntadas en el
**press de banca**, con sus kilos. La prescripción del press queda desalineada con lo
ejecutado, y el motor de carga de la semana siguiente propone a partir de un dato falso.

### Cómo se provoca

Entrar al salón con una sesión de varios ejercicios y registrar sin haber tocado nada más. El
salón no pregunta.

### Evidencia

- `src/features/entrenar/salon/SalonEntrenar.tsx:96-99`:
  ```
  function ejercicioEnCurso(sesion: Sesion | undefined): EjercicioPrescrito | undefined {
    if (!sesion) return undefined
    return sesion.ejercicios.find((e) => !ejercicioCompleto(e)) ?? sesion.ejercicios[0]
  }
  ```
  Coge el primero sin terminar. No hay más criterio.
- `SalonEntrenar.tsx:272-286` — el registro se monta con ese ejercicio y **no hay ningún
  selector**: en las 309 líneas del salón no existe un navegador de ejercicios, ni una lista,
  ni un botón de siguiente.
- Para comparar, la pantalla que hoy hace esto sí lo tiene:
  `src/features/entrenar/SesionPage.tsx:345` monta `<ProximosEjercicios … onIr={setExIdxManual} />`.
- Y las paredes solo hablan de ese ejercicio: `SalonEntrenar.tsx:122` calcula `contenido` una
  sola vez, para `ejercicio`. El resto de la sesión no se ve en ninguna parte del salón.

### Qué lo evitaría

Que el hueco `registro` no pueda escribir sobre un ejercicio que el asesorado no ha elegido
explícitamente: o se elige, o no se registra desde aquí y el botón lleva a la sesión.

---

## 4 · Doble toque en «Guardar serie»: una serie que nadie hizo

**Gravedad: CRITICO**

### Qué pasa

El asesorado pulsa Guardar con las manos sudadas y el dedo rebota, o pulsa dos veces porque
la primera no pareció hacer nada (no hay acuse ninguno). Queda registrada una serie de más,
con los valores prescritos, que no ocurrió. Cuenta como volumen, cuenta para el cumplimiento
y cuenta para la comparación de fuerza.

### Cómo se provoca

1. Guardar la serie 1.
2. El componente que monta el salón se refresca, `orden` pasa a 2, la `key` cambia y
   `RegistroSerieSalon` se remonta con los valores prescritos de la serie 2.
3. El segundo toque cae **en el mismo sitio de la pantalla**, sobre un botón que ahora dice
   «Guardar serie 2», y la escribe.

### Evidencia

- `src/features/entrenar/salon/registro/RegistroSerieSalon.tsx:171-178` — el botón no tiene
  `disabled`, ni estado de envío, ni bloqueo temporal; `onClick={guardar}` a secas.
- `RegistroSerieSalon.tsx:92-105` — `guardar()` es síncrono y no lleva guarda de reentrada.
- `SalonEntrenar.tsx:281` — `key={`${ejercicio.id}-${ejercicio.series.length + 1}`}`: el
  remontaje al avanzar la serie está buscado a propósito, y es justo lo que hace que el
  segundo toque escriba una serie distinta en vez de repetir la misma.
- La etiqueta del botón cambia bajo el pulgar («Guardar serie 1» → «Guardar serie 2») sin que
  el botón se mueva ni un píxel.

### Qué lo evitaría

Desactivar el botón hasta que la serie que se acaba de escribir esté confirmada en pantalla,
o exigir un gesto distinto para la serie siguiente. Cualquier acuse visible que separe los
dos toques.

---

## 5 · El coste de la escena, medido: 604.141 operaciones por fotograma, en la pantalla principal del entreno

**Gravedad: ALTO**

### Qué pasa

En un móvil de gama baja la pantalla `/entrenar` va a tirones, el teléfono se calienta en el
bolsillo entre series y la batería baja a ojo durante una sesión de una hora. Y si además el
asesorado abre el encoder a grabar, la toma sale por debajo de 50 fps y **se descarta**: hay
que repetir la serie.

### Cómo se provoca

Entrar a `/entrenar` con una sesión que tenga un ejercicio con patrón. Nada más. La animación
arranca sola (`reproduciendo` nace en `true`) y no para.

### Lo medido

Corrí un script propio contra el código real de la rama —los mismos constructores que llama
`construir()`— y conté vértices e índices de cada parte que se sube en cada fotograma:

| parte | vértices | índices |
|---|---:|---:|
| laboratorio | 1.574 | 3.594 |
| plomada | 218 | 1.224 |
| sala | 859 | 2.142 |
| trípode | 88 | 144 |
| huesos | 13.774 | 75.696 |
| músculos | 14.488 | 84.672 |
| guías | 5.754 | 32.364 |
| **total** | **36.755** | **199.836** |

Eso son **604.141 llamadas a `push`** por fotograma (404.305 flotantes de atributos + 199.836
índices), más seis `new Float32Array`/`new Uint32Array` de unos 2,4 MB en conjunto, más seis
`bufferData` a la GPU. A 60 Hz: ~36 millones de `push` por segundo, ~145 MB/s de basura para
el recolector y ~210 MB/s subidos al bus. Cada fotograma. Para una geometría que en su
inmensa mayoría **no ha cambiado**.

### Evidencia

- `src/features/entrenar/visor/motor.ts:182-221` — `subir()` reconstruye seis arrays de
  JavaScript concatenando **cada** malla y vuelve a subir los seis búferes enteros. No hay
  búfer por parte ni actualización parcial.
- `src/features/entrenar/visor/VisorPatron.tsx:238-265` — `construir()` llama a
  `motor.subir(partes)` con la lista completa.
- `VisorPatron.tsx:288-320` — el bucle: si `reproduciendo`, `cambia = true` y se llama a
  `construir()` + `pintar()` **cada fotograma**.
- `VisorPatron.tsx:144` — `reproduciendo` arranca en `true`.
- `VisorPatron.tsx:53-98` — las cachés de laboratorio, sala y trípode ahorran
  *construir* la geometría, no *subirla*: la concatenación y los `bufferData` se pagan igual.
- `SalonEntrenar.tsx:187-198` — el salón monta el visor **con `datos`**, que es lo que
  enciende sala y trípode (`VisorPatron.tsx:256-260`).

### Lo que sí está protegido, y lo que no

Está protegido el caso del encoder grabando (`VisorPatron.tsx:294-297`, `camaraAbierta()`) y
el de «menos movimiento» del sistema (`VisorPatron.tsx:179`). **No** está protegido: el panel
inferior abierto tapando el 84 % de la pantalla (`PanelInferior.tsx:174`) — la escena sigue a
pleno rendimiento detrás de una hoja opaca —, ni el descanso entre series con la pantalla
encendida, ni el ejercicio de cardio, ni la sesión entera.

Y esto ahora vive en la pantalla de aterrizaje de la pestaña Entrenar, no en un visor que se
abre a propósito: antes lo pagaba quien elegía mirar el patrón, ahora lo paga quien entra a
entrenar.

### Qué lo evitaría

Subir a la GPU solo lo que cambia (el sujeto) y dejar quieto lo que no (bahía, sala, trípode,
paredes), o parar el bucle cuando el panel está abierto y cuando nadie mira. Con lo que hay
hoy, el número no baja tocando parámetros: baja cambiando quién sube qué.

---

## 6 · Los mandos del visor quedan recortados fuera de la pantalla

**Gravedad: ALTO**

### Qué pasa

El asesorado ve el modelo, pero no puede pausarlo, ni mover el deslizador de fase, ni cambiar
entre Ambas / Músculo / Hueso. Tampoco ve el resumen del patrón, ni «Qué hace cada
articulación», ni las claves de ejecución, ni los errores frecuentes, ni la musculatura
implicada. No es que estén escondidos: están fuera del recuadro visible y no hay scroll que
los alcance.

### Cómo se provoca

Abrir el salón con un ejercicio con patrón. Intentar tocar los botones de capa.

### Evidencia

- `SalonEntrenar.tsx:167-172` — la raíz del salón es
  `className="fixed inset-0 overflow-hidden bg-ink-900"`. **`overflow-hidden`**: lo que no
  cabe se recorta, no se desplaza.
- `SalonEntrenar.tsx:174-181` — el centro es
  `absolute inset-0 flex items-center justify-center`: el contenido se centra en vertical y
  desborda por arriba y por abajo a partes iguales.
- `VisorPatron` no es un lienzo: es un documento largo. En el mismo `flex flex-col gap-3`
  están el canvas (`VisorPatron.tsx:387-390`, `h-[46vh] max-h-[420px] min-h-[240px]`), la fila
  de mandos (`:416-467`), el resumen (`:476`), la lista de acciones articulares (`:478-538`),
  las claves (`:540-553`), los errores (`:555-568`) y la musculatura (`:570` en adelante). En
  un teléfono eso pasa holgadamente del alto de la pantalla.
- Y encima del centro va aún el registro (`SalonEntrenar.tsx:272-286`) y el panel
  (`:289-303`), que le comen la parte de abajo.

*Sin ver en pantalla*: el desbordamiento real en un dispositivo está sin medir. Lo que sí
está en el código y no depende de medir es el `overflow-hidden` sobre un contenido de altura
libre y centrado. Para ponerle número basta abrir el salón en un teléfono con un ejercicio
con patrón y leer `scrollHeight` contra `clientHeight` del hueco `centro`: la diferencia es
justo lo que el asesorado no puede alcanzar.

### Agravante

Los tres botones Ambas / Músculo / Hueso (`VisorPatron.tsx:452-465`) son, según la cabecera
del propio salón (`SalonEntrenar.tsx:62-67`), **la única forma real de cambiar la capa
anatómica que se dibuja**. Si quedan recortados, el eje W del salón no tiene sustituto:
véase el riesgo 7.

### Qué lo evitaría

Que el hueco `centro` declare qué parte del visor monta, en vez de montarlo entero y confiar
en que quepa.

---

## 7 · El eje W —la cuarta dimensión— no cambia lo que se ve del cuerpo

**Gravedad: ALTO**

### Qué pasa

El asesorado arrastra el dedo hacia arriba sobre el sujeto esperando atravesarlo hasta el
hueso. La habitación se oscurece un poco y se enciende otro punto de la columna de la
derecha. El cuerpo sigue exactamente igual. Repite cuatro veces hasta el último peldaño: la
pantalla está un 40 % más oscura y el modelo no ha cambiado. Concluye, con razón, que la
función está rota.

### Cómo se provoca

Arrastrar en vertical sobre el centro, o pulsar los peldaños de la derecha.

### Evidencia

- `SalonEntrenar.tsx:62-67` — lo dice la propia cabecera del archivo: «Lo que NO hace es
  cambiar la capa anatómica que dibuja el modelo». Honesto en el comentario, invisible para
  quien usa la app.
- `SalonEntrenar.tsx:155` — `setW(...)` es el único efecto del gesto.
- `SalonEntrenar.tsx:213-220` — el velo: `opacity: w * 0.1` sobre un degradado radial. Eso es
  cuanto ocurre al atravesar.
- `SalonEntrenar.tsx:187-198` — el visor se monta sin recibir `w`: no hay ninguna prop por la
  que la capa pudiera llegar al modelo.

### El agravante: dos contratos del mismo eje, y el bueno está muerto

Hay dos catálogos de las cinco capas y dos umbrales del gesto, y el salón usa los suyos:

- `src/features/entrenar/capas/nivelesAnatomicos.ts` (376 líneas) y
  `src/features/entrenar/capas/gestoVertical.ts` (99 líneas) **no los importa nadie**. Lo
  volví a comprobar el 2026-08-29 con grep sobre `src/` excluyendo la propia carpeta: cero
  resultados. Sí tienen prueba propia (`capas/capas.test.ts`), lo cual es peor de leer, no
  mejor: hay un contrato verde que no gobierna ningún píxel.
- `capas/gestoVertical.ts:51` fija `UMBRAL_DE_CAPA = 72` px y razona el número.
  `SalonEntrenar.tsx:71` fija `const UMBRAL_W = 46` y no lo menciona. Dos umbrales distintos
  para el mismo gesto.
- `capas/gestoVertical.ts:74-82` — `capaTrasArrastre()` es pura, total y defensiva frente a
  `NaN`. `SalonEntrenar.tsx:141-157` reimplementa la regla a mano y no la llama.

Cuando alguien suba el umbral porque «se dispara solo», tiene un 50 % de posibilidades de
tocar el número que no manda.

### Corrección del 2026-08-29: el aviso que se citaba aquí ya no existe

Este apartado citaba una línea de `capas/nivelesAnatomicos.ts` que avisaba de que no se
había comprobado que los cinco niveles se vieran distintos. **Esa frase fue retirada del
archivo**: la capa motor la sustituyó por un apartado con la comprobación hecha contra
`motor.ts` y `malla.ts` («Qué sabe encender y apagar el motor, medido»,
`capas/nivelesAnatomicos.ts:29-53`). Ahí queda establecido que los 21 huesos del nivel 4
son exactamente los 21 índices con geometría de `construirHuesos()`, que
`estructurasDesconocidas()` y `musculosSinNivel()` salen vacías, y que los cinco niveles
mandan al motor cinco combinaciones distintas de malla y color. Citar hoy aquel aviso sería
citar un archivo que ya no dice eso, así que se retira la cita.

Lo que **no** se cae con ella es el riesgo, y el propio archivo lo dice ahora mejor de lo
que lo decía el aviso viejo:

- `capas/nivelesAnatomicos.ts:55-61` — «`construirMusculos()` dibuja siempre las setenta
  porciones y no admite filtro, así que hoy los niveles 0 a 3 mandan las mismas setenta y
  el reparto de veinte y diecisiete todavía no recorta nada». Es decir: entre W=0, 1, 2 y 3
  el catálogo declara músculos distintos y el constructor entrega los mismos.
- `src/domain/patrones/musculos.ts:208-215` — la firma lo confirma:
  `construirMusculos(esq, activacion, enReposo, reutilizar?)` no recibe ninguna lista de
  estructuras, y el bucle recorre `PORCIONES` entero. No hay por dónde pasarle el reparto
  de niveles. (Ese archivo está en `src/domain/`, de solo lectura para esta revisión: se
  cita, no se toca.)
- Y el archivo también acota qué clase de comprobación es la suya: lo medido es lo que
  ENTRA en `subir()`, no una captura de pantalla (`capas/nivelesAnatomicos.ts:60-61`). Que
  el motor sepa encender dos mallas no prueba que el asesorado vea cinco cuerpos distintos.

**Efecto neto sobre la gravedad: ninguno, y por dos motivos.** Primero, porque el eje W del
salón no llega al modelo por ninguna vía (`SalonEntrenar.tsx:187-198`: el visor se monta sin
recibir `w`), de modo que el filtro por nivel, exista o no en el constructor, hoy no se
pediría nunca. Segundo, porque el día que alguien enchufe W al visor —que es el arreglo
natural— se encontrará con que niveles 0 a 3 devuelven la misma geometría: el trabajo que
falta está en `construirMusculos()`, no en el catálogo.

*Sin ver en pantalla*: para cerrar esto de verdad hace falta abrir `/entrenar` en un
teléfono con un ejercicio con patrón, recorrer los cinco peldaños y fotografiar cada uno. Si
las cuatro primeras fotos son la misma silueta con distinto velo, está confirmado.

### Qué lo evitaría

O el eje W llega al modelo, o el salón no promete atravesar el cuerpo. Y borrar uno de los
dos umbrales: mientras convivan, cualquier ajuste es una moneda al aire.

---

## 8 · Se pierde el contexto WebGL y el centro se queda negro para siempre

**Gravedad: ALTO**

### Qué pasa

A mitad de sesión —el asesorado abre la cámara, atiende una videollamada, o el sistema
recupera memoria de GPU— el sujeto desaparece y queda un rectángulo del color de fondo del
estudio. No hay mensaje de error, porque no hubo error: el contexto se perdió. Salir y
volver a entrar en la pestaña no lo arregla, porque el efecto que monta el motor solo se
vuelve a ejecutar si cambia el patrón.

### Cómo se provoca

Cualquier cosa que le quite el contexto WebGL a la pestaña en un móvil con poca memoria: otra
app pesada en primer plano, la cámara del encoder, varias pestañas con canvas.

### Evidencia

- `src/features/entrenar/visor/motor.ts:142` — `lienzo.getContext('webgl', …)`. No se registra
  `webglcontextlost` ni `webglcontextrestored` en ningún sitio: grep de `contextlost` sobre
  `src/` sale vacío.
- `VisorPatron.tsx:190-347` — el efecto que crea el `Motor` depende de `[patron, conEscenario]`
  (`:347`). Perdido el contexto, no hay nada que lo vuelva a crear.
- `VisorPatron.tsx:206-210` — el único camino a `setError(...)` es que el constructor lance en
  el montaje. Una pérdida posterior no pasa por ahí: `drawElements` sobre un contexto perdido
  no lanza, simplemente no dibuja.
- `motor.ts:245-246` — `gl.clearColor(...)` + `clear(...)`: por eso queda el color de fondo y
  no un hueco, que es lo que hace que parezca «una pantalla que se quedó pillada» y no un
  fallo.

### Qué lo evitaría

Escuchar `webglcontextlost`, decirlo en pantalla y volver a montar el motor al recuperarlo.
Hoy el fallo es mudo y permanente.

---

## 9 · Guardar la serie desde el salón no arranca el descanso

**Gravedad: ALTO**

### Qué pasa

El asesorado apunta la serie y se sienta a esperar. El cronómetro de descanso no arranca.
Descansa a ojo, o mira el reloj del móvil. La prescripción dice «descanso 2,5 min» —el salón
incluso lo tiene escrito en la pared de Series— y la app, que antes lo contaba, ya no lo
cuenta.

### Cómo se provoca

Registrar una serie desde el salón en vez de desde la sesión.

### Evidencia

- `src/features/entrenar/SesionPage.tsx:337-340` — el camino que ya existía:
  ```
  db.microciclos.registrarSerie(microciclo.id, ejercicioActual.id, serie)
  alGuardarSerie(ejercicioActual.id, ejercicioActual.descansoMin)
  ```
  La segunda línea es la que enciende el descanso.
- `src/features/entrenar/salon/registro/RegistroSerieSalon.tsx:100-102` — el camino nuevo hace
  la primera y no la segunda. `onGuardado?.(serie)` existe como enganche, pero
  `SalonEntrenar.tsx:277-284` monta `RegistroSerieSalon` **sin pasar `onGuardado`**.
- `src/features/entrenar/DescansoTimer.tsx` sigue existiendo y el salón no lo monta en
  ninguna de sus 309 líneas.

La cabecera de `RegistroSerieSalon` (`:19-33`) afirma que esto es «un envoltorio, no un
registro nuevo» y que «el camino de escritura es el que ya funciona». La escritura sí; el
efecto de haber registrado, no.

### Qué lo evitaría

Que el hueco `registro` declare también qué pasa **después** de escribir, no solo la
escritura.

---

## 10 · Sin sesión hoy, el centro se inventa una prescripción

**Gravedad: ALTO**

### Qué pasa

Un asesorado en día de descanso, o con la semana ya terminada, o con una sesión sin
ejercicios, abre Entrenar y lee en mitad de la pantalla:

> Sin modelo 3D para este ejercicio.
> No hay gesto resistido que enseñar.
> Minutos: Sin minutos prescritos · Zona: Sin zona ni RPE escritos · Ritmo: Sin ritmo escrito
> · **Descanso: Continuo, sin descanso pautado**

No hay ningún ejercicio. La pantalla habla en singular de «este ejercicio» que no existe, y
la última casilla afirma una pauta —«continuo, sin descanso pautado»— que nadie prescribió.
Es exactamente lo que el repositorio lleva meses evitando en las comprobaciones de carga: un
dato que parece medido y no lo está.

### Cómo se provoca

Entrar a `/entrenar` un día sin sesión, o con una sesión cuyo array `ejercicios` esté vacío y
sin `bloquesCardio`.

### Evidencia

- `SalonEntrenar.tsx:96-99` — sin sesión, `ejercicioEnCurso` devuelve `undefined`.
- `SalonEntrenar.tsx:117` — `tienePatronDeMovimiento(undefined)` devuelve `false`
  (`sinPatron/SalonSinSujeto.tsx:39-42`), así que se entra en la rama del centro sin sujeto.
- `SalonEntrenar.tsx:203-205` — se monta `SalonSinSujeto` con `ejercicio={undefined}`.
- `sinPatron/SalonSinSujeto.tsx:84-86`:
  ```
  const descanso = ejercicio
    ? `${…} min entre series`
    : 'Continuo, sin descanso pautado'
  ```
  La rama del `else` es precisamente el caso «no hay ejercicio», y responde afirmando una
  pauta.
- `SalonSinSujeto.tsx:126` — el texto fijo «Sin modelo 3D para este ejercicio.» se pinta
  también cuando no hay ejercicio ninguno.

### Nota de contexto

En este proyecto ya está escrito que «sin microciclo» no es una urgencia y que parte de la
cartera está inactiva a propósito. La lectura correcta de un día vacío es «hoy no toca», no
«hoy toca algo continuo y sin descanso».

### Qué lo evitaría

Separar los dos casos: «este ejercicio no tiene modelo 3D» y «hoy no hay ejercicio». Hoy
comparten componente y comparten frases.

---

## 11 · Si el tirador no responde, los doce bloques de la Ruta son inalcanzables

**Gravedad: ALTO**

### Qué pasa

El asesorado entra a Entrenar y ve una habitación oscura con ocho rótulos diminutos y un
formulario de serie. No están su nivel, su progreso, cómo llega esta semana, el calendario,
las competencias, los requisitos, la Escala Alfa, las notas del coach, el enlace al encoder
ni **el botón para abrir la sesión de hoy**. Cuanto había en `/entrenar` está detrás de una
barrita gris de 44 × 4 px sin una sola letra.

### Cómo se provoca

- Que el gesto no se dispare: `setPointerCapture` no disponible, un guante, un protector de
  pantalla, un lápiz.
- O simplemente no saber que hay que tirar: el tirador no dice nada, por diseño explícito.

### Evidencia

- `panel/PanelInferior.tsx:183-197` — el tirador es un `<button>` cuyo contenido es un `<span
  aria-hidden>` de `h-1 w-11`. Su nombre solo vive en `aria-label`
  (`PanelInferior.tsx:186`), que un lector de pantalla anuncia y un ojo no ve.
- `PanelInferior.tsx:199` — `{abierto && (…)}`: los doce recuadros **no existen en el DOM**
  mientras el panel esté cerrado. No es que estén ocultos: no están.
- `PanelInferior.tsx:204-292` — ahí dentro están los doce, incluido
  `<Recuadro clave="bloque-en-curso">` con `<BloqueEnCurso … sesion={sesionCta} />`, que es
  quien lleva el `<Link to={`/entrenar/sesion/${sesion.id}`}>`
  (`ruta/BloqueEnCurso.tsx:59-69`). **El único camino a la sesión del día pasa por abrir el
  panel.**
- `SalonEntrenar.tsx:46-51` — la «regla dura de la vista inicial» (ni un nodo de texto fuera
  de los huecos) es la que obliga a que el tirador sea mudo. La regla está cumplida; el precio
  es este.

### Atenuante honesto

Hay una salida: un toque limpio también abre (`PanelInferior.tsx:145-148`, umbral `TOQUE = 6`),
y el botón es accesible por teclado. No es un callejón sin salida; es un descubrimiento que
depende de que a alguien se le ocurra tocar una barra sin etiqueta.

### Qué lo evitaría

Que el estado cerrado del panel diga qué hay dentro. La regla de la vista inicial y «que se
pueda encontrar» chocan aquí, y hoy gana la regla.

---

## 12 · El salón ya ES `/entrenar`, sin interruptor y sin haberse visto en un teléfono

**Gravedad: ALTO**

> **Este riesgo está invertido respecto a como se escribió.** Decía que el salón no estaba
> enchufado a ninguna ruta y que no tenía ni una prueba. Las dos mitades han dejado de ser
> ciertas, y la corrección **sube** la gravedad en vez de bajarla: lo que era «nada de esto
> le ha pasado a nadie todavía» es ahora «esto es lo que se ve al entrar».

### Qué pasa

Lo que el asesorado ve al entrar en `/entrenar` **es el salón**. Ya no hay columna con
scroll detrás de la que esperar. Los riesgos 1 a 11 y 13 a 22 de este documento dejaron de
ser hipotéticos el día que se añadió la línea que lo monta, y esa línea no tiene detrás
ningún interruptor: no hay bandera, ni variable de entorno, ni porcentaje de usuarios.

### Evidencia

- `src/features/entrenar/RutaPage.tsx:20` — `import { SalonEntrenar } from './salon/SalonEntrenar'`,
  y `:113` lo monta con todos los datos de la ruta. Ya no importa `PortadaMicrociclo` como
  pantalla: el salón es el contenido.
- `src/app/layouts.tsx:43` — `RUTAS_SIN_CABECERA = ['/entrenar']`, y `:78` deja de pintar la
  `TopBar` en esa ruta. La cáscara de la app se apartó **para hacerle sitio al salón**, que
  es la señal más clara de que esto ya no es un experimento aparcado. (De paso: el
  apilamiento de la cabecera sobre el salón, que era un riesgo aparte, queda resuelto aquí,
  y `salon.test.tsx:261` lo fija con una prueba.)
- Grep de `SalonEntrenar` sobre `src/` excluyendo la propia carpeta: ahora sale `RutaPage`.
  No hay ninguna condición alrededor de ese `<SalonEntrenar …/>`; es el `return` del
  componente.
- Sí hay pruebas, y no eran cero: `salon/salon.test.tsx`, `salon/registro/registro.test.tsx`,
  `salon/sinPatron/sinPatron.test.tsx` y `capas/capas.test.ts` — 4 archivos, 52 casos, 1.175
  líneas.

### Lo que sigue sin proteger nadie, que es la parte viva del riesgo

Las pruebas que hay son de estructura, no de píxeles ni de dedo, y se ve en sus propios
títulos: «monta los huecos declarados y ninguno de más», «el eje W tiene sus cinco peldaños»,
«ninguna pared se pasa del tope de 42 caracteres». Todas cosas que jsdom sabe contar. Ninguna
de las 52 ve un tamaño de letra al sol (riesgo 14), un recorte por `overflow-hidden` (riesgo
6), una zona segura de una muesca (riesgo 15), una diana de 28 px a 6 px del borde (riesgo
16) ni un fotograma del sujeto moviéndose (riesgo 13). Y el reparto de cobertura es desigual:

- `src/features/entrenar/escena/` son **656 líneas** —`sala.ts`, `tripode.ts`— con **cero**
  archivos de prueba. Es la geometría de la habitación, y es justo lo que jsdom no puede
  mirar aunque hubiera tests.
- En conjunto, 3.169 líneas de producción en `salon/`, `capas/` y `escena/` contra 1.175 de
  prueba, con la parte de prueba concentrada en `salon/`.
- `capas/` tiene 18 casos verdes sobre dos módulos que **no importa nadie** (riesgo 7): son
  pruebas que pasan y no defienden ningún píxel.

### Por qué sigue siendo ALTO y no baja a nota de estado

Porque cambia cómo hay que leer el resto del documento, pero en la dirección contraria a la
que decía la versión anterior. Los riesgos 1 a 4 son de mecanismo y se sostienen en el
código. Los de píxeles (6, 13, 14, 15, 16) están razonados sobre el CSS y **siguen sin
haberse visto**, solo que ahora se ven ellos solos, en el teléfono de cada asesorado, sin
que nadie los haya mirado antes.

*Sin ver en pantalla*: nadie de esta revisión ha abierto `/entrenar` en un navegador. Para
cerrarlo hace falta lo de siempre y no más: un teléfono con muesca, la PWA instalada, una
sesión de fuerza con patrón, y recorrer los cinco peldaños de W, los mandos del visor y las
dos paredes anotando qué se recorta y qué no se lee.

### Qué lo evitaría

Un interruptor que se pueda apagar sin desplegar —una bandera leída en `RutaPage`— y una
pasada en un teléfono real antes de dejarlo como camino por defecto. Hoy el único modo de
revertirlo es un despliegue, y Vercel publica con solo empujar a `main`.

---

## 13 · Ninguna prueba automática puede ver si el sujeto se mueve bien

**Gravedad: ALTO**

### Qué pasa

El aparato entero de verificación de este repositorio —2.982 tests en 235 archivos, cifra
que me dan por buena para el 2026-08-29 y que yo no he vuelto a correr en esta revisión— es
ciego a lo único que este trabajo promete: que
el cuerpo se vea y se mueva. Un cambio que deje el sujeto del revés, o quieto, o con las
caras invertidas, pasa `npm run verify` en verde. Los 52 casos que el salón sí tiene desde
entonces (riesgo 12) no cambian nada de esto: son de estructura del DOM, y el DOM no sabe
si el sujeto está boca abajo.

### Evidencia

- `src/features/entrenar/visor/VisorPatron.test.tsx:7` — lo dice el encabezado del propio
  test: «En jsdom no hay WebGL: `getContext('webgl')` devuelve null».
- `motor.ts:142-144` — con `null`, el constructor lanza `new Error('WebGL no disponible')`.
- `VisorPatron.tsx:206-210` — el `catch` llama a `setError(...)`. **Cada prueba existente del
  visor recorre la rama de error**, nunca la de dibujo. `construir()`, `subir()` y `dibujar()`
  no se ejecutan en ninguna prueba.
- Lo mismo alcanza a lo nuevo: `escena/sala.ts` (473 líneas) y `escena/tripode.ts` (183) no
  tienen prueba, y su salida solo se ve en un lienzo que en pruebas no existe.

### Consecuencia práctica

Los tres modos de fallo típicos de este motor son invisibles al CI y visibles al instante
para el asesorado: una cara con el enrollado al revés desaparece porque `CULL_FACE` está
activo (`motor.ts:164-165`); un búfer que se sube con la longitud equivocada dibuja basura
sin lanzar; y una matriz de hueso mal puesta descoyunta el modelo. Ninguno de los tres cambia
un solo carácter de texto en el DOM.

### Qué lo evitaría

Una comprobación que mire píxeles, aunque sea grosera: contar píxeles no-fondo en un lienzo
real y comparar contra una huella. Mientras no exista, cualquier afirmación de que «el sujeto
se ve bien» viene de un ojo humano, no del CI, y hay que decirlo así.

---

## 14 · Lectura al sol: 8,5 px y 4,40:1 de contraste, en píxeles fijos

**Gravedad: MEDIO**

### Qué pasa

En el gimnasio, con luz cenital fuerte o al lado de un ventanal, los rótulos de las paredes no
se leen. Quien tenga la letra del sistema en grande no gana nada: el texto no crece.

### Evidencia

- `paredes/PanelPared.tsx:95-98` — el rótulo va en `text-[8.5px]` con
  `tracking-[0.16em] text-silver-500`, y el valor en `text-[11.5px] text-silver-100`.
- Contraste calculado con los valores reales del proyecto: `--silver-500-rgb: 111 119 130`
  (= `#6f7782`, `src/styles/tokens.css:268-269`) sobre `--ink-900-rgb: 8 9 10` (`:246`) da
  **4,40:1**. El mínimo de WCAG AA para texto normal es 4,5:1, y 8,5 px no es «texto grande»
  bajo ningún criterio.
- El mismo tamaño se repite en `sinPatron/SalonSinSujeto.tsx:139` (`text-[8.5px]`) y en
  `panel/recuadros/Recuadro.tsx:54` (`text-[11px]`).
- Los tamaños del salón están en `px` literales, sin excepción —`text-[8.5px]`, `[9px]`, `[10px]`,
  `[11.5px]`, `[12.5px]`—, no en `rem`. Un `px` no responde al tamaño de letra por defecto del
  navegador; `text-xs` (0,75 rem), que es lo que usa el resto de la app, sí.

### Corrección del 2026-08-29: el fondo dejó de moverse, y eso quita medio riesgo

Este apartado decía que el fondo **se movía** —rótulos semitransparentes con
`backdrop-blur-[2px]` sobre `bg-ink-900/70`, encima de una escena 3D animada— y que por eso
el contraste fluctuaba fotograma a fotograma, bajando a ~3,8:1 sobre el fondo del estudio
compuesto. **Eso ya no es así.** Hoy la caja es opaca y sin desenfoque:

- `paredes/PanelPared.tsx:82` — `bg-ink-900` liso, sin `/70` y sin `backdrop-blur`. El
  comentario de `:75-81` explica por qué se quitó: la caja se escorza con la órbita, así que
  un `backdrop-filter` obligaba a remuestrear la región en cada fotograma.
- `salon/registro/RegistroSerieSalon.tsx:109` y `:122` — el registro hizo lo mismo:
  `bg-ink-900` opaco en los dos estados.
- Grep de `backdrop-blur` y `backdrop-filter` sobre `src/features/entrenar/salon/`: no queda
  ninguno vivo, solo comentarios que explican la ausencia.

Consecuencia para este riesgo: **el número malo desaparece y el bueno se queda**. Ya no hay
un ~3,8:1 fluctuante; el contraste real es el 4,40:1 fijo sobre `--ink-900`. Sigue por debajo
del 4,5:1 de AA, sigue a 8,5 px y sigue en `px` literales, así que el apartado se mantiene
—pero pierde el agravante del fondo animado y baja de la horquilla «entre 3,8 y 4,4» a un
único valor conocido.

*Sin ver en pantalla*: los ratios son cálculo sobre los tokens del repositorio. Medirlo de
verdad pide un colorímetro sobre el teléfono al sol, o al menos una captura del dispositivo
pasada por un comprobador de contraste: el 4,40:1 sale de dos hexadecimales, no de una
pantalla encendida.

### Qué lo evitaría

Que el tope de 42 caracteres se pague con anchura y no con tamaño de letra, y que los tamaños
salgan en `rem`.

---

## 15 · La primera pared se va bajo la barra de estado

**Gravedad: MEDIO**

### Qué pasa

En un iPhone con isla dinámica, o en un Android con perforación, el primer panel de cada muro
—«Ejercicio» a la izquierda y «Móvil» a la derecha— queda parcial o totalmente debajo del
reloj y la batería.

### Cómo se provoca

Abrir el salón en la PWA instalada en un teléfono con muesca.

### Evidencia

- `index.html:11` — `viewport-fit=cover`: la app pide expresamente pintar bajo las zonas
  seguras.
- `SalonEntrenar.tsx:170` — `fixed inset-0`: la raíz del salón llega hasta `top: 0` real.
- `paredes/PanelPared.tsx:106-109` — la capa de paredes es `absolute inset-x-0 top-0 … pt-2`.
  Ocho píxeles de margen superior contra los ~47 que ocupa la barra de estado en un iPhone
  moderno.
- El proyecto sí resuelve esto abajo: `src/styles/tokens.css:198` define
  `--hueco-nav: max(0.875rem, env(safe-area-inset-bottom))`. No existe el equivalente
  superior, y el salón —que es la primera pantalla `fixed inset-0` a pantalla completa de la
  app— es quien lo necesitaba.
- `SalonEntrenar.tsx:267-270` sí reserva `paddingBottom: 'var(--tope-nav)'` para la barra de
  navegación. Arriba no hay nada equivalente.
- **Y desde el 2026-08-29 no hay nada que lo tape por accidente**: `src/app/layouts.tsx:43`
  mete `/entrenar` en `RUTAS_SIN_CABECERA` y `:78` deja de pintar la `TopBar` ahí. Era la
  decisión correcta —la cabecera se apilaba sobre el salón y le robaba la parte de arriba—,
  pero quita de en medio lo único que separaba la primera pared del reloj del teléfono. Este
  riesgo, que antes competía con la cabecera, ahora está solo: el panel «Ejercicio» empieza
  literalmente a 8 px del borde físico de la pantalla.

*Sin ver en pantalla*: para verlo basta un iPhone con isla dinámica o un Android con
perforación, la PWA instalada (no la pestaña del navegador, que sí pinta la barra de
direcciones) y una captura del borde superior con un ejercicio con paredes encendidas.

### Qué lo evitaría

Un `env(safe-area-inset-top)` en la capa de paredes, del mismo modo que abajo ya hay uno.

---

## 16 · La escalera del eje W: dianas de 28 px a 6 px del borde

**Gravedad: MEDIO**

### Qué pasa

El asesorado intenta pulsar «Hueso» y le sale el gesto de «atrás» del sistema, o no acierta y
cambia a la capa de al lado, o el borde curvo de la pantalla se come el toque.

### Evidencia

- `SalonEntrenar.tsx:227-231` — la columna va en `absolute right-1.5`: **6 px** desde el borde
  derecho de la pantalla, que es la franja del gesto de retroceso en iOS y en la mayoría de
  Android con navegación por gestos.
- `SalonEntrenar.tsx:239` — cada peldaño es `h-7 w-7`: **28 × 28 px**. El mínimo recomendado
  de diana táctil es 44 × 44 (Apple) o 48 × 48 (Android).
- `SalonEntrenar.tsx:228` — `gap-1.5`: 6 px entre dianas de 28. Cinco objetivos en 164 px de
  alto.
- Los peldaños no llevan texto por diseño (`SalonEntrenar.tsx:222-226`), así que fallar el
  toque tampoco enseña qué se pulsó.

*Sin ver en pantalla*: los números salen de las clases de Tailwind (`right-1.5` = 6 px,
`h-7` = 28 px, `gap-1.5` = 6 px), no de un dedo. Para cerrarlo hace falta un teléfono con
navegación por gestos y contar cuántos de veinte intentos de pulsar «Hueso» acaban en
«atrás».

### Qué lo evitaría

Separar la columna del borde y darle a cada peldaño un área táctil de 44 px aunque el círculo
visible siga midiendo 28.

---

## 17 · El gesto vertical hace dos cosas a la vez, y el archivo dice que no

**Gravedad: MEDIO**

### Qué pasa

El asesorado arrastra el dedo hacia arriba para «atravesar» y la cámara **también se
inclina**. Sube al hueso y el sujeto se ha ido girando hacia abajo por el camino. Cuando
vuelve a la piel, la vista ya no es la que tenía.

### Evidencia

- `SalonEntrenar.tsx:132-140` — la cabecera del manejador afirma la ortogonalidad y explica
  que no se llama a `preventDefault` ni a `stopPropagation` «para que el visor siga recibiendo
  su arrastre intacto y siga orbitando».
- `SalonEntrenar.tsx:147-150` — el salón **sí** se retira cuando el gesto es horizontal
  (`if (Math.abs(dx) > Math.abs(dy)) { g.vivo = false; return }`).
- `visor/motor.ts:303-308` — el visor **no** se retira cuando el gesto es vertical:
  ```
  this.azimut    = this.arrastre.az - (e.clientX - this.arrastre.x) * 0.42
  this.elevacion = limitar(this.arrastre.el + (e.clientY - this.arrastre.y) * 0.32, -78, 78)
  ```
  Aplica siempre las dos, sin mirar cuál domina.

O sea: la ortogonalidad está implementada en una dirección de las dos. El comentario de
`huecos.ts:22-24` («orbitar nunca cambia de capa y cambiar de capa nunca mueve la cámara»)
describe la mitad que existe.

### Qué lo evitaría

Que el visor también decida el eje dominante al empezar el arrastre. Cambiar eso toca el
motor, que es lo que el salón se propuso no tocar; el precio de no tocarlo es este.

---

## 18 · El velo del eje W apaga los mandos del propio visor

**Gravedad: MEDIO**

### Qué pasa

Cuanto más «adentro» está el asesorado, menos ve los botones de Pausa, Orbitar y
Ambas/Músculo/Hueso, y el deslizador de fase. En el último peldaño el borde de la pantalla
está en negro casi puro.

### Evidencia

- `SalonEntrenar.tsx:213-220` — el velo es hermano **posterior** del envoltorio del visor
  dentro de `data-hueco="centro"` (`:182-206`), así que se pinta encima de él, y es
  `absolute inset-0`: cubre la pantalla entera, no solo el sujeto.
- `opacity: w * 0.1` sobre `radial-gradient(90% 70% at 50% 45%, transparent 0%, #05060700 40%,
  #050607 100%)`: en `w = 4` el borde llega al 40 % de negro sólido.
- Los mandos del visor (`VisorPatron.tsx:416-467`) viven dentro de ese subárbol y quedan
  debajo del velo. Las paredes, el registro y el panel se pintan después
  (`SalonEntrenar.tsx:256-303`) y sí quedan por encima.

El velo es `pointer-events-none` (`:215`), así que se pueden seguir pulsando. Se ven peor, no
se bloquean.

### Qué lo evitaría

Acotar el velo al sujeto en vez de a la pantalla, o excluir el subárbol de mandos.

---

## 19 · La vista inicial es muda para quien navega con lector de pantalla

**Gravedad: MEDIO**

### Qué pasa

Quien entra con VoiceOver o TalkBack no encuentra encabezado ninguno con el que orientarse: la
pantalla no tiene nombre. Lo primero que anuncia son ocho paneles de pared sin jerarquía,
cinco botones de un grupo llamado «Capa del cuerpo» que no cambian nada perceptible (riesgo 7)
y un botón cuyo nombre accesible es el `aria-label` de apertura del panel
(`PanelInferior.tsx:186`).

### Evidencia

- `SalonEntrenar.tsx:163-305` — en las 142 líneas del `return` no hay ni un `<h1>`, `<h2>`,
  `<main>`, `<header>` ni `role="region"` con nombre. Es la consecuencia directa de la regla
  de la vista inicial (`:44-51`): «quitar del árbol los subárboles `[data-hueco]` tiene que
  dejar el salón sin texto».
- `paredes/PanelPared.tsx:88-91` — los ocho rótulos son `<p>`, no encabezados, y la capa
  entera es `pointer-events-none` (`:101`).
- `SalonEntrenar.tsx:229-230` — el único nombre accesible de la vista inicial es
  `aria-label="Capa del cuerpo"` sobre un `role="group"`.
- No hay `aria-live` en el registro: guardar una serie no anuncia nada
  (`registro/RegistroSerieSalon.tsx:117-178`).

### Qué lo evitaría

Un encabezado accesible que la regla de la vista inicial admita: la regla habla de nodos de
texto visibles, y un `aria-label` sobre la raíz no lo es.

---

## 20 · Las cachés de sala, trípode y laboratorio son globales de módulo

**Gravedad: BAJO**

### Qué pasa

Con dos visores montados a la vez (el del salón y el que abre `SesionPage` para estudiar el
patrón), las cachés se pisan y las dos escenas reconstruyen su geometría en cada fotograma en
vez de reutilizarla. El teléfono se calienta más, y el riesgo 5 empeora.

### Evidencia

- `VisorPatron.tsx:53` (`laboratorioCache`), `:72` (`salaCache`), `:88` (`tripodeCache`) — son
  variables a nivel de módulo, compartidas por cada instancia del componente.
- `VisorPatron.tsx:74-88` — `sala()` cachea por la clave `series|reps|rir`. Dos visores con
  series distintas se invalidan mutuamente en cada llamada.
- `SalonEntrenar.tsx:187-198` monta un visor con `datos`; `SesionPage` monta el suyo. La
  versión anterior de este apartado descargaba el riesgo diciendo que los dos no coinciden
  porque el salón no está enchufado. **Ese consuelo ya no vale**: el salón es `/entrenar`
  (riesgo 12), y `SesionPage` es `/entrenar/sesion/:id`. Son dos rutas distintas, sí, pero
  ahora las dos existen y se navega de una a otra dentro del mismo módulo, así que el
  solapamiento pasa a depender solo de que no haya dos visores vivos a la vez —una
  transición, un `Suspense` que mantenga la anterior montada, un panel que no se desmonte—,
  que es un supuesto mucho más frágil que «nadie lo monta».

### Qué lo evitaría

Que la caché cuelgue de la instancia, no del módulo.

---

## 21 · El `push` con propagación tiene un techo, y la malla se acerca

**Gravedad: BAJO**

### Qué pasa

Si la malla del músculo crece, el visor deja de dibujar de golpe con un
`RangeError: Maximum call stack size exceeded`, que el `catch` de `VisorPatron.tsx:330`
convierte en «No se pudo cargar el modelo 3D» — un mensaje que apunta a la red y no a lo que
pasó.

### Evidencia

- `motor.ts:192-197` — `pos.push(...m.posicion)` y cuatro más iguales: propagan un
  `Float32Array` completo como argumentos de una llamada.
- Medido hoy: la malla de músculos tiene 14.488 vértices, o sea **43.464 argumentos** en una
  sola llamada. El límite práctico de JavaScriptCore (Safari, y por tanto cualquier navegador de iOS) está en
  torno a 65.536 argumentos.
- `VisorPatron.tsx:215` — `new Malla(16384)` reserva para 16.384 vértices: 49.152 argumentos.
  Sigue por debajo, pero el margen es del 25 %, y `musculos.ts` decide cuántas porciones se
  dibujan.

### Qué lo evitaría

Copiar con `set()` sobre un búfer reservado en vez de propagar. Además quitaría la mayor parte
del coste del riesgo 5.

---

## 22 · Sin espacio en el teléfono, la instantánea deja de persistir en silencio

**Gravedad: BAJO**

### Qué pasa

En un móvil con el almacenamiento del navegador lleno, las series registradas siguen viéndose
durante la sesión, pero si el sistema mata la pestaña —cosa habitual en iOS con la app en
segundo plano— al volver a abrir faltan.

### Evidencia

- `mockDb.ts:56-78` — `guardar()` captura la excepción de cuota, marca
  `marcarSinEspacio()`, escribe un `console.error` y **no lanza**. La copia en memoria sigue
  al día; el disco no.
- El dato no se pierde por completo: la cola vive en otra clave y se defiende sola
  (`cola.ts:72-97`, que suelta la instantánea antes que la cola). Por eso esto es BAJO y no
  ALTO.
- Lo que no hay es aviso: `marcarSinEspacio()` deja una marca, pero el salón no la lee en
  ninguna de sus 309 líneas.

### Qué lo evitaría

Que el salón mire esa marca y lo diga. Hay un sitio evidente donde ponerlo —el panel de
abajo—, y hoy no está.

---

## Lo que he mirado y no he encontrado roto

Para que la lista de arriba se pueda pesar:

- **Pérdida de red a mitad de guardar.** Es el escenario mejor defendido de este código. La
  escritura es local y síncrona; la subida va a una cola en `localStorage` que sobrevive a la
  recarga (`cola.ts:64-97`), no gasta reintentos cuando `navigator.onLine` es falso
  (`procesador.ts:76-78`), reintenta al volver la conexión y cada 30 s
  (`procesador.ts:138-141`) y aparta en vez de tirar lo que falla de forma persistente
  (`procesador.ts:79-86`). El asesorado no ve nada raro y el dato queda. El fallo de este
  frente no es la red: es el riesgo 2, que la escritura *local* puede no ocurrir.
- **Recortar a 42 caracteres no pierde texto.** La invariante de `contenidoPared()` se
  sostiene leyendo el código: `paredes/contenidoPared.ts:365-380` baja al panel el texto
  completo siempre que difiera del recortado, y `panel/recuadros/RecuadroEjercicio.tsx:48-60`
  lo pinta sin recortar ni truncar. Los recuadros nacen abiertos
  (`panel/recuadros/Recuadro.tsx:37`) y los que no tienen datos dicen por qué en vez de
  desaparecer (`Recuadro.tsx:95-96`). Esa parte está bien hecha.
- **Cardio y cribado sin patrón.** La decisión se delega entera en el dominio
  (`sinPatron/SalonSinSujeto.tsx:39-42` → `patronDeCategoria()`), no hay una segunda lista de
  términos que se pueda separar del catálogo, y el visor no se monta cuando no hay patrón
  (`SalonEntrenar.tsx:200-206`), así que tampoco se abre un contexto WebGL para nada. Lo que
  falla ahí es el caso de «no hay ejercicio», que es el riesgo 10.
- **Sin microciclo activo.** `RutaPage.tsx:47-54` corta antes con un `EmptyState`, así que el
  salón nunca llega a montarse sin microciclo. Ese frente está cubierto río arriba.
