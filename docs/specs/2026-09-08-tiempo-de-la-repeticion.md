# El tiempo de la repetición (2026-09-08)

## Los tres tiempos del salón

El salón cuenta tres cosas y hasta hoy solo dos se podían tocar:

1. **El reloj de sesión** — cuenta hacia arriba desde que se abre el salón. Corre solo.
2. **El descanso** — cuenta hacia atrás desde el descanso pautado. Lo arranca el mando,
   tirando del disco a la izquierda (y a la derecha, el excéntrico).
3. **La repetición** — lo que tarda el sujeto en bajar y subir en la demostración. Corría
   dentro del bucle de dibujo, y **no había forma de pararlo**: para mirar el instante en
   que el codo pasa por 90° había que esperar a que volviera a pasar.

Este trabajo le da mando al tercero, y la regla que lo gobierna es que **son tres tiempos
distintos y un gesto no puede mover dos**: recorrer la demostración no arranca un
descanso, y el descanso no para la demostración.

## Cómo se dispara el control

Para la capa de pruebas, que es quien va a emular el toque:

- **Selector del control**: el disco del mando,
  `button[aria-label^="Mando del reloj de la pared"]`. Es el mismo botón de siempre; no hay
  ningún control nuevo en pantalla.
- **Gesto**: bajar el dedo sobre el disco y **AGUANTAR sin salir de la zona muerta** (16 px,
  `ZONA_MUERTA`) durante `ESPERA_DEL_RECORRIDO` = **420 ms**. A partir de ahí el mando se
  queda con la repetición: la demostración se pausa y el dedo la recorre moviéndose en
  horizontal. Al levantar el dedo, la demostración sigue por donde la dejaron.
- **Coordenadas**: `RECORRIDO_COMPLETO` = **180 px** de dedo es una repetición entera.
  Desde el punto donde bajó el dedo, `dx = +180` lleva la fase a 1 (el fondo del recorrido)
  y `dx = −180`, a 0. Es proporcional y con topes: pasarse por la derecha deja la fase en 1
  y quieta.
- **Qué se lee**: nada nuevo en pantalla. Lo que cambia se ve **en el sujeto**, que se para
  y se mueve con el dedo. Desde fuera, el estado del mando se consulta con
  `repeticionPausada()` y `faseDelMando()` de `visor/controlDelTiempo.ts`.
- **Qué NO pasa**: mientras dura ese gesto el mando no emite rumbo, así que `onSoltar` no
  corre y el reloj de la pared se queda exactamente como estaba. Un tirón corto —bajar,
  tirar y soltar antes de los 420 ms— sigue haciendo lo de siempre.

Con toque emulado (`Input.dispatchTouchEvent`), la secuencia es: `touchStart` en el centro
del disco → esperar ≥ 500 ms → `touchMove` en pasos de 15 px hasta +180 px en X (misma Y)
→ `touchEnd`. En jsdom hay que disparar `MouseEvent('pointerdown'|'pointermove'|'pointerup')`
con `clientX`/`clientY`: `fireEvent.pointerMove` cae a un `Event` genérico y las
coordenadas se pierden por el camino.

## Qué se ha construido

**`visor/controlDelTiempo.ts`** pasa de ser una puerta a ser un mando:

| Función | Qué hace |
|---|---|
| `pausarLaRepeticion()` | Congela el RELOJ del gesto, no la fase: la fase sola no dice si el sujeto subía o bajaba. |
| `reanudarLaRepeticion()` | Sigue desde donde el dedo la dejó, moviendo el desfase. Sin salto. |
| `irALaFase(f)` | Lleva la demostración a la fase `f` (0…1). Pausa si no lo estaba. |
| `ponerLaVelocidad(v)` / `laVelocidad()` | Multiplicador del reloj del gesto. El cambio no da un salto: se recoloca el desfase. |
| `faseAhora()` | Dónde está el sujeto ahora, para empezar a recorrer AHÍ y no en el principio. |
| `repeticionPausada()` / `faseDelMando()` | Lo que hace falta para mirarlo desde fuera. |
| `soltarElTiempo()` | Devuelve el mando a su sitio. El estado es de módulo, así que lo que uno deje puesto se lo encuentra el siguiente. |
| `tiempoDeLaFase(f)` | La vuelta de `faseDeTiempo`, por muestreo. La curva del ciclo lleva tabla, suavizado y asentamiento: escribir su inversa a mano sería escribirla dos veces. |

`faseDeTiempo` sigue siendo la misma función para quien no toca el mando: mismo ciclo,
misma curva, mismo asentamiento. Con el mando puesto, manda el mando.

**`salon/mando/rumboDelJoystick.ts`** se lleva la aritmética nueva —`ESPERA_DEL_RECORRIDO`,
`RECORRIDO_COMPLETO` y `faseDelRecorrido(dx, faseAlAgarrar)`— por el mismo motivo por el
que ya tenía la del rumbo: un umbral escrito dentro de un manejador de puntero solo se
puede probar montando el componente y moviendo un dedo falso.

**`salon/mando/Joystick.tsx`** gana tres avisos opcionales (`onTomarElTiempo`,
`onRecorrer`, `onSoltarElTiempo`) y el temporizador de la espera. `onTomarElTiempo`
devuelve la fase en la que estaba la demostración, para que el primer píxel de dedo no la
teletransporte.

**`salon/SalonEntrenar.tsx`** los engancha, y nada más: un bloque de siete líneas junto al
`<Joystick>`. No se ha tocado `conSujeto`, ni la condición que cae a `<SalonSinSujeto>`,
ni el gancho del cardio.

## Por qué aguantar, y por qué esto no rompe el kit

La regla del mando es que **todo lo que cambia se lee en la pared, nunca sobre el mando**.
Aquí lo que cambia se lee en el SUJETO: se para y se mueve con el dedo. El disco sigue sin
rotular nada, y el gesto se descubre igual que el otro —tirando, aguantando— y no leyendo
una etiqueta.

Aguantar y tirar se separan por el tiempo y no por la dirección porque las cuatro
direcciones ya están cogidas (descanso, excéntrico, carga y reposo), y porque el reparto
ya existe en esta app: sobre el cuerpo, tocar y aguantar son dos cosas distintas
(`capas/hundirEnElCuerpo.ts`, 320 ms). Aquí son 420 ms, un pelo más largo, porque el tirón
corto tiene que seguir siendo cómodo.

La profundidad **sigue siendo el eje W**: este gesto es del disco y el eje W es del cuerpo.
No comparten superficie ni se pisan.

## Cómo se comprobó

```
$ npx vitest run src/features/entrenar/salon/mando/tiempoDeLaRepeticion.test.tsx
 ✓ aguantar el disco para la demostración y el dedo la lleva de 0 a 1 y de vuelta
 ✓ el descanso y el reloj de sesión valen lo mismo antes y después
 ✓ un tirón corto sigue cambiando lo que cuenta la pared, y no toca la repetición
 ✓ si el salón se cierra con el dedo puesto, la demostración no se queda congelada
 ✓ el recorrido empieza donde está el sujeto, no en el principio del gesto
 Test Files  1 passed (1)
      Tests  5 passed (5)

$ npx vitest run src/features/entrenar/salon/salon.test.tsx
 Test Files  1 passed (1)
      Tests  25 passed (25)      # incluida la regla dura de cero texto sobre el lienzo
```

La primera prueba mide el recorrido en 24 pasos —doce de ida y doce de vuelta— y exige
que ningún salto pase de 0,1 de fase: un recorrido a trompicones no sirve para lo que se
quiere, que es pararse en el punto donde el codo pasa por 90°.

La cuarta se vio fallar a propósito antes de darla por buena: quitando la limpieza del
desmontaje del `Joystick`, `expected true to be false`. Cubre el caso que dejaría la peor
avería posible y muda —el salón se cierra con el dedo todavía encima, `alSoltarDedo` no
corre nunca, y como el mando del tiempo es de módulo y sobrevive al componente, el
siguiente que abriera el salón vería un sujeto congelado sin un solo error en ninguna
parte.

La tercera existe para que la segunda signifique algo: si el instrumento no supiera mover
el rótulo del muro, «vale lo mismo antes y después» sería verde en vacío. Con un tirón
corto a la izquierda el muro pasa a contar el descanso, y eso se ve.

## Qué queda

- **La velocidad no tiene mando todavía.** `ponerLaVelocidad` está construida y probada
  por el tipo, pero ningún gesto la llama: el disco solo pausa y recorre. Cuando se decida
  el gesto (lo natural sería el eje vertical del mismo disco mientras se recorre) ya hay
  dónde enchufarlo, y el cambio no dará saltos.
- **El estado del tiempo es de módulo**, así que dos visores a la vez compartirían mando.
  Hoy solo hay uno montado a la vez; si algún día hay dos, esto pide un identificador.
- **Nadie avisa de que la demostración está pausada** más que la propia demostración. Es a
  propósito —un cartel encima del sujeto rompería la regla del salón— pero conviene que la
  decisión esté escrita: si alguien la echa de menos, el sitio es la pared, no el mando.
- **El testigo con toque emulado lo levanta la capa de pruebas.** Aquí queda dicho el
  selector, el gesto y las coordenadas.
