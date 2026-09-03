# Los cuadros del salón se salían por arriba — 2026-09-03

**Qué se fue a arreglar:** dos flecos anotados al cerrar el salón —la carga en kg no
estaba en el cartel de la pared, y el cuadro del ejercicio rozaba el borde de arriba—.
**Qué se encontró al medir:** el segundo no era un roce. Con el ejercicio de hoy
(`Press inclinado en multipower`) los tres cuadros del salón caían **entre 629 y 861 px
POR ENCIMA** de una pantalla de 390 × 844. El salón se abría sin una sola letra dentro.

## Lo medido, no lo supuesto

Con `node testigo/cuadros-en-pantalla.mjs`, que abre un Chrome de verdad, emula el
teléfono y lee el rectángulo de cada `[data-cuadro]`:

```
  cuadro        x     y   ancho  alto   ↑sobra ↓sobra ←sobra →sobra
  ejercicio    293  -861    212   181      861  -1524   -293    116   ←SE SALE
  series       -92  -801    166    60      801  -1585     92   -316   ←SE SALE
  registro     -77  -629    184    63      629  -1410     77   -283   ←SE SALE
```

Idéntico en 414 × 736 y con el movimiento reducido apagado: no es del viewport ni de la
animación de entrada.

## La causa: la elevación de la cámara no es una constante del salón

Las alturas de `sitiosDeLaPared.ts` se midieron con la cámara del salón a **6°**, que es
la elevación de los patrones **de pie**. Pero la elevación la pone cada patrón
(`patron.camara.elevacion`) y en `domain/patrones/catalogo.ts` va **de 2° a 56°**, porque
un ejercicio **tumbado se estudia desde arriba**. Cuanto más mira la cámara al suelo, más
sube el muro de enfrente en la pantalla.

El reparto del catálogo (32 patrones):

| elevación | patrones | qué pasa con los cuadros |
|---|---|---|
| 0°–10° | 22 | caben, con el asentado nuevo |
| 12°–14° | 3 | el cuadro del ejercicio se corta por arriba |
| 32°–56° | 7 | **no se ve NINGUNA altura del muro**: el cono de la cámara cae entero sobre el suelo |

Los siete de arriba son la familia tumbada: empuje horizontal, empuje inclinado, apertura
de pecho, retracción escapular.

`node scripts/banda-del-muro.mjs` imprime, para cada elevación, qué alturas del muro caen
dentro del cuadro. A 32° la más alta visible ya es **−0,05 m** — bajo el suelo.

## Por qué ninguna prueba se puso en rojo

Los tres cuadros **estaban montados**, con su texto y su marco. jsdom no proyecta nada: el
DOM decía que existían y las 3.072 pruebas estaban verdes. Es la misma familia de fallo que
la pantalla negra del 28 de agosto — lo que hay que comprobar no es que el nodo exista, es
dónde cae.

## Lo que se arregló

1. **La carga sube a la pared.** `carga` es el noveno campo de `contenidoPared()` y cuelga
   del muro izquierdo con las series y el RIR. `cargaKg` sin definir no se escribe como
   «0 kg»: se dice que la prescripción no lleva kilos.
2. **`asentarEnLaBanda()`** baja cada cuadro por su muro lo justo para que no se salga por
   arriba, con una cámara canónica (el cuadro de frente) para que la altura no cambie al
   orbitar. Solo baja, nunca sube, y no pasa de 1,9 m, que es donde el cuerpo del sujeto
   empieza a taparlo.
3. **Series, carga y RIR en una fila.** Con los cinco campos apilados el cuadro del
   ejercicio medía **249 px de 844 — el 30 % de la pantalla**. En fila baja a 179 px, y de
   paso deja de rozar el borde: 49 px de margen a 6°.
4. **El tope de alto se mide.** Cada cuadro publica `data-alto-tope` y el testigo compara
   el alto de verdad con el declarado. Ya cazó el primero: con la carga añadida el cuadro
   pasaba su tope en 30 px.

Verificado: `npm run verify` limpio — 0 errores, 6 avisos (delta cero), **3.089 pruebas**.
Los tres guardianes nuevos se vieron fallar con el asentado neutralizado antes de darlos
por buenos.

## Lo que NO se arregló, y es decisión de Bryan

**Los 7 patrones tumbados siguen abriendo el salón vacío.** No es una altura mal elegida:
a 46° no existe ningún punto del muro de 6,8 m que entre en el cuadro. Lo único que se ve
es el suelo. Las salidas son tres y ninguna es un ajuste:

- **bajar la cámara del salón** (por ejemplo, tope de 10°) — la sala funciona siempre, y un
  press se ve casi de perfil en vez de desde arriba;
- **llevar la información al suelo** cuando el muro no se ve — es lo que está en cuadro, y
  encaja con las marcas rojas que ya hay;
- **dejar cambiar la elevación con el dedo** — hoy no se puede: el arrastre vertical es el
  eje W.

El techo actual está clavado en una prueba (`geometriaDeCuadro.test.ts`): **10°**. Si
alguien añade un campo al cuadro del ejercicio, el techo baja y esa prueba lo dice.
