# Los carteles de las estaciones no se dibujan encima del sujeto

**2026-09-10** · salón de `/entrenar` · rama `salon/kit-verificado`

## Qué pasaba

El kit «Sala de entrenamiento» pide, en su criterio de aceptación 3, que **ningún rótulo,
cifra ni panel se dibuje encima del sujeto ni de otro texto**. Bryan lo había dicho antes
con sus palabras —«desaparecer la mayor cantidad de letras y cuadros que tapen el salón»— y
quedaba anotado como el único defecto declarado y sin cerrar del salón: «los carteles de las
estaciones a veces tapan al sujeto».

Se midió, y no era «a veces»: **era siempre**.

## Cómo se midió

`testigo/carteles-y-sujeto.mjs`, un Chrome de verdad a 390×844 conducido por el protocolo de
DevTools. Por cada posición de cámara toma tres capturas —con carteles, sin carteles, y sin
sujeto— y cuenta **tinta**, no rectángulos: `sin carteles − sin sujeto` son los píxeles que
pinta el cuerpo, y de esos, los que cambian al encender los carteles son los que el cartel se
ha comido. El rectángulo de un cartel es casi todo transparente, así que medirlo por su caja
habría dado un número inflado que no se parece a lo que se ve.

Se mide con `prefers-reduced-motion: reduce`, y eso es el **peor caso a propósito**: ahí las
cuatro cifras se quedan puestas para siempre —una animación que termina en `opacity: 0`
dejaría la prescripción invisible para quien pide movimiento reducido— así que es el estado
en el que más se tapa, y es el estado real de una persona real.

| | tinta del cuerpo tapada |
|---|---|
| Antes | **9 % – 37 %**, mediana 25 %, en las 13 posiciones de cámara |
| Después | **0 %** en la mitad de las posiciones, **≤ 1,6 %** en el resto (bordes suavizados) |

La foto lo enseña mejor que la tabla: las dos cifras grandes caían justo sobre los antebrazos
del press inclinado.

## Por qué no bastaba con moverlos en un solo eje

Los dos cuerpos que de verdad se dan piden salidas **opuestas**:

- **De pie** el cuerpo es estrecho y altísimo. Ocupa de la cabeza a los pies casi toda la
  pantalla útil: quedan 36 px de aire sobre la cabeza y 42 bajo los pies, y el cartel mide 92.
  Por arriba y por abajo no cabe. A los lados, sobra sitio.
- **Tumbado en un banco** es lo contrario: una banda estrecha que va de x=40 a x=350 de una
  pantalla de 390. No hay un solo hueco horizontal, y toda la holgura está arriba y abajo.

Por eso `desvioDelCartel()` calcula los cuatro escapes, descarta los que se salen del marco
—un cartel fuera de la pantalla no tapa al sujeto y tampoco se lee: es el mismo criterio 3
incumplido por el otro lado— y se queda con **el más corto**.

## Dónde vive

- `salon/estaciones/sitioDelCartel.ts` — la decisión, función pura, con los dos bordes del
  marco medidos en el salón (la banda de la sesión arriba; el tirador del panel, la tira de
  puntos y la barra de navegación abajo).
- `salon/estaciones/EstacionesDelSujeto.tsx` — `useEsquivarElCuerpo`, un bucle de
  `requestAnimationFrame` que **escribe dos variables CSS en el nodo y no toca el estado de
  React**. No es una optimización: el cuadro del cuerpo cambia sesenta veces por segundo, así
  que un `setState` aquí repintaría las cuatro estaciones en cada fotograma, que es justo lo
  que el kit prohíbe.
- El desvío se calcula siempre contra el sitio **natural** del cartel, nunca contra donde
  está ahora: contra su sitio actual sería un lazo cerrado —apartado ya no pisa, así que el
  desvío pedido volvería a cero, volvería a pisar— y el cartel oscilaría para siempre.

## Guardián

`sitioDelCartel.test.ts`, ocho casos. Visto rojo con tres señuelos antes de contarlo:

1. no apartar nunca → 4 rojos;
2. esquivar solo en vertical → rojo el cuerpo de pie;
3. subir sin mirar el marco → rojo el que comprueba que no se mete bajo el panel.

## Lo que NO toca esta tanda, y sigue abierto

- La prescripción se ve **dos veces**: en el tablón del muro (grande, como pidió Bryan el
  6-sep) y en las cuatro estaciones alrededor del cuerpo. Con el muro llevándola siempre, el
  ciclo infinito de las cifras podría volver a ser lo que el kit dice —entran, se leen y se
  retiran—, y el salón quedaría aún más despejado.
  // DECISIÓN PENDIENTE: es palabra de Bryan, porque el ciclo lo pidió él.
- El nombre del ejercicio en trazo se monta sobre «CARGA A USAR» cuando es largo («Press
  inclinado en multipower» parte en dos líneas). Es el mismo criterio 3, en el otro texto.
- El sujeto en la capa exterior sigue siendo el manojo de músculos pálidos sin huesos.
