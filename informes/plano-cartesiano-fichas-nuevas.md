# El plano cartesiano de las fichas nuevas — 2026-09-06

Cinco fichas nuevas en el catálogo de patrones, y lo que cada una hace medido sobre el
motor: cuántos grados recorre cada articulación, qué segmento se mueve sobre cuál, por
dónde pasa el punto seguido en los tres ejes del mundo, y cuánto brazo de palanca le
queda a cada eje en cada fase.

**Nada de este informe está escrito a mano.** Sale de
`pruebas/plano-cartesiano.test.ts`, que se puede volver a correr:

```
npx vitest run pruebas/plano-cartesiano.test.ts
```

## Lo que cambió en el barrido de cobertura

| | Antes | Ahora |
| --- | --- | --- |
| Categorías del repo con sujeto | 54 de 62 (87,1 %) | **59 de 62 (95,2 %)** |
| Ejercicios del seed con sujeto | 19 de 27 (70,4 %) | **27 de 27 (100 %)** |
| Familias de nombre de producción | 140 de 159 (88,1 %) | **150 de 159 (94,3 %)** |
| Familias sin sujeto que NO son cardio | 10 | **0** |

Las nueve familias que siguen sin sujeto son las nueve de cardio, y quedarse fuera es lo
correcto: no hay gesto resistido que enseñar en una elíptica. La diferencia con antes es
que ahora está **declarado** en `SIN_PATRON` en vez de caerse por no encajar en ninguna
regla.

## Los dos agujeros eran de naturaleza distinta

1. **Cinco categorías nombraban una acción articular y no tenían ficha** —rotación de
   cadera, flexión de hombro, las dos muñecas y la extensión lumbar—. Estas sí
   necesitaban cuerpo nuevo, y son las cinco hojas de abajo.
2. **El agujero más grande no necesitaba ninguna ficha.** Los ocho ejercicios del seed
   que se quedaban sin sujeto —el 30 %— eran todos de categoría `AISLAMIENTO`, que no
   dice el gesto sino para qué sirve. Un curl femoral es una flexión de rodilla y una
   elevación lateral es una abducción de hombro: el patrón ya existía y nadie miraba el
   nombre. Lo mismo con las seis de `PREV/REHAB`.

## Un patrón equivocado es peor que ninguno

`ROTACIÓN DE CADERA` no tenía ficha, así que caía a la lista por nombre, y allí
«rotación externa» estaba escrito para el manguito rotador del **hombro**. La familia
recibía sujeto y era el sujeto de otra articulación: no se ve venir con el aviso de «sin
modelo», se ve como si fuera correcto. Arreglado por los dos lados —ficha propia, y la
regla de cadera colocada ANTES que la de hombro en `POR_NOMBRE`—.

## La física ya estaba escrita; le faltaba el cuerpo

Las cinco fichas nuevas **no necesitaron modelo mecánico nuevo**: los cinco ya existían
en `src/domain/biomecanica/modelos*.ts`, escritos para las 34 categorías canónicas y sin
ninguna ficha a la que aplicarse. Por eso las flechas de fuerza salen solas.

Donde no salen es en cinco patrones del catálogo, y por dos motivos distintos que
conviene no confundir:

- **`salto`, `rotacion_externa_hombro`, `apoyo_una_pierna` y `suspension`**: su categoría
  no está en la lista canónica, así que la tabla de modelos ni siquiera los puede
  nombrar. Es un hueco.
- **`movilidad_toracica`**: su categoría sí es canónica y su modelo está escrito como
  `null` a propósito — una movilidad no tiene carga contra la que medir palanca. Eso no
  es un hueco, es una decisión.

## Cómo se leen los ejes

El sujeto mira a **+Z** y su plano sagital es **X = 0**. Así que **Y** es la altura
—contra la que tira la gravedad—, **Z** es adelante/atrás (deriva sagital) y **X** es
izquierda/derecha (deriva frontal). En casi todo el catálogo la deriva frontal es cero;
donde NO lo es, es el dato principal.

El brazo de momento es la **mitad geométrica** del par: la otra mitad es la carga, que la
pone el asesorado y no vive en el patrón. Un brazo de 22 cm dice que a igualdad de peso
ese punto pide el doble que uno de 11; no dice cuántos newton-metro son.

---

### Flexión de hombro · `flexion_hombro`

Categoría **FLEXIÓN DE HOMBRO** · cadena **abierta** · apoyo **suelo** · ejemplo «Elevación frontal con mancuernas» → implemento **mancuernas** · línea de fuerza: **carga-externa**

| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hombro | motor | Húmero | Escápula | Flexión | sagital | 2° → 93° | 91° |
| Escápula | motor | Escápula | Caja torácica | Rotación ascendente | frontal | 2° → 22° | 20° |

**Trayectoria de `manoD`** — vertical (Y) 80.3 cm · sagital (Z) 50.5 cm · frontal (X) 5 cm · razón deriva/vertical 0.63

| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |
| --- | --- | --- |
| hombro | principal | 13.4 · 31.7 · 46.7 · 54.9 · 54.6 |

### Rotación de cadera · `rotacion_cadera`

Categoría **ROTACIÓN DE CADERA** · cadena **abierta** · apoyo **ninguno** · ejemplo «90/90 de cadera» → implemento **sin declarar** · línea de fuerza: **cable**

| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cadera | motor | Fémur | Pelvis | Rotación interna | transverso | 40° → -40° | 80° |

**Trayectoria de `tibiaD`** — vertical (Y) 1.2 cm · sagital (Z) 12.2 cm · frontal (X) 53.9 cm · razón deriva/vertical 45.54

**Brazo de momento**: no se mide (cable).

### Extensión lumbar · `extension_lumbar`

Categoría **EXTENSIÓN LUMBAR** · cadena **cerrada** · apoyo **ninguno** · ejemplo «Extensión lumbar en banco romano» → implemento **sin declarar** · línea de fuerza: **centro-de-masas**

| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Columna lumbar | motor | Pelvis | Vértebras lumbares | Extensión | sagital | 52° → -17° | 69° |
| Columna torácica | motor | Vértebras lumbares | Vértebras torácicas | Extensión | sagital | 33° → -10° | 42° |
| Cadera | motor | Pelvis | Fémur | Extensión | sagital | 46° → 6° | 40° |
| Cuello | libre | Vértebras torácicas | Vértebras cervicales | Flexión | sagital | -58° → -20° | 38° |
| Cabeza | libre | Vértebras cervicales | Cráneo | Flexión | sagital | -16° → -2° | 13° |

**Trayectoria de `torax`** — vertical (Y) 61.6 cm · sagital (Z) 27.4 cm · frontal (X) 0 cm · razón deriva/vertical 0.45

| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |
| --- | --- | --- |
| lumbar | principal | 12.2 · 11.4 · 8.7 · 4 · 2.4 |
| cadera | principal | 15.7 · 15 · 12.3 · 7.5 · 1.1 |

### Flexión de muñeca · `flexion_muneca`

Categoría **FLEXIÓN DE MUÑECA** · cadena **abierta** · apoyo **ninguno** · ejemplo «Curl de muñeca con barra sentado» → implemento **barra** · línea de fuerza: **carga-externa**

| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muñeca | motor | Carpo | Radio y cúbito | Flexión | sagital | -52° → 49° | 101° |

**Trayectoria de `manoD`** — vertical (Y) 25.8 cm · sagital (Z) 6.9 cm · frontal (X) 6.9 cm · razón deriva/vertical 0.27

| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |
| --- | --- | --- |
| muñeca | principal | 0 · 0 · 0 · 0 · 0 |
| muñeca | principal | 0 · 0 · 0 · 0 · 0 |

### Extensión de muñeca · `extension_muneca`

Categoría **EXTENSIÓN DE MUÑECA** · cadena **abierta** · apoyo **ninguno** · ejemplo «Curl inverso de muñeca con barra» → implemento **barra** · línea de fuerza: **carga-externa**

| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muñeca | motor | Carpo | Radio y cúbito | Extensión | sagital | 58° → -36° | 94° |

**Trayectoria de `manoD`** — vertical (Y) 27.5 cm · sagital (Z) 9.7 cm · frontal (X) 6.7 cm · razón deriva/vertical 0.35

| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |
| --- | --- | --- |
| muñeca | principal | 0 · 0 · 0 · 0 · 0 |


---

## Lo que estas hojas destapan y no se arregla aquí

- **El brazo de momento de la muñeca sale 0 en las cinco fases.** No es que no haya
  palanca: es que `puntoDeCarga()` pone la carga en el ARRANQUE del hueso de la mano, que
  es justo donde está el eje de la muñeca. Para un curl de muñeca la carga está en el
  extremo distal, a la longitud de la mano. Mientras siga así, los dos patrones de muñeca
  se dibujan sin flecha de fuerza aunque su modelo exista.
- **El retardo distal se come 13° en cada extremo de la muñeca.** La ficha pide 114° de
  flexión y el motor entrega 101; pide 106 de extensión y entrega 94. No es un error de la
  ficha: es que la muñeca es lo más distal de la cadena y llega tarde a la fase 1. Cambia
  lo que hay que escribir en una ficha de articulación pequeña — para ver el rango entero
  hay que pedir más del que se quiere ver.
- **La contra hacia atrás de la elevación frontal se escribió por manual y la medida la
  tumbó.** El razonamiento era correcto —los brazos son el 10 % de la masa y al subirlos
  el peso se sale del pie— pero `centroDeMasas` pesa el CUERPO, no la carga: la mancuerna
  que justifica la contra no está en la suma. Sin contra el peso se queda dentro del
  apoyo (−1,7 cm en el peor punto, margen 4); con −3° se va a −4,1 y con −9° a −14,1, y el
  signo dice detrás del talón. El día que la carga entre en la plomada, se vuelve a medir.
- **`estancamiento` va sin declarar en las cinco.** El campo dice que solo se declara
  donde hay medida publicada, y para estos cinco gestos no la hay. Usan el punto de en
  medio, que es preferible a inventarle un número a cada patrón.
- **El empuje de trineo sigue saliendo como un salto.** Defecto anterior, medido y
  deliberadamente no tocado: la decisión de si un trineo merece ficha propia o merece
  quedarse sin sujeto es de Bryan.
