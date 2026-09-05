# El motor pinta superficies

**Fecha:** 2026-09-05 · **Rama:** `salon/motor-texturas` (sobre `salon/entrenar-4d`)

## Qué pide Bryan

Que el salón de `/entrenar` sea **un gimnasio por el que se pueda andar, como un
videojuego**, con el detalle de las máquinas y aspecto real. El 5-sep se construyó ese
gimnasio en Blender —`Desktop\gimnasio-blender\gimnasio.blend`— y él lo aprobó zona a
zona. Lo que falta es que la app lo pueda enseñar, y la app no puede: su motor no sabe
pintar superficies.

## Qué hay hoy

`src/features/entrenar/visor/motor.ts` es WebGL 1, un solo programa, seis atributos por
vértice (posición, normal, color, hueso, fibra, alfa) y todas las mallas concatenadas en
un búfer y dibujadas en tres tandas por opacidad. **No hay coordenadas de textura, no hay
muestreador, no hay imágenes.** Todo lo que se ve es color plano por vértice más un
modelo de luz de dos direcciones fijas.

Y la sala 3D (`escena/sala.ts`) **no tiene suelo**: pared cilíndrica, marcadores,
estación y mobiliario. Bajo los pies está el `clearColor` y el degradado del SVG.

## Por qué esto primero

Un rack modelado a la perfección, metido en este motor, se vería gris: la forma no es
lo que separa la plastilina del videojuego, es cómo la superficie coge la luz. El paso
que más cambia por lo que cuesta es enseñarle al motor a estampar una imagen sobre una
malla. Con eso, la geometría que ya existe deja de ser color plano, y es la puerta por
la que después entran las piezas horneadas en Blender.

## Qué se hace

1. **`Malla` lleva coordenadas de textura y una textura por malla.** Dos floats por
   vértice (`uv`) que nacen en cero, y `textura: string | null` de la malla entera, como
   ya son `alfa` y `encima`. `hornear()` las conserva. Ninguna malla existente cambia.
2. **El motor sabe cargar una imagen y estamparla.** `cargarTextura(nombre, imagen)`
   guarda una textura por nombre. El shader multiplica el color del vértice por la
   muestra de la textura cuando la malla la tiene, y por blanco cuando no: lo que ya se
   dibujaba se dibuja igual.
3. **El orden de dibujo agrupa por textura.** `ordenarPorOpacidad` sigue poniendo lo
   opaco delante y lo translúcido detrás, y además deja contiguas las mallas que
   comparten textura y devuelve los tramos. `dibujar()` recorre los tramos y cambia de
   textura entre uno y otro. Sin texturas hay un tramo por tanda: lo de siempre.
4. **La sala tiene suelo.** `escena/suelo.ts` construye un disco a ras de suelo con
   coordenadas en metros —la imagen cubre 3 × 3 m y se repite— y la textura
   `suelo-goma`. El visor lo empuja junto a la sala y carga la imagen al arrancar.
5. **La imagen** es `public/texturas/suelo-goma.jpg`: 1024², 77 KB, sacada de la
   escena de Blender (Poly Haven `anti_skid_tiles`, CC0, desaturada y oscurecida a goma).

## Qué NO se hace

- No se carga glTF ni piezas de fuera todavía. Eso es el paso siguiente y necesita
  esto antes.
- No se toca el modelo de luz, ni la órbita, ni el encuadre.
- No se añade ninguna librería. El motor sigue siendo WebGL a mano.

## Cómo se comprueba

- **Sin WebGL (vitest):** `Malla` escribe y conserva `uv`; `hornear` las lleva;
  `ordenarPorOpacidad` agrupa por textura y sus tramos suman todos los índices;
  `Motor.subir()` sube el búfer `uv` byte a byte; `construirSuelo` hace un disco con
  todas las caras mirando hacia ARRIBA —la regla de las caras al revés— y `uv` en
  metros.
- **Con píxeles (Chrome, pestaña delante):** `node testigo/salon-visible.mjs` sigue en 0
  con los cinco elementos, y una captura enseña el suelo con juntas donde antes había
  color plano.
- **En el teléfono de Bryan:** que no se arrastre. Es él quien lo mide.

## Riesgos

- El oscurecimiento de contacto del shader (`u_suelo`) baja el ambiente a ras de
  suelo: el suelo nuevo está en `y = 0` y le toca entero. Es goma oscura, así que sirve,
  pero si la textura sale más negra de lo que es, la causa es esa y no la imagen.
- Una textura que no sea potencia de dos no admite repetición en WebGL 1. La imagen es
  1024² a propósito.
