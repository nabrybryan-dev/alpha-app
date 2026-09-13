# La pregunta del coach, debajo del vídeo — 2026-09-12

## Qué

En **Hoy**, dentro de «Tu revisión de la semana», debajo de la tarjeta de números, una
tarjeta con **la pregunta pendiente del coach** —el texto entero— y un botón **Responder**
que lleva al chat.

## Por qué

Decisión de Bryan del 2026-09-12, permitiendo cambiar el diseño que se había fijado: el
mensaje con la pregunta tiene que verse **debajo del vídeo**, sin entrar al chat. Ese mismo
día se decidió en `cerebro-alpha` el riesgo escalonado: una zona amarilla sin firma ya no
para el plan, se le pregunta a la persona y **de su respuesta depende si sigue o se para**.
Hasta ahora esa pregunta solo asomaba recortada en una línea dentro de «Escríbele a tu coach».

## Cuál es «la pregunta pendiente» (`domain/preguntaDelCoach.ts`)

El último mensaje del hilo con el coach, si:

1. es **del coach** (si lo último es de la persona, ya contestó);
2. es **humano**, no una respuesta automática del Centro (`origen: 'alpha'`);
3. **pregunta algo** (lleva `?`). Un «buen trabajo» no se queda pegado bajo el vídeo.

Cuando la persona contesta, desaparece sola.

## Lo que NO cambia

- La tarjeta de números y la barra del coach siguen donde estaban.
- No hay migración ni cambio en la base: los mensajes ya están en el almacén local.
- No se marca nada como leído al enseñarla: eso sigue pasando al abrir el chat.
