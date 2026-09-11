# Presupuesto de fotograma del salón

Bryan pidió **medir primero y decidir después**. Esto es la medida. No hay ningún
cambio en `motor.ts` ni en `malla.ts`: los dos se han leído y no se han tocado.

## Cómo se midió, y por qué se dice antes que los números

- **Dónde:** Chrome 151 en Windows 11, 16 hilos, sobre el servidor de Vite de este
  árbol (`http://localhost:5173/entrenar`), importando los módulos reales del
  repositorio (`motor.ts`, `malla.ts`, `sala.ts`, `tripode.ts`, `laboratorio.ts`,
  `huesos.ts`, `musculos.ts`, `escena/implementos.ts`) desde la propia página.
- **Con qué escena:** la misma que monta `VisorPatron.construir()` — bahía de
  medida, plomada, sala con marcadores, trípode, esqueleto y musculatura— para el
  patrón `SENTADILLA` en fase media. Lienzo de 405 × 720 px (9:16), `dpr` 1.
- **Con la pestaña VISIBLE.** `document.visibilityState` se comprobó **en la misma
  llamada que devuelve cada número**, y sale escrito abajo con cada tabla. Esto no
  es burocracia: una de las tandas se coló con la ventana tapada y dio **39,6 ms de
  mediana para el mismo `subir()` que visible da 11,5**. La pestaña oculta no
  devuelve un número bueno de más ni de menos: devuelve otro número, tres veces y
  media peor, con la misma cara de dato.
- **Estadístico:** mediana de 25–120 repeticiones, con 8–25 de calentamiento
  descartadas. Se dan además p10, p90 y máximo, porque el p90 es lo que decide si
  un fotograma se salta y la mediana no lo dice.
- **Banda de ruido, medida:** cuatro corridas idénticas y separadas de
  `subir(escena de hoy)` dieron 11,7 · 12,0 · 11,5 · 12,1 ms →
  **oscilación del 5,2 %**. Cualquier diferencia menor de ~0,6 ms entre dos
  configuraciones de esta escena **no la distingue esta medida**. Se dice aquí y se
  aplica luego.

---

## Coste de hoy

`Motor.subir()` sobre la escena completa, con `visibilityState = "visible"` al
empezar, en cada paso y al terminar:

| medida | mín | p10 | **mediana** | p90 | máx | n |
|---|---|---|---|---|---|---|
| `subir()` escena de hoy | 10,3 | 10,7 | **11,5** | 14,7 | 32,5 | 120 |
| `dibujar()` | 0,0 | 0,0 | **0,0** | 0,0 | 0,2 | 120 |
| `construirMusculos()` | 1,4 | 1,5 | **1,9** | 2,6 | 2,9 | 60 |
| `esqueletoEnFase()` | 0,0 | 0,0 | **0,1** | 0,1 | 0,9 | 200 |
| **fotograma entero, en `requestAnimationFrame`** | 11,9 | 12,9 | **13,9** | 17,6 | 37,3 | 70 |

Los 70 fotogramas del bucle se midieron con la pestaña visible: **0 de 70 con la
pestaña oculta**, comprobado fotograma a fotograma.

La escena que se sube son **31.129 vértices y 168.192 índices**.

Lo que dicen estos números, en orden de importancia:

1. **`subir()` es el fotograma.** 11,5 de los 13,9 ms de CPU: el **83 %**. El
   presupuesto a 60 Hz es 16,7 ms, así que hoy se gasta el **69 % del presupuesto
   solo en subir geometría**, y el fotograma entero se come el **83 %**. El p90 del
   fotograma (17,6 ms) **ya está por encima de los 16,7**: uno de cada diez
   fotogramas se salta hoy, antes de añadir nada.
2. **`dibujar()` no cuesta nada de CPU.** Mediana 0,0 ms. No significa que la
   tarjeta no trabaje: significa que `drawElements` vuelve enseguida y el trabajo
   de GPU no cae en este reloj. El cuello no está en pintar.
3. **La musculatura se reconstruye entera cada fotograma por 1,9 ms.** Catorce mil
   vértices de geometría nueva cuestan la sexta parte de lo que cuesta *copiarlos*.

### De qué está hecho ese coste

`subir()` hace dos cosas: concatena las mallas en arrays de JavaScript y luego las
convierte a tipadas y las manda a la tarjeta. Se midieron las dos mitades por
separado, con una réplica exacta del cuerpo de la función **escrita fuera de
`motor.ts`** (medir no es tocar):

| mitad | mediana | qué es |
|---|---|---|
| concatenar (`pos.push(...m.posicion)` × 5 y el bucle de índices) | **10,4 ms** | 90 % del total |
| convertir a `Float32Array` + `bufferData` | **0,5 ms** | 4 % |
| solo la conversión, sin tocar la tarjeta | 0,3 ms | — |

**El coste no está en la tarjeta gráfica ni en el ancho de banda: está en cinco
`push(...)` y un bucle de índices en JavaScript.** Subir 31.000 vértices a la GPU
cuesta medio milisegundo; construir los arrays intermedios para poder subirlos
cuesta veinte veces más.

---

## Coste con los implementos

El implemento de una sentadilla en barra que construye
`escena/implementos.ts` son **368 vértices y 684 índices** — un 1,2 % más sobre los
31.129 de la escena.

Medido directamente:

| escena | vértices | mediana de `subir()` |
|---|---|---|
| hoy | 31.129 | 11,5 ms |
| hoy + barra con discos | 31.497 | 11,6 ms |

**Esa diferencia de 0,1 ms no la distingue esta medida**: la banda de ruido entre
corridas idénticas es de 0,6 ms. Decir «los implementos cuestan 0,1 ms» sería
inventarse una precisión que no hay.

Así que se midió la **razón de coste por vértice**, que sí se puede medir: la misma malla de
implemento repetida 10 y 30 veces, para que la diferencia salga del ruido y luego
se divida.

| geometría añadida | vértices totales | mediana de `subir()` | incremento |
|---|---|---|---|
| ninguna | 31.129 | 10,8 ms | — |
| +3.680 v (×10) | 34.809 | 13,1 ms | +2,3 ms |
| +11.040 v (×30) | 42.169 | 14,9 ms | +4,1 ms |

Los tres pasos, con `visibilityState = "visible"` comprobado en cada uno.

Razón: **0,37 ms por cada 1.000 vértices añadidos**. Contrastada con la otra
serie de la misma tanda —subconjuntos crecientes de la escena real, de 2.521 a
31.129 vértices— que da **0,40 ms por 1.000**. Las dos coinciden dentro de la banda.

De ahí sale el coste real de los implementos, y ya no es una opinión:

| pieza | vértices | coste esperado en `subir()` |
|---|---|---|
| barra con discos | 368 | ≈ 0,14 ms |
| dos mancuernas | 224 | ≈ 0,08 ms |
| prensa (raíl inclinado) | 132 | ≈ 0,05 ms |
| polea con su columna y su cable | 328 | ≈ 0,12 ms |
| barra fija de dominada | 168 | ≈ 0,06 ms |

**Los implementos no son el problema.** El caso más caro añade 0,14 ms sobre un
fotograma de 13,9. Bajo la banda de ruido de la propia medida.

---

## Cuánto margen queda

El presupuesto a 60 Hz es 16,7 ms. Hoy el fotograma gasta **13,9 ms de mediana y
17,6 de p90**. Con la razón medida (0,37 ms por 1.000 vértices) el margen sale
de una resta, no de una impresión:

| criterio | margen que queda | en vértices |
|---|---|---|
| que la **mediana** no pase de 16,7 ms | 2,8 ms | **≈ 7.500 vértices** |
| que el **p90** no pase de 16,7 ms | **−0,9 ms** | **ninguno: ya se pasa** |

Las dos filas dicen cosas distintas y las dos son verdad. La honesta es la segunda:
**hoy, sin implementos y sin luces, uno de cada diez fotogramas ya se sale del
presupuesto.** La mediana lo tapa.

Qué cabe en esos 7.500 vértices de margen de mediana:

- **Los implementos: caben veinte veces.** 368 vértices sobre 7.500.
- **Las luces:** no añaden vértices. Tres puntos, contraluz y claroscuro son
  trabajo de *fragment shader*, y el fragment shader no pasa por `subir()`. Su
  coste va a la GPU, que en esta medida no aparece porque `dibujar()` devuelve en
  0,0 ms. **Este informe no mide el coste de GPU de las luces**; para eso hace
  falta la extensión `EXT_disjoint_timer_query` o medir en el móvil de destino, y
  ninguna de las dos cosas se ha hecho aquí.
- **La estela de la ejecución anterior: no cabe.** Una traza de repetición
  construida con `tuboDiscontinuo` —que es lo que ya usa `guias()`— sale a unos 6
  vértices por anillo × 5 anillos por trazo ≈ 30 vértices por trazo. Una estela de
  las últimas tres repeticiones con veinte trazos cada una son ~1.800 vértices,
  0,67 ms. Eso sí cabe. Lo que **no** cabe es una estela por serie de la sesión: a
  cinco series son 9.000 vértices, 3,3 ms, y la mediana se va a 17,2 ms.

Y el dato que ordena cuanto va arriba: de esos 11,5 ms, **10,4 son la concatenación
en arrays de JavaScript**. El margen no está limitado por cuánta geometría hay,
sino por cómo se copia.

---

## Qué recomiendo, y qué decide Bryan

Lo medido, en una frase: **la escena no es pesada; la forma de subirla sí.** Copiar
31.000 vértices a la tarjeta cuesta 0,5 ms; prepararlos con `push(...)` cuesta
10,4. El 69 % del presupuesto de fotograma se va en un paso intermedio que no
dibuja nada.

**Lo que recomiendo, y está medido, no opinado.** Se replicó una alternativa
**fuera de `motor.ts`** —contar primero, escribir con `set()` en arrays tipados
reutilizados, y subir con `subarray`— produciendo los mismos búferes desde las
mismas mallas:

| implementación | mediana | qué incluye |
|---|---|---|
| `subir()` tal como está hoy | **11,7 ms** | concatenar + convertir + `bufferData` |
| réplica con arrays tipados reutilizados | **0,5 ms** | lo mismo, entero |
| — solo la parte de concatenar de la réplica | 0,2 ms | |

Las dos, en la misma tanda y con la pestaña visible. **Son 11,2 ms recuperados: el
67 % del presupuesto de fotograma.** El fotograma pasaría de 13,9 a ~2,7 ms de
mediana, y el p90 de 17,6 a ~6.

Es la misma técnica que la clase `Malla` ya aplica dentro de sí misma, y por el
mismo motivo escrito en `malla.ts`: hacer crecer arrays a base de `push` costaba
19 de 22 ms. El diagnóstico ya está en el repositorio; `subir()` quedó fuera de
aquella corrección.

**Lo que NO está comprobado y hay que comprobar antes de tocar nada.** La réplica
mide la aritmética, no el resultado: no se ha verificado que produzca píxeles
idénticos, y usa índices de 32 bits siempre, mientras que `subir()` elige entre 16
y 32 según el tamaño. Los dos puntos son trabajo real, no detalles.

**Lo que decide Bryan, y no yo:**

1. Si se toca `subir()`. Hoy está prohibido y este informe no lo toca. Los 11,2 ms
   están medidos; la decisión de gastarlos o no es suya.
2. Si el criterio es la mediana o el p90. Con la mediana hay 2,8 ms de margen y no
   corre prisa. Con el p90 no hay margen y ya se están saltando fotogramas.
3. Qué entra primero en ese margen. Los implementos caben con o sin arreglo (0,14
   ms). La estela de las últimas repeticiones cabe hoy (0,67 ms); la estela de la
   sesión entera no cabe hoy y sí cabría después.

**Si la respuesta es que no se toca `subir()`, este informe se queda aquí y los
implementos entran igual**: 0,14 ms sobre 13,9 no cambia nada de lo que ya pasaba.
Lo que no se puede decir es que la escena vaya holgada, porque el p90 dice que no.

---

## Lo que este informe no mide

Se dice para que nadie lo lea como si estuviera cubierto:

- **El coste de GPU.** `dibujar()` mide cuándo vuelve la llamada, no cuándo acaba
  la tarjeta. Las luces de tres puntos, el claroscuro, la profundidad de campo y el
  grano viven ahí y **no aparecen en ninguna cifra de este informe**. Haría falta
  `EXT_disjoint_timer_query`, o medir fotogramas presentados en vez de tiempo de
  CPU.
- **El móvil.** Esto es un Chrome de escritorio con 16 hilos. Un iPhone en
  Safari tiene otro reparto entre CPU y GPU, y el destino es ése. Para cerrarlo
  haría falta correr la misma tanda contra Safari en un teléfono real, por red
  local o con el inspector conectado.
- **La sesión larga.** Las tandas son de decenas de segundos. Nada aquí dice qué
  pasa a los veinte minutos de sesión con el teléfono caliente y la frecuencia
  bajada.
