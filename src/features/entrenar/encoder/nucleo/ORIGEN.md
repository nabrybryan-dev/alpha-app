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

## Lo que esa comprobación NO puede hacer, y quién lo hace ahora

Las huellas solo detectan que *aquí* se tocó algo. Si el que cambia es el de
allí, los dos ficheros se separan **en silencio**: la copia sigue intacta, las
huellas siguen en verde, y la app mide con un núcleo viejo.

Eso no es hipotético. El **23 de agosto de 2026** se descubrió que llevaba
semanas pasando: a esta copia le faltaban el ajuste de elipse del disco —6-9 % de
escala sistemático, y nada detectado por encima de 25° de cámara— y el umbral de
giro, que costó una tanda entera de diez tomas grabadas con el indicador en
verde. Las huellas estuvieron en verde todo el tiempo. **Una copia intacta y
obsoleta es peor que una tocada**, porque nada la delata.

Desde entonces hay un segundo guardián en `nucleo.test.ts`, y corre dentro de
`npm run verify`: si encuentra el repo de las herramientas, compara los tres
ficheros contra el original y se pone rojo si se han separado. Busca en las
colocaciones conocidas, o donde diga `ENCODER_HERRAMIENTAS`.

**Se salta cuando el otro repo no está** —en el CI no está— y eso es deliberado:
un guardián que se pone rojo por algo que no depende de quien lo lee enseña a
ignorar los rojos. Así que sigue habiendo un hueco, y conviene tenerlo escrito:
en una máquina sin el repo de herramientas, esto no protege de nada. Ahí sigue
valiendo `comprobar-copia-en-la-app.mjs`, que se corre a mano desde el otro lado.

Es el mismo riesgo que ya tiene el proyecto entre `dutyEnT` y el firmware de la
claqueta: dos ficheros que tienen que ir a la par y que, si se separan, no dan
error — dan números creíbles y equivocados.

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
