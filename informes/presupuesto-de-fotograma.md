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

---

## Remedida del 21-oct-2026 (R-15): la cifra de hoy

Los 13,9 ms de arriba son del 29-ago. Desde el 2-sep `Motor.subir()` reserva arrays tipados y
escribe con `set()` (lo dice su comentario en `motor.ts`), y el visor se partió en módulos. Se
mide otra vez, sin tocar `motor.ts`.

- **Comando:** servidor `npx vite --host 127.0.0.1 --port 5198`; en Chrome 155 (Windows 11), con la
  pestaña delante, se abre
  `http://127.0.0.1:5198/scripts/medir-fotograma-salon.html?nombre=hoy-N`. La página importa los
  módulos reales, monta la escena de `construir()` para `SENTADILLA` («Sentadilla con barra»,
  lienzo 405 × 720, `dpr` 1), descarta 15 fotogramas de calentamiento, mide 80 y manda el JSON a un
  receptor local. Archivos: `scripts/medir-fotograma-salon.{mjs,html}`.
- **Visibilidad:** `visible` en todos los pasos de las tres corridas; 0 pasos con la pestaña oculta.
- **Escena:** 35.933 vértices (la de 29-ago tenía 31.129). No incluye las piezas estáticas de la sala
  de Blender (van por `subirEstaticas()`, fuera de `subir()`), ni coste de GPU real: `gl.finish()` no
  cambió ninguna cifra, lo que indica que esta medida casi no ve GPU.

| corrida | `subir()` mediana | `construirMusculos()` mediana | fotograma CPU mediana | p90 | máx |
|---|---|---|---|---|---|
| hoy-1 | 1,0 | 3,5 | 5,8 | 12,1 | 18,5 |
| hoy-2 | 1,0 | 3,5 | 7,1 | 14,7 | 21,1 |
| hoy-3 | 1,1 | 3,3 | 6,8 | 14,8 | 17,8 |

- **Cifra de hoy:** fotograma de CPU, **mediana 6,8 ms** (mediana de las tres corridas), p90 de
  12,1 a 14,8 ms; `subir()` 1,0 ms. Antes: 13,9 y 11,5.
- **Banda de ruido, medida:** las medianas de tres corridas idénticas van de 5,8 a 7,1, **1,3 ms**.
  Una diferencia menor de ~1,3 ms entre dos configuraciones no la distingue esta medida.
- **Lo que cambió de fondo:** el cuello ya no es `subir()` sino la musculatura (3,5 ms de 6,8).

### Con la capa de momentos encendida (21-oct-2026)

Mismo comando con `&capa=1` (`scripts/capa-momentos-medida.mjs`: la capa se decide una vez, como el
`useMemo` del salón, y las dos mallas se construyen en cada fotograma). La capa aporta **760
vértices** (36.693 contra 35.933, un 2 %). `capa-1` se descartó: la pestaña pasó a oculta en 2 pasos;
se repitió como `capa-1b`. Las tres válidas tienen 0 pasos con la pestaña oculta.

| corrida | `subir()` | `construirMusculos()` | fotograma CPU mediana | p90 | máx |
|---|---|---|---|---|---|
| capa-1b | 0,9 | 2,6 | 4,7 | 10,4 | 16,1 |
| capa-2 | 1,0 | 3,1 | 9,4 | 15,5 | 19,9 |
| capa-3 | 0,9 | 3,0 | 6,8 | 13,9 | 15,4 |
| control sin capa (hoy-4, misma tanda) | 0,9 | 2,3 | 7,2 | 12,8 | 18,2 |

- **Mediana de medianas con la capa: 6,8 ms** (contra 6,8 sin capa). Criterio del plan: no entra si
  pasa de 8,1 ms o si algún p90 pasa de 16,7: **cumple** (el p90 más alto es 15,5).
- **Lo que esta medida NO distingue:** las medianas con capa van de 4,7 a 9,4 ms, más ancho que la
  banda sin capa (5,8 a 7,1). Una capa de 760 vértices no se separa del ruido de la máquina (hubo
  otras sesiones y pruebas corriendo). Se puede afirmar que no supera el umbral fijado; no se puede
  afirmar que cueste «0 ms».
- **Sigue sin medirse:** GPU real, móvil, sesión larga, y el fotograma con la sala de Blender subida.

### Peor caso de la capa, remedido alternando 6 + 6 (21-oct-2026, tarde)

**Por qué otra vez.** Desde C-3 la capa solo dibuja cerca de la pose del cálculo, y el medidor
(`?capa=1`) fallaba con «no aportó ni un vértice». Se arregló en `c07dabb0`:
`capa-momentos-medida.mjs` pone la pose del cálculo en la de cada fotograma (`mallasDelPeorCaso`), así
que los arcos se construyen en TODOS los fotogramas: es una **cota superior** del coste, no el típico
(en el salón real, de pie o en otra fase, la capa cuesta 0 vértices). La guarda suma los vértices de
toda la tanda. Prueba que falla con la versión vieja de cada una: `scripts/medir-fotograma-guarda.test.mjs`.

**Cómo.** Playwright con Chrome (`channel='chrome'`, ventana visible, `bring_to_front`), contexto nuevo
por corrida, lienzo 405 × 720, 15 fotogramas de calentamiento y 80 medidos, 6 corridas con capa y 6 sin
ella, alternadas (capa-1, hoy-1, capa-2, hoy-2…). `visibilityState` = `visible` en las 12, 0 pasos con la
pestaña oculta. La capa añade **912 vértices por fotograma** a 35.933 (2,5 %).

| par | fotograma CPU mediana, capa / sin capa (ms) | p90, capa / sin capa | `subir()` mediana, capa / sin | carga de CPU antes (capa / sin) |
|---|---|---|---|---|
| 1 | 6,2 / 6,7 | 11,9 / 10,2 | 1,7 / 1,2 | 91 % / 66 % |
| 2 | 7,8 / 8,3 | 13,2 / 15,0 | 1,1 / 1,0 | 59 % / 68 % |
| 3 | 6,8 / 7,6 | 12,2 / 14,1 | 1,0 / 1,6 | 70 % / 94 % |
| 4 | 6,8 / 5,5 | 13,9 / 12,5 | 1,8 / 1,2 | 100 % / 66 % |
| 5 | 7,9 / 7,0 | 16,1 / 13,4 | 1,3 / 1,1 | 88 % / 60 % |
| 6 | 10,8 / 6,0 | 16,7 / 14,9 | 1,4 / 1,1 | 54 % / 90 % |

- **Mediana de las seis medianas:** 7,3 ms con capa y 6,85 sin ella; mediana de los p90: 13,6 y 13,75.
  Diferencia por pares (capa − sin capa): −0,5, −0,5, −0,8, +1,3, +0,9, +4,8: **signos mezclados**.
- **Lectura:** la diferencia está **dentro del ruido**. Las medianas sin capa van de 5,5 a 8,3 ms (2,8 ms de
  rango entre corridas idénticas) y las con capa de 6,2 a 10,8. No se puede decir que la capa cueste algo
  ni que cueste 0; lo que sí se sostiene es que el peor caso queda por debajo de los umbrales fijados
  (mediana 8,1 ms, p90 16,7 ms) en la **mediana de las medianas** (7,3) y en la mediana de los p90 (13,6),
  pero **no en todas las corridas**: capa-6 (10,8 ms) y los p90 de capa-5 (16,1) y capa-6 (16,7, en el borde)
  los rozan o superan. Esas corridas coinciden con otras tareas del equipo en marcha.
- **El equipo NO estaba descargado.** Durante toda la tanda corrían la cola U-Net de MANU
  (`unet_cola.py`, ~71.000 s de CPU acumulados) y un `grupo_medir.py`; la carga de CPU osciló entre 54 % y
  100 % (columna de la tabla). No se pausó la cola de otro proyecto. Para separar el efecto de la capa
  del ruido hay que repetir con la cola parada; mientras tanto el coste de la capa queda **sin
  distinguir del ruido**, y este informe no inventa una cifra.
- **Sigue sin medirse:** GPU real, móvil, sesión larga y la sala de Blender subida.

### 20 pares alternados con Chrome en prioridad alta: criterio fijado ANTES de medir (21-oct, 15:03)

- **Estadístico:** por par, `d = fotogramaCPU.mediana(capa) − fotogramaCPU.mediana(sin capa)`; 20 pares
  alternados (capa, sin capa, capa…) y la mediana de las 20 `d`.
- **Intervalo:** bootstrap percentil de la mediana de `d`, 10.000 remuestras con semilla fija (20261021),
  nivel 95 %.
- **Regla:** la capa **cabe** si el límite superior del intervalo es **menor de 1 ms**. Si no, se escribe
  «no determinable con el equipo cargado», sin cifra de coste.
- **Condiciones:** procesos de Chrome lanzados por la medida en prioridad alta; no se toca ningún proceso
  ajeno (la cola de MANU y los agentes del laboratorio siguen corriendo). Se anota la carga de CPU de cada
  corrida y la hora; los agentes del laboratorio cargan el equipo hasta cerca de las 16:55.
- Se rechaza una corrida con la pestaña oculta o que no cuadre vértices = fotogramas × 912.

#### Resultado de los 20 pares (15:02 a 15:17, mismo día)

Cumplen la condición previa las 40 corridas: Chrome en prioridad `High` en todas, 0 pasos con la pestaña
oculta, vértices = fotogramas × 912 (190 × 912 = 173.280) en las 20 con capa y 0 en las 20 sin ella.

- **Mediana de las 20 diferencias por pares: +0,20 ms** (capa 6,10 ms, sin capa 5,95). 12 pares positivos
  y 8 negativos.
- **Intervalo de bootstrap del 95 % de esa mediana: de −0,35 a +1,30 ms.** El límite superior (1,30) no es
  menor de 1 ms.
- **Veredicto según la regla fijada antes: NO DETERMINABLE CON EL EQUIPO CARGADO.** No se afirma que la capa
  quepa ni que no, ni se da un coste en ms. (La mediana apunta a algo pequeño, pero el intervalo incluye
  tanto 0 como más de 1 ms.)
- **Carga durante la tanda:** la carga de CPU antes de cada corrida osciló entre 32 % y 100 % (la mayoría
  entre 70 % y 100 %). Seguían en marcha la cola U-Net de MANU y los agentes del laboratorio (cargan el
  equipo hasta cerca de las 16:55), así que **coinciden con toda la tanda**. Hay dos corridas con tirones
  claros, ambas con capa: el par 14 (mediana 16,3 y p90 213,9 ms) y el 17 (p90 55,9 ms); y huecos de tiempo
  entre corridas (15:06 a 15:08, 15:12 a 15:14) que indican que el equipo se ahogó. No se descartaron:
  el criterio se fijó antes y no incluía descartes.
- **Datos y código:** `informes/medidas/capa-20-pares/*.json` (cada JSON lleva `hora`, `cargaCPUantes`,
  `prioridadChrome`, `fotogramas`), `informes/medidas/medir-capa-20-pares.py`,
  `informes/medidas/analizar-capa-20-pares.py`.
- **Para repetir con la cola de MANU parada y sin agentes del laboratorio** (con el servidor
  `npx vite --host 127.0.0.1 --port 5198 --strictPort` en marcha, desde este repo):
  `py -3.13 informes/medidas/medir-capa-20-pares.py salidas 20` y luego, desde la carpeta de salidas,
  `py -3.13 informes/medidas/analizar-capa-20-pares.py` (ajustar la ruta `salidas20/` del analizador). Misma regla:
  cabe si el límite superior del IC95 de la mediana de las diferencias es < 1 ms.

### Trazas de Chrome con eventos de recolección de basura (21-oct-2026, tarde)

**Pregunta:** ¿explica el GC los tirones de los pares 14 y 17 de los 20 pares (p90 de 213,9 y 55,9 ms, ambos con capa)?

**Cómo:** `informes/medidas/traza-gc-capa.py` (Playwright, `start_tracing` con las categorías `devtools.timeline`,
`disabled-by-default-devtools.timeline`, `v8`, `disabled-by-default-v8.gc`), una traza por corrida; 14 corridas con capa y
14 sin ella, alternadas, con el mismo peor caso (912 vértices por fotograma). `informes/medidas/analizar-gc.py` cuenta los
eventos `MinorGC`/`MajorGC` y las tareas largas. Las trazas (5 MB cada una) no se versionan.

| | corridas | GC por corrida | ms de GC por corrida (mediana, rango) | pausa máxima de un GC | p90 de fotograma, máximo |
|---|---|---|---|---|---|
| con capa | 14 | 259 a 267 (todos `MinorGC` salvo 1 `MajorGC` por corrida) | 129,7 (92,5 a 146,7) | 7,3 ms | 13,0 ms |
| sin capa | 14 | 269 a 276 (ídem) | 137,3 (80,0 a 176,3) | 39,3 ms | 12,6 ms |

- **La capa no añade recolecciones:** tiene incluso algo menos de GC que la corrida sin capa (261 contra 273 de mediana).
  El trabajo de GC es el mismo orden en las dos (unos 130 ms repartidos en ~260 *scavenges* de ~0,5 ms).
- **Veredicto sobre los tirones 14 y 17: el GC NO los explica — refutado por magnitud, no por coincidencia.** Una pausa
  de GC mide como mucho 39 ms en estas 28 corridas (y esa, sin capa, no subió el p90 de su corrida: 7,5 ms); para un p90
  de 213,9 ms hacen falta al menos 8 fotogramas seguidos de más de 200 ms, y el GC total de una corrida entera no
  llega a 180 ms. **Limitación:** en estas 28 corridas trazadas **no se reprodujo ningún tirón** (el p90 máximo fue 13 ms),
  así que no se pudo mirar un tirón concreto con su traza; lo que se descarta es que el GC tenga la magnitud para producirlo.
  La causa de los tirones 14 y 17 sigue **sin explicar**; los huecos de tiempo entre corridas de esa tanda (15:06 a
  15:08, 15:12 a 15:14) apuntan a que el equipo, no la página, se ahogó, pero eso no está demostrado.
