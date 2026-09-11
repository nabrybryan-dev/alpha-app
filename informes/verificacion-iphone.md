# Verificación del salón de `/entrenar` — los 8 puntos de «terminado»

**Rama:** `salon/entrenar-4d` · **Fecha:** 2026-08-29 · **Capa que firma:** pruebas.

Este informe dice, punto por punto, **qué se ha podido comprobar con una máquina y qué no**.
No hay ningún veredicto sacado de leer el código y suponer que funciona: o hay un test que se
ha visto fallar a propósito, o el punto está marcado **requiere el ojo de Bryan** con el motivo
escrito.

## Con qué se ha medido, y qué no puede medir

Los tests corren en **jsdom**, que no es un navegador:

| Lo que falta en jsdom | Qué deja sin comprobar |
| --- | --- |
| **WebGL** — `getContext('webgl')` devuelve `null` | Nada de lo que el sujeto DIBUJA: capas, inserciones, la ejecución del gesto, el acabado. El `<canvas>` sí existe en el DOM, así que se puede comprobar si el visor **se monta o no**, pero no lo que pinta. |
| **Maquetación** — todo elemento mide 0×0 | «Ocupa la pantalla entera», «nada tapa al sujeto», si una pared se solapa con el cuerpo. Solo se puede leer lo **declarado** (clases, `z-index`), que es más débil. |
| **`element.animate`** | La subida del panel, el velo del eje W, el viaje de las cifras. Ninguna transición se puede cronometrar. |
| **Dedos** | Los umbrales de gesto (**72 px** para el eje W, 40/60 px para el panel) están razonados sobre el tamaño del gesto, no validados con un dedo humano en un teléfono. La prueba que hay que hacer con la mano está escrita más abajo, en «Lo que hay que probar con el dedo». |

Los tests que sostienen este informe:

| Archivo | Tests | Estado |
| --- | --- | --- |
| `pruebas/inventario.test.ts` | 27 | verde |
| `src/features/entrenar/capas/capas.test.ts` | 18 | verde |
| `src/features/entrenar/salon/salon.test.tsx` | 16 | verde (la 15.ª nació roja: era el punto 1, cerrado desde entonces en otra capa; la 16.ª es la mitad «con sujeto» del eje W) |
| `src/features/entrenar/salon/registro/registro.test.tsx` | 11 | verde |
| `src/features/entrenar/salon/sinPatron/sinPatron.test.tsx` | 78 | verde (las 31 nuevas son la mitad «con patrón» del eje W, una por categoría real) |
| `src/features/entrenar/RutaPage.test.tsx` | 5 | verde — entra hoy: una de las cinco medía el mando equivocado |
| `pruebas/cobertura-de-patrones.test.ts` | 11 | verde |
| `src/features/entrenar/capas/mallaDelNivel.test.ts` | 15 | verde — nuevo, el eje W en la malla |
| `src/features/entrenar/salon/ejeW-llega-al-modelo.test.tsx` | 4 | verde — nuevo, la capa del salón llega al visor |
| `src/features/entrenar/salon/ejeW-prop-al-visor.test.tsx` | 4 | verde — nuevo, la prop `w`, mirada por dentro |

---

## 1 · El salón ocupa la pantalla entera sin texto suelto arriba

**Veredicto: NO CUMPLIDO en la parte medible. Hay texto de la cáscara escrito sobre el salón.**

Lo que **sí** se cumple, y está medido:

- `/entrenar` monta el salón (`[data-salon="entrenar"]`), declarado `fixed inset-0`.
- **Dentro del salón, quitando del árbol los subárboles `[data-hueco]`, quedan CERO nodos de
  texto.** Se cuenta recorriendo el DOM con un `TreeWalker`, nodo a nodo, no con
  `textContent`. Comprobado dos veces: con la sesión metabólica del seed (centro sin sujeto) y
  con una sesión de fuerza, que enciende los cuatro huecos a la vez.
- Con el panel bajado, el panel inferior no escribe **ni una letra**: el tirador lleva su
  nombre en `aria-label`, que es un atributo y no un nodo de texto.
- Los cinco peldaños del eje W tampoco llevan letras **los días que se pintan** — que ya no
  son todos: desde el 2026-08-29 la escalera solo existe si hay sujeto en el centro, y la
  sesión que la agenda destaca hoy en el seed es la metabólica. Medido en las dos mitades:
  sin sujeto no hay ni grupo ni un solo `button[aria-pressed]` en el salón; con la sesión de
  fuerza están los cinco, sin una letra. Ver «El eje W dejó de estar siempre» más abajo.

Lo que **no** se cumple:

> La `TopBar` de la cáscara del asesorado se apila **por encima** del salón y escribe encima.

- El salón va a `--z-elevado`, que `src/styles/tokens.css:304` fija en **20**.
- `src/components/ui/TopBar.tsx:46` declara `sticky top-0 **z-40**`, y se monta en
  `src/app/layouts.tsx:56`, fuera del `<main>` donde vive el salón.
- Resultado medido: sobre el salón quedan escritos **«Entrenar»**, las iniciales del avatar
  (**«VC»** con el seed) y el contador de mensajes no leídos (**«1»**).

El test que lo dice es
`salon.test.tsx > … > nada de la cáscara con texto se apila por encima del salón`, y nació
**rojo a propósito**: esta capa no lo arregló, lo reportó.

**Actualización del 2026-08-29 (capa pruebas):** ese test **está verde**. Otra capa cerró el
hallazgo quitando la cabecera en esta ruta — `src/app/layouts.tsx:43` declara
`RUTAS_SIN_CABECERA = ['/entrenar']`—, así que la `TopBar` ya no se monta sobre el salón. Lo de
arriba se conserva porque explica qué se midió y por qué; el veredicto de este punto lo
actualiza la capa que lo lleva.

**Requiere el ojo de Bryan:** que el salón llene de verdad la pantalla en píxeles —incluidas
las barras del sistema de iOS y el área segura de abajo— no se puede medir sin maquetación.
`fixed inset-0` es lo declarado, no lo pintado.

---

## 2 · Se orbita 360° sin que nada tape al sujeto

**Veredicto: REQUIERE EL OJO DE BRYAN.**

No es una excusa: es que las dos mitades de la frase necesitan cosas que jsdom no tiene.

- **«Se orbita»** — el arrastre horizontal lo sirve el propio `<canvas>` del visor, y sin WebGL
  la cámara no existe. Lo único comprobable aquí es que el salón **no le roba el gesto**: el
  manejador del eje W está en el envoltorio, no llama a `preventDefault` ni a
  `stopPropagation`, y se retira en cuanto `|dx| > |dy|`
  (`SalonEntrenar.tsx`, `alMoverDedo`). Eso es lectura de código, no una medida.
- **«Sin que nada tape»** — es una pregunta de píxeles. Lo que se puede decir es lo declarado:
  la capa de paredes va con `pointer-events-none` entera, así que no captura el arrastre; y
  geométricamente los dos muros ocupan **42 % + 42 %** del ancho anclados arriba
  (`PanelPared.tsx`), o sea que en un iPhone de 390 px dejan una banda central de unos **55
  px**. Si el sujeto es más ancho que eso a la altura de los paneles, se solapan. **Falta la
  medida y sólo la da el teléfono:** el ancho en píxeles que ocupa el sujeto a la altura de
  los paneles, leído con el inspector de Safari sobre el dispositivo, en las dos orientaciones.

**Qué mirar con el teléfono en la mano:** girar 360° despacio y comprobar (a) que en ningún
ángulo una pared cae sobre el cuerpo, (b) que el gesto horizontal nunca cambia de capa por
accidente, y (c) que empezar el arrastre en el borde de la pantalla —donde está el pulgar— no
se lo come nada.

---

## 3 · Se ve hueso, músculo, inserción y tejido pasivo, y el sujeto ejecuta excéntrica y concéntrica

**Veredicto: el eje W YA CAMBIA EL MODELO —medido—. El punto sigue REQUIRIENDO EL OJO DE BRYAN
para lo que se ve en pantalla.**

Este veredicto cambia respecto a la versión anterior de este informe, que decía **NO CUMPLIDO
por el eje W**. Lo que decía entonces era esto, y era cierto:

> `SalonEntrenar` no le pasa `w` al `VisorPatron`; solo le pasa `patron` y los números de la
> serie. Y nada de `src/` importa `capas/nivelesAnatomicos.ts` ni `capas/gestoVertical.ts`.

Ya no lo es. Las capas motor e interfaz cerraron el cable y esta capa lo ha medido.

### Lo que ha cambiado, con la medida

- **La prop viaja.** `SalonEntrenar.tsx` monta `<VisorPatron patron={patron} w={w} …>`, y
  `ejeW-prop-al-visor.test.tsx` lo comprueba sustituyendo el visor por un doble que anota lo
  que recibe: la `w` está entre sus props, arranca en 0 y sigue a la escalera escalón a
  escalón.
- **La lista de mallas ya no se decide en el visor.** Sale de `mallasDelSujeto(w, patron)`
  (`capas/mallaDelNivel.ts`), que lee `nivelesAnatomicos.ts`. Los dos módulos de `capas/` que
  antes no importaba nadie los importan ahora el visor y ese módulo nuevo.
- **Y las cinco capas suben al motor cinco escenas distintas.** Esto es lo que faltaba y es lo
  que se ha medido de verdad: no la `w`, no el rótulo, sino los **búferes** —vértices, índices,
  posiciones y colores— que entran en `Motor.subir()`. Ninguna de las diez parejas de niveles
  coincide. Con la sentadilla, en la fase 0,35:

| W | Nivel | Porciones | Lo que sube al motor |
| --- | --- | --- | --- |
| 0 | Piel | 42 | músculo, **10 204** vértices, sin activación (envolvente) |
| 1 | Músculo superficial | 42 | los mismos **10 204** vértices, coloreados por lo que trabaja |
| 2 | Músculo profundo | 28 | músculo, **4 284** vértices **+ los 13 774 del rig** |
| 3 | Tendón y tejido pasivo | 17 | las biarticulares, **2 820** vértices **+ el rig** |
| 4 | Hueso | 0 | solo el rig: **13 774** vértices, ni una porción de músculo |

(42 + 28 = las setenta porciones del catálogo; las 17 del nivel 3 son un subconjunto de esas
setenta, no una lista aparte.)

- **El filtro recorta de verdad.** Ningún nivel dibuja las setenta porciones: el cuerpo entero
  son 14 488 vértices y ninguno de los cuatro niveles con músculo llega ahí. Superficial y
  profundo suman exactamente el cuerpo entero —10 204 + 4 284 = 14 488—, así que el reparto no
  pierde ni repite un solo vértice.
- **El sujeto sigue ejecutando su gesto en las cinco capas**, en lo que una máquina alcanza a
  decir: en cada capa con músculo, dos fases del movimiento dan dos mallas distintas; el número
  de vértices de una capa NO cambia a lo largo del gesto (no aparecen ni desaparecen músculos a
  mitad de la repetición); en el hueso el gesto lo llevan las matrices, que sí cambian entre la
  bajada y la subida; y en la pantalla, atravesar las cinco capas no reinicia el deslizador de
  fase ni cambia de patrón.
- **Entre la piel y el músculo superficial cambia también la geometría, no solo el color** —10
  309 componentes de posición en la sentadilla—. No es un fallo del filtro: `radioDePorcion()`
  multiplica el radio por el tono (`0,86 + a·0,3`), así que la porción que trabaja se dibuja
  más gruesa. Comprobado a propósito: una porción que este patrón NO activa sale **idéntica**
  en las dos capas. La pose es la misma; lo que se mueve es el vientre.

### El guardián de la copia, que la capa motor dejó pedido

`mallaDelNivel.ts` no puede filtrar desde dentro de `construirMusculos()` —vive en
`src/domain/`, de solo lectura en esta rama— así que repite el cuerpo de su bucle: el ensanche
por volumen constante, el tono, la resolución del tubo y el ángulo de fibra, más una copia de
`fibraDe()` porque `musculos.ts` no la exporta. Esa copia se puede separar en silencio.

Queda fijado: `construirMusculosFiltrado(…, null)` no filtra nada y su malla tiene que salir
**idéntica** a la de `construirMusculos()`. Hoy lo es —14 488 vértices, 84 672 índices y los
cinco búferes iguales componente a componente, con cero diferencias—. Comprobado que el
guardián muerde: cambiando el tono de la copia a una constante, el test canta **14 765
componentes de posición** separadas.

### Lo que sigue sin poder decir una máquina, y por qué

Todo lo de arriba es lo que **entra** en `Motor.subir()`. En jsdom no hay WebGL: nada de esto
llega a pintarse, así que **el píxel lo firma un ojo**. Requieren a Bryan, con el teléfono:

1. Que las cinco capas se **distingan** al verlas, y no solo en el búfer.
2. Que la **inserción** se lea y que el **tejido pasivo** se distinga del músculo.
3. Que la **excéntrica y la concéntrica** se vean como dos cosas distintas.
4. **La piel no es piel, y está dicho en el código:** no hay malla de piel: el nivel 0 dibuja la
   envolvente de los veinte músculos superficiales, apagada y de un solo color, así que entre
   porción y porción se verá el hueco. La malla cerrada vive en `malla.ts`, que necesita
   permiso de Bryan.
5. Que el **nivel 3** se entienda: son las diecisiete porciones biarticulares sobre el rig, y
   los topes de `ARTICULACIONES.noPuede` son texto del panel, no geometría — no hay
   constructor de articulaciones en el código.

## 4 · Acabado a nivel de videojuego actual

**Veredicto: REQUIERE EL OJO DE BRYAN. Ningún test puede opinar de esto.**

Es un juicio de calidad visual sobre una escena WebGL, y las tres cosas que lo componen —lo que
se dibuja, cómo se ilumina y cómo se mueve— caen justo en los tres agujeros de jsdom: sin
WebGL, sin maquetación y sin `element.animate`.

Lo único que se puede aportar es una advertencia medida, y no es buena: **hoy el salón no
dibuja ningún sujeto en las pruebas** porque no hay contexto gráfico, así que el «acabado» no
tiene ni una comprobación automática de respaldo. Si esto se degrada en un despliegue, no hay
ningún test que se ponga rojo.

**Qué mirar:** fluidez al orbitar (¿60 fps o tirones?), si el modelo se lee como un cuerpo o
como tubos, si el velo del eje W se siente como profundidad o como un filtro gris pegado
encima, y si las paredes escorzadas se leen como muros o como etiquetas flotando. **Medir los
fps con la pestaña en primer plano**: una pestaña oculta congela el movimiento y da un número
falso que parece bueno.

---

## 5 · Las paredes muestran lo corto del ejercicio

**Veredicto: CUMPLIDO (medido).**

- Con un ejercicio de fuerza real del seed, el salón monta **exactamente 8 paneles**
  (`[data-campo][data-tope]`), uno por campo de `contenidoPared()`.
- **Ninguno se pasa de 42 caracteres.** Contado por puntos de código, no por unidades UTF-16 —
  con acentos y «ñ» en casi todos los textos, contar mal partiría la comprobación justo donde
  importa.
- Lo que no cupo **está íntegro abajo**: se comparan los conjuntos de **huellas** (FNV-1a) de
  lo que `contenidoPared()` mandó al panel contra los `data-huella` del DOM, y son el mismo
  conjunto. Comparar huellas y no prosa es lo que hace que la comprobación signifique algo:
  leer doce párrafos a ojo no dice si falta uno.
- Y el texto pintado es el **completo**, no otro recorte: cada `[data-huella]` contiene su
  texto entero.

**Salvedad importante, y no es menor:** con la sesión que la agenda destaca hoy en el seed de
demo —la metabólica— **las paredes no se montan en absoluto**, porque una sesión metabólica no
tiene `ejercicios`. Es correcto por diseño, pero significa que quien abra `/entrenar` en la app
de demo un día de cardio no verá paredes. Comprobado montando el salón con una sesión de fuerza
del mismo microciclo.

**Requiere el ojo de Bryan:** que 42 caracteres se LEAN de reojo, en escorzo de 14° y con la
cámara moviéndose. El tope está razonado sobre lo que cabe en una línea legible; nadie lo ha
leído todavía a esa distancia.

---

## 6 · Se registra carga, repeticiones y RIR

**Veredicto: CUMPLIDO (medido). Es el punto mejor cubierto del informe.**

- Se teclean los tres valores y un espía sobre **`db.microciclos.registrarSerie`** —la misma
  llamada que hace la sesión— comprueba que recibe **esos tres**:
  `('m-de-prueba', 'e-de-prueba', { orden: 1, cargaKg: 82.5, reps: 9, rir: 1 })`.
- **Los topes son los de siempre:** carga 0-999, reps 1-50, RIR 0-5. Y un valor topado **se
  guarda topado**: teclear 1200 / 77 / 8 escribe 999 / 50 / 5 en la base, no el número de fuera
  de rango.
- **Si el guardado se cae a media operación, el borrador no se pierde.** Con la escritura
  reventando, el borrador sigue en el teléfono con los tres números puestos y **vuelve al
  remontar** — que es lo que de verdad ve el asesorado. Y el caso contrario también está
  cubierto: cuando la escritura sale bien, el borrador se retira, o la serie siguiente
  arrancaría con los números de la anterior.
- La clave del borrador es **la misma que usa la sesión**
  (`alpha-serie-<microciclo>-<ejercicio>-<orden>`): una serie empezada allí aparece a medio
  llenar aquí y al revés.
- **No hay un segundo camino de escritura:** guardar no toca `fetch` ni una sola vez.
- La serie que registra es la **siguiente a las ya hechas**, y con todas hechas no hay botón de
  guardar.

**Requiere el ojo de Bryan:** que los tres mandos se alcancen **con el pulgar** sin girar la
cámara, que es la razón por la que el registro va al suelo y no a una pared. Eso es ergonomía
de una mano y no se mide sin la mano.

---

## 7 · El panel sube y cada recuadro es interactivo, sin perder información

**Veredicto: CUMPLIDO en contenido e interactividad (medido). El GESTO requiere el ojo de Bryan.**

- El panel **sube con un toque** y trae **los doce recuadros**, contados por `data-recuadro`,
  sin ninguno repetido.
- **Cada recuadro tiene un elemento interactivo real:** su título ES un `<button
  aria-expanded>` que pliega y despliega. No es una promesa bloque a bloque; es estructura, así
  que el recuadro trece tampoco podrá quedarse en texto muerto. Comprobado plegando y volviendo
  a desplegar uno.
- **Nacen abiertos.** Si nacieran plegados, abrir el panel enseñaría doce títulos y ninguna
  información — perder el texto de la forma más silenciosa posible.
- **No se perdió información:** `pruebas/inventario-entrenar.ts` enumera **58 datos en 13
  bloques** de la pantalla vieja, y los 13 tienen un sitio escrito en el salón. Once bajan al
  panel, uno es el centro y uno —«sin microciclo activo»— se queda en `RutaPage`, que es donde
  se sabe.
- **Ocho de los doce montan EL MISMO componente** de `ruta/`, no una copia adaptada. Es la
  única forma de poder afirmar que no se perdió un dato *dentro* de un bloque.
- La portada del microciclo es la excepción, y está justificada: baja como **contenido
  permanente** (`RecuadroMicrociclo`) y no como el cartel que se cierra, porque lo que el
  cartel llevaba —número, sesiones, series, grupos, foco, frase— son datos del plan y se verían
  solo el primer día. Usa las mismas funciones de dominio que la portada.

**Requiere el ojo de Bryan:**

- **Que el panel «suba» de verdad.** El seguimiento del dedo va con `translateY` y el estado
  abierto con `max-height: 84dvh`; ninguna de las dos cosas se puede medir sin maquetación.
- **Los umbrales del gesto:** 40 px para abrir, 60 px para cerrar, 6 px para que cuente como
  toque, y **72 px** para cada escalón del eje W. Están razonados sobre el tamaño del gesto y **no
  validados con un dedo humano en un teléfono**. La prueba concreta —con el pulgar, diez veces,
  y con la mano sudada— está más abajo, en «Lo que hay que probar con el dedo».
- **`setPointerCapture`.** No existe en jsdom y el código lo salta con una guarda, así que
  **está sin probar** el caso que de verdad importa: sacar el dedo del tirador a media subida.
  En el navegador, sin captura, el gesto se corta.
- **Que doce recuadros abiertos no sean un muro.** El panel es ahora una columna con scroll
  dentro de una hoja — la misma forma que el salón vino a sustituir. Que se navegue bien es un
  juicio, no una medida.

---

## 8 · Funciona para todos los ejercicios

**Veredicto: CUMPLIDO con un hueco medido, y con dos casos que salen mal.** De las **159
familias de ejercicio que usa el catálogo de producción, 140 reciben sujeto (88,1 %)** y 19
caen al camino sin sujeto. De esas 19, **diez son cardio y está bien**; las otras **nueve son
un hueco real**. Y aparte hay **dos familias que sí reciben sujeto y reciben uno equivocado**,
que es peor que no recibir ninguno.

### Esto se podía contar sin salir del repo, y se ha contado

La regla de «esto tiene modelo / esto no» vive entera en `patronDeCategoria()`
(`src/domain/patrones/catalogo.ts`). El vocabulario de categorías y los nombres de ejercicio
que el coach escribe de verdad están en seis archivos de este repositorio:

| Fuente | Qué aporta |
| --- | --- |
| `src/domain/taxonomia.ts` → `CATEGORIAS` | las 34 categorías canónicas por acción articular |
| `src/domain/patrones/catalogo.ts` → `PATRONES` | la categoría de cada una de las 31 fichas |
| `src/domain/patrones/catalogo.ts` → bloque `ALIAS` | las 23 categorías del vocabulario VIEJO que siguen circulando |
| `auditar-categoria-1y3.sql` → lista `canonicas` | las categorías contra las que se audita la base |
| `src/data/seed/*.ts` y `supabase/migrations/0002_semilla.sql` | ejercicios reales con categoría **y** nombre |
| `supabase/migrations/0038_taxonomia_final.sql` → `tmp_categoria_final` | **el censo**: el clasificador que se corrió SOBRE la base de producción, rama a rama |

El último es el que convierte esto en una medida y no en un ensayo con el seed. Esa función SQL
no se escribió de memoria: se escribió mirando los ejercicios de la base —su propia cabecera
dice que cada excepción «costó un ejercicio mal clasificado en un ensayo en seco»—, así que sus
ramas **son** las familias de nombre que la operación usa, cada una con la categoría en la que
acabó. Reconstruirlas es lo más cerca de producción que se puede estar sin abrir la base.

El barrido vive en `pruebas/cobertura-de-patrones.ts` y lo recorre
`pruebas/cobertura-de-patrones.test.ts` (11 pruebas, las once vistas en rojo antes de darlas por
buenas). Salida real, de la corrida de hoy:

```
CATEGORÍAS: 62 · con patrón 54 (87.1 %) · sin sujeto 8
  sin sujeto: ROTACIÓN DE CADERA | FLEXIÓN DE HOMBRO | FLEXIÓN DE MUÑECA | EXTENSIÓN DE MUÑECA | EXTENSIÓN LUMBAR | PREV/REHAB | ACONDICIONAMIENTO | AISLAMIENTO
EJERCICIOS DEL SEED: 27 · con patrón 19 (70.4 %) · sin sujeto 8
  sin sujeto: AISLAMIENTO · Curl femoral sentado | AISLAMIENTO · Abducción de cadera en máquina | AISLAMIENTO · Elevaciones laterales con mancuernas | AISLAMIENTO · Curl femoral tumbado | AISLAMIENTO · Patada de glúteo en polea | AISLAMIENTO · Curl de bíceps en banco inclinado | AISLAMIENTO · Extensión de tríceps en polea con cuerda | AISLAMIENTO · Elevación lateral en polea
FAMILIAS DE NOMBRE DE PRODUCCIÓN: 159 · con patrón 140 (88.1 %) · sin sujeto 19
  sin sujeto: ACONDICIONAMIENTO · CARDIO | ACONDICIONAMIENTO · BICICLETA | ACONDICIONAMIENTO · CINTA | ACONDICIONAMIENTO · ESCALADORA | ACONDICIONAMIENTO · ELIPTICA | ACONDICIONAMIENTO · HIIT | ACONDICIONAMIENTO · CIRCUITO | ACONDICIONAMIENTO · TABATA | ACONDICIONAMIENTO · ERGOMETRO | ACONDICIONAMIENTO · SWING | PREV/REHAB · ROTADOR | PREV/REHAB · ISOMETRIA DE SOSTEN | PREV/REHAB · APOYO ESTABLE | PREV/REHAB · ARCO PLANTAR | PREV/REHAB · TIBIAL POSTERIOR | PREV/REHAB · PLIOMETRIA | EXTENSIÓN LUMBAR · BANCO ROMANO | EXTENSIÓN LUMBAR · EXTENSION LUMBAR | ROTACIÓN DE CADERA · 90/90
DESCARTADAS (no son nombre literal): 21 → GATO.?CAMELLO | BIRD.?DOG | SIT.?UP | (PLATI|PLANTI).?FLEXION | ELEVACION(ES)? LATERAL | ELEVACION(ES)? FRONTAL | ROTACION (EXTERNA|INTERNA) DE CADERA | EXTENSION (DE )?CADERA | PULL.?THROUGH | FLEXION (DE )?RODILLA | EXTENSION (DE )?CODO | STEP.?UP | STEP.?DOWN | BRAZO (RIGIDO|RECTO) | ELEVACIONES? Y | APERTURAS? INVERSAS? | PULL.?UP | CHIN.?UP | CRUCE (DE POLEAS|EN POLEA) | PRESS (DE )?BANCA | PRESS (BANCO )?PLANO
  de ellas, en categoría que no resuelve sola: 2 → FLEXIÓN DE HOMBRO · ELEVACION(ES)? FRONTAL | ROTACIÓN DE CADERA · ROTACION (EXTERNA|INTERNA) DE CADERA
```

Las 21 «descartadas» son alternativas del clasificador que llevan metacaracteres de expresión
regular y no se pueden leer como un nombre: inventarles una grafía metería en el barrido
nombres que nadie ha escrito. Se apartan y se cuentan aparte, y **sólo dos** caen en una
categoría que no resuelve ella sola, así que el reparto no depende de esa decisión.

### Los tres recuentos

| Barrido | Casos | Con sujeto | Sin sujeto |
| --- | --- | --- | --- |
| Categorías que el repo sabe nombrar (canónicas + alias viejos + las del seed) | **62** | 54 (87,1 %) | 8 |
| Ejercicios del seed de demo, con categoría **y** nombre | **27** | 19 (70,4 %) | 8 |
| Familias de nombre del catálogo de producción (censo de la 0038) | **159** | 140 (88,1 %) | 19 |

### Quiénes se quedan fuera, con nombre y apellido

**1 · Cardio: diez familias, y está bien.** `CARDIO`, `BICICLETA`, `CINTA`, `ESCALADORA`,
`ELIPTICA`, `HIIT`, `CIRCUITO`, `TABATA`, `ERGOMETRO` y `SWING`. Una bicicleta en zona 2 no
tiene gesto resistido que enseñar, y el centro lo dice en vez de inventarlo. La única discutible
es `SWING`: un swing de kettlebell es una bisagra de cadera con nombre de acondicionamiento, y
en el salón se va a quedar sin sujeto.

**2 · Prevención: seis familias de `PREV/REHAB`, y aquí sí falta cobertura.** `ROTADOR`,
`ISOMETRIA DE SOSTEN`, `APOYO ESTABLE`, `ARCO PLANTAR`, `TIBIAL POSTERIOR` y `PLIOMETRIA`.
Dos de las seis se salvan si el nombre viene entero —«manguito rotador…» engancha por
`manguito`, y «apoyo estable a una pierna» está escrito así en la lista por nombre—, pero
**a cuatro no las alcanza ningún término**: el arco plantar, el tibial posterior, la isometría
de sostén y, llamativamente, la palabra `pliometría`, que no está en la lista aunque `salto` y
`reactiv` sí lo estén.

**3 · Categorías canónicas sin ficha: tres familias.** `EXTENSIÓN LUMBAR · BANCO ROMANO`,
`EXTENSIÓN LUMBAR · EXTENSION LUMBAR` y `ROTACIÓN DE CADERA · 90/90`.

### Cinco categorías del vocabulario cerrado no tienen modelo

De las **34** categorías canónicas de `taxonomia.ts`, siete no resuelven por categoría. Dos son
de propósito y ahí decide el nombre a propósito (`PREV/REHAB` y `ACONDICIONAMIENTO`). Las otras
**cinco nombran una acción articular y no tienen ficha en `PATRONES`**:

`ROTACIÓN DE CADERA` · `FLEXIÓN DE HOMBRO` · `FLEXIÓN DE MUÑECA` · `EXTENSIÓN DE MUÑECA` ·
`EXTENSIÓN LUMBAR`

Las dos de muñeca no aparecen **ni una vez** en el clasificador de producción, así que su hueco
es teórico. Las otras tres sí aparecen: son las de los tres casos del punto anterior.

### Y dos sitios donde el sujeto que sale es el de otro ejercicio

Esto no es «falta un modelo», que se ve venir porque el centro pone el aviso. Es un modelo
**equivocado**, que se ve como si fuera el correcto:

- **`ROTACIÓN DE CADERA` enseña el manguito rotador del HOMBRO.** La categoría no tiene ficha,
  así que la decisión se cae a la búsqueda por nombre, y allí `rotación externa` está escrito
  para el hombro. Un «rotación externa de cadera sentado» —familia que la 0038 escribe como
  `ROTACION (EXTERNA|INTERNA) DE CADERA`— recibe `rotacion_externa_hombro`. Medido en
  `pruebas/cobertura-de-patrones.test.ts`, prueba «una rotación externa de CADERA enseña el
  manguito del HOMBRO».
- **Un empuje de trineo sale saltando.** La 0038 clasifica `TRINEO` como `ACONDICIONAMIENTO`, y
  la lista por nombre lleva `trineo` al patrón `salto` porque comparte lista con el trabajo
  reactivo.

Las dos se arreglan en `src/domain/patrones/catalogo.ts`, que **esta capa no toca**: quedan
medidas y escritas como prueba para que el arreglo tenga por dónde empezar y para que no se
pierdan.

### El seed y el vocabulario viejo

De los **27** ejercicios del seed de demo, **19 reciben sujeto y 8 no, y los 8 son de
`AISLAMIENTO`** —curls femorales, elevaciones laterales, patada de glúteo, tríceps en polea—.
`AISLAMIENTO` no está entre las 34 canónicas: es vocabulario anterior a la consolidación de
categorías, y por eso no tiene ficha ni la va a tener. Un microciclo viejo que lo siga usando
verá el aviso en todos esos ejercicios, y el arreglo de raíz es recategorizar en la base, no
añadir un alias más.

Sigue en pie, y medido, lo que ya decía este punto: para las **31 fichas** con su categoría real
el salón monta el visor y no el aviso; para los 8 sin patrón monta `SalonSinSujeto` y **no hay
`<canvas>` en el árbol**; con la sesión metabólica el salón no se cae; y
`tienePatronDeMovimiento()` **no es una segunda regla** — ahora comprobado no sobre 31 casos
sino sobre las **159 familias del censo**, sin una sola discrepancia.

### La medida que falta, y cómo se consigue

El barrido pesa **una vez cada ejercicio distinto**. En la app pesan las veces que se prescribe:
si una familia sin sujeto fuera la mitad de las prescripciones, el asesorado vería el aviso la
mitad del tiempo aunque el porcentaje de aquí siguiera siendo 88 %. Esa ponderación necesita
leer la base, y es una sola consulta de lectura:

```sql
-- Cuánto pesa de verdad cada categoría en lo que la gente tiene HOY delante.
-- Solo lee. Su resultado se cruza con las cinco categorías sin ficha y con AISLAMIENTO.
with prescritos as (
  select e ->> 'categoria' as categoria, e ->> 'nombre' as nombre
    from public.microciclos m,
         jsonb_array_elements(m.datos -> 'sesiones') s,
         jsonb_array_elements(coalesce(s -> 'ejercicios', '[]'::jsonb)) e
   where m.estado = 'activo'
)
select categoria,
       count(*)                                          as prescripciones,
       count(distinct nombre)                            as ejercicios_distintos,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
  from prescritos
 group by categoria
 order by prescripciones desc;
```

Con esa tabla al lado, el reparto de arriba pasa de «cuántos ejercicios» a «cuánto tiempo», que
es lo que decide si el salón enseña más el aviso que al sujeto. Es lo único de este punto que no
cabe dentro del repo.

---

## El eje W dejó de estar siempre (2026-08-29, capa pruebas)

**Este apartado deroga lo que este informe daba por hecho: que la escalera del eje W se pinta
en `/entrenar` pase lo que pase.** Ya no.

### Qué pasó

Bryan abrió `/entrenar` en el iPhone. Le tocó un día de cardio, así que el centro no tenía
sujeto —una sesión metabólica no trae `ejercicios` y el catálogo deja el cardio fuera de los
patrones—, y aun así vio a la derecha los cinco peldaños encendidos. Atravesar la nada. La capa
de interfaz lo cerró con una condición sola en `salon/SalonEntrenar.tsx:155`:

```ts
const conEjeW = conSujeto && !!patron
```

De ella cuelgan las cuatro salidas del eje, no solo la escalera: el velo, los peldaños, los
manejadores del gesto vertical (`onPointerDown/Move/Up/Cancel` del hueco `centro`) y la prop
`w` que viaja al visor. `data-w` se queda puesto en las dos ramas, porque es la capa en la que
**está** el salón —la piel, el escalón 0—, no un mando.

### Qué defendían mis tests, y qué defienden ahora

Dos de esta capa protegían la regla vieja, y uno de ellos la tenía escrita en su propio
comentario: *«la escalera del eje W también: cambiar de capa no depende de que haya modelo»*.
Esa frase es exactamente la que deroga lo que Bryan vio. Los dos se han reescrito, y **cada
mitad de la regla tiene su test**, porque uno que solo dijera «no está» se quedaría verde el
día que la escalera desapareciera para siempre:

| Mitad | Dónde | Qué exige |
| --- | --- | --- |
| **SIN sujeto no hay eje** | `salon.test.tsx` → «sin sujeto en el centro no hay eje W» (por la ruta, con el seed de demo) | el hueco `sinPatron` está y no hay `canvas`; no hay grupo `Capa del cuerpo`; **cero** `button[aria-pressed]` en todo el salón; `data-w` sigue en `'0'` |
| **SIN sujeto no hay eje** | `sinPatron.test.tsx` → «y el resto del salón sigue en pie, pero el eje W se apaga con el sujeto» (con la sesión metabólica del seed) | el salón y su `panelInferior` siguen en pie; ni grupo ni peldaño suelto; `data-w` en `'0'` |
| **CON sujeto el eje está entero** | `salon.test.tsx` → «con sujeto, el eje W tiene sus cinco peldaños» (sesión de fuerza) | hay `canvas`; cinco peldaños, cada uno con `aria-label`, ninguno con texto, exactamente uno `aria-pressed="true"` |
| **CON sujeto el eje está entero** | `sinPatron.test.tsx` → «y con la categoría real «%s» la escalera vuelve entera» (×31) | sobre las **31 categorías reales de `PATRONES`**, no una lista copiada: hay visor y hay cinco peldaños |

La segunda mitad no es un adorno. Con solo la primera, el arreglo de interfaz podría pasarse de
frenada y apagar el eje también con sujeto sin que nada se pusiera rojo.

### Y el tercer rojo: `RutaPage.test.tsx` no era un fallo de la app

El tercero que se cayó fue «deja cambiar el día seleccionado», con `Unable to find
role="button"`. **No es un fallo de la capa interfaz: el mando funciona.** Averiguado mirando
el DOM que monta ese test, no leyendo el código:

| Con el panel… | Botones en el documento | Con `aria-pressed` |
| --- | --- | --- |
| **cerrado** | 1 — el tirador | 0. Y `[data-recuadro]`: **0** |
| **abierto** | el calendario trae 8 (el título + 7 días) | 7: seis `false` y uno `true` (Sáb 29) |

Y al clicar uno de los seis sin marcar: queda `aria-pressed="true"` y sigue habiendo **uno
solo** marcado. Cambiar de día funciona.

Lo que se rompió fue el test, y llevaba roto de antes sin que se notara: buscaba los días **a
ciegas por todo el documento y con el panel cerrado**, donde no hay ni un día montado. Lo que
encontraba y clicaba eran los peldaños del eje W —los únicos botones con `aria-pressed` que
había entonces sobre el salón—, así que pasaba en verde midiendo **otro mando**. Al apagarse la
escalera se quedó sin nada que encontrar y salió el rojo. Arreglado abriendo el panel y
clicando **dentro** del recuadro `calendario`; ninguna línea de producción tocada.

Es el mismo patrón que este informe ya tiene fichado dos veces: el guardián que pasa por la
razón equivocada. Aquí no pasaba en vacío — pasaba sobre el control de al lado.

### Lo que sigue sin poder decir una máquina

Que **sin escalera la pantalla de cardio se lea mejor**. jsdom dice que los peldaños no están
en el árbol; que el centro de un día de cardio ya no tenga un mando muerto colgando a la
derecha lo firma el ojo de Bryan, en el mismo iPhone donde lo vio.

---

## Resumen

| # | Punto | Veredicto |
| --- | --- | --- |
| 1 | Pantalla entera sin texto suelto arriba | **NO CUMPLIDO** — la `TopBar` (z-40) escribe sobre el salón (z-20). Lo demás, verde. |
| 2 | Orbitar 360° sin que nada tape | **Requiere el ojo de Bryan** — sin WebGL ni maquetación |
| 3 | Hueso, músculo, inserción, tejido pasivo, excéntrica y concéntrica | **El eje W YA CAMBIA EL MODELO** — medido: las 5 capas suben cinco escenas distintas al motor y ninguna dibuja el cuerpo entero. Lo que se VE, requiere el ojo de Bryan (y la capa 0 no es piel) |
| 4 | Acabado de videojuego actual | **Requiere el ojo de Bryan** — ningún test puede opinar |
| 5 | Las paredes muestran lo corto | **CUMPLIDO** — 8 paneles, tope 42 respetado, lo largo íntegro abajo con huella |
| 6 | Se registra carga, reps y RIR | **CUMPLIDO** — los tres valores, los tres topes, y el borrador sobrevive al fallo |
| 7 | El panel sube, recuadros interactivos, sin perder información | **CUMPLIDO** en contenido; el **gesto**, requiere el ojo de Bryan |
| 8 | Funciona para todos los ejercicios | **CUMPLIDO con hueco medido** — 140 de 159 familias del catálogo real reciben sujeto (88,1 %); de las 19 restantes, 10 son cardio y 9 son hueco. Y **2 familias reciben el sujeto equivocado** |

> **Nota del cierre (2026-08-29, capa pruebas).** La corrida completa de hoy está **en verde**,
> incluidos el rojo del punto 1 y los seis ajenos que esta capa reportó: se cerraron en otras
> capas y la evidencia está más abajo. Los veredictos 1 y 3 los firma la capa que los lleva;
> aquí queda la medida.
>
> **Segunda nota, del mismo día, después de que motor e interfaz conectaran el eje W.** El
> punto 3 era **NO CUMPLIDO** y ya no lo es: se ha medido que las cinco capas mandan cinco
> escenas distintas al motor y que la `w` del salón llega al visor. Lo que sigue sin firmar una
> máquina es el píxel, y eso está dicho dentro del punto sin adornos: hay cinco cosas que solo
> puede ver un ojo, y una de ellas es que **la capa 0 no es piel** — es la envolvente de los
> músculos superficiales, con hueco entre porción y porción.
>
> **Tercera nota, del mismo día, después de lo que Bryan vio en el iPhone.** El eje W **ya no
> está siempre**: sin sujeto en el centro no se pintan ni la escalera ni el velo, y el gesto
> vertical ni se escucha. Este informe daba por hecho lo contrario en el punto 1 y dos tests
> míos defendían la regla vieja; están reescritos con las **dos** mitades comprobadas. El
> apartado «El eje W dejó de estar siempre» lo cuenta entero, incluido el tercer rojo, que
> resultó no ser un fallo de la app sino un test que medía el mando de al lado.
>
> Corrida completa tras el cambio: **239 archivos, 3.048 pruebas, 0 rojos** (eran 3.016 con 3
> rojas; las 32 nuevas son las dos mitades de la regla).

## Lo que hay que probar con el dedo, y ningún test puede

Tres números deciden el gesto del salón, y los tres están **razonados sobre el tamaño del
gesto, no validados con un dedo humano sobre un teléfono**. Esto es un hecho, no una tarea
pendiente: el código funciona con ellos, y lo que falta es saber si el dedo de una persona
real cae dentro o fuera.

| Umbral | Dónde | Qué decide |
| --- | --- | --- |
| **72 px** | `capas/gestoVertical.ts` (`UMBRAL_DE_CAPA`) | cuánto hay que arrastrar en vertical para bajar un escalón del eje W |
| **40 px** | `salon/panel/PanelInferior.tsx:92` (`UMBRAL_ABRIR`) | cuánto hay que subir el tirador para que el panel suba |
| **60 px** | `salon/panel/PanelInferior.tsx:94` (`UMBRAL_CERRAR`) | cuánto hay que bajarlo para que se vuelva a guardar |

(El cuarto, `TOQUE = 6`, separa el toque del arrastre y es el que decide que un dedo tembloroso
no cuente como gesto.)

Ninguno de los tres es medible aquí: jsdom no tiene maquetación, `element.animate` no existe y
un `PointerEvent` sintético no tiene ni presión ni deriva. **Y no se aprueban mirando la
pantalla: se aprueban con la mano.**

**La prueba que tiene que hacer Bryan, con el teléfono y sin mirar el código:**

1. **Con el pulgar de la mano que sujeta**, no con el índice de la otra: es como se usa la app
   en el gimnasio. De pie, con el móvil en una mano.
2. **Eje W** —y ahora hace falta un día **con sujeto**: en un día de cardio el eje no existe,
   ni escalera ni gesto, y arrastrar en vertical no tiene que hacer nada. Con el sujeto
   delante: arrastrar en vertical **una sola vez** intentando bajar **un** escalón. ¿Baja uno,
   o se saltan dos? Repetirlo diez veces y contar cuántas veces sale el escalón que se quería.
   Si se pasa, 72 px es poco; si cuesta, es mucho. **Y ahora hay algo más que mirar:** con el
   escalón cambia el cuerpo, así que la pregunta ya no es solo si baja un peldaño sino si lo
   que aparece es otra capa —el psoas en la 2, el rig desnudo en la 4— y si el sujeto sigue
   haciendo la repetición mientras se atraviesa. Eso es el punto 3, y solo lo firma un ojo.
   (El umbral se movió de 46 a 72 px y cambió de casa: vive en `capas/gestoVertical.ts`, ya no
   en el salón. La cifra vieja de este informe apuntaba a una línea que ya no existe.)
3. **Panel.** Subirlo y bajarlo diez veces seguidas. Fijarse en si alguna vez **se abre sin
   querer** al mover el pulgar por la parte baja de la pantalla (40 px es poco) o si hay que
   arrastrar dos veces (40 px es mucho); y lo mismo al cerrar con los 60.
4. **El caso que ningún test alcanza:** empezar a subir el panel y **sacar el dedo del tirador**
   a media subida, hacia el lado. En jsdom `setPointerCapture` no existe y el código lo salta
   con una guarda, así que ese camino **está sin recorrer**: en el navegador, sin captura, el
   gesto se corta a mitad.
5. **Con la mano sudada**, que es la condición real de una serie. El dedo resbala y el arrastre
   sale más largo y más torcido que en el sofá.

El resultado de esa prueba son tres números nuevos o la confirmación de estos tres. Hasta que
exista, los umbrales son una hipótesis razonable, y así están escritos.

## Lo que la corrida completa destapa, y que no es de esta capa

Salida real de `npx vitest run` sobre el repo entero, medida al cerrar esta tanda:

```
 Test Files  239 passed (239)
      Tests  3016 passed (3016)
```

Medido dos veces para poder atribuir la diferencia: **sin** los tres archivos de esta tanda la
corrida da `236 passed (236)` y `2993 passed (2993)`, así que las 23 pruebas nuevas son
exactamente las tres que se añaden aquí. (El encargo hablaba de 235 archivos y 2 982 tests; ese
número ya no era el del árbol antes de tocar nada — otra sesión había dejado un archivo más.)

Y `npx tsc -b` sale limpio: **0 errores**. `npx eslint` sobre los tres archivos nuevos: **0
avisos**, así que el delta del linter es cero.

Cuando esta sección se escribió había **7 rojos**: uno de esta capa y a propósito (la `TopBar`
del punto 1) y seis de otras. **Hoy no queda ninguno.** Se conservan abajo, con lo que cada uno
destapaba y con la evidencia de cómo se cerró, porque el motivo por el que existieron sigue
valiendo aunque el rojo ya no esté.

**El del punto 1, cerrado:** `src/app/layouts.tsx:43` declara ahora
`RUTAS_SIN_CABECERA = ['/entrenar']`, así que la cáscara no monta la `TopBar` sobre el salón. La
prueba que lo denunciaba —`salon.test.tsx` › «nada de la cáscara con texto se apila por encima
del salón»— sigue en su sitio y pasa.

### 1. Cuatro tests de `RutaPage.test.tsx` se quedaron hablando de la pantalla vieja

`src/features/entrenar/RutaPage.test.tsx` — los cuatro que buscan «Nivel 03 · RENDIMIENTO»,
«Bloque en curso», los siete botones de día y «Para subir a nivel 04» en la vista macro. Ya no
están sueltos en la página: bajaron al panel inferior y solo aparecen con el panel abierto.
Tres de los cuatro tardan **10 s** en fallar, que es el `asyncUtilTimeout` agotándose. No es un
fallo del salón: es el test de la maqueta anterior, que hay que reescribir contra el salón o
retirar en favor de `salon.test.tsx`.

**Cerrado:** el archivo se reescribió contra el salón; hoy tiene 5 pruebas y todas pasan.

### 2. Un guardián de color en rojo

`src/styles/opacidad-de-color.test.ts` →
`src/features/entrenar/salon/panel/PanelInferior.tsx:195` usa `bg-silver-500/60`, y
`silver-500` **no está declarado con `<alpha-value>`** en `tailwind.config.js`. El mensaje del
guardián es literal: «Estas clases NO generan ninguna regla CSS y dejan el elemento sin color».
O sea que **el tirador del panel puede quedarse sin color de verdad**, y es la única manija
visible del gesto.

**Cerrado:** `tailwind.config.js:37` declara `'silver-500': 'rgb(var(--silver-500-rgb) /
<alpha-value>)'`, y el guardián pasa.

### 3. Un guardián de desenfoque en rojo

`src/test/blur-solo-en-superficies-fijas.test.ts` → usan `backdrop-blur` suelto:

- `src/features/entrenar/salon/panel/PanelInferior.tsx:172`
- `src/features/entrenar/salon/paredes/PanelPared.tsx:75`
- `src/features/entrenar/salon/registro/RegistroSerieSalon.tsx:109` y `:120`

La regla del repo dice: si la superficie es fija, usar `.glass-blur`; si scrollea, no lleva
desenfoque; y si es una excepción, apuntarla en `BLUR_PERMITIDO` con su motivo. El panel
inferior **scrollea por dentro cuando está abierto**, así que ahí la regla apunta a algo real y
no a un tecnicismo.

**Cerrado:** no queda ningún `backdrop-blur` suelto en los `.tsx` del salón, y `BLUR_PERMITIDO`
sigue vacío — o sea que se arregló quitándolo, no metiéndolo en la lista de excepciones.

## Otras dos cosas que conviene mirar, sin test que las señale

**El umbral del eje W estaba escrito dos veces, con dos números distintos — CERRADO.** Decía
este informe que `gestoVertical.ts` declaraba `UMBRAL_DE_CAPA = 72` mientras `SalonEntrenar.tsx`
hacía la cuenta a mano con un `UMBRAL_W = 46` propio. Ya no: `grep -rn "UMBRAL_W\|acotarW" src/`
no devuelve **nada**, y el salón importa `capaTrasArrastre` y no compara contra ningún número
del eje. Lo cerró la capa interfaz, que además encontró una segunda aritmética duplicada que
este informe no había visto: `acotarW` medía el tope contra `CAPAS_W.length - 1` en vez de
contra el eje.

**Los dos módulos de `capas/` no los importaba nadie — CERRADO.** El mismo `grep`, hoy:
`SalonEntrenar.tsx:14` importa `capaTrasArrastre` de `gestoVertical`, y `VisorPatron.tsx:32-33`
importan `NIVEL_POR_W` de `nivelesAnatomicos` y `mallasDelSujeto` / `construirMusculosDeNivel`
del módulo nuevo `mallaDelNivel.ts`. De contrato escrito a pintura en pantalla.

**Y queda una cabecera que desmiente al código, que esta capa no puede tocar.**
`capas/nivelesAnatomicos.ts` sigue diciendo en su cabecera: «Falta un escalón para que la
distinción superficial/profundo se VEA: `construirMusculos()` dibuja siempre las setenta
porciones y no admite filtro, así que hoy los niveles 0 a 3 mandan las mismas setenta y el
reparto de veinte y diecisiete todavía no recorta nada». Eso **ya no es cierto** —lo recorta
`mallaDelNivel.ts`, y está medido arriba: 42, 42, 28, 17 y 0 porciones—. Es código de
producción y esta capa solo escribe tests e informes, así que queda apuntado con su sitio para
quien lleve `capas/`: la regla de la casa dice que un comentario que dice «esto todavía no se
hace» cuando ya se hace desmiente al siguiente que lo lea.

**Detalles menores, sin acción urgente:**

- `npx eslint` sobre lo nuevo deja **1 aviso nuevo**:
  `SalonSinSujeto.tsx:39` exporta un componente **y** una función
  (`react-refresh/only-export-components`). La regla de la casa es «delta, no presupuesto»: el
  repo tenía 5 avisos y ahora tiene 6.
- **La carpeta `pruebas/` no la typechequea `npm run typecheck`**: `tsconfig.app.json` declara
  `"include": ["src"]`. Sus dos archivos se han comprobado a mano con un `tsc --noEmit` suelto y
  salen limpios, pero mientras la carpeta esté fuera del `include`, un error de tipos ahí no
  bloqueará el `verify`.

## Cómo se ha comprobado que estos tests sirven

Ninguno cuenta como entregado sin haberlo visto **fallar a propósito**. Las **152 pruebas** de
esta capa se han visto en rojo, se corrieron así y se restauró todo. Un test que nunca se ha
visto rojo no prueba nada: en este repo tres de cada cinco guardianes nacen pasando en vacío.

Las 129 primeras se rompieron **cambiando el valor esperado**, nunca el código de producción.
Las **23 del eje W** se rompieron al revés y está dicho a propósito: se rompió **el código**
—quitar `w={w}`, hacer que el filtro no filtre, cachear la malla por capa—, porque un test que
solo se ha visto fallar cambiándole el número esperado demuestra que la aserción está viva,
pero no que apunte al fallo que dice cazar. Los tres archivos tocados se restauraron desde una
copia y se comprobaron **byte a byte** con `cmp`: idénticos.

### `pruebas/inventario.test.ts` (27)

| Qué se rompió | Error que dio |
| --- | --- |
| `'Escala Alfa'` → `'recuadro:escala-alfa-inventada'` | `expected '…' to contain 'clave="escala-alfa-inventada"'` (y también rojo el de los doce recuadros) |
| `toBeGreaterThan(40)` → `400` | `expected 58 to be greater than 400` |
| `fuente(entrada.origen)` → `origen + '.inventado'` | `expected [Function] not to throw an error but 'ENOENT…' was thrown` |
| clave del mapa `'Escala Alfa'` → `'Escala Alfa X'` | `expected [ 'Escala Alfa' ] to deeply equal []` |
| `datosDe(bloque).length` → `toBeGreaterThan(99)` | `expected 1 to be greater than 99` |
| `'../../ruta/CabeceraNivel'` → `'…CabeceraNivelInventada'` | `expected '…' to contain "import { CabeceraNivel } from '../../ruta/CabeceraNivelInventada'"` |
| `'<RecuadroMicrociclo'` → `'<RecuadroInventado'` | `expected '…' to contain '<RecuadroInventado'` |

**Rojo genuino durante el desarrollo:** `expect(PANEL_INFERIOR).not.toContain('PortadaMicrociclo')`
falló porque el nombre aparece en la **tabla de la cabecera** del archivo, que documenta de
dónde viene cada recuadro. El test estaba mal, no el código: se corrigió a buscar el `import` y
la etiqueta JSX.

### `src/features/entrenar/capas/capas.test.ts` (18)

| Qué se rompió | Error que dio |
| --- | --- |
| `hueso.w` esperado `4` → `3` | `expected 4 to be 3` |
| `toHaveLength(5)` → `6` en los niveles | `expected [ …(5) ] to have a length of 6 but got 5` |
| `estructurasDe(w).length` → `toBeGreaterThan(9999)` | `expected 20 to be greater than 9999` |
| `NIVEL_POR_W[w]).toBe(nivel)` → `.not.toBe` | `expected { w: 0, … } not to be { w: 0, … }` |
| ids de `CAPAS_W` → `['x']` | `expected [ 'piel', …(4) ] to deeply equal [ 'x' ]` |
| `musculosSinNivel()` → esperando `fuera: ['inventado']` | `expected { fuera: [], repetidos: [] } to deeply equal { fuera: [ 'inventado' ], … }` |
| `estructurasDesconocidas()` → esperando `['inventado']` | `expected [] to deeply equal [ 'inventado' ]` |
| `musculoVisibleEn(1,'gluteo_mayor')` `true` → `false` | `expected true to be false` |
| porciones biarticulares + `'inventada'` | `expected [ …(17) ] to deeply equal [ …(18) ]` |
| `capaTrasArrastre(-UMBRAL, 0)` `1` → `2` | `expected 1 to be 2` |
| arrastre corto `1` → `2` | `expected 1 to be 2` |
| arrastre largo `-600` desde 0: `1` → `4` | `expected 1 to be 4` |
| tope 0: `CAPA_MINIMA` → `1` | `expected 0 to be 1` |
| tope 4: `CAPA_MAXIMA` → `1` | `expected 4 to be 1` |
| recorrido `[0,1,2,3,4]` → `[0,1,2,3,3]` | `expected [ 0, 1, 2, 3, 4 ] to deeply equal [ 0, 1, 2, 3, 3 ]` |
| `capaTrasArrastre(NaN, 2)` `2` → `0` | `expected 2 to be 0` |
| `CAPA_MINIMA` → `9` | `expected 0 to be 9` |

**Rojo genuino durante el desarrollo:** `tfl.unico no es biarticular: expected undefined to be true`.
Era un fallo **mío**: `biarticular` vive en `PorcionLocalizada.porcion`, no en la porción
localizada. Al corregirlo salió gratis una comprobación mejor —que el nivel 3 lista **todas**
las biarticulares del catálogo, no solo que las listadas lo sean—, que es la que caza el fallo
silencioso de olvidarse una.

### `src/features/entrenar/salon/salon.test.tsx` (15)

| Qué se rompió | Error que dio |
| --- | --- |
| `data-w` `'0'` → `'3'` | `expected '0' to be '3'` |
| `className` `'fixed'` → `'static'` | `expected 'fixed inset-0 …' to contain 'static'` |
| huecos: `toContain('centro')` → `'inventado'` | `expected [ 'centro', 'sinPatron', 'panelInferior' ] to contain 'inventado'` |
| peldaños `toHaveLength(5)` → `6` (hoy, ya en la mitad «con sujeto») | `expected [ <button …(4)>…(1)</button>, …(4) ] to have a length of 6 but got 5` |
| «sin sujeto no hay eje W»: escalera `toBeNull()` → `not.toBeNull()` | `expected null not to be null` |
| VACÍO: texto → `'Sin microciclo activo INVENTADO'` | `Unable to find an element with the text: Sin microciclo activo INVENTADO` |
| CARGA: `'Cargando…'` → `'Cargando INVENTADO'` | `Unable to find an element with the text: Cargando INVENTADO` |
| ERROR: texto → `'Esta sección INVENTADA'` | `Unable to find an element with the text: Esta sección INVENTADA` |
| panel cerrado: `nodosDeTexto(panel)` → esperar 1 nodo | `expected [] to deeply equal [ { texto: 'x', camino: 'y' } ]` |
| regla dura: quitar **cero** huecos en vez de todos | lista los 10 nodos filtrados, `expected [ …(10) ] to deeply equal []` |
| regla dura: guarda de no-vacuidad `> 0` → `> 99999` | `expected 10 to be greater than 99999` |
| paredes: `toHaveLength(8)` → `9` | `expected …(8) to have a length of 9 but got 8` |
| paredes: `toContain('paredes')` → `'paredes-inventadas'` | `expected [ …(4) ] to contain 'paredes-inventadas'` |
| tope de pared: `tope` → `4` | `la pared «nombre» se pasa del tope: Hip thrust con barra: expected 20 to be less than or equal to 4` |
| recuadros `toHaveLength(12)` → `13` | `expected [ <section …>, …(11) ] to have a length of 13 but got 12` |
| plegado: `aria-expanded` `'false'` → `'true'` | `expected 'false' to be 'true'` |
| huellas: conjunto + `'huella-que-no-existe'` | `expected Set{ …(9) } to deeply equal Set{ …(10) }` |

**Rojo genuino durante el desarrollo:** el test de CARGA no encontraba `Cargando…`. La causa no
era el código: **`React.lazy` cachea el módulo resuelto en el propio objeto**, así que a partir
del segundo render de la suite el salón se monta de golpe y el estado de carga ya no existe. Se
arregló estrenando el registro de módulos con `vi.resetModules()` —reimportando también los dos
proveedores, porque un contexto viejo y un consumidor nuevo son objetos distintos—.

**Rojo que NO se ha arreglado:** el de la `TopBar` sobre el salón (punto 1). Es un hallazgo, no
un test mal escrito.

### `src/features/entrenar/salon/registro/registro.test.tsx` (11)

| Qué se rompió | Error que dio |
| --- | --- |
| `cargaKg: 82.5` → `80` en lo esperado | `expected "registrarSerie" to be called with arguments: [ 'm-de-prueba', 'e-de-prueba', …(1) ]` |
| `cargaKg: 999` → `1000` (valor topado) | idem, con el objeto recibido `{ cargaKg: 999, reps: 50, rir: 5 }` |
| `onGuardado`: `cargaKg: 60` → `61` | `expected { orden: 1, cargaKg: 60, … } to deeply equal { orden: 1, cargaKg: 61, … }` |
| orden `2` → `9` | `expected { orden: 2, … } to match object { orden: 9 }` |
| `'3 series registradas'` → `'9 …'` | `Unable to find an element with the text: 9 series registradas` |
| tope reps `'50'` → `'51'` | `expected '50' to be '51'` |
| tope RIR `'5'` → `'6'` | `expected '5' to be '6'` |
| suelo de carga `'0'` → `'1'` | `expected '0' to be '1'` |
| borrador tras el fallo `{95,7,0}` → `{1,1,1}` | `expected { cargaKg: 95, reps: 7, rir: +0 } to deeply equal { cargaKg: 1, reps: 1, rir: 1 }` |
| borrador tras el éxito: `toBeNull()` → `not.toBeNull()` | `expected null not to be null` |
| `expect(enRed).not.toHaveBeenCalled()` → `toHaveBeenCalled()` | `expected "spy" to be called at least once` |

**Rojo genuino durante el desarrollo:** leer `input.value` justo después de teclear daba
`'179.48'` contra `'999'`. No era un fallo del salón: la cifra de estos mandos **viaja** hasta
su valor (`cifraViva` → `useContadorAnimado`, con rAF), y la aserción llegaba antes que el
mando. Se arregló esperando con `waitFor`; el valor que se GUARDA nunca dependió de esa
animación, y eso se comprueba aparte contra el espía.

**Segundo rojo genuino:** el error del manejador de evento salía como **excepción no capturada**
de toda la corrida (`Vitest caught 1 unhandled error`), porque un fallo en un manejador no lo
atrapa ningún `ErrorBoundary` —React solo los usa para el render— y acaba en el `dispatchEvent`
de jsdom. Se recoge a propósito con un listener de `error` que hace `preventDefault()`, y se
comprueba que el fallo **ocurrió de verdad**, para que el test no acabe probando el camino
feliz con otro nombre.

### `src/features/entrenar/salon/sinPatron/sinPatron.test.tsx` (47)

| Qué se rompió | Error que dio |
| --- | --- |
| oráculo `!== undefined` → `=== undefined` | `DOMINANTE DE CADERA \| … : las dos respuestas se han separado: expected true to be false` |
| `hayVisor()` `false` → `true` en los 8 sin patrón | `se montó un canvas para un ejercicio sin modelo: expected false to be true` (×8) |
| `hayVisor()` `true` → `false` en las 31 con patrón | `no se montó el visor para EXTENSIÓN DE CADERA: expected true to be false` (×31) |
| `tienePatronDeMovimiento(undefined)` `false` → `true` | `expected false to be true` |
| «Sin modelo 3D» → «Sin modelo 4D» | `Unable to find an element with the text: /Sin modelo 4D para este ejercicio/` |
| peldaños del eje W `5` → `4`, hoy en la mitad «con patrón» y por las 31 categorías | `sin escalera con ABDUCCIÓN DE CADERA: expected …(5) to have a length of 4 but got 5` (×31) |
| «el eje W se apaga con el sujeto»: escalera `toBeNull()` → `not.toBeNull()` | `expected null not to be null` |
| `not.toContain('canvas')` → `toContain` | `expected 'import { patronDeCategoria } from …' to contain 'canvas'` |
| rótulos + `'inventado'` | `falta el dato «inventado»: expected null not to be null` |
| `'Sin minutos prescritos'` → `'Sin minutos INVENTADOS'` | `Unable to find an element with the text: Sin minutos INVENTADOS` |
| `toBeLessThanOrEqual(TOPE_PARED)` → `5` | `se pasa del tope: «Sin modelo 3D para este ejercicio.»: expected 34 to be less than or equal to 5` |

**Rojo genuino durante el desarrollo:** `expect(fuente).not.toContain('VisorPatron')` falló
porque la **cabecera** de `SalonSinSujeto.tsx` nombra las dos piezas justo para explicar que no
las usa. El test estaba mal: ahora mira el fuente **sin comentarios**, que es lo que el archivo
hace y no lo que cuenta.

### `src/features/entrenar/RutaPage.test.tsx` (1 de las 5, la que se reescribió hoy)

| Qué se rompió | Error que dio |
| --- | --- |
| quitarle el `await abrirPanel(usuario)` — el estado en el que estaba antes | `TestingLibraryElementError: Unable to find role="button"` (el rojo original, reproducido) |
| días sin marcar `toHaveLength(6)` → `7` | `expected [ <button …(4)>…(3)</button>, …(5) ] to have a length of 7 but got 6` |

Las dos roturas dicen cosas distintas a propósito: la primera prueba que **el panel tiene que
estar abierto de verdad** para que haya días —y de paso reproduce el rojo tal cual llegó—, y la
segunda que la cuenta de días es una aserción viva y no un `getAllBy` que devuelve lo que sea.

### `pruebas/cobertura-de-patrones.test.ts` (11)

Las once se rompieron **de una vez** —una aserción por prueba, y ninguna tocando `src/`— para
que la corrida enseñara los once mensajes juntos:

| Qué se rompió | Error que dio |
| --- | --- |
| categorías `toHaveLength(62)` → `63` | `expected [ { …(2) }, …(59) ] to have a length of 63 but got 62` |
| `'ROTACIÓN DE CADERA'` → `'ROTACIÓN DE CADERA ROTA'` en las canónicas sin ficha | `expected [ 'ROTACIÓN DE CADERA', …(6) ] to deeply equal [ 'ROTACIÓN DE CADERA ROTA', …(6) ]` |
| cada ficha por su categoría: `.toBe(p.id)` → `p.id + 'x'` | `ficha inalcanzable: extension_cadera: expected 'extension_cadera' to be 'extension_caderax'` |
| seed `toHaveLength(27)` → `28` | `expected [ { …(3) }, …(24) ] to have a length of 28 but got 27` |
| producción: `'ACONDICIONAMIENTO · SWING'` → `'… SWING ROTO'` | `expected [ 'ACONDICIONAMIENTO · CARDIO', …(18) ] to deeply equal [ … ]` |
| «manguito rotador» esperando `suspension` | `expected 'rotacion_externa_hombro' to be 'suspension'` |
| trineo esperando `suspension` | `expected 'salto' to be 'suspension'` |
| descartadas `toHaveLength(21)` → `20` | `expected [ 'GATO.?CAMELLO', …(19) ] to have a length of 20 but got 21` |
| rotación de cadera esperando `toBeUndefined()` | `expected { Object (id, cadena, ...) } to be undefined` |
| la puerta del salón: oráculo `!== undefined` → `=== undefined` | `ABDUCCIÓN DE HOMBRO · ELEVACION EN POLEA: expected true to be false` |
| el resumen impreso esperando `159` → `160` | `expected 'CATEGORÍAS: 62 · con patrón 54 (87.1 …' to contain 'FAMILIAS DE NOMBRE DE PRODUCCIÓN: 160'` |

**Rojo genuino durante el desarrollo:** la prueba escrita para afirmar que las cinco categorías
sin ficha se quedan **siempre** sin sujeto falló, y la afirmación era mía, no del código:
`patronDeCategoria('ROTACIÓN DE CADERA', 'Rotación externa de cadera sentado')` devolvía
`rotacion_externa_hombro`. Ese rojo es el que destapó el hallazgo del manguito, y por eso la
prueba quedó escrita al revés de como se pensó: afirmando lo que pasa, no lo que debería pasar.

### Las 23 del eje W: `mallaDelNivel.test.ts` (15) y los dos `ejeW-*` (4 + 4)

Aquí las roturas son **de código de producción**, no de valores esperados, por lo dicho arriba.
Cada una se aplicó sola, se corrió, y se restauró desde una copia comprobada con `cmp`. La
columna de la derecha es el mensaje literal de vitest.

| Rotura (en producción) | Pruebas que se pusieron rojas | Error que dio |
| --- | --- | --- |
| **1.** Quitar `w={w}` del `<VisorPatron>` de `SalonEntrenar.tsx` — el fallo original, tal cual | 6 de las 8 de interfaz | `el salón dejó de pasarle 'w' al visor: expected [ 'patron', 'datos' ] to include 'w'` · `Unable to find an element with the text: Piel` |
| **2.** `key={w}` en el visor, que lo remonta en cada capa | «el sujeto sigue con su gesto…» | `expected '0' to be '40'` (el deslizador de fase se reiniciaba al atravesar) |
| **3.** Quitar el `useMemo` del patrón: un objeto nuevo por render | «atravesar no cambia de patrón» | `expected { id: 'bisagra_cadera', …(17) } to be { id: 'bisagra_cadera', …(17) }` |
| **4.** `porcionesDeNivel()` devuelve `PORCIONES` sin filtrar | 4 de las puras | `el nivel 0 dibuja las setenta porciones: expected 14488 to be less than 14488` · `expected 28976 to be 14488` |
| **5.** El eje decorativo otra vez: ni `mallasDelSujeto()` ni `construirMusculosDeNivel()` miran la capa | 5 de las puras, la principal incluida | `el nivel 0 (Piel) y el 1 (Músculo superficial) suben la MISMA escena` |
| **6.** El tono de la copia a una constante (`0,86`), como si alguien afinara `musculos.ts` sin pasar por aquí | el guardián de la copia | `expected 14765 to be +0` |
| **7.** `huesosParcialesDeNivel()` sin su guarda | «ningún nivel pide medio esqueleto» | `expected [ 'pelvis', 'lumbar', 'torax', …(18) ] to deeply equal []` |
| **8.** Cachear la malla por capa —la optimización que parece buena | «en cada capa el cuerpo se mueve» | `el nivel 0 dibuja lo mismo en dos fases distintas` |
| **9.** Saltarse las porciones muy acortadas a mitad del gesto | «la topología no cambia con la fase» | `el nivel 0 cambia de porciones a mitad del gesto: expected 3 to be 1` |

Dos aserciones no tienen palanca en producción que tocar —`construirMusculos()` y
`esqueletoEnFase()` están en `src/domain/`, de solo lectura en esta rama— así que se rompieron
desde el test y queda dicho: el umbral de «el cuerpo entero son las setenta porciones» subido a
100 000 (`expected 14488 to be greater than 100000`) y las dos fases del rig igualadas
(`el rig no se mueve entre la bajada y la subida: expected 0 to be greater than 0`).

Y el guardián del lienzo se vio rojo montando el salón sin ejercicio: `expected null not to be
null`, que es lo que impide que «no está el selector viejo» pase por no haber visor ninguno.

**Rojo genuino durante el desarrollo, y es el hallazgo del día en esta capa.** La prueba de que
el rig se mueve entre la bajada y la subida **pasaba en vacío**: `EsqueletoResuelto.matrices` es
un array de 22 matrices, y cada llamada las construye nuevas, así que compararlas con `!==`
salía siempre distinto. Se descubrió al romperla a propósito —igualando las dos fases— y ver
que seguía verde. Reescrita para comparar **componente a componente**, ahora sí se cae. Es
exactamente el patrón que este repo ya tiene fichado: el guardián que nace pasando en vacío.

**Segundo rojo genuino:** la primera versión de la prueba de la piel afirmaba que el nivel 0 y
el 1 tienen la **misma geometría** y solo cambian de color. Es falso, y lo dijo la corrida:
`expected 10309 to be +0`. El tono engorda el vientre del músculo que trabaja. La prueba se
reescribió para afirmar lo que pasa —misma topología, mismos índices, y la porción que no
trabaja idéntica— en vez de lo que yo suponía.
