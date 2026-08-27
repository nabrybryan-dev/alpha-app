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

## Dónde anotar lo que salga

Aquí mismo, debajo. Una fila por medición, con fecha y aparato.

| fecha | móvil | A (puerta puesta) | B (puerta quitada) | notas |
| --- | --- | --- | --- | --- |
| | | | | |
