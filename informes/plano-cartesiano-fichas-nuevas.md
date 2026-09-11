# El plano cartesiano de las fichas nuevas — 2026-09-06

Cinco fichas nuevas en el catálogo de patrones, y lo que cada una hace medido sobre el
motor: cuántos grados recorre cada articulación, qué segmento se mueve sobre cuál, por
dónde pasa el punto seguido en los tres ejes del mundo, y cuánto brazo de palanca le
queda a cada eje en cada fase.

**Nada de este informe está escrito a mano.** Sale de
`pruebas/plano-cartesiano.test.ts`, que se puede volver a correr. Las cifras están medidas
con el **varón real** como juego de huesos por defecto (commit `7eed7a0`); con el cuerpo
neutro anterior cambian unos centímetros —el brazo subía 80 en vez de 76— sin que cambie
nada de lo que dicen:

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
ninguna ficha a la que aplicarse.

Lo que sí faltaba era decir **con qué se hace** cada ejercicio, que es lo que decide si
además de moverse se le puede dibujar una flecha: de los 90 ejemplos del catálogo, **37 no
declaraban implemento**. Ahora son **2**, y los dos callan a propósito.

Se cerraron de dos formas distintas, y la diferencia importa. **Por familia**, cuando el
nombre ya dice el implemento aunque no lo nombre: la **banda elástica** —que ni existía en
la tabla y se estaba usando: band pull apart, rotación con banda, tibial posterior—, los
saltos, las planchas, los equilibrios, los colgados, la movilidad, el banco romano, un
crunch a secas y el pec deck, que es el nombre de la máquina y no del gesto. Y **por
apellido**, poniéndoselo al ejemplo, que es lo correcto cuando el gesto admite varios
implementos y aquí se elige uno para dibujarlo: press militar *con barra*, face pull *en
polea*, peso muerto parcial *con barra* desde rack.

Los dos que quedan son el mismo ejercicio —el paseo del granjero y la maleta— y callan por
dos razones. La de siempre: se hace con mancuernas o con barra hexagonal y el nombre no lo
dice. Y una **medida**: ponerle apellido le da implemento de peso libre, y con peso libre
se enciende la ley de trayectoria, que sobre un porteo da razón 1,12 y lo marca como
incumplido. No porque el gesto esté mal — porque un porteo **camina**, y esa ley mide la
deriva contra el mundo.

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

**Trayectoria de `manoD`** — vertical (Y) 75.5 cm · sagital (Z) 48 cm · frontal (X) 4.7 cm · razón deriva/vertical 0.64

| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |
| --- | --- | --- |
| hombro | principal | 15.2 · 35 · 50.8 · 59.1 · 58.4 |

### Rotación de cadera · `rotacion_cadera`

Categoría **ROTACIÓN DE CADERA** · cadena **abierta** · apoyo **ninguno** · ejemplo «90/90 de cadera» → implemento **peso-corporal** · línea de fuerza: **centro-de-masas**

| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cadera | motor | Fémur | Pelvis | Rotación interna | transverso | 40° → -40° | 80° |

**Trayectoria de `tibiaD`** — vertical (Y) 1.2 cm · sagital (Z) 12.5 cm · frontal (X) 56.1 cm · razón deriva/vertical 46.36

| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |
| --- | --- | --- |
| cadera | principal | 10.8 · 11.1 · 11.3 · 11.3 · 11 |

### Extensión lumbar · `extension_lumbar`

Categoría **EXTENSIÓN LUMBAR** · cadena **cerrada** · apoyo **ninguno** · ejemplo «Extensión lumbar en banco romano» → implemento **peso-corporal** · línea de fuerza: **centro-de-masas**

| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Columna lumbar | motor | Pelvis | Vértebras lumbares | Extensión | sagital | 52° → -17° | 69° |
| Columna torácica | motor | Vértebras lumbares | Vértebras torácicas | Extensión | sagital | 33° → -10° | 42° |
| Cadera | motor | Pelvis | Fémur | Extensión | sagital | 46° → 6° | 40° |
| Cuello | libre | Vértebras torácicas | Vértebras cervicales | Flexión | sagital | -58° → -20° | 38° |
| Cabeza | libre | Vértebras cervicales | Cráneo | Flexión | sagital | -16° → -2° | 13° |

**Trayectoria de `torax`** — vertical (Y) 67.1 cm · sagital (Z) 29.9 cm · frontal (X) 0 cm · razón deriva/vertical 0.45

| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |
| --- | --- | --- |
| lumbar | principal | 13.5 · 12.8 · 10 · 4.9 · 2 |
| cadera | principal | 17.4 · 16.7 · 13.9 · 8.8 · 1.9 |

### Flexión de muñeca · `flexion_muneca`

Categoría **FLEXIÓN DE MUÑECA** · cadena **abierta** · apoyo **ninguno** · ejemplo «Curl de muñeca con barra sentado» → implemento **barra** · línea de fuerza: **carga-externa**

| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muñeca | motor | Carpo | Radio y cúbito | Flexión | sagital | -52° → 49° | 101° |

**Trayectoria de `manoD`** — vertical (Y) 25.9 cm · sagital (Z) 6.9 cm · frontal (X) 6.4 cm · razón deriva/vertical 0.27

| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |
| --- | --- | --- |
| muñeca | principal | 5.6 · 7 · 7.8 · 7.1 · 4.7 |

### Extensión de muñeca · `extension_muneca`

Categoría **EXTENSIÓN DE MUÑECA** · cadena **abierta** · apoyo **ninguno** · ejemplo «Curl inverso de muñeca con barra» → implemento **barra** · línea de fuerza: **carga-externa**

| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muñeca | motor | Carpo | Radio y cúbito | Extensión | sagital | 58° → -36° | 94° |

**Trayectoria de `manoD`** — vertical (Y) 27.3 cm · sagital (Z) 9.8 cm · frontal (X) 6.2 cm · razón deriva/vertical 0.36

| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |
| --- | --- | --- |
| muñeca | principal | 3.4 · 4.7 · 7 · 7.9 · 6.8 |

---

## Y el otro hueco de la física: 22 familias con cuerpo y sin flechas

Tener sujeto no basta. Sin modelo mecánico el salón dibuja el cuerpo moviéndose y **ni una
sola flecha de fuerza**, que es la mitad de lo prometido. Medido sobre producción: **22 de
las 150 familias con sujeto** acababan sin plan de medida —el 15 % de lo que se prescribe—
y casi todas de PREV/REHAB, que es donde el asesorado más necesita entender qué sostiene.

La causa era de índice, no de biomecánica: la tabla de modelos va por categoría canónica y
cuatro fichas del catálogo tienen categorías que no están en la taxonomía, así que no se
las podía ni nombrar. Ahora quedan **3**, las de `MOVILIDAD`, escritas `null` a propósito.

Lo que más importa de esos cuatro modelos no es el número: es **dónde se pone la cámara**.
Dos no se graban de lado. La rotación del manguito ocurre en el plano transverso —de perfil
el recorrido se proyecta sobre un punto y la medida sale cero con cara de dato— y el apoyo
a una pierna se rompe en el plano frontal, con la pelvis cayendo hacia el lado libre.

## Lo que estas hojas destaparon

- **El brazo de momento de la muñeca salía 0 en las cinco fases — y ya no.** No era que no
  hubiera palanca: `puntoDeCarga()` ponía la carga en el ARRANQUE del hueso de la mano, que
  es exactamente donde está el eje de la muñeca, así que la distancia era cero **por
  construcción**. Un cero que sale de la geometría del rig y no del ejercicio es un cero que
  miente, y encima es invisible: no falla nada, simplemente no se dibuja ninguna flecha.
  Arreglado poniendo la carga en la palma (0,45 del hueso, 8 cm de los 18 que mide la mano),
  que es donde cruza el eje de una barra. Medido en todo el catálogo: curl de bíceps 24,1 →
  32,6 cm, press militar 23,8 → 30,3, remo 17,4 → 23,5, apertura 10,9 → 15,6, curl de muñeca
  0,0 → 8,7. Los de cadena cerrada apenas se mueven, que es la comprobación de que el número
  no es un ajuste a ojo: cambia donde el agarre manda y no cambia donde no.
- **El retardo distal se come 13° en cada extremo de la muñeca.** La ficha pide 114° de
  flexión y el motor entrega 101; pide 106 de extensión y entrega 94. No es un error de la
  ficha: es que la muñeca es lo más distal de la cadena y llega tarde a la fase 1. Cambia lo
  que hay que escribir en una ficha de articulación pequeña — para ver el rango entero hay
  que pedir más del que se quiere ver.
- **La contra hacia atrás de la elevación frontal se escribió por manual y la medida la
  tumbó.** El razonamiento era correcto —los brazos son el 10 % de la masa y al subirlos el
  peso se sale del pie— pero `centroDeMasas` pesa el CUERPO, no la carga: la mancuerna que
  justifica la contra no está en la suma. Sin contra el peso se queda dentro del apoyo
  (−1,7 cm en el peor punto, margen 4); con −3° se va a −4,1 y con −9° a −14,1, y el signo
  dice detrás del talón. El día que la carga entre en la plomada, se vuelve a medir.
- **`estancamiento` va sin declarar en las cinco.** El campo dice que solo se declara donde
  hay medida publicada, y para estos cinco gestos no la hay. Usan el punto de en medio, que
  es preferible a inventarle un número a cada patrón.

## Lo que sigue abierto y no es de esta tanda

- **El muñeco daba un tirón de 12 grados dos veces por repetición** — CERRADO el 2026-09-06,
  y con una corrección a lo que este informe decía antes. Se había reportado que las fichas
  declaraban ángulos que el salón no enseñaba nunca, y estaba mal medido: la muestra se tomó
  con el sentido fijo en «subiendo» y el ciclo real **baja con el sentido invertido**. El
  recorrido completo sí aparecía; aparecía **de un salto**. El retardo distal se restaba a
  la fase con un signo que depende del sentido, así que en el cambio de sentido el canal
  saltaba a su extremo: 12,55 grados en 9 milésimas, dos veces por repetición. Como el rango
  completo salía, ninguna prueba de rango lo veía. Arreglado reescalando el retardo sobre la
  ventana disponible, que además hace la función continua: el mayor tirón del catálogo pasa
  de 12,55° a 1,39°.
- **El cuello de `movilidad_toracica`, de 11 grados a los 48 que declara** — CERRADO. No lo
  sobrescribía nadie: la capa que mantiene la cabeza mirando al frente es una resta
  proporcional a la inclinación del tronco, y ahí el tronco se inclina 52 grados, así que la
  resta se movía 32 en sentido contrario y el tope del cuello se comía el resto. Se arregla
  con la regla que ese archivo ya aplicaba a los brazos: una capa no se pelea con un canal
  que el patrón mueve a propósito.
- **Y la consecuencia, que no se esconde:** la sentadilla pasa a pedir **33,4° de
  dorsiflexión** en vez de 30,1 y la búlgara 38 en vez de 33. No piden más — es que hasta
  hoy no se enseñaban enteras. Treinta y tres grados de tobillo es mucho, y es justo por lo
  que el déficit de tobillo es lo primero que se mira cuando alguien no baja. Si la
  sentadilla de demostración debe ser menos profunda, se toca la ficha.
- **Dos de los 90 ejemplos del catálogo no declaran implemento**, y son el mismo ejercicio:
  el paseo del granjero y la maleta. `undefined` no es lo mismo que `barra`, y aquí además
  ponerle apellido enciende una ley que no le corresponde (ver arriba).
- **El paseo del granjero CAMINA.** El día que se le declare implemento, su deriva hay que
  medirla contra la PELVIS y no contra el mundo, o la ley de trayectoria dará un número
  correcto que no significa nada.
- **El empuje de trineo salía como un salto** — CERRADO el 2026-09-06. La migración 0038 lo
  clasifica como acondicionamiento y la lista por nombre lo llevaba a `salto`, así que al
  asesorado al que se le manda empujar un trineo veinte metros le salía un muñeco saltando.
  Decisión de Bryan: **quitarle el muñeco antes que darle ficha propia**. Va declarado en
  `SIN_PATRON` con su motivo, que no es el del cardio: en una elíptica no hay gesto
  resistido que enseñar, y en un trineo lo hay — lo que falta es la ficha. El día que
  alguien la escriba hay que sacarlo de esa lista, y el test se pondrá rojo pidiéndolo.
