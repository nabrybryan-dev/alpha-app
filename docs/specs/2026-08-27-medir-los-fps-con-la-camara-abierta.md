# Medir los fps del encoder con la cámara abierta

**Qué contesta:** si el movimiento del área de entrenamiento le está costando fotogramas
a la captura. **Cuánto tarda:** tres minutos. **Qué hace falta:** el móvil que se usa de
verdad y una barra con un disco.

Esto existe porque la auditoría de movimiento del 27/08 dejó una afirmación sin
comprobar, y conviene que deje de estarlo. Todo lo demás de aquella tanda se midió —las
barras, el `.press` con movimiento reducido, los colores en los dos temas— leyendo
estilos calculados en el navegador. Los fps **no**: dependen del aparato, de la cámara y
del calor, y no hay forma honesta de deducirlos desde un portátil.

## Por qué 50, y no «que vaya fluido»

No es una preferencia estética. Por debajo de 50 fps **la puerta descarta la toma**, y el
copy que lo dice está escrito:

> «La cámara grabó a menos de 50 fps. A 30 fps la pérdida de velocidad se va 5 puntos, y
> es la que decide la dosis.» — `encoder/copys.ts`, `pocos_fps_largo`

O sea que un fotograma perdido no es un parpadeo: es una serie que hay que repetir con el
asesorado de pie esperando.

## Dónde está el número

La barra de medidas del visor lo pinta en vivo. Lo escribe `medirFps` en
`encoder/useCaptura.ts`, desde el mismo callback de fotograma que dibuja el instrumento
—no pasa por estado de React a propósito—. Es la lectura **fps**.

## La palanca del A/B

La app ya trae con qué comparar. Cuando se abre la cámara, `RegistroSerie` pone
`data-camara-abierta` en el `<body>`, y `tokens.css` cuelga de ese atributo dos reglas:

```css
[data-camara-abierta] * { animation-play-state: paused !important; }
[data-camara-abierta] * { backdrop-filter: none !important; }
```

Quitar el atributo a mano **enciende otra vez todo el movimiento** sin tocar nada más:
las cuatro animaciones infinitas del gabinete, el ticker del panel de ritmo y el
desenfoque de la barra de descanso. Esa es exactamente la diferencia que se quiere medir.

## El procedimiento

1. Móvil en el trípode, con el visor abierto y el disco fijado. **Que la pantalla no se
   apague** y que el móvil no esté recién sacado del bolsillo: si está caliente, el
   resultado no vale para nada.
2. **Toma A — con la puerta puesta (lo normal).** Grabar una serie completa y anotar el
   fps más bajo que se vea, no el promedio. El mínimo es lo que decide.
3. Conectar el móvil por USB y abrir las devtools remotas de Chrome (`chrome://inspect`
   en el portátil). En la consola:
   ```js
   delete document.body.dataset.camaraAbierta
   ```
4. **Toma B — con la puerta quitada.** Repetir la misma serie, mismo sitio, misma luz.
   Anotar otra vez el mínimo.
5. Volver a poner la puerta y confirmar que se recupera:
   ```js
   document.body.dataset.camaraAbierta = 'si'
   ```

Repetir A y B una vez más, alternando el orden. Dos pasadas de cada una: si A y B se
solapan, no hay señal.

## Cómo se lee el resultado

| | |
| --- | --- |
| **B baja de 50 y A no** | La puerta de cámara está ganándose el sueldo. No tocar nada, y no añadir movimiento nuevo a esas pantallas. |
| **Las dos por encima de 50, sin diferencia clara** | El movimiento no era el cuello de botella en ESTE aparato. Sigue sin serlo en uno más lento — no se puede extrapolar hacia abajo. |
| **A también baja de 50** | El problema no es el movimiento: es la captura. Ahí lo que se mira es `useCaptura`, no las animaciones — el `getImageData` por fotograma y la segmentación. |

Anotar el modelo del móvil junto al número. Un resultado sin el aparato al lado no dice
nada, y este repo ya se quemó una vez dando por bueno un dato sin su contexto.

## Lo que este procedimiento NO contesta

- **El coste de la profundidad.** La escala `--prof-*` crea capas de composición que la
  puerta de cámara **no** deshace: `perspective: none` quita el escorzo, no las capas. Su
  propio comentario en `tokens.css` lo dice — «es un apagado del efecto, no del coste».
  Medir eso pide el perfilador, no la lectura de fps.
- **Si `requestVideoFrameCallback` existe en el aparato.** Si no está, el bucle cae al
  `requestAnimationFrame` de respaldo, y ahí los callbacks corren **antes** de
  estilo/maquetación/pintado en el mismo fotograma: cualquier cosa que invalide la
  maquetación se recalcula dentro del fotograma que el bucle intenta cerrar. Comprobarlo
  aparte:
  ```js
  'requestVideoFrameCallback' in HTMLVideoElement.prototype
  ```

## Sin móvil a mano: la cámara sintética

El procedimiento de arriba es el que vale. Esto es el banco de pruebas para cuando no
hay móvil delante: sirve para **probar que el bucle corre y comparar A contra B en el
portátil**, no para dar un número que se pueda llevar al gimnasio. Los fps dependen del
aparato, y un portátil no dice nada de un teléfono de gama media caliente.

La idea es sustituir la cámara por un lienzo que se anima: `getUserMedia` devuelve el
`captureStream()` de un canvas con un disco subiendo y bajando, que es exactamente lo
que el segmentador busca. El encoder no se entera —recibe un `MediaStream` con sus
`videoWidth`/`videoHeight`— y el bucle de captura corre entero: `drawImage`, el
`getImageData` del lienzo de 640, la segmentación y las siete escrituras de `textContent`.

Pegar esto en la consola **antes** de tocar «Abrir cámara»:

```js
const c = document.createElement('canvas')
c.width = 1280; c.height = 720
const g = c.getContext('2d')
const t0 = performance.now()
;(function pinta () {
  const t = (performance.now() - t0) / 1000
  g.fillStyle = '#101014'; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#f2f2f2'
  g.beginPath(); g.arc(640, 360 + Math.sin(t * 1.4) * 240, 78, 0, Math.PI * 2); g.fill()
  requestAnimationFrame(pinta)
})()
const flujo = c.captureStream(60)
navigator.mediaDevices.getUserMedia = async () => flujo
```

Y a partir de ahí, el mismo A/B: `delete document.body.dataset.camaraAbierta` para la
toma B, y el atributo puesto para la A.

### Dónde se corre importa: la puerta NO existe en `/entrenar/encoder`

El atributo lo escribe **`RegistroSerie`** y nadie más (`camaraAbierta.ts`, un único
llamante). O sea que la puerta de cámara está puesta cuando se mide **desde la sesión**
—`RegistroSerie` → `HojaMedicion` → visor—, y **no** cuando se abre la página suelta de
`/entrenar/encoder`. Comprobado el 27/08: con el flujo sintético ya enganchado en esa
página, `document.body.dataset` estaba **vacío**.

Consecuencia para el A/B: en la página suelta, la toma A no es «con la puerta puesta»
sino «sin puerta» — se estarían midiendo dos veces las mismas condiciones y saldría que
el movimiento no cuesta nada. La medición se hace **desde la sesión**; si aun así se
quiere usar la página suelta, hay que poner el atributo a mano para la toma A:

```js
document.body.dataset.camaraAbierta = 'si'
```

### La condición que invalida la medición: la pestaña en segundo plano

**La ventana de Chrome tiene que estar delante.** No es una recomendación: en una
pestaña oculta Chrome **congela el reloj de animación** —`document.timeline.currentTime`
se queda quieto—, así que ni el `requestAnimationFrame` que pinta el lienzo ni el
`requestVideoFrameCallback` del bucle de captura llegan a dispararse. Comprobado el
27/08 en este mismo montaje: con la ventana detrás, el vídeo recibía el flujo y decía
`1280×720` reproduciéndose, y la barra de medidas seguía marcando **`fps —`** después de
dos segundos y medio. Ni un solo fotograma.

O sea que el modo de fallo es el peor posible: **parece que mide y da un número bajo**.
Si alguien corre esto con la ventana minimizada y anota lo que sale, anota la
estrangulación de Chrome creyendo que anota el coste del movimiento. Antes de dar por
buena cualquier lectura:

```js
document.visibilityState   // tiene que decir "visible"
```

Este repo ya se comió esa trampa una vez el mismo día, midiendo el contraste de una
transición en una pestaña oculta y acusando a `main` de un fallo que no existía.

## Dónde anotar lo que salga

Aquí mismo, debajo. Una fila por medición, con fecha y aparato.

| fecha | móvil | A (puerta puesta) | B (puerta quitada) | notas |
| --- | --- | --- | --- | --- |
| | | | | |
