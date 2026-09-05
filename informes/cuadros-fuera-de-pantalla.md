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

Verificado: `npm run verify` limpio — 0 errores, 6 avisos (delta cero), **3.091 pruebas**.
Los guardianes nuevos se vieron fallar a propósito antes de darlos por buenos: los tres del
asentado con la función neutralizada, y los dos del catálogo subiendo el tope a 60°.

## La decisión: la cámara del salón se acota en 10°

**Bryan, 2026-09-03, viendo las dos capturas.** El salón entra con
`elevacionDelSalon(patron.camara.elevacion)`, que es `min(elevación, 10°)`. Las otras dos
salidas —llevar la información al suelo, o dejar mover la elevación con el dedo— quedan
descartadas para esta tanda.

Lo que **no** toca, y es lo que hace que la decisión sea barata:

- el ángulo de estudio del patrón sigue intacto cuando el visor monta el patrón solo, que
  es para lo que se eligió: ver el movimiento. El catálogo conserva sus 56°;
- el ángulo y la distancia de la **estación de grabación** no se mueven: son el contrato de
  medida del encoder.

Lo que se paga: un press tumbado se ve casi de perfil en vez de desde arriba.

Medido después, con el mismo press inclinado que abría el salón vacío:

```
  cuadro        x     y   ancho  alto   tope   ↑sobra ↓sobra
  ejercicio    270    26    163   179    206     -26   -639
  series       -26    30    128    58     74     -30   -756
  registro     -25   154    149    58     59    -154   -633
```

Ninguno se sale, y ninguno pasa su tope de alto.

**Y la prueba que cierra el caso:** `geometriaDeCuadro.test.ts` recorre **los 32 patrones
del catálogo contra los nueve sitios de la pared** y exige que ninguno quede fuera. Con el
tope neutralizado se pone en rojo con 73 combinaciones y 10 patrones nombrados; con el tope
puesto, verde. Si mañana entra un patrón con la cámara a 50°, se entera sola.

El techo del cuadro del ejercicio —**10°**— sigue clavado en su propia prueba: si alguien
le añade un campo, baja, y esa prueba lo dice.
