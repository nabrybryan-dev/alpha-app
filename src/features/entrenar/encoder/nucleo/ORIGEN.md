# De dónde sale este núcleo, y por qué no se toca aquí

Los tres `.js` de esta carpeta entran **verbatim** desde el otro repo:

    Cerebro Alpha/herramientas/encoder-camara/{analisis,disco,reloj-fotograma}.js

No son código nuevo. Son el código que llevan validando dos semanas **56 casos de
prueba** (`pruebas-velocidad.mjs` y `pruebas-disco.mjs`, que viven allí, no aquí) y
que ha cazado tres errores, uno de ellos de 14 puntos de %PV. Copiarlo tal cual es
deliberado: reescribirlo a TypeScript en el mismo movimiento en que se estrena la
pantalla mezclaría dos riesgos que conviene tener separados.

## La regla

**Aquí son de solo lectura.** Un arreglo se hace en `herramientas/encoder-camara`,
se corren allí las dos baterías, y luego se vuelve a copiar. Al revés no: un
parche hecho aquí no lo ve ninguna prueba.

`huellas.json` guarda el sha-256 de los tres archivos y `nucleo.test.ts` lo
comprueba. Si alguien edita una copia aquí, el test se pone rojo y dice cuál.

## Lo que esa comprobación NO puede hacer

**La app y las herramientas son dos repos distintos**, así que el test no puede
mirar el original: solo detecta que *aquí* se tocó algo. Si el que cambia es el
de allí, los dos ficheros se separan en silencio hasta la siguiente copia.

Para eso está `comprobar-copia-en-la-app.mjs`, en el repo de las herramientas: se
corre a mano y compara las dos copias. Es el mismo riesgo que ya tiene el proyecto
entre `dutyEnT` y el firmware de la claqueta, y se trata igual — dejándolo escrito
donde se va a leer.

## Por qué hay `.d.ts` a mano

`tsconfig` no tiene `allowJs`, y aun teniéndolo el JS no lleva tipos. Los `.d.ts`
declaran **solo lo que usa la pantalla**, con las formas leídas del original una
por una. Un `.d.ts` que declara de más miente igual que uno que declara de menos:
`unSoloMarcador` estuvo a punto de quedar tipado como si devolviera dos
marcadores, y eso habría compilado y reventado en el gimnasio.

## Lo que se quedó fuera

`claqueta.js` **no está aquí**. Sirve para dar base de tiempo común a varios
teléfonos y para medir el ritmo del cristal, y no hace falta para medir series: en
un teléfono suelto `captureTime` ya llega. Si algún día hacen falta dos cámaras
sincronizadas, se trae entonces.
