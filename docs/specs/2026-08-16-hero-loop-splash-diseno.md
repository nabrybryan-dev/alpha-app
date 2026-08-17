# Plancha de vídeo en el Splash y el Login — diseño

Fecha: 2026-08-16
Rama: `diseno/hero-3d-splash`

## Qué problema resuelve

El Splash y el Login son lo primero que ve un asesorado, y hoy son estáticos: el
Splash pinta un degradado radial y el Login una foto fija (`LoginPage.tsx:66`).
La marca declara una dirección visual «cinemática, oscura, cruda» en
`MarcaPage.tsx`, pero ninguna de las dos pantallas la ejerce.

Se añade un loop de 8 segundos de fondo — equipo Alpha y un atleta, la barra
despiezándose y volviendo a montarse — generado con Seedance 2.0 siguiendo la
guía de diseño web 3D.

## Qué NO es

- **No toca pantallas de uso en gimnasio.** Hoy, Entrenar, Sesión, Nutrición y
  Progreso se quedan exactamente como están. Un vídeo en bucle a mitad de una
  serie es batería y datos que el asesorado no eligió gastar.
- **No cambia la identidad.** Paleta, tipografías y curvas salen de
  `tokens.css`. No entra ningún token nuevo.
- **No mete texto en el vídeo.** `Splash.tsx:44-46` ya pinta el wordmark y el
  lema en HTML. El vídeo es plancha de fondo y nada más: el texto tiene que
  seguir siendo seleccionable, nítido a cualquier densidad y accesible.

## Decisiones

### El póster manda, el vídeo es la mejora

El `<video>` nunca es la única fuente de la imagen. El `poster` —el fotograma
que generó el paso 3 de la guía— es lo que se ve durante la carga, con conexión
mala, si el archivo falla, y para quien pide menos movimiento. Tiene que aguantar
solo. Si el póster no funciona como imagen fija, la dirección está mal elegida.

### Presupuesto de peso

| Archivo | Máximo |
|---|---|
| `public/hero/despiece.webm` | 900 KB |
| `public/hero/despiece.mp4` | 1,2 MB |
| `public/hero/despiece.jpg` | 120 KB |

Este límite no es estético. Este repo ya perdió semanas con un `@import` de
fuentes de 314 KB que bloqueaba el primer pintado de **todas** las pantallas,
incluidas las que no usaban esa tipografía (ver el comentario en
`tokens.css:730-737`). Un loop sin comprimir es el mismo error a mayor escala,
y el sitio donde caería es justo la pantalla de entrada.

El vídeo va con `preload="none"`: no se descarga hasta que el elemento decide
reproducir. El póster carga primero y siempre.

### Movimiento reducido: no se descarga nada

Con `prefers-reduced-motion: reduce` el `<video>` **no se monta**. No es que se
pause: no existe en el árbol, así que el navegador no pide el archivo. Quien pide
menos movimiento ve el póster y ya. Es coherente con los once bloques
`prefers-reduced-motion` que ya tiene `tokens.css`.

La preferencia se escucha en vivo (`change` sobre el `matchMedia`), no se lee una
sola vez al montar: si alguien la activa con la app abierta, el vídeo se va.

### Dónde vive el componente

`src/components/ui/FondoVideo.tsx` — es una primitiva sin lógica de negocio, lo
usan dos features distintas (`auth/Splash` y `auth/LoginPage`), y esa carpeta es
justo para eso.

### Duplicación conocida, a propósito

`useMovimientoReducido` se extrae a `src/components/ui/useMovimientoReducido.ts`,
copiado tal cual de `ExerciseSlotMachine.tsx:90-102`. **Ese archivo no se toca en
este cambio.** Consolidar los cinco sitios que hoy repiten la comprobación
(`AguilaInteractiva`, `FichaPanini`, `Revelar`, `useContadorAnimado`,
`ExerciseSlotMachine`) es una tanda propia, con sus tests, no un arreglo de
pasada dentro de otro cambio.

## Riesgos

- **El autoplay puede no arrancar.** iOS solo lo permite con `muted` y
  `playsInline`, y aun así puede fallar en ahorro de batería. Por eso el póster
  es la base: si el vídeo no arranca, la pantalla sigue siendo correcta y nadie
  lo nota.
- **El loop puede tener costura visible.** Se ve al montar, no antes. Si la junta
  canta, se corrige regenerando en Seedance con el mismo fotograma de inicio y
  fin, no parcheando en CSS.
- **El vídeo puede tapar el texto.** El prompt reserva el 40% inferior del
  encuadre en negro y sin nada legible. Además el HUD lleva su propio degradado.
  Las dos protecciones son necesarias: si el fotograma se regenera y se olvida la
  banda, el degradado es lo único que salva la lectura.

## Verificación

1. `npm run verify` en verde.
2. Los tests de `FondoVideo` cubren: monta el vídeo por defecto, no lo monta con
   movimiento reducido, reacciona al cambio de preferencia en vivo, y siempre
   deja el póster.
3. Los cuatro tests de `Splash.test.tsx` siguen pasando sin cambios: el vídeo no
   puede alterar el temporizador de 2,3 s ni el saltar-al-tocar.
4. A ojo en el navegador, que es donde se ve si el loop tiene costura.
